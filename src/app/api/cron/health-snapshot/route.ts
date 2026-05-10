import { NextResponse, type NextRequest } from "next/server";
import { withPrisma, getPersistenceBackend } from "@/lib/persistence/db";
import { enqueueJob } from "@/lib/jobs/queue";
import { captureError } from "@/lib/observability/error-capture";

/**
 * GET /api/cron/health-snapshot (H5-OPS-01 + H5-OPS-02)
 *
 * Llama a /api/health internamente, persiste el snapshot y dispara
 * alerta por email si overall=down (con throttle 30 min).
 *
 * Pensado para Vercel Cron cada minuto.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const ALERT_THROTTLE_MS = 30 * 60 * 1000;
let lastAlertAt = 0;

export async function GET(request: NextRequest) {
  const secret = String(process.env.CRON_SECRET || "").trim();
  if (secret) {
    const auth = request.headers.get("authorization") || "";
    if (auth !== "Bearer " + secret) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
  }
  if (getPersistenceBackend() !== "postgres") {
    return NextResponse.json({ ok: false, error: "Postgres only" }, { status: 400 });
  }

  try {
    // Llama al health endpoint sobre la propia URL pública
    const baseUrl =
      process.env.PRONTARA_PUBLIC_BASE_URL ||
      process.env.PRONTARA_APP_BASE_URL ||
      "http://localhost:3000";
    const r = await fetch(baseUrl.replace(/\/+$/, "") + "/api/health", { cache: "no-store" });
    const data = await r.json();

    const overall = String(data?.overall || "down");
    const components = (data?.components || []).map((c: Record<string, unknown>) => ({
      key: c.key,
      label: c.label,
      state: c.state,
    }));

    await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        healthSnapshot: {
          create: (a: { data: Record<string, unknown> }) => Promise<unknown>;
        };
      };
      await c.healthSnapshot.create({ data: { overall, componentsJson: components } });
    });

    // Alerta si overall=down y throttle lo permite
    if (overall === "down") {
      const now = Date.now();
      if (now - lastAlertAt > ALERT_THROTTLE_MS) {
        const alertEmail = String(process.env.OPERATOR_ALERT_EMAIL || "").trim();
        if (alertEmail) {
          await enqueueJob({
            kind: "email",
            payload: {
              to: alertEmail,
              subject: "[Prontara] ALERTA: overall=down",
              html:
                "<h2>Health check ha reportado <strong>down</strong>.</h2>" +
                "<p>Componentes:</p><pre>" + JSON.stringify(components, null, 2) + "</pre>" +
                "<p>Fecha: " + new Date().toISOString() + "</p>",
            },
          }).catch(() => undefined);
          lastAlertAt = now;
        }
      }
    } else if (overall === "ok") {
      // Reset throttle si vuelve a OK — la próxima caída disparará inmediatamente
      lastAlertAt = 0;
    }

    return NextResponse.json({ ok: true, overall, snapshotsKeptDays: 30 });
  } catch (e) {
    captureError(e, { scope: "/api/cron/health-snapshot" });
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
