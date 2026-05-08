import { NextResponse, type NextRequest } from "next/server";
import { processJobs } from "@/lib/jobs/queue";
import "@/lib/jobs/handlers"; // registra handlers
import { flush as flushMetrics } from "@/lib/observability/metrics";
import { captureError } from "@/lib/observability/error-capture";

/**
 * GET /api/cron/tick (H3-ARQ-01)
 *
 * Procesa hasta 10 jobs pendientes de la queue Postgres + flusha
 * métricas acumuladas. Pensado para ser invocado por Vercel Cron cada
 * minuto. Si Vercel Cron no está activo, también se puede llamar
 * manualmente para drenar la queue.
 *
 * Auth: si `CRON_SECRET` está definido, se exige header
 * `Authorization: Bearer <CRON_SECRET>`. Vercel Cron pone este header
 * automáticamente si la variable está en producción.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = String(process.env.CRON_SECRET || "").trim();
  if (secret) {
    const auth = request.headers.get("authorization") || "";
    if (auth !== "Bearer " + secret) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const summary = await processJobs(10);
    await flushMetrics().catch(() => undefined);
    return NextResponse.json({ ok: true, ...summary, at: new Date().toISOString() });
  } catch (e) {
    captureError(e, { scope: "/api/cron/tick" });
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "tick error" },
      { status: 500 },
    );
  }
}
