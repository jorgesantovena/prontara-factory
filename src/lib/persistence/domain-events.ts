/**
 * Cola de eventos de dominio (ARQ-7).
 *
 * Es la pieza que permite que un paso del pipeline de alta (o de
 * cualquier otro flujo crítico) que falla más allá de lo razonable
 * lance una acción de compensación o se reintenta de forma diferida
 * sin bloquear el request original.
 *
 * Modelo:
 *   - Un evento tiene `type` (ej: "tenant.activation.failed"), un
 *     aggregateType + aggregateId (a quién afecta), un payload arbitrario
 *     para el handler, y un estado que evoluciona pending → processing
 *     → completed (o → dead_letter si agotó reintentos).
 *   - Un cron en /api/cron/process-domain-events toma N eventos cuyo
 *     nextAttemptAt ha pasado y los procesa con el handler registrado
 *     para su `type`.
 *   - Backoff exponencial entre reintentos (ej: 30s, 1m, 2m, 4m, 8m...).
 *
 * Persistencia dual: filesystem en local (data/saas/domain-events/),
 * Postgres en producción.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { writeJsonAtomic } from "@/lib/saas/fs-atomic";
import { getPersistenceBackend, withPrisma } from "@/lib/persistence/db";

export type DomainEventStatus =
  | "pending"
  | "processing"
  | "completed"
  | "dead_letter";

export type DomainEventRecord = {
  id: string;
  type: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  status: DomainEventStatus;
  retryCount: number;
  maxRetries: number;
  occurredAt: string;
  nextAttemptAt: string;
  processedAt: string | null;
  errorMsg: string | null;
};

const DEFAULT_MAX_RETRIES = 5;
/**
 * Backoff exponencial en segundos por intento. Tras agotar pasa a
 * dead_letter (queda visible para inspección manual del operador).
 */
const BACKOFF_SECONDS = [30, 60, 120, 240, 480, 960];

function projectRoot(): string {
  return process.cwd();
}

function getEventsDir(): string {
  const dir = path.join(projectRoot(), "data", "saas", "domain-events");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function eventFilePath(id: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(id)) {
    throw new Error("DomainEvent id inválido.");
  }
  return path.join(getEventsDir(), id + ".json");
}

function nextAttemptAt(retryCount: number): Date {
  const idx = Math.min(retryCount, BACKOFF_SECONDS.length - 1);
  return new Date(Date.now() + BACKOFF_SECONDS[idx] * 1000);
}

function nowIso(): string {
  return new Date().toISOString();
}

function genId(): string {
  // cuid-like: timestamp + random. Compatible con Prisma cuid().
  return "ev_" + Date.now().toString(36) + "_" + crypto.randomBytes(6).toString("hex");
}

// ---------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------

/**
 * Persiste un evento en estado pending para que el cron lo recoja.
 * Devuelve el id asignado.
 */
export async function emitDomainEventAsync(input: {
  type: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  maxRetries?: number;
  /** Si quieres retrasar el primer intento (en segundos desde ahora). */
  delaySeconds?: number;
}): Promise<string> {
  const id = genId();
  const now = nowIso();
  const firstAttempt = new Date(
    Date.now() + (input.delaySeconds ? input.delaySeconds * 1000 : 0),
  ).toISOString();

  const record: DomainEventRecord = {
    id,
    type: input.type,
    aggregateType: input.aggregateType,
    aggregateId: input.aggregateId,
    payload: input.payload,
    status: "pending",
    retryCount: 0,
    maxRetries: input.maxRetries ?? DEFAULT_MAX_RETRIES,
    occurredAt: now,
    nextAttemptAt: firstAttempt,
    processedAt: null,
    errorMsg: null,
  };

  if (getPersistenceBackend() === "filesystem") {
    writeJsonAtomic(eventFilePath(id), record);
    return id;
  }

  await withPrisma(async (prisma) =>
    prisma.domainEvent.create({
      data: {
        id,
        type: record.type,
        aggregateType: record.aggregateType,
        aggregateId: record.aggregateId,
        payload: record.payload,
        status: record.status,
        retryCount: record.retryCount,
        maxRetries: record.maxRetries,
        occurredAt: new Date(record.occurredAt),
        nextAttemptAt: new Date(record.nextAttemptAt),
      },
    }),
  );
  return id;
}

/**
 * Marca hasta `limit` eventos como "processing" y los devuelve para
 * que el caller los maneje. Si el handler crashea, el siguiente claim
 * los volverá a coger pasados ~30s (rescate por timeout — ver
 * `rescueStuckEventsAsync`).
 */
export async function claimNextEventsAsync(
  limit: number,
): Promise<DomainEventRecord[]> {
  if (limit <= 0) return [];
  const now = new Date();

  if (getPersistenceBackend() === "filesystem") {
    const dir = getEventsDir();
    if (!fs.existsSync(dir)) return [];
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
    const candidates: DomainEventRecord[] = [];
    for (const file of files) {
      try {
        const rec = JSON.parse(
          fs.readFileSync(path.join(dir, file), "utf8"),
        ) as DomainEventRecord;
        if (rec.status === "pending" && new Date(rec.nextAttemptAt) <= now) {
          candidates.push(rec);
        }
      } catch {
        /* fichero corrupto; lo ignoramos */
      }
    }
    candidates.sort(
      (a, b) =>
        new Date(a.nextAttemptAt).getTime() - new Date(b.nextAttemptAt).getTime(),
    );
    const claimed: DomainEventRecord[] = [];
    for (const rec of candidates.slice(0, limit)) {
      const next: DomainEventRecord = { ...rec, status: "processing" };
      writeJsonAtomic(eventFilePath(rec.id), next);
      claimed.push(next);
    }
    return claimed;
  }

  // Postgres: usamos updateMany con returning vía SELECT … FOR UPDATE SKIP LOCKED
  // simulado con dos queries (Prisma no expone FOR UPDATE directamente sin raw).
  // Para nuestro volumen actual (decenas de eventos / día) es suficiente.
  return withPrisma(async (prisma) => {
    const candidates = await prisma.domainEvent.findMany({
      where: { status: "pending", nextAttemptAt: { lte: now } },
      orderBy: { nextAttemptAt: "asc" },
      take: limit,
    });
    const claimed: DomainEventRecord[] = [];
    for (const c of candidates) {
      // Update solo si sigue en pending (anti-double-claim)
      const updated = await prisma.domainEvent.updateMany({
        where: { id: c.id, status: "pending" },
        data: { status: "processing" },
      });
      if (updated.count === 1) {
        claimed.push({
          id: c.id,
          type: c.type,
          aggregateType: c.aggregateType,
          aggregateId: c.aggregateId,
          payload: c.payload as Record<string, unknown>,
          status: "processing",
          retryCount: c.retryCount,
          maxRetries: c.maxRetries,
          occurredAt: c.occurredAt.toISOString(),
          nextAttemptAt: c.nextAttemptAt.toISOString(),
          processedAt: c.processedAt ? c.processedAt.toISOString() : null,
          errorMsg: c.errorMsg,
        });
      }
    }
    return claimed;
  });
}

/**
 * Marca un evento como completado. processedAt = ahora.
 */
export async function completeEventAsync(id: string): Promise<void> {
  const now = nowIso();
  if (getPersistenceBackend() === "filesystem") {
    const fp = eventFilePath(id);
    if (!fs.existsSync(fp)) return;
    const rec = JSON.parse(fs.readFileSync(fp, "utf8")) as DomainEventRecord;
    writeJsonAtomic(fp, { ...rec, status: "completed", processedAt: now, errorMsg: null });
    return;
  }
  await withPrisma(async (prisma) =>
    prisma.domainEvent.update({
      where: { id },
      data: { status: "completed", processedAt: new Date(), errorMsg: null },
    }),
  );
}

/**
 * Marca un evento como fallido en este intento. Si quedan reintentos,
 * vuelve a pending con nextAttemptAt calculado por backoff. Si agota
 * reintentos pasa a dead_letter.
 */
export async function failEventAsync(input: {
  id: string;
  errorMsg: string;
}): Promise<void> {
  if (getPersistenceBackend() === "filesystem") {
    const fp = eventFilePath(input.id);
    if (!fs.existsSync(fp)) return;
    const rec = JSON.parse(fs.readFileSync(fp, "utf8")) as DomainEventRecord;
    const newRetry = rec.retryCount + 1;
    if (newRetry >= rec.maxRetries) {
      writeJsonAtomic(fp, {
        ...rec,
        status: "dead_letter",
        retryCount: newRetry,
        processedAt: nowIso(),
        errorMsg: input.errorMsg,
      });
    } else {
      writeJsonAtomic(fp, {
        ...rec,
        status: "pending",
        retryCount: newRetry,
        nextAttemptAt: nextAttemptAt(newRetry).toISOString(),
        errorMsg: input.errorMsg,
      });
    }
    return;
  }

  await withPrisma(async (prisma) => {
    const current = await prisma.domainEvent.findUnique({ where: { id: input.id } });
    if (!current) return;
    const newRetry = current.retryCount + 1;
    if (newRetry >= current.maxRetries) {
      await prisma.domainEvent.update({
        where: { id: input.id },
        data: {
          status: "dead_letter",
          retryCount: newRetry,
          processedAt: new Date(),
          errorMsg: input.errorMsg,
        },
      });
    } else {
      await prisma.domainEvent.update({
        where: { id: input.id },
        data: {
          status: "pending",
          retryCount: newRetry,
          nextAttemptAt: nextAttemptAt(newRetry),
          errorMsg: input.errorMsg,
        },
      });
    }
  });
}

/**
 * Rescata eventos que quedaron en "processing" hace más de N segundos
 * (probablemente porque el cron crashed antes de completar). Los
 * devuelve a pending para que el siguiente claim los recoja.
 *
 * Llamar desde el cron antes de `claimNextEventsAsync`.
 */
export async function rescueStuckEventsAsync(
  staleSeconds = 300,
): Promise<number> {
  const cutoff = new Date(Date.now() - staleSeconds * 1000);

  if (getPersistenceBackend() === "filesystem") {
    const dir = getEventsDir();
    if (!fs.existsSync(dir)) return 0;
    let rescued = 0;
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".json"))) {
      try {
        const fp = path.join(dir, file);
        const rec = JSON.parse(fs.readFileSync(fp, "utf8")) as DomainEventRecord;
        if (
          rec.status === "processing" &&
          new Date(rec.nextAttemptAt) <= cutoff
        ) {
          writeJsonAtomic(fp, {
            ...rec,
            status: "pending",
            nextAttemptAt: nowIso(),
          });
          rescued += 1;
        }
      } catch {
        /* ignorar fichero corrupto */
      }
    }
    return rescued;
  }

  return withPrisma(async (prisma) => {
    const result = await prisma.domainEvent.updateMany({
      where: { status: "processing", nextAttemptAt: { lte: cutoff } },
      data: { status: "pending" },
    });
    return result.count;
  });
}

/**
 * Lectura para UI / debugging.
 */
export async function listDomainEventsAsync(input?: {
  status?: DomainEventStatus;
  limit?: number;
}): Promise<DomainEventRecord[]> {
  const limit = input?.limit ?? 50;

  if (getPersistenceBackend() === "filesystem") {
    const dir = getEventsDir();
    if (!fs.existsSync(dir)) return [];
    const records: DomainEventRecord[] = [];
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".json"))) {
      try {
        const rec = JSON.parse(
          fs.readFileSync(path.join(dir, file), "utf8"),
        ) as DomainEventRecord;
        if (!input?.status || rec.status === input.status) records.push(rec);
      } catch {
        /* ignorar */
      }
    }
    records.sort(
      (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
    );
    return records.slice(0, limit);
  }

  return withPrisma(async (prisma) => {
    const rows = await prisma.domainEvent.findMany({
      where: input?.status ? { status: input.status } : undefined,
      orderBy: { occurredAt: "desc" },
      take: limit,
    });
    return rows.map((c) => ({
      id: c.id,
      type: c.type,
      aggregateType: c.aggregateType,
      aggregateId: c.aggregateId,
      payload: c.payload as Record<string, unknown>,
      status: c.status as DomainEventStatus,
      retryCount: c.retryCount,
      maxRetries: c.maxRetries,
      occurredAt: c.occurredAt.toISOString(),
      nextAttemptAt: c.nextAttemptAt.toISOString(),
      processedAt: c.processedAt ? c.processedAt.toISOString() : null,
      errorMsg: c.errorMsg,
    }));
  });
}
