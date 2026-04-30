/**
 * Registro de auditoría del chat de Factory.
 *
 * Cada vez que el agente invoca una tool de escritura (write_repo_file,
 * apply_repo_patch, run_tsc_check, etc.) se graba una línea JSON en
 * `data/factory/chat/audit/YYYY-MM-DD.jsonl`. El formato es JSONL por
 * fecha para que rotar/eliminar viejos sea trivial y para que los
 * ficheros no crezcan sin fin.
 *
 * El objetivo es responder siempre a "¿quién ejecutó qué contra la
 * Factory y cuándo?" sin depender de logs de la plataforma. Las tools
 * de solo lectura NO se auditan aquí — el registro es específico de
 * mutaciones.
 */
import fs from "node:fs";
import path from "node:path";

export type ToolContext = {
  accountId: string;
  email: string;
  conversationId: string;
};

export type AuditOutcome = "success" | "error" | "skipped";

export type AuditEntry = {
  /** ISO-8601 UTC. */
  at: string;
  /** Quién lo disparó. */
  actor: {
    accountId: string;
    email: string;
  };
  /** En qué conversación del chat se ejecutó. */
  conversationId: string;
  /** Nombre de la tool invocada (e.g. "write_repo_file"). */
  tool: string;
  /** Entradas del modelo, sin sanitizar — útil para reproducir. */
  input: Record<string, unknown>;
  /** Resultado — suele ser un subconjunto útil, no el output completo. */
  result: Record<string, unknown>;
  /** success | error | skipped (por ejemplo si el path estaba fuera del whitelist). */
  outcome: AuditOutcome;
  /** Duración en ms de la ejecución. */
  durationMs: number;
  /** Si outcome = error, texto del error. */
  error?: string;
  /** Paths tocados (relativos a la raíz del repo). */
  touchedPaths?: string[];
  /** Snapshot o backup asociado, si lo hubo. */
  backupRef?: string;
};

function getProjectRoot(): string {
  return process.cwd();
}

function getAuditDir(): string {
  const dir = path.join(getProjectRoot(), "data", "factory", "chat", "audit");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getAuditFilePath(date: Date): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return path.join(getAuditDir(), yyyy + "-" + mm + "-" + dd + ".jsonl");
}

/**
 * Apendiza una entrada de auditoría al fichero del día actual. Thread-safe
 * a nivel proceso gracias a fs.appendFileSync (escribe de una vez). Entre
 * procesos no garantiza orden absoluto pero sí que no se pierdan líneas.
 */
export function recordAuditEntry(entry: AuditEntry): void {
  const line = JSON.stringify(entry);
  const filePath = getAuditFilePath(new Date(entry.at));
  try {
    fs.appendFileSync(filePath, line + "\n", "utf8");
  } catch (err) {
    // Nunca dejamos que un fallo de auditoría tumbe la ejecución del
    // chat, pero sí lo dejamos visible en consola del servidor.
    console.error("[factory-chat/audit] No se pudo escribir auditoría:", err);
  }
}

export type RecentAuditOptions = {
  /** Número máximo de entradas a devolver, ordenadas de más reciente a menos. */
  limit?: number;
  /** Filtro por nombre de tool. */
  tool?: string;
  /** Filtro por accountId. */
  accountId?: string;
  /** Filtro por conversationId. */
  conversationId?: string;
  /** Cuántos días hacia atrás mirar (por defecto 7). */
  lookbackDays?: number;
};

/**
 * Lee entradas recientes de auditoría. Escanea los ficheros de los
 * últimos N días y filtra en memoria — suficiente para el uso típico
 * del chat (decenas/cientos de entradas por día).
 */
export function readRecentAuditEntries(options: RecentAuditOptions = {}): AuditEntry[] {
  const limit = Math.max(1, Math.min(options.limit || 50, 500));
  const lookback = Math.max(1, Math.min(options.lookbackDays || 7, 90));
  const results: AuditEntry[] = [];

  const now = new Date();
  for (let i = 0; i < lookback; i++) {
    const day = new Date(now);
    day.setUTCDate(day.getUTCDate() - i);
    const filePath = getAuditFilePath(day);
    if (!fs.existsSync(filePath)) continue;

    const raw = fs.readFileSync(filePath, "utf8");
    const lines = raw.split("\n").filter((l) => l.trim());
    for (const line of lines) {
      try {
        const entry = JSON.parse(line) as AuditEntry;
        if (options.tool && entry.tool !== options.tool) continue;
        if (options.accountId && entry.actor?.accountId !== options.accountId) continue;
        if (options.conversationId && entry.conversationId !== options.conversationId) continue;
        results.push(entry);
      } catch {
        // línea corrupta, la ignoramos
      }
    }
  }

  results.sort((a, b) => (b.at < a.at ? -1 : b.at > a.at ? 1 : 0));
  return results.slice(0, limit);
}

/**
 * Wrapper para envolver una función de tool de escritura añadiendo
 * medición de tiempo + auditoría automática. El caller solo tiene que
 * devolver el objeto resultado (y opcionalmente touchedPaths/backupRef).
 */
export async function withAudit<T extends { touchedPaths?: string[]; backupRef?: string }>(
  tool: string,
  input: Record<string, unknown>,
  context: ToolContext,
  handler: () => Promise<T>,
): Promise<T> {
  const start = Date.now();
  const at = new Date(start).toISOString();

  try {
    const result = await handler();
    recordAuditEntry({
      at,
      actor: { accountId: context.accountId, email: context.email },
      conversationId: context.conversationId,
      tool,
      input,
      result: result as unknown as Record<string, unknown>,
      outcome: "success",
      durationMs: Date.now() - start,
      touchedPaths: result.touchedPaths,
      backupRef: result.backupRef,
    });
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido.";
    recordAuditEntry({
      at,
      actor: { accountId: context.accountId, email: context.email },
      conversationId: context.conversationId,
      tool,
      input,
      result: {},
      outcome: "error",
      durationMs: Date.now() - start,
      error: message,
    });
    throw err;
  }
}
