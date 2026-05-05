/**
 * Cliente GitHub para leer ficheros y crear ramas + commits + PRs desde
 * el chat de Factory.
 *
 * Por qué existe:
 *   En producción serverless (Vercel) el filesystem es read-only, así que
 *   las read/write tools de código (read_repo_file, write_repo_file,
 *   patch_repo_file) están gateadas. La forma correcta de leer y modificar
 *   el repo desde el chat de producción es vía GitHub API:
 *     - Lectura: Contents API (GET /repos/{}/{}/contents/{path}). Para
 *       ficheros >1MB la Contents API rechaza, fallback a Git Blobs API.
 *     - Escritura: Git Data API (blobs/trees/commits/refs) + Pulls API.
 *       El chat genera el cambio, lo sube a rama nueva, abre PR contra
 *       main. Jorge revisa+mergea desde web/móvil. Vercel auto-despliega.
 *
 * Diseño:
 *   - Usa la Git Data API (blobs/trees/commits/refs) para meter N ficheros
 *     en UN solo commit. La Contents API (PUT /contents) hace 1 commit por
 *     fichero, lo que ensucia el historial.
 *   - Toda mutación va con un commit message que incluye trazas del chat:
 *     conversation id, operator email, intención.
 *   - Whitelist de paths (igual que write_repo_file): src/, docs/, scripts/,
 *     prisma/schema.prisma. Defensa contra el modelo intentando tocar
 *     .env, secrets, .git/, etc.
 *   - Tamaño máximo por fichero: 500 KB. Tamaño máximo total por commit:
 *     2 MB. Si necesitas más, parte la operación en varios PRs.
 *
 * Auth:
 *   GITHUB_TOKEN como env var. Fine-grained PAT con scope `repo`
 *   (Contents: read+write, Pull requests: read+write) sobre el repo
 *   `jorgesantovena/prontara-factory`. Vive en Vercel + .env.local.
 *
 * Repo target:
 *   GITHUB_REPO env var (default "jorgesantovena/prontara-factory") por si
 *   en el futuro hay que apuntar a un fork o a una mirror.
 */

import path from "node:path";

const GITHUB_API = "https://api.github.com";
const DEFAULT_REPO = "jorgesantovena/prontara-factory";
const DEFAULT_BASE_BRANCH = "main";

const MAX_FILE_BYTES = 500_000;
const MAX_TOTAL_BYTES = 2_000_000;

const PATH_WHITELIST_PREFIXES = ["src/", "docs/", "scripts/"];
const PATH_WHITELIST_EXACT = new Set<string>(["prisma/schema.prisma"]);
const PATH_DENY_PATTERNS = [
  /(^|\/)\.env(\..+)?$/i,
  /(^|\/)node_modules(\/|$)/i,
  /(^|\/)\.git(\/|$)/i,
  /(^|\/)data(\/|$)/i,
  /(^|\/)\.next(\/|$)/i,
  /(^|\/)\.prontara(\/|$)/i,
];

export type GitHubFileSpec = {
  path: string;
  content: string;
  /** Defaults a "100644" (regular file). "100755" para shell scripts. */
  mode?: "100644" | "100755";
};

export type CommitToGitHubInput = {
  /** Si no se da, se genera "chat/<timestamp>-<random>". */
  branch?: string;
  /** Default "main". */
  baseBranch?: string;
  files: GitHubFileSpec[];
  /** Mensaje principal del commit. El audit trail se añade automáticamente. */
  message: string;
  /** Título del PR. Default usa el message. */
  prTitle?: string;
  /** Cuerpo del PR. Default genera uno con metadata del chat. */
  prBody?: string;
  /** Si true, no crea el PR (solo el commit y la rama). Default false. */
  skipPr?: boolean;
  /** Si true, abre como draft. Default false. */
  draft?: boolean;
};

export type CommitToGitHubResult = {
  branch: string;
  commitSha: string;
  commitUrl: string;
  filesChanged: string[];
  prNumber: number | null;
  prUrl: string | null;
  prDraft: boolean;
};

/** Contexto del operador para incluir en el commit message y PR body. */
export type GitHubOperatorContext = {
  email: string;
  conversationId: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getRepo(): { owner: string; repo: string } {
  const value = String(process.env.GITHUB_REPO || DEFAULT_REPO).trim();
  const [owner, repo] = value.split("/");
  if (!owner || !repo) {
    throw new Error(
      "GITHUB_REPO mal formado. Esperado 'owner/repo', recibido '" + value + "'.",
    );
  }
  return { owner, repo };
}

function getToken(): string {
  const token = String(process.env.GITHUB_TOKEN || "").trim();
  if (!token) {
    throw new Error(
      "Falta GITHUB_TOKEN en el entorno. Sin token no puedo modificar el repo. Pídele a Jorge que lo configure (Vercel + .env.local).",
    );
  }
  return token;
}

function ghHeaders(): Record<string, string> {
  return {
    Authorization: "Bearer " + getToken(),
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "prontara-factory-chat",
    "Content-Type": "application/json",
  };
}

async function ghFetch<T>(
  method: string,
  endpoint: string,
  body?: unknown,
): Promise<T> {
  const { owner, repo } = getRepo();
  const url =
    endpoint.startsWith("/repos/") || endpoint.startsWith("/user")
      ? GITHUB_API + endpoint
      : GITHUB_API + "/repos/" + owner + "/" + repo + endpoint;

  const response = await fetch(url, {
    method,
    headers: ghHeaders(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (!response.ok) {
    const detail =
      parsed && typeof parsed === "object" && "message" in parsed
        ? (parsed as { message?: string }).message
        : String(parsed);
    throw new Error(
      "GitHub API " +
        method +
        " " +
        url +
        " → " +
        response.status +
        ": " +
        (detail || "(sin detalle)"),
    );
  }

  return parsed as T;
}

function normalizePath(input: string): string {
  const cleaned = path
    .normalize(String(input || "").replace(/\\/g, "/"))
    .replace(/^(\.\/)+/, "");
  return cleaned;
}

function assertPathAllowed(rel: string) {
  const norm = normalizePath(rel);
  if (!norm) {
    throw new Error("Ruta vacía.");
  }
  if (norm.startsWith("..") || norm.startsWith("/")) {
    throw new Error("Ruta fuera del repo: '" + rel + "'.");
  }
  for (const pattern of PATH_DENY_PATTERNS) {
    if (pattern.test(norm)) {
      throw new Error(
        "Ruta prohibida: '" + rel + "' (deny pattern " + pattern.source + ").",
      );
    }
  }
  if (PATH_WHITELIST_EXACT.has(norm)) return;
  const allowed = PATH_WHITELIST_PREFIXES.some((p) => norm.startsWith(p));
  if (!allowed) {
    throw new Error(
      "Ruta no permitida: '" +
        rel +
        "'. Solo se puede commitear dentro de: " +
        [...PATH_WHITELIST_PREFIXES, ...PATH_WHITELIST_EXACT].join(", "),
    );
  }
}

function generateBranchName(): string {
  const ts = new Date()
    .toISOString()
    .replace(/[:.]/g, "")
    .replace("T", "-")
    .slice(0, 15);
  const rand = Math.random().toString(36).slice(2, 8);
  return "chat/" + ts + "-" + rand;
}

function buildCommitMessage(
  baseMessage: string,
  ctx: GitHubOperatorContext,
): string {
  const trimmed = String(baseMessage || "").trim() || "Cambio desde Factory chat";
  // Convención: primera línea = título corto. Después blank line + audit trail.
  return (
    trimmed +
    "\n\n" +
    "Origen: Factory chat\n" +
    "Operador: " +
    ctx.email +
    "\n" +
    "Conversation: " +
    ctx.conversationId +
    "\n"
  );
}

function buildPrBody(
  baseMessage: string,
  files: GitHubFileSpec[],
  ctx: GitHubOperatorContext,
): string {
  const lines: string[] = [];
  lines.push("## Cambio propuesto desde el chat de Prontara Factory");
  lines.push("");
  lines.push(String(baseMessage || "").trim() || "(sin descripción)");
  lines.push("");
  lines.push("## Ficheros tocados");
  lines.push("");
  for (const f of files) {
    lines.push("- `" + normalizePath(f.path) + "` (" + f.content.length + " bytes)");
  }
  lines.push("");
  lines.push("## Trazabilidad");
  lines.push("");
  lines.push("- Operador: `" + ctx.email + "`");
  lines.push("- Conversation: `" + ctx.conversationId + "`");
  lines.push("");
  lines.push(
    "> Este PR se ha generado automáticamente desde el chat. Revisa los cambios antes de hacer merge. Vercel desplegará automáticamente tras el merge a `main`.",
  );
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// GitHub API wrappers (low-level)
// ---------------------------------------------------------------------------

type RefResponse = {
  ref: string;
  object: { sha: string; type: string; url: string };
};

type CommitResponse = {
  sha: string;
  url: string;
  html_url?: string;
  tree: { sha: string };
};

type TreeResponse = { sha: string; url: string };
type BlobResponse = { sha: string; url: string };
type PrResponse = {
  number: number;
  html_url: string;
  draft?: boolean;
};

async function getBranchHeadSha(branch: string): Promise<string> {
  const ref = await ghFetch<RefResponse>(
    "GET",
    "/git/ref/heads/" + encodeURIComponent(branch),
  );
  return ref.object.sha;
}

async function getCommit(sha: string): Promise<CommitResponse> {
  return ghFetch<CommitResponse>(
    "GET",
    "/git/commits/" + encodeURIComponent(sha),
  );
}

async function createBranch(name: string, fromSha: string): Promise<void> {
  await ghFetch<RefResponse>("POST", "/git/refs", {
    ref: "refs/heads/" + name,
    sha: fromSha,
  });
}

async function branchExists(name: string): Promise<boolean> {
  try {
    await getBranchHeadSha(name);
    return true;
  } catch {
    return false;
  }
}

async function createBlob(content: string): Promise<BlobResponse> {
  // Mandamos siempre como utf-8 — los ficheros que el chat puede crear son
  // texto (ts/tsx/md/json/prisma). Para binarios habría que codificar
  // base64 + encoding:"base64".
  return ghFetch<BlobResponse>("POST", "/git/blobs", {
    content,
    encoding: "utf-8",
  });
}

async function createTree(
  baseTreeSha: string,
  blobs: Array<{ path: string; sha: string; mode: string }>,
): Promise<TreeResponse> {
  return ghFetch<TreeResponse>("POST", "/git/trees", {
    base_tree: baseTreeSha,
    tree: blobs.map((b) => ({
      path: b.path,
      mode: b.mode,
      type: "blob",
      sha: b.sha,
    })),
  });
}

async function createCommit(
  message: string,
  treeSha: string,
  parentSha: string,
): Promise<CommitResponse> {
  return ghFetch<CommitResponse>("POST", "/git/commits", {
    message,
    tree: treeSha,
    parents: [parentSha],
  });
}

async function updateBranchRef(
  branch: string,
  sha: string,
): Promise<RefResponse> {
  return ghFetch<RefResponse>(
    "PATCH",
    "/git/refs/heads/" + encodeURIComponent(branch),
    { sha, force: false },
  );
}

async function createPullRequest(
  title: string,
  body: string,
  head: string,
  base: string,
  draft: boolean,
): Promise<PrResponse> {
  return ghFetch<PrResponse>("POST", "/pulls", {
    title,
    body,
    head,
    base,
    draft,
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function commitFilesToGitHubPr(
  input: CommitToGitHubInput,
  operator: GitHubOperatorContext,
): Promise<CommitToGitHubResult> {
  // 1. Validación de entrada
  if (!Array.isArray(input.files) || input.files.length === 0) {
    throw new Error("Hay que pasar al menos un fichero en `files`.");
  }
  let totalBytes = 0;
  for (const f of input.files) {
    assertPathAllowed(f.path);
    const size = Buffer.byteLength(String(f.content || ""), "utf8");
    if (size > MAX_FILE_BYTES) {
      throw new Error(
        "Fichero demasiado grande: '" +
          f.path +
          "' (" +
          size +
          " bytes, máx " +
          MAX_FILE_BYTES +
          ").",
      );
    }
    totalBytes += size;
  }
  if (totalBytes > MAX_TOTAL_BYTES) {
    throw new Error(
      "Commit demasiado grande (" +
        totalBytes +
        " bytes, máx " +
        MAX_TOTAL_BYTES +
        "). Parte el cambio en varios PRs.",
    );
  }

  const baseBranch = String(input.baseBranch || DEFAULT_BASE_BRANCH).trim();
  const targetBranch = String(input.branch || generateBranchName()).trim();

  // 2. Obtenemos head sha de baseBranch.
  const baseSha = await getBranchHeadSha(baseBranch);
  const baseCommit = await getCommit(baseSha);

  // 3. Creamos rama nueva si no existe (idempotente: si existe, hacemos
  //    el commit encima de su head actual).
  let branchHeadSha = baseSha;
  if (await branchExists(targetBranch)) {
    branchHeadSha = await getBranchHeadSha(targetBranch);
  } else {
    await createBranch(targetBranch, baseSha);
    branchHeadSha = baseSha;
  }

  // 4. Para hacer el commit encima de la rama (no de main) necesitamos el
  //    tree del head actual de la rama, no el de main.
  const branchHeadCommit = await getCommit(branchHeadSha);

  // 5. Creamos blob por fichero, luego un único tree, luego un commit.
  const blobs: Array<{ path: string; sha: string; mode: string }> = [];
  for (const f of input.files) {
    const blob = await createBlob(String(f.content));
    blobs.push({
      path: normalizePath(f.path),
      sha: blob.sha,
      mode: f.mode || "100644",
    });
  }

  const tree = await createTree(branchHeadCommit.tree.sha, blobs);
  const commitMessage = buildCommitMessage(input.message, operator);
  const newCommit = await createCommit(commitMessage, tree.sha, branchHeadSha);

  // 6. Actualizamos la rama para apuntar al nuevo commit.
  await updateBranchRef(targetBranch, newCommit.sha);

  // 7. Abrimos PR contra base.
  let prNumber: number | null = null;
  let prUrl: string | null = null;
  let prDraft = false;
  if (!input.skipPr) {
    const prTitle = String(input.prTitle || input.message).trim().slice(0, 200);
    const prBody = String(
      input.prBody || buildPrBody(input.message, input.files, operator),
    );
    const pr = await createPullRequest(
      prTitle,
      prBody,
      targetBranch,
      baseBranch,
      Boolean(input.draft),
    );
    prNumber = pr.number;
    prUrl = pr.html_url;
    prDraft = Boolean(pr.draft);
  }

  // baseCommit no se usa luego; lo dejamos calculado por si en debug
  // queremos saber desde qué main hicimos el branch.
  void baseCommit;

  return {
    branch: targetBranch,
    commitSha: newCommit.sha,
    commitUrl: newCommit.html_url || newCommit.url,
    filesChanged: input.files.map((f) => normalizePath(f.path)),
    prNumber,
    prUrl,
    prDraft,
  };
}

// ===========================================================================
// READ — Contents API + Git Blobs API
// ===========================================================================

const READ_WHITELIST_PREFIXES = [
  "src/",
  "docs/",
  "scripts/",
  "prisma/",
  "package.json",
  "tsconfig.json",
  "README.md",
  "next.config.ts",
  ".github/",
];

const READ_DENY_PATTERNS = [
  /(^|\/)\.env(\..+)?$/i,
  /(^|\/)node_modules(\/|$)/i,
  /(^|\/)\.git(\/|$)/i,
  /(^|\/)data(\/|$)/i,
  /(^|\/)\.next(\/|$)/i,
];

/** Tope para devolver el contenido al chat. Más grande dispara fallback Git Blobs API. */
const READ_INLINE_MAX_BYTES = 1_000_000; // 1 MB
/** Tope absoluto: por encima rechazamos para no inundar el contexto. */
const READ_ABSOLUTE_MAX_BYTES = 5_000_000; // 5 MB

function assertReadPathAllowed(rel: string) {
  const norm = normalizePath(rel);
  if (!norm) {
    throw new Error("Ruta vacía.");
  }
  if (norm.startsWith("..") || norm.startsWith("/")) {
    throw new Error("Ruta fuera del repo: '" + rel + "'.");
  }
  for (const pattern of READ_DENY_PATTERNS) {
    if (pattern.test(norm)) {
      throw new Error(
        "Ruta prohibida para lectura: '" +
          rel +
          "' (deny pattern " +
          pattern.source +
          ").",
      );
    }
  }
  // Para directorios el path puede ser exactamente "src" o "src/" → normalizamos.
  const allowed = READ_WHITELIST_PREFIXES.some(
    (p) => norm === p.replace(/\/$/, "") || norm.startsWith(p),
  );
  if (!allowed) {
    throw new Error(
      "Ruta no permitida para lectura: '" +
        rel +
        "'. Whitelist: " +
        READ_WHITELIST_PREFIXES.join(", "),
    );
  }
}

type ContentsFileResponse = {
  type: "file";
  size: number;
  name: string;
  path: string;
  sha: string;
  content?: string;
  encoding?: string;
  /** Cuando size > 1 MB la Contents API responde sin content y hay que ir a blobs. */
  download_url?: string | null;
};

type ContentsDirEntry = {
  type: "file" | "dir" | "symlink" | "submodule";
  size: number;
  name: string;
  path: string;
  sha: string;
};

type BlobLargeResponse = {
  sha: string;
  size: number;
  content: string;
  encoding: string;
};

export type ReadGitHubFileInput = {
  path: string;
  /** Default "main". Puede ser nombre de rama, tag o SHA. */
  ref?: string;
  /** Bytes a devolver al inicio del fichero. Default 8000, máx 80000. */
  byteLimit?: number;
  /** Offset desde el cual leer. Default 0. */
  byteOffset?: number;
};

export type ReadGitHubFileResult = {
  path: string;
  ref: string;
  sha: string;
  totalSize: number;
  returnedBytes: number;
  truncated: boolean;
  content: string;
};

export async function readGitHubFile(
  input: ReadGitHubFileInput,
): Promise<ReadGitHubFileResult> {
  const rel = String(input.path || "").trim();
  assertReadPathAllowed(rel);
  const norm = normalizePath(rel);
  const ref = String(input.ref || DEFAULT_BASE_BRANCH).trim();

  // 1. Pedir Contents API
  const endpoint =
    "/contents/" +
    norm.split("/").map(encodeURIComponent).join("/") +
    "?ref=" +
    encodeURIComponent(ref);

  const meta = await ghFetch<ContentsFileResponse | ContentsDirEntry[]>(
    "GET",
    endpoint,
  );

  if (Array.isArray(meta)) {
    throw new Error(
      "La ruta '" +
        rel +
        "' es un directorio, no un fichero. Usa list_github_dir para listarlo.",
    );
  }

  if (meta.type !== "file") {
    throw new Error(
      "Tipo no soportado para '" + rel + "': " + meta.type + ".",
    );
  }

  if (meta.size > READ_ABSOLUTE_MAX_BYTES) {
    throw new Error(
      "Fichero demasiado grande (" +
        meta.size +
        " bytes, máx " +
        READ_ABSOLUTE_MAX_BYTES +
        "). No se devuelve para no inundar contexto.",
    );
  }

  let raw: string;

  if (meta.content && meta.encoding === "base64") {
    // Contents API devuelve content con saltos de línea cada 60 chars que
    // hay que limpiar antes de decodificar.
    const cleaned = meta.content.replace(/\s/g, "");
    raw = Buffer.from(cleaned, "base64").toString("utf-8");
  } else {
    // Fichero >1 MB: fallback Git Blobs API por SHA.
    const blob = await ghFetch<BlobLargeResponse>(
      "GET",
      "/git/blobs/" + encodeURIComponent(meta.sha),
    );
    if (blob.encoding !== "base64") {
      throw new Error(
        "Encoding inesperado en blob " + meta.sha + ": " + blob.encoding,
      );
    }
    const cleaned = blob.content.replace(/\s/g, "");
    raw = Buffer.from(cleaned, "base64").toString("utf-8");
  }

  const offset = Math.max(0, input.byteOffset || 0);
  const limit = Math.max(1, Math.min(input.byteLimit || 8_000, 80_000));
  const slice = raw.slice(offset, offset + limit);
  const truncated = raw.length > offset + limit;

  return {
    path: norm,
    ref,
    sha: meta.sha,
    totalSize: meta.size,
    returnedBytes: Buffer.byteLength(slice, "utf-8"),
    truncated,
    content: slice,
  };
}

export type ListGitHubDirInput = {
  path: string;
  ref?: string;
};

export type ListGitHubDirEntry = {
  name: string;
  path: string;
  type: "file" | "dir" | "symlink" | "submodule";
  size: number;
};

export type ListGitHubDirResult = {
  path: string;
  ref: string;
  entries: ListGitHubDirEntry[];
};

export async function listGitHubDir(
  input: ListGitHubDirInput,
): Promise<ListGitHubDirResult> {
  const rel = String(input.path || "").trim() || "src";
  assertReadPathAllowed(rel);
  const norm = normalizePath(rel);
  const ref = String(input.ref || DEFAULT_BASE_BRANCH).trim();

  const endpoint =
    "/contents/" +
    norm.split("/").map(encodeURIComponent).join("/") +
    "?ref=" +
    encodeURIComponent(ref);

  const meta = await ghFetch<ContentsFileResponse | ContentsDirEntry[]>(
    "GET",
    endpoint,
  );

  if (!Array.isArray(meta)) {
    throw new Error(
      "La ruta '" +
        rel +
        "' es un fichero, no un directorio. Usa read_github_file para leerlo.",
    );
  }

  return {
    path: norm,
    ref,
    entries: meta.map((entry) => ({
      name: entry.name,
      path: entry.path,
      type: entry.type,
      size: entry.size,
    })),
  };
}
// READ_INLINE_MAX_BYTES queda como constante de referencia; se respeta vía
// el threshold de 1MB que hace que content venga vacío en Contents API y
// dispare el fallback a blobs.
void READ_INLINE_MAX_BYTES;
