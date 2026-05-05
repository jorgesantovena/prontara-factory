/**
 * Wrapper async sobre la auditoría del Factory Chat.
 *
 * Modo dual:
 *   - PRONTARA_PERSISTENCE=filesystem (default local) → JSONL diario en
 *     data/factory/chat/audit/YYYY-MM-DD.jsonl. Útil para inspección
 *     manual y para no requerir Postgres en local.
 *   - PRONTARA_PERSISTENCE=postgres (producción) → tabla `AuditEvent`
 *     que ya estaba en el schema desde F-31 (deploy preparation).
 *
 * Mismo patrón que factory-chat-storage-async.ts.
 *
 * NOTA — `actor.accountId`: el modelo Postgres `AuditEvent` solo guarda
 * `actorEmail`. El accountId del operador no se persiste porque el email
 * ya identifica de forma única a cada operador Factory. Si en el futuro
 * hace falta, se puede embeber en `inputJson` o añadir una columna.
 */
import {
  recordAuditEntry as recordAuditEntryFs,
  readRecentAuditEntries as readRecentAuditEntriesFs,
  type AuditEntry,
  type RecentAuditOptions,
  type AuditOutcome,
  type ToolContext,
} from "@/lib/factory-chat/audit";
import { getPersistenceBackend, withPrisma } from "@/lib/persistence/db";

// ---------------------------------------------------------------------------
// Mapping fila Postgres ↔ AuditEntry del dominio.
// ---------------------------------------------------------------------------

type AuditEventRow = {
  id: string;
  tenantId: string | null;
  conversationId: string | null;
  actorEmail: string | null;
  tool: string;
  outcome: string;
  durationMs: number;
  inputJson: unknown;
  resultJson: unknown;
  touchedPaths: string[];
  backupRef: string | null;
  errorMessage: string | null;
  createdAt: Date;
};

function rowToEntry(row: AuditEventRow): AuditEntry {
  const inputObj =
    row.inputJson && typeof row.inputJson === "object"
      ? (row.inputJson as Record<string, unknown>)
      : {};
  const resultObj =
    row.resultJson && typeof row.resultJson === "object"
      ? (row.resultJson as Record<string, unknown>)
      : {};

  return {
    at: row.createdAt.toISOString(),
    actor: {
      // accountId no se persiste en AuditEvent — usamos email como
      // sustituto cuando se reconstruye el AuditEntry desde Postgres.
      accountId: row.actorEmail || "",
      email: row.actorEmail || "",
    },
    conversationId: row.conversationId || "",
    tool: row.tool,
    input: inputObj,
    result: resultObj,
    outcome: (row.outcome as AuditOutcome) || "success",
    durationMs: row.durationMs,
    error: row.errorMessage || undefined,
    touchedPaths: row.touchedPaths.length > 0 ? row.touchedPaths : undefined,
    backupRef: row.backupRef || undefined,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Persiste una entrada de auditoría. En filesystem appendea al JSONL del
 * día; en Postgres inserta una fila en AuditEvent. Nunca lanza error que
 * tumbe el chat — los errores se loguean en consola del servidor.
 */
export async function recordAuditEntryAsync(entry: AuditEntry): Promise<void> {
  if (getPersistenceBackend() === "filesystem") {
    recordAuditEntryFs(entry);
    return;
  }

  try {
    await withPrisma(async (prisma) => {
      // cuid() para el id — el AuditEntry del dominio no tiene id propio
      // (es append-only, lo identifica `at` + `conversationId` + `tool`).
      // Postgres genera el id con el default del schema.
      await prisma.auditEvent.create({
        data: {
          conversationId: entry.conversationId || null,
          actorEmail: entry.actor.email || null,
          tool: entry.tool,
          outcome: entry.outcome,
          durationMs: entry.durationMs,
          inputJson:
            entry.input && Object.keys(entry.input).length > 0
              ? (entry.input as object)
              : undefined,
          resultJson:
            entry.result && Object.keys(entry.result).length > 0
              ? (entry.result as object)
              : undefined,
          touchedPaths: entry.touchedPaths || [],
          backupRef: entry.backupRef || null,
          errorMessage: entry.error || null,
          createdAt: new Date(entry.at),
        },
      });
    });
  } catch (err) {
    // Equivalente a la rama fs: nunca dejamos que un fallo de auditoría
    // tumbe la ejecución de una tool.
    console.error(
      "[factory-chat-audit-async] No se pudo escribir auditoría a Postgres:",
      err,
    );
  }
}

/**
 * Lee las entradas recientes para el viewer de /factory/auditoria y para
 * read_audit_log.
 */
export async function readRecentAuditEntriesAsync(
  options: RecentAuditOptions = {},
): Promise<AuditEntry[]> {
  if (getPersistenceBackend() === "filesystem") {
    return readRecentAuditEntriesFs(options);
  }

  const limit = Math.max(1, Math.min(options.limit || 50, 500));
  const lookbackDays = Math.max(1, Math.min(options.lookbackDays || 7, 90));

  // Filtro temporal: lookbackDays ventana hacia atrás. Más eficiente que
  // traer todo y filtrar en memoria como en filesystem.
  const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);

  const result = await withPrisma(async (prisma) => {
    const where: {
      createdAt: { gte: Date };
      tool?: string;
      actorEmail?: string;
      conversationId?: string;
    } = { createdAt: { gte: since } };
    if (options.tool) where.tool = options.tool;
    // accountId del filtro — en Postgres lo aplicamos contra actorEmail
    // porque AuditEvent no guarda accountId. La capa de filesystem lo
    // hace contra accountId, pero como en producción solo hay 1-2
    // operadores Factory, el filtro por email es equivalente.
    if (options.accountId) where.actorEmail = options.accountId;
    if (options.conversationId) where.conversationId = options.conversationId;

    return prisma.auditEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  });

  return ((result as AuditEventRow[]) || []).map(rowToEntry);
}

/**
 * Wrapper que mide tiempo + audita un handler de tool. Equivalente al
 * `withAudit` de filesystem, pero usando recordAuditEntryAsync.
 *
 * Las tools del chat lo usan para registrar cada invocación de tool de
 * escritura (write_repo_file, regenerate_tenant, etc.).
 */
export async function withAuditAsync<
  T extends { touchedPaths?: string[]; backupRef?: string },
>(
  tool: string,
  input: Record<string, unknown>,
  context: ToolContext,
  handler: () => Promise<T>,
): Promise<T> {
  const start = Date.now();
  const at = new Date(start).toISOString();

  try {
    const result = await handler();
    await recordAuditEntryAsync({
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
    await recordAuditEntryAsync({
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
