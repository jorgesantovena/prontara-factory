/**
 * Índice BM25 del codebase para búsquedas rápidas del chat.
 *
 * Por qué BM25 y no embeddings "de verdad":
 *   Anthropic no ofrece API de embeddings. El partner recomendado es
 *   Voyage AI, pero añadir otro proveedor (con su API key, su coste, su
 *   cuota) es overhead que no está justificado todavía. BM25 sobre
 *   chunks rinde sorprendentemente bien para código y documentación
 *   donde los términos importantes suelen ser literales (nombres de
 *   funciones, keys, paths) — exactamente el caso de uso del chat.
 *
 * Cuando en el futuro queramos semántica de verdad (p.ej. "buscar
 * lógica relacionada con cancelación sin mencionar 'cancel'"), este
 * módulo se puede reemplazar por un vector index manteniendo la API
 * pública (searchCodebase) idéntica.
 *
 * Índice en memoria con TTL de 10 min. Se reconstruye bajo demanda.
 */
import fs from "node:fs";
import path from "node:path";

const SEARCH_ROOTS = ["src", "docs", "scripts", "prisma"];
const FILE_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".mts",
  ".mjs",
  ".js",
  ".jsx",
  ".md",
  ".prisma",
  ".json",
];

const MAX_FILE_BYTES = 200_000; // ignoramos ficheros > 200 KB (generados, datos)
const CHUNK_LINES = 120; // líneas por chunk — balance entre granularidad y contexto
const INDEX_TTL_MS = 10 * 60 * 1000; // 10 min

const STOPWORDS = new Set([
  // castellano
  "el", "la", "los", "las", "un", "una", "unos", "unas", "y", "o", "de", "del",
  "que", "en", "a", "por", "para", "con", "sin", "no", "si", "es", "se",
  "me", "te", "lo", "le", "nos", "su", "sus", "al", "como", "ya", "qué",
  // inglés
  "the", "a", "an", "and", "or", "of", "in", "on", "at", "to", "for", "with",
  "is", "are", "was", "were", "be", "been", "being", "this", "that", "it",
  "not", "no", "but", "as", "by", "from", "if", "then", "else",
  // código/ruido común
  "const", "let", "var", "function", "return", "import", "export", "default",
  "type", "interface", "async", "await", "null", "undefined", "true", "false",
  "new", "this", "from", "as",
]);

type DocumentRecord = {
  id: string;
  path: string;
  startLine: number;
  endLine: number;
  tokens: string[];
  tokenFreq: Map<string, number>;
  length: number;
  snippet: string;
};

type CodebaseIndex = {
  builtAt: number;
  documents: DocumentRecord[];
  idf: Map<string, number>;
  avgLen: number;
};

let cachedIndex: CodebaseIndex | null = null;

function projectRoot(): string {
  return process.cwd();
}

function shouldSkipDir(name: string): boolean {
  if (name.startsWith(".")) return true;
  if (name === "node_modules") return true;
  if (name === "dist" || name === "build" || name === ".next") return true;
  return false;
}

function walk(root: string): string[] {
  const out: string[] = [];
  const abs = path.join(projectRoot(), root);
  if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) {
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) out.push(root);
    return out;
  }

  const stack: string[] = [root];
  while (stack.length > 0) {
    const rel = stack.pop()!;
    const dirAbs = path.join(projectRoot(), rel);
    const entries = fs.readdirSync(dirAbs, { withFileTypes: true });
    for (const entry of entries) {
      const childRel = path.join(rel, entry.name);
      if (entry.isDirectory()) {
        if (!shouldSkipDir(entry.name)) stack.push(childRel);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (!FILE_EXTENSIONS.includes(ext)) continue;
        const stat = fs.statSync(path.join(projectRoot(), childRel));
        if (stat.size > MAX_FILE_BYTES) continue;
        out.push(childRel.replace(/\\/g, "/"));
      }
    }
  }
  return out;
}

function tokenize(text: string): string[] {
  const tokens: string[] = [];
  const lowered = text.toLowerCase();
  // Separador ancho: cualquier cosa no alfanumérica ni subrayado.
  const parts = lowered.split(/[^a-z0-9_]+/);
  for (const raw of parts) {
    if (!raw || raw.length < 2 || raw.length > 30) continue;
    if (STOPWORDS.has(raw)) continue;
    // Ignora tokens puramente numéricos de 1-2 dígitos (ruido).
    if (/^\d+$/.test(raw) && raw.length < 3) continue;
    tokens.push(raw);
    // También indexamos subpalabras de camelCase / snake_case grandes.
    // "getSectorPackByKey" → ["get", "sector", "pack", "by", "key"]
    if (raw.length > 6) {
      const parts2 = raw.split(/_/);
      if (parts2.length > 1) {
        for (const p of parts2) {
          if (p.length >= 2 && !STOPWORDS.has(p)) tokens.push(p);
        }
      }
    }
  }
  return tokens;
}

function splitCamelSnake(word: string): string[] {
  // Usado en tokenización más profunda si hace falta — expone subpalabras
  // de un token largo para mejorar recall. No se usa directamente porque
  // `tokenize` ya maneja snake_case; esto queda como helper para futuros
  // tweaks.
  const parts: string[] = [];
  let buffer = "";
  for (const ch of word) {
    if (/[A-Z]/.test(ch) && buffer.length > 0) {
      parts.push(buffer.toLowerCase());
      buffer = "";
    }
    buffer += ch;
  }
  if (buffer) parts.push(buffer.toLowerCase());
  return parts;
}
// Export silencioso para evitar "unused" del helper.
export const __internalSplitCamelSnake = splitCamelSnake;

function chunkLines(content: string): Array<{ start: number; end: number; text: string }> {
  const lines = content.split(/\r?\n/);
  const chunks: Array<{ start: number; end: number; text: string }> = [];
  for (let i = 0; i < lines.length; i += CHUNK_LINES) {
    const slice = lines.slice(i, i + CHUNK_LINES);
    chunks.push({
      start: i + 1,
      end: Math.min(i + slice.length, lines.length),
      text: slice.join("\n"),
    });
  }
  if (chunks.length === 0) {
    chunks.push({ start: 1, end: 1, text: "" });
  }
  return chunks;
}

function buildDocument(
  filePath: string,
  chunkIndex: number,
  chunk: { start: number; end: number; text: string },
): DocumentRecord {
  const tokens = tokenize(chunk.text);
  const tokenFreq = new Map<string, number>();
  for (const t of tokens) {
    tokenFreq.set(t, (tokenFreq.get(t) || 0) + 1);
  }
  const snippet = chunk.text.slice(0, 400).trim();
  return {
    id: filePath + "#" + chunkIndex,
    path: filePath,
    startLine: chunk.start,
    endLine: chunk.end,
    tokens,
    tokenFreq,
    length: tokens.length,
    snippet,
  };
}

function buildIndex(): CodebaseIndex {
  const files: string[] = [];
  for (const root of SEARCH_ROOTS) {
    files.push(...walk(root));
  }

  const documents: DocumentRecord[] = [];
  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(projectRoot(), file), "utf8");
      const chunks = chunkLines(content);
      chunks.forEach((chunk, i) => {
        const doc = buildDocument(file, i, chunk);
        if (doc.length > 0) documents.push(doc);
      });
    } catch {
      // ignoramos ficheros que no se pueden leer
    }
  }

  // IDF por término: log((N - df + 0.5) / (df + 0.5) + 1)
  const df = new Map<string, number>();
  for (const doc of documents) {
    for (const term of doc.tokenFreq.keys()) {
      df.set(term, (df.get(term) || 0) + 1);
    }
  }
  const N = documents.length;
  const idf = new Map<string, number>();
  for (const [term, dfValue] of df.entries()) {
    idf.set(term, Math.log(((N - dfValue + 0.5) / (dfValue + 0.5)) + 1));
  }

  const totalLen = documents.reduce((acc, d) => acc + d.length, 0);
  const avgLen = N > 0 ? totalLen / N : 0;

  return {
    builtAt: Date.now(),
    documents,
    idf,
    avgLen,
  };
}

function getIndex(force = false): CodebaseIndex {
  if (!force && cachedIndex && Date.now() - cachedIndex.builtAt < INDEX_TTL_MS) {
    return cachedIndex;
  }
  cachedIndex = buildIndex();
  return cachedIndex;
}

// BM25 params — defaults estándar de la literatura.
const BM25_K1 = 1.5;
const BM25_B = 0.75;

function scoreDocument(doc: DocumentRecord, queryTerms: string[], idx: CodebaseIndex): number {
  let score = 0;
  for (const term of queryTerms) {
    const tf = doc.tokenFreq.get(term) || 0;
    if (tf === 0) continue;
    const termIdf = idx.idf.get(term) || 0;
    const denom = tf + BM25_K1 * (1 - BM25_B + BM25_B * (doc.length / (idx.avgLen || 1)));
    score += termIdf * ((tf * (BM25_K1 + 1)) / (denom || 1));
  }

  // Pequeño boost cuando el path del fichero contiene alguna palabra del
  // query — "dame clientes.ts" tiende a ser "encuéntrame ese fichero".
  const loweredPath = doc.path.toLowerCase();
  for (const term of queryTerms) {
    if (loweredPath.includes(term)) score *= 1.15;
  }
  return score;
}

export type CodebaseSearchResult = {
  path: string;
  startLine: number;
  endLine: number;
  score: number;
  snippet: string;
};

export type CodebaseSearchOptions = {
  query: string;
  limit?: number;
  pathFilter?: string;
  force?: boolean;
};

export function searchCodebase(options: CodebaseSearchOptions): {
  results: CodebaseSearchResult[];
  totalDocuments: number;
  indexAgeMs: number;
} {
  const query = String(options.query || "").trim();
  if (!query) {
    const idx = getIndex(false);
    return { results: [], totalDocuments: idx.documents.length, indexAgeMs: Date.now() - idx.builtAt };
  }

  const idx = getIndex(Boolean(options.force));
  const queryTerms = [...new Set(tokenize(query))];
  if (queryTerms.length === 0) {
    return { results: [], totalDocuments: idx.documents.length, indexAgeMs: Date.now() - idx.builtAt };
  }

  const pathFilterLower = (options.pathFilter || "").trim().toLowerCase();
  const limit = Math.max(1, Math.min(options.limit || 10, 50));

  const scored: Array<{ doc: DocumentRecord; score: number }> = [];
  for (const doc of idx.documents) {
    if (pathFilterLower && !doc.path.toLowerCase().includes(pathFilterLower)) continue;
    const score = scoreDocument(doc, queryTerms, idx);
    if (score > 0) scored.push({ doc, score });
  }
  scored.sort((a, b) => b.score - a.score);

  const top = scored.slice(0, limit).map(({ doc, score }) => ({
    path: doc.path,
    startLine: doc.startLine,
    endLine: doc.endLine,
    score: Number(score.toFixed(3)),
    snippet: doc.snippet,
  }));

  return {
    results: top,
    totalDocuments: idx.documents.length,
    indexAgeMs: Date.now() - idx.builtAt,
  };
}

export function getCodebaseIndexStats(): {
  documents: number;
  builtAt: string;
  avgDocLength: number;
  uniqueTerms: number;
} | null {
  if (!cachedIndex) return null;
  return {
    documents: cachedIndex.documents.length,
    builtAt: new Date(cachedIndex.builtAt).toISOString(),
    avgDocLength: Math.round(cachedIndex.avgLen),
    uniqueTerms: cachedIndex.idf.size,
  };
}

export function rebuildCodebaseIndex(): { builtAt: string; documents: number } {
  const idx = getIndex(true);
  return {
    builtAt: new Date(idx.builtAt).toISOString(),
    documents: idx.documents.length,
  };
}
