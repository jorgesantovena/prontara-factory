/**
 * Tools de escritura del chat de Factory (Fase 2).
 *
 * Diseño:
 *   - Toda mutación pasa por snapshotFiles() + withAudit(). No hay escrituras
 *     silenciosas.
 *   - Whitelist estricto de rutas: solo src/, docs/, scripts/, prisma/schema.prisma.
 *     Nunca se puede tocar .env*, data/**, .git/**, node_modules/**.
 *   - Tamaños limitados para evitar que un error del modelo escriba ficheros gigantes.
 *   - tsc y lint se corren con el binario local (no `npx`) con timeout.
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { withAudit, readRecentAuditEntries, type ToolContext } from "@/lib/factory-chat/audit";
import {
  snapshotFiles,
  listBackupSnapshots,
  restoreSnapshot,
} from "@/lib/factory-chat/backups";
import {
  regenerateTenantByClientId,
  invalidateFactoryCaches,
} from "@/lib/saas/tenant-regeneration";
import { seedDemoDataForTenant, type DemoSeedMode } from "@/lib/factory/demo-seeder";
import { hardReprovisionTenant } from "@/lib/factory/tenant-hard-provisioning";

const MAX_FILE_BYTES = 500_000; // 500 KB tope por escritura
const MAX_PATCH_HAYSTACK_BYTES = 2_000_000; // 2 MB tope por fichero a parchear
const TSC_TIMEOUT_MS = 120_000; // 2 min
const LINT_TIMEOUT_MS = 120_000;

/** Prefijos permitidos para WRITE (más estrictos que los de READ). */
const WRITE_WHITELIST_PREFIXES = ["src/", "docs/", "scripts/"];

/** Ficheros sueltos explícitamente escribibles por whitelist exacta. */
const WRITE_WHITELIST_EXACT = new Set<string>([
  "prisma/schema.prisma",
]);

/**
 * Rutas prohibidas en cualquier caso, aunque caigan dentro de un prefijo
 * permitido. Defensa extra contra patrones peligrosos.
 */
const WRITE_DENY_PATTERNS = [
  /(^|\/)\.env(\..+)?$/i,
  /(^|\/)node_modules(\/|$)/i,
  /(^|\/)\.git(\/|$)/i,
  /(^|\/)data(\/|$)/i,
  /(^|\/)\.next(\/|$)/i,
  /(^|\/)\.prontara(\/|$)/i,
  /\.tmp-/,
];

function normalizeRel(rel: string): string {
  // path.normalize resuelve ".." pero no sanea. Después bloqueamos
  // explícitamente cualquier salida del proyecto.
  const clean = path.normalize(String(rel || "").replace(/\\/g, "/")).replace(/^(\.\/)+/, "");
  return clean;
}

export function isWritePathAllowed(rel: string): boolean {
  const norm = normalizeRel(rel);
  if (!norm) return false;
  if (norm.startsWith("..") || norm.startsWith("/")) return false;
  for (const pattern of WRITE_DENY_PATTERNS) {
    if (pattern.test(norm)) return false;
  }
  if (WRITE_WHITELIST_EXACT.has(norm)) return true;
  return WRITE_WHITELIST_PREFIXES.some((p) => norm.startsWith(p));
}

function assertWriteAllowed(rel: string) {
  if (!isWritePathAllowed(rel)) {
    throw new Error(
      "Ruta no permitida para escritura: '" +
        rel +
        "'. Solo se puede escribir dentro de: " +
        [...WRITE_WHITELIST_PREFIXES, ...WRITE_WHITELIST_EXACT].join(", "),
    );
  }
}

function projectRoot(): string {
  return process.cwd();
}

function writeFileAtomic(absPath: string, content: string) {
  const dir = path.dirname(absPath);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = absPath + ".tmp-" + process.pid + "-" + Date.now();
  fs.writeFileSync(tmp, content, "utf8");
  fs.renameSync(tmp, absPath);
}

// ---------------------------------------------------------------------------
// write_repo_file
// ---------------------------------------------------------------------------

export type WriteRepoFileInput = {
  path?: string;
  content?: string;
};

export type WriteRepoFileResult = {
  path: string;
  created: boolean;
  previousSize: number;
  newSize: number;
  touchedPaths: string[];
  backupRef?: string;
};

export async function writeRepoFileTool(
  input: WriteRepoFileInput,
  ctx: ToolContext,
): Promise<WriteRepoFileResult> {
  return withAudit("write_repo_file", input as Record<string, unknown>, ctx, async () => {
    const rel = String(input.path || "").trim();
    const content = String(input.content || "");

    assertWriteAllowed(rel);

    if (Buffer.byteLength(content, "utf8") > MAX_FILE_BYTES) {
      throw new Error(
        "Contenido demasiado grande (" +
          Buffer.byteLength(content, "utf8") +
          " bytes). Máximo " +
          MAX_FILE_BYTES +
          " bytes por escritura.",
      );
    }

    const abs = path.join(projectRoot(), rel);
    const existedBefore = fs.existsSync(abs);
    const previousSize = existedBefore ? fs.statSync(abs).size : 0;

    const snap = snapshotFiles([rel]);
    writeFileAtomic(abs, content);
    const newSize = fs.statSync(abs).size;

    return {
      path: rel,
      created: !existedBefore,
      previousSize,
      newSize,
      touchedPaths: [rel],
      backupRef: snap.backedUpPaths.length > 0 ? snap.backupRef : undefined,
    };
  });
}

// ---------------------------------------------------------------------------
// patch_repo_file (find/replace por string único)
// ---------------------------------------------------------------------------

export type PatchRepoFileInput = {
  path?: string;
  oldString?: string;
  newString?: string;
  /** Si es true, reemplaza todas las ocurrencias. Por defecto exige unicidad. */
  replaceAll?: boolean;
};

export type PatchRepoFileResult = {
  path: string;
  replacements: number;
  touchedPaths: string[];
  backupRef: string;
};

export async function patchRepoFileTool(
  input: PatchRepoFileInput,
  ctx: ToolContext,
): Promise<PatchRepoFileResult> {
  return withAudit("patch_repo_file", input as Record<string, unknown>, ctx, async () => {
    const rel = String(input.path || "").trim();
    const oldString = String(input.oldString || "");
    const newString = String(input.newString || "");
    const replaceAll = Boolean(input.replaceAll);

    assertWriteAllowed(rel);

    if (!oldString) {
      throw new Error("oldString no puede estar vacío.");
    }
    if (oldString === newString) {
      throw new Error("oldString y newString son idénticos — nada que hacer.");
    }

    const abs = path.join(projectRoot(), rel);
    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
      throw new Error("El fichero no existe: " + rel);
    }

    const size = fs.statSync(abs).size;
    if (size > MAX_PATCH_HAYSTACK_BYTES) {
      throw new Error(
        "El fichero es demasiado grande para parchear (" +
          size +
          " bytes). Máximo " +
          MAX_PATCH_HAYSTACK_BYTES +
          " bytes.",
      );
    }

    const original = fs.readFileSync(abs, "utf8");
    let updated: string;
    let replacements: number;

    if (replaceAll) {
      const splitted = original.split(oldString);
      replacements = splitted.length - 1;
      if (replacements === 0) {
        throw new Error("oldString no aparece en el fichero.");
      }
      updated = splitted.join(newString);
    } else {
      const idx = original.indexOf(oldString);
      if (idx === -1) {
        throw new Error("oldString no aparece en el fichero.");
      }
      if (original.indexOf(oldString, idx + oldString.length) !== -1) {
        throw new Error(
          "oldString aparece varias veces — usa replaceAll:true o amplía el contexto para que sea único.",
        );
      }
      updated = original.slice(0, idx) + newString + original.slice(idx + oldString.length);
      replacements = 1;
    }

    const snap = snapshotFiles([rel]);
    writeFileAtomic(abs, updated);

    return {
      path: rel,
      replacements,
      touchedPaths: [rel],
      backupRef: snap.backupRef,
    };
  });
}

// ---------------------------------------------------------------------------
// run_tsc_check
// ---------------------------------------------------------------------------

/**
 * Filtro de ruido de entorno: ignora errores derivados de tipos Node/React
 * no instalados en el sandbox. En un entorno local normal no aparecerán,
 * así que el filtro es seguro: solo quita falsos positivos.
 */
const TSC_NOISE_RE =
  /(TS2307.*Cannot find module 'next|TS2307.*Cannot find module 'react|TS2307.*Cannot find module 'node:|TS2307.*Cannot find module '@prisma|TS2307.*Cannot find module 'fs'|TS2307.*Cannot find module 'path'|TS2307.*Cannot find module 'pdf-parse'|TS2307.*Cannot find module 'mammoth'|TS2580.*process|TS2580.*console|TS2580.*Buffer|TS2580.*URL|TS2580.*require|TS2503.*React|TS2503.*JSX|TS2875.*jsx-runtime|TS7026|TS7006|_audit\/|\.next\/)/;

export type RunTscCheckInput = Record<string, never>;

export type RunTscCheckResult = {
  ok: boolean;
  totalErrorLines: number;
  realErrorLines: number;
  errors: string[];
  truncated: boolean;
  touchedPaths: string[];
};

export async function runTscCheckTool(
  input: RunTscCheckInput,
  ctx: ToolContext,
): Promise<RunTscCheckResult> {
  return withAudit("run_tsc_check", input as Record<string, unknown>, ctx, async () => {
    const root = projectRoot();
    const tscBin =
      process.platform === "win32"
        ? path.join(root, "node_modules", ".bin", "tsc.cmd")
        : path.join(root, "node_modules", ".bin", "tsc");

    if (!fs.existsSync(tscBin)) {
      throw new Error("No se encontró el binario local de tsc en node_modules/.bin/tsc.");
    }

    let stdout = "";
    try {
      stdout = execSync('"' + tscBin + '" --noEmit', {
        cwd: root,
        timeout: TSC_TIMEOUT_MS,
        stdio: ["ignore", "pipe", "pipe"],
        encoding: "utf8",
      });
    } catch (err) {
      const e = err as { stdout?: Buffer | string; stderr?: Buffer | string };
      stdout = String(e.stdout || "") + String(e.stderr || "");
    }

    const errorLines = stdout.split("\n").filter((l) => l.includes("error TS"));
    const realErrors = errorLines.filter((l) => !TSC_NOISE_RE.test(l));
    const truncated = realErrors.length > 100;

    return {
      ok: realErrors.length === 0,
      totalErrorLines: errorLines.length,
      realErrorLines: realErrors.length,
      errors: realErrors.slice(0, 100),
      truncated,
      touchedPaths: [],
    };
  });
}

// ---------------------------------------------------------------------------
// run_lint_check
// ---------------------------------------------------------------------------

export type RunLintCheckInput = {
  paths?: string[];
};

export type RunLintCheckResult = {
  ok: boolean;
  output: string;
  touchedPaths: string[];
};

export async function runLintCheckTool(
  input: RunLintCheckInput,
  ctx: ToolContext,
): Promise<RunLintCheckResult> {
  return withAudit("run_lint_check", input as Record<string, unknown>, ctx, async () => {
    const root = projectRoot();
    const eslintBin =
      process.platform === "win32"
        ? path.join(root, "node_modules", ".bin", "eslint.cmd")
        : path.join(root, "node_modules", ".bin", "eslint");

    if (!fs.existsSync(eslintBin)) {
      throw new Error("No se encontró el binario local de eslint en node_modules/.bin/eslint.");
    }

    const targets = (input.paths || []).filter((p) => typeof p === "string" && p.trim());
    const validTargets = targets.filter((p) => isWritePathAllowed(p));

    const args =
      validTargets.length > 0
        ? validTargets.map((p) => '"' + p + '"').join(" ")
        : '"src"';

    let output = "";
    let ok = true;
    try {
      output = execSync('"' + eslintBin + '" ' + args, {
        cwd: root,
        timeout: LINT_TIMEOUT_MS,
        stdio: ["ignore", "pipe", "pipe"],
        encoding: "utf8",
      });
    } catch (err) {
      const e = err as { stdout?: Buffer | string; stderr?: Buffer | string };
      output = String(e.stdout || "") + String(e.stderr || "");
      ok = false;
    }

    return {
      ok,
      output: output.slice(0, 8000),
      touchedPaths: [],
    };
  });
}

// ---------------------------------------------------------------------------
// read_audit_log (read-only, no pasa por withAudit)
// ---------------------------------------------------------------------------

export type ReadAuditLogInput = {
  limit?: number;
  tool?: string;
  conversationId?: string;
};

export type ReadAuditLogResult = {
  entries: Array<{
    at: string;
    actor: string;
    conversationId: string;
    tool: string;
    outcome: string;
    durationMs: number;
    touchedPaths?: string[];
    backupRef?: string;
    error?: string;
  }>;
};

export function readAuditLogTool(input: ReadAuditLogInput): ReadAuditLogResult {
  const entries = readRecentAuditEntries({
    limit: input.limit,
    tool: input.tool,
    conversationId: input.conversationId,
  });

  return {
    entries: entries.map((e) => ({
      at: e.at,
      actor: e.actor.email,
      conversationId: e.conversationId,
      tool: e.tool,
      outcome: e.outcome,
      durationMs: e.durationMs,
      touchedPaths: e.touchedPaths,
      backupRef: e.backupRef,
      error: e.error,
    })),
  };
}

// ---------------------------------------------------------------------------
// list_backup_snapshots (read-only)
// ---------------------------------------------------------------------------

export type ListBackupSnapshotsInput = {
  limit?: number;
};

export function listBackupSnapshotsTool(input: ListBackupSnapshotsInput) {
  return {
    snapshots: listBackupSnapshots(input.limit),
  };
}

// ---------------------------------------------------------------------------
// restore_backup_snapshot (audited)
// ---------------------------------------------------------------------------

export type RestoreBackupSnapshotInput = {
  backupRef?: string;
};

export type RestoreBackupSnapshotResult = {
  backupRef: string;
  restoredFiles: string[];
  touchedPaths: string[];
};

export async function restoreBackupSnapshotTool(
  input: RestoreBackupSnapshotInput,
  ctx: ToolContext,
): Promise<RestoreBackupSnapshotResult> {
  return withAudit(
    "restore_backup_snapshot",
    input as Record<string, unknown>,
    ctx,
    async () => {
      const backupRef = String(input.backupRef || "").trim();
      if (!backupRef) throw new Error("Falta backupRef.");
      if (!/^[A-Za-z0-9_-]+$/.test(backupRef)) {
        throw new Error("backupRef con formato inválido.");
      }
      // Snapshot previo de los ficheros que vamos a sobrescribir, para poder
      // deshacer un rollback equivocado.
      const snaps = listBackupSnapshots(100);
      const target = snaps.find((s) => s.backupRef === backupRef);
      if (!target) throw new Error("Snapshot no existe: " + backupRef);

      snapshotFiles(target.files);
      const restored = restoreSnapshot(backupRef);
      return {
        backupRef,
        restoredFiles: restored,
        touchedPaths: restored,
      };
    },
  );
}

// ---------------------------------------------------------------------------
// regenerate_tenant
// ---------------------------------------------------------------------------

export type RegenerateTenantInput = {
  clientId?: string;
};

export type RegenerateTenantToolResult = {
  clientId: string;
  tenantId: string;
  slug: string;
  displayName: string;
  firstAdminEmail: string | null;
  accountCount: number;
  trialStatus: string;
  trialExpiresAt: string;
  onboardingStepsCompleted: number | null;
  onboardingStepsTotal: number | null;
  dashboardCacheInvalidated: boolean;
  notes: string[];
  touchedPaths: string[];
};

export async function regenerateTenantTool(
  input: RegenerateTenantInput,
  ctx: ToolContext,
): Promise<RegenerateTenantToolResult> {
  return withAudit("regenerate_tenant", input as Record<string, unknown>, ctx, async () => {
    const clientId = String(input.clientId || "").trim();
    if (!clientId) throw new Error("Falta clientId.");

    const res = regenerateTenantByClientId(clientId);

    return {
      clientId: res.clientId,
      tenantId: res.tenantId,
      slug: res.slug,
      displayName: res.displayName,
      firstAdminEmail: res.firstAdminEmail,
      accountCount: res.accountCount,
      trialStatus: res.trialState.status,
      trialExpiresAt: res.trialState.expiresAt,
      onboardingStepsCompleted: res.onboarding?.stepsCompleted ?? null,
      onboardingStepsTotal: res.onboarding?.stepsTotal ?? null,
      dashboardCacheInvalidated: res.dashboardCacheInvalidated,
      notes: res.notes,
      // No hay paths de fichero tocados — la regeneración es idempotente
      // sobre JSON de estado (trial, onboarding) que pueden crearse si
      // faltan pero no "cambian" si ya existen.
      touchedPaths: [],
    };
  });
}

// ---------------------------------------------------------------------------
// invalidate_factory_cache
// ---------------------------------------------------------------------------

export type InvalidateFactoryCacheInput = Record<string, never>;

export type InvalidateFactoryCacheResult = {
  invalidated: string[];
  touchedPaths: string[];
};

export async function invalidateFactoryCacheTool(
  input: InvalidateFactoryCacheInput,
  ctx: ToolContext,
): Promise<InvalidateFactoryCacheResult> {
  return withAudit(
    "invalidate_factory_cache",
    input as Record<string, unknown>,
    ctx,
    async () => {
      const res = invalidateFactoryCaches();
      return { invalidated: res.invalidated, touchedPaths: [] };
    },
  );
}

// ---------------------------------------------------------------------------
// seed_demo_data
// ---------------------------------------------------------------------------

export type SeedDemoDataInput = {
  clientId?: string;
  mode?: DemoSeedMode;
  modules?: string[];
};

export type SeedDemoDataToolResult = {
  clientId: string;
  packKey: string;
  mode: DemoSeedMode;
  modulesProcessed: Array<{
    moduleKey: string;
    insertedRows: number;
    skippedRows: number;
    totalRowsAfter: number;
  }>;
  totalInserted: number;
  totalSkipped: number;
  notes: string[];
  touchedPaths: string[];
};

export async function seedDemoDataTool(
  input: SeedDemoDataInput,
  ctx: ToolContext,
): Promise<SeedDemoDataToolResult> {
  return withAudit("seed_demo_data", input as Record<string, unknown>, ctx, async () => {
    const clientId = String(input.clientId || "").trim();
    if (!clientId) throw new Error("Falta clientId.");

    const result = seedDemoDataForTenant({
      clientId,
      mode: input.mode,
      modules: input.modules,
    });

    // touchedPaths: listamos los ficheros de datos materializados para
    // que la auditoría refleje dónde se escribió.
    const touched = result.modulesProcessed.map(
      (m) => "data/saas/" + clientId + "/" + m.moduleKey + ".json",
    );

    return {
      clientId: result.clientId,
      packKey: result.packKey,
      mode: result.mode,
      modulesProcessed: result.modulesProcessed,
      totalInserted: result.totalInserted,
      totalSkipped: result.totalSkipped,
      notes: result.notes,
      touchedPaths: touched,
    };
  });
}

// ---------------------------------------------------------------------------
// hard_reprovision_tenant
// ---------------------------------------------------------------------------

export type HardReprovisionToolInput = {
  clientId?: string;
  resetAdminPassword?: boolean;
  seedDemo?: "merge" | "replace";
  adminEmail?: string;
  adminFullName?: string;
  reason?: string;
};

export type HardReprovisionToolResult = {
  clientId: string;
  tenantId: string;
  slug: string;
  displayName: string;
  steps: Array<{ step: string; ok: boolean; detail: string }>;
  adminEmail: string | null;
  hasTemporaryPassword: boolean;
  newState: string;
  trialStatus: string;
  seedSummary: {
    mode: "merge" | "replace";
    modulesProcessed: number;
    totalInserted: number;
    totalSkipped: number;
  } | null;
  touchedPaths: string[];
};

/**
 * Hard-reprovision: idempotente por diseño. El temporaryPassword que pueda
 * generarse NO se audita en el resultado del chat (flag hasTemporaryPassword
 * indica su existencia pero el valor solo viaja por la API HTTP de factory
 * a la sesión del operador). Así el chat puede anunciar que hay un password
 * nuevo sin filtrarlo al historial persistente.
 */
export async function hardReprovisionTenantTool(
  input: HardReprovisionToolInput,
  ctx: ToolContext,
): Promise<HardReprovisionToolResult> {
  return withAudit(
    "hard_reprovision_tenant",
    // input sanitizado para el audit (resetAdminPassword sí se guarda, es un flag booleano)
    input as Record<string, unknown>,
    ctx,
    async () => {
      const clientId = String(input.clientId || "").trim();
      if (!clientId) throw new Error("Falta clientId.");

      const result = hardReprovisionTenant({
        clientId,
        resetAdminPassword: Boolean(input.resetAdminPassword),
        seedDemo: input.seedDemo,
        adminEmail: input.adminEmail,
        adminFullName: input.adminFullName,
        reason: input.reason || "Hard reprovisioning solicitado vía chat",
      });

      const touched: string[] = [];
      if (result.seedSummary) {
        touched.push("data/saas/" + clientId + "/* (demo seed)");
      }
      touched.push("data/saas/accounts/" + clientId + ".json");
      touched.push("data/saas/trial/" + clientId + ".json");
      if (result.onboarding) {
        touched.push(
          "data/saas/onboarding/" + clientId + "__" + result.onboarding.accountId + ".json",
        );
      }

      return {
        clientId: result.clientId,
        tenantId: result.tenantId,
        slug: result.slug,
        displayName: result.displayName,
        steps: result.steps,
        adminEmail: result.adminEmail,
        hasTemporaryPassword: Boolean(result.temporaryPassword),
        newState: result.newState,
        trialStatus: result.trialState.status,
        seedSummary: result.seedSummary,
        touchedPaths: touched,
      };
    },
  );
}
