/**
 * Background jobs queue en Postgres (H3-ARQ-01).
 *
 * Diseño: tabla `BackgroundJob` con `status: pending | running | done | failed`
 * + `runAfter` para programar diferidos. Un único worker (Vercel Cron sobre
 * `/api/cron/tick` cada minuto) saca el siguiente pendiente con
 * `FOR UPDATE SKIP LOCKED` y lo ejecuta.
 *
 * Ventajas vs Redis/BullMQ:
 *   - Cero infra extra (Neon ya está)
 *   - Compatible con serverless (no necesita worker long-running)
 *   - Atómico vía Postgres locking
 *   - Persistente automáticamente (los jobs no se pierden si reinicia)
 *
 * Inconvenientes:
 *   - Latencia mínima ~1 min (cron interval). Suficiente para emails,
 *     recálculos, retries — no apto para nada interactivo.
 *   - Cap teórico: ~hundreds de jobs/min. Suficiente para Prontara.
 *
 * Tipos de job soportados:
 *   - "email": envío diferido vía Resend (payload: { to, subject, html })
 *   - "recalc-kpis": refresca KPIs precomputados de un tenant (payload: { clientId })
 *   - "verifactu-resend": reintento de envío AEAT (payload: { submissionId })
 *   - "gdpr-export": genera bundle y notifica (payload: { clientId, requesterEmail })
 *   - "custom": payload libre, requiere handler registrado
 */
import { withPrisma, getPersistenceBackend } from "@/lib/persistence/db";
import { createLogger } from "@/lib/observability/logger";
import { captureError } from "@/lib/observability/error-capture";

const log = createLogger("jobs-queue");

export type JobKind =
  | "email"
  | "recalc-kpis"
  | "verifactu-resend"
  | "gdpr-export"
  | "custom";

export type EnqueueOptions = {
  kind: JobKind;
  payload: Record<string, unknown>;
  tenantId?: string;
  clientId?: string;
  /** Retraso desde ahora en ms (default 0 = inmediato). */
  delayMs?: number;
  /** Máx intentos antes de marcar failed (default 5). */
  maxAttempts?: number;
};

export async function enqueueJob(opts: EnqueueOptions): Promise<string | null> {
  if (getPersistenceBackend() !== "postgres") {
    log.warn("queue requiere Postgres — job ignorado", { kind: opts.kind });
    return null;
  }
  const runAfter = new Date(Date.now() + (opts.delayMs || 0));
  const id = await withPrisma(async (prisma) => {
    const c = prisma as unknown as {
      backgroundJob: {
        create: (a: { data: Record<string, unknown> }) => Promise<{ id: string }>;
      };
    };
    const job = await c.backgroundJob.create({
      data: {
        tenantId: opts.tenantId,
        clientId: opts.clientId,
        kind: opts.kind,
        payloadJson: opts.payload,
        status: "pending",
        runAfter,
        maxAttempts: opts.maxAttempts ?? 5,
      },
    });
    return job.id;
  });
  log.info("job enqueued", { id, kind: opts.kind });
  return id;
}

/**
 * Saca un único job pendiente cuyo `runAfter <= now`, lo marca como
 * running y devuelve el job. El caller es responsable de llamar
 * `markJobDone` / `markJobFailed`. Si nadie marca, la próxima
 * iteración del cron lo reclama (ver `reclaimStuckJobs`).
 */
export async function pickNextJob(): Promise<{
  id: string;
  kind: string;
  payloadJson: Record<string, unknown>;
  attempts: number;
  maxAttempts: number;
} | null> {
  return withPrisma(async (prisma) => {
    // SQL crudo para usar FOR UPDATE SKIP LOCKED de forma atómica.
    const rows = await (prisma as unknown as { $queryRawUnsafe: <T>(sql: string) => Promise<T> })
      .$queryRawUnsafe<Array<{
        id: string;
        kind: string;
        payloadJson: Record<string, unknown>;
        attempts: number;
        maxAttempts: number;
      }>>(`
        UPDATE "BackgroundJob"
        SET status = 'running', "startedAt" = NOW(), attempts = attempts + 1
        WHERE id = (
          SELECT id FROM "BackgroundJob"
          WHERE status = 'pending' AND "runAfter" <= NOW()
          ORDER BY "runAfter" ASC
          LIMIT 1
          FOR UPDATE SKIP LOCKED
        )
        RETURNING id, kind, "payloadJson", attempts, "maxAttempts"
      `);
    return rows[0] || null;
  });
}

export async function markJobDone(id: string): Promise<void> {
  await withPrisma(async (prisma) => {
    const c = prisma as unknown as {
      backgroundJob: {
        update: (a: { where: { id: string }; data: Record<string, unknown> }) => Promise<unknown>;
      };
    };
    await c.backgroundJob.update({
      where: { id },
      data: { status: "done", finishedAt: new Date(), errorMsg: null },
    });
  });
}

export async function markJobFailed(id: string, error: unknown, retry: boolean): Promise<void> {
  const errMsg = error instanceof Error ? error.message : String(error);
  await withPrisma(async (prisma) => {
    const c = prisma as unknown as {
      backgroundJob: {
        update: (a: { where: { id: string }; data: Record<string, unknown> }) => Promise<unknown>;
      };
      $queryRawUnsafe: (sql: string, ...args: unknown[]) => Promise<unknown>;
    };
    if (retry) {
      // Backoff exponencial: 30s, 1min, 2min, 5min, 15min
      const delays = [30, 60, 120, 300, 900];
      // Necesitamos saber attempts actuales — leemos primero
      await (prisma as unknown as { $executeRawUnsafe: (sql: string, ...args: unknown[]) => Promise<unknown> })
        .$executeRawUnsafe(
          `UPDATE "BackgroundJob"
           SET status = CASE WHEN attempts >= "maxAttempts" THEN 'failed' ELSE 'pending' END,
               "errorMsg" = $1,
               "runAfter" = NOW() + (
                 CASE attempts
                   WHEN 1 THEN INTERVAL '30 seconds'
                   WHEN 2 THEN INTERVAL '1 minute'
                   WHEN 3 THEN INTERVAL '2 minutes'
                   WHEN 4 THEN INTERVAL '5 minutes'
                   ELSE INTERVAL '15 minutes'
                 END
               )
           WHERE id = $2`,
          errMsg, id,
        );
    } else {
      await c.backgroundJob.update({
        where: { id },
        data: { status: "failed", finishedAt: new Date(), errorMsg: errMsg },
      });
    }
  });
}

/**
 * Reclama jobs que llevan más de 10 minutos en "running" — significa
 * que el worker murió a mitad. Los devuelve a "pending" para reintento.
 */
export async function reclaimStuckJobs(): Promise<number> {
  const n = await withPrisma(async (prisma) => {
    const result = await (prisma as unknown as { $executeRawUnsafe: (sql: string) => Promise<number> })
      .$executeRawUnsafe(`
        UPDATE "BackgroundJob"
        SET status = 'pending', "errorMsg" = COALESCE("errorMsg", '') || ' [reclaimed]'
        WHERE status = 'running' AND "startedAt" < NOW() - INTERVAL '10 minutes'
      `);
    return Number(result) || 0;
  });
  return n ?? 0;
}

/**
 * Tipo de un handler de job. Recibe el payload, hace su trabajo, lanza
 * si falla. La queue se encarga del retry/backoff.
 */
export type JobHandler = (payload: Record<string, unknown>) => Promise<void>;

const handlers = new Map<string, JobHandler>();

export function registerJobHandler(kind: string, handler: JobHandler): void {
  handlers.set(kind, handler);
}

export function getJobHandler(kind: string): JobHandler | undefined {
  return handlers.get(kind);
}

/**
 * Procesa hasta N jobs en una sola tick. Se llama desde /api/cron/tick.
 * Devuelve resumen de resultados.
 */
export async function processJobs(maxJobs = 10): Promise<{
  processed: number;
  done: number;
  failed: number;
  reclaimed: number;
}> {
  if (getPersistenceBackend() !== "postgres") {
    return { processed: 0, done: 0, failed: 0, reclaimed: 0 };
  }
  const reclaimed = await reclaimStuckJobs().catch(() => 0);
  let done = 0;
  let failed = 0;
  let processed = 0;
  for (let i = 0; i < maxJobs; i++) {
    let job: Awaited<ReturnType<typeof pickNextJob>>;
    try {
      job = await pickNextJob();
    } catch (e) {
      captureError(e, { scope: "jobs-queue.pickNext" });
      break;
    }
    if (!job) break;
    processed += 1;
    const handler = getJobHandler(job.kind);
    if (!handler) {
      await markJobFailed(job.id, new Error("no handler for kind=" + job.kind), false);
      failed += 1;
      continue;
    }
    try {
      await handler(job.payloadJson);
      await markJobDone(job.id);
      done += 1;
    } catch (err) {
      captureError(err, { scope: "jobs-queue.handler", tags: { kind: job.kind } });
      await markJobFailed(job.id, err, job.attempts < job.maxAttempts);
      failed += 1;
    }
  }
  return { processed, done, failed, reclaimed };
}
