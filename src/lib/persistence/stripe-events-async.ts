/**
 * Dedupe de eventos del webhook Stripe.
 *
 * Stripe reintenta los eventos si no responde 200 antes de 30s. Para
 * evitar procesar el mismo evento dos veces (= doble activación de plan,
 * doble notificación, doble factura), persistimos cada event.id procesado
 * y rechazamos los duplicados.
 *
 * Usa la misma estrategia que las otras stores: filesystem en local,
 * Postgres en producción.
 */
import fs from "node:fs";
import path from "node:path";
import { writeJsonAtomic } from "@/lib/saas/fs-atomic";
import { getPersistenceBackend, withPrisma } from "@/lib/persistence/db";

export type StripeEventOutcome = "ok" | "error" | "duplicate";

export type StripeProcessedEvent = {
  eventId: string;
  type: string;
  processedAt: string;
  outcome: StripeEventOutcome;
  errorMsg: string | null;
};

function projectRoot(): string {
  return process.cwd();
}

function getStripeEventsDir(): string {
  const dir = path.join(projectRoot(), "data", "saas", "stripe-events");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function eventFilePath(eventId: string): string {
  if (!/^[A-Za-z0-9_.-]+$/.test(eventId)) {
    throw new Error("eventId Stripe inválido.");
  }
  return path.join(getStripeEventsDir(), eventId + ".json");
}

/**
 * Devuelve el evento ya procesado si existe; null si no se ha visto antes.
 * Si ya existe, el caller debe abortar el procesamiento (evento duplicado).
 */
export async function findStripeProcessedEventAsync(
  eventId: string,
): Promise<StripeProcessedEvent | null> {
  if (!eventId) return null;

  if (getPersistenceBackend() === "filesystem") {
    const fp = eventFilePath(eventId);
    if (!fs.existsSync(fp)) return null;
    try {
      return JSON.parse(fs.readFileSync(fp, "utf8")) as StripeProcessedEvent;
    } catch {
      return null;
    }
  }

  const result = await withPrisma(async (prisma) =>
    prisma.stripeProcessedEvent.findUnique({ where: { eventId } }),
  );
  if (!result) return null;
  return {
    eventId: result.eventId,
    type: result.type,
    processedAt: result.processedAt.toISOString(),
    outcome: result.outcome as StripeEventOutcome,
    errorMsg: result.errorMsg,
  };
}

/**
 * Marca el evento como procesado. Si ya existía, no falla (idempotente).
 */
export async function markStripeEventProcessedAsync(input: {
  eventId: string;
  type: string;
  outcome: StripeEventOutcome;
  errorMsg?: string;
}): Promise<void> {
  if (!input.eventId) return;

  const record: StripeProcessedEvent = {
    eventId: input.eventId,
    type: input.type,
    processedAt: new Date().toISOString(),
    outcome: input.outcome,
    errorMsg: input.errorMsg || null,
  };

  if (getPersistenceBackend() === "filesystem") {
    writeJsonAtomic(eventFilePath(input.eventId), record);
    return;
  }

  await withPrisma(async (prisma) =>
    prisma.stripeProcessedEvent.upsert({
      where: { eventId: input.eventId },
      create: {
        eventId: input.eventId,
        type: input.type,
        outcome: input.outcome,
        errorMsg: input.errorMsg || null,
      },
      update: {
        outcome: input.outcome,
        errorMsg: input.errorMsg || null,
      },
    }),
  );
}
