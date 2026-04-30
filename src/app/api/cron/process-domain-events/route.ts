/**
 * Worker del saga (ARQ-7).
 *
 * Vercel Cron invoca este endpoint periódicamente (ver vercel.json).
 * Por cada invocación:
 *
 *   1. Rescata eventos atascados en "processing" desde hace mucho.
 *   2. Toma hasta MAX_EVENTS_PER_RUN eventos pending cuyo nextAttemptAt
 *      ya haya pasado.
 *   3. Despacha cada uno al handler de su type.
 *   4. completeEventAsync si OK; failEventAsync si lanza.
 *
 * Autenticación: Vercel Cron envía la cabecera
 *   Authorization: Bearer <CRON_SECRET>
 * que comparamos contra la env var. En desarrollo local puede llamarse
 * sin cabecera si NODE_ENV != production (para tests manuales).
 */
import { NextResponse, type NextRequest } from "next/server";
import {
  claimNextEventsAsync,
  completeEventAsync,
  failEventAsync,
  rescueStuckEventsAsync,
} from "@/lib/persistence/domain-events";
import { dispatchDomainEvent } from "@/lib/saas/domain-event-handlers";
import { createLogger } from "@/lib/observability/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_EVENTS_PER_RUN = 25;
const STUCK_THRESHOLD_SECONDS = 300; // 5 min

const log = createLogger("cron-domain-events");

function isAuthorized(request: NextRequest): boolean {
  const expected = (process.env.CRON_SECRET || "").trim();
  // En desarrollo local, permitir sin cabecera para pruebas manuales.
  if (!expected && process.env.NODE_ENV !== "production") return true;
  if (!expected) return false; // en prod no permitir nunca sin secret configurado
  const auth = request.headers.get("authorization") || "";
  return auth === "Bearer " + expected;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    log.warn("unauthorized cron call");
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const startedAt = Date.now();
  let rescued = 0;
  let claimed = 0;
  let completed = 0;
  let failed = 0;

  try {
    rescued = await rescueStuckEventsAsync(STUCK_THRESHOLD_SECONDS);
    if (rescued > 0) log.info("rescued stuck events", { count: rescued });

    const events = await claimNextEventsAsync(MAX_EVENTS_PER_RUN);
    claimed = events.length;

    for (const event of events) {
      try {
        await dispatchDomainEvent(event);
        await completeEventAsync(event.id);
        completed += 1;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        log.warn("event handler failed — will retry with backoff", {
          eventId: event.id,
          type: event.type,
          retry: event.retryCount,
          error: errMsg,
        });
        await failEventAsync({ id: event.id, errorMsg: errMsg });
        failed += 1;
      }
    }
  } catch (err) {
    log.error("cron run aborted", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { ok: false, error: "Cron run aborted.", rescued, claimed, completed, failed },
      { status: 500 },
    );
  }

  const tookMs = Date.now() - startedAt;
  log.info("cron run finished", { rescued, claimed, completed, failed, tookMs });

  return NextResponse.json({
    ok: true,
    rescued,
    claimed,
    completed,
    failed,
    tookMs,
  });
}
