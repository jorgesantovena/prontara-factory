import { NextResponse, type NextRequest } from "next/server";
import { withPrisma, getPersistenceBackend } from "@/lib/persistence/db";
import { enqueueJob } from "@/lib/jobs/queue";
import { captureError } from "@/lib/observability/error-capture";

/**
 * GET /api/cron/avisos (H8-C10)
 *
 * Cron diario que:
 *   - Lee avisos-programados con estado=activo y proximaFecha<=hoy
 *   - Por cada uno, enqueue un job (email/whatsapp/sms) con la plantilla
 *   - Recalcula proximaFecha según frecuencia y guarda ultimaFecha=hoy
 *   - Si frecuencia=unica → marca completado
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function nextDate(current: string, freq: string): string {
  const d = new Date(current);
  if (Number.isNaN(d.getTime())) return current;
  switch (freq) {
    case "mensual": d.setMonth(d.getMonth() + 1); break;
    case "trimestral": d.setMonth(d.getMonth() + 3); break;
    case "semestral": d.setMonth(d.getMonth() + 6); break;
    case "anual": d.setFullYear(d.getFullYear() + 1); break;
    default: return current;
  }
  return d.toISOString().slice(0, 10);
}

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
  const today = new Date().toISOString().slice(0, 10);

  try {
    const result = await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        tenantModuleRecord: {
          findMany: (a: { where: Record<string, unknown> }) => Promise<Array<{ id: string; clientId: string; payloadJson: Record<string, unknown> }>>;
          update: (a: { where: { id: string }; data: Record<string, unknown> }) => Promise<unknown>;
        };
      };
      const avisos = await c.tenantModuleRecord.findMany({
        where: { moduleKey: "avisos-programados" },
      });

      let enqueued = 0;
      let updated = 0;
      let skipped = 0;

      for (const av of avisos) {
        const p = av.payloadJson;
        if (String(p.estado) !== "activo") { skipped += 1; continue; }
        const proximaFecha = String(p.proximaFecha || "").slice(0, 10);
        if (!proximaFecha || proximaFecha > today) { skipped += 1; continue; }

        const canal = String(p.canal || "email");
        const cliente = String(p.cliente || "");
        const nombre = String(p.nombre || "Aviso programado");

        // Para email/whatsapp/sms enqueue job
        if (canal === "email" || canal === "whatsapp" || canal === "sms") {
          await enqueueJob({
            kind: "email",
            clientId: av.clientId,
            payload: {
              to: cliente, // el handler luego resuelve a email real
              subject: nombre,
              html: "<p>Recordatorio automático: " + nombre + "</p>",
            },
          }).catch(() => undefined);
          enqueued += 1;
        }

        // Recalcular siguiente
        const freq = String(p.frecuencia || "unica");
        const nuevoEstado = freq === "unica" ? "completado" : "activo";
        const siguiente = freq === "unica" ? proximaFecha : nextDate(proximaFecha, freq);

        await c.tenantModuleRecord.update({
          where: { id: av.id },
          data: {
            payloadJson: {
              ...p,
              ultimaFecha: today,
              proximaFecha: siguiente,
              estado: nuevoEstado,
            },
          },
        });
        updated += 1;
      }

      return { totalAvisos: avisos.length, enqueued, updated, skipped };
    });

    return NextResponse.json({ ok: true, ...result, at: new Date().toISOString() });
  } catch (e) {
    captureError(e, { scope: "/api/cron/avisos" });
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
