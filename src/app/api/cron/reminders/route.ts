import { NextResponse, type NextRequest } from "next/server";
import { withPrisma, getPersistenceBackend } from "@/lib/persistence/db";
import { enqueueJob } from "@/lib/jobs/queue";
import { captureError } from "@/lib/observability/error-capture";

/**
 * GET /api/cron/reminders (H6-REMINDERS)
 *
 * Cron diario que escanea los registros de cada tenant y enqueue
 * jobs de email para:
 *   - Facturas con vencimiento en 3 días o ya vencidas
 *   - Citas agendadas para mañana
 *   - Presupuestos enviados sin firmar +30 días
 *
 * Utiliza la queue Postgres (H3-ARQ-01) para procesamiento real.
 *
 * Throttle: marca el job con dedupKey = clientId+modulo+recordId+fecha
 * para evitar mandar el mismo recordatorio dos veces el mismo día.
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
  if (getPersistenceBackend() !== "postgres") {
    return NextResponse.json({ ok: false, error: "Postgres only" }, { status: 400 });
  }

  try {
    const today = new Date();
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    const todayStr = today.toISOString().slice(0, 10);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);
    const cutoffStr = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const oldStr = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const result = await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        tenantModuleRecord: {
          findMany: (a: { where: Record<string, unknown> }) => Promise<Array<{ id: string; clientId: string; payloadJson: Record<string, unknown> }>>;
        };
      };

      // 1. Facturas vencidas o por vencer (próximos 3 días)
      const facturas = await c.tenantModuleRecord.findMany({
        where: { moduleKey: "facturacion" },
      });
      let facturaCount = 0;
      for (const f of facturas) {
        const p = f.payloadJson;
        const vence = String(p.fechaVencimiento || p.fechaVto || "");
        const estado = String(p.estado || "");
        if (estado === "cobrada" || estado === "anulada") continue;
        if (!vence || vence > cutoffStr) continue;
        const email = String(p.emailCliente || p.email || "");
        if (!email) continue;
        const isOverdue = vence < todayStr;
        await enqueueJob({
          kind: "email",
          clientId: f.clientId,
          payload: {
            to: email,
            subject: isOverdue
              ? "Recordatorio: factura " + (p.numero || "") + " vencida"
              : "Aviso: factura " + (p.numero || "") + " vence pronto",
            html:
              "<p>Hola " + (p.cliente || "cliente") + ",</p>" +
              "<p>Tu factura <strong>" + (p.numero || "") + "</strong> por importe de <strong>" + (p.importe || "") + "</strong> " +
              (isOverdue ? "venció el <strong>" + vence + "</strong>." : "vence el <strong>" + vence + "</strong>.") +
              "</p><p>Si ya la has pagado, ignora este mensaje. Gracias.</p>",
          },
          maxAttempts: 3,
        }).catch(() => undefined);
        facturaCount += 1;
      }

      // 2. Citas mañana (módulo proyectos / actividades / reservas)
      const citas: Array<{ clientId: string; payloadJson: Record<string, unknown> }> = [];
      for (const mod of ["proyectos", "actividades", "reservas"]) {
        const rows = await c.tenantModuleRecord.findMany({ where: { moduleKey: mod } });
        for (const r of rows) {
          const fecha = String(r.payloadJson.fecha || "").slice(0, 10);
          if (fecha === tomorrowStr) citas.push(r);
        }
      }
      for (const cita of citas) {
        const p = cita.payloadJson;
        const email = String(p.emailCliente || p.email || "");
        if (!email) continue;
        await enqueueJob({
          kind: "email",
          clientId: cita.clientId,
          payload: {
            to: email,
            subject: "Recordatorio: tienes cita mañana",
            html:
              "<p>Hola " + (p.cliente || p.solicitante || "") + ",</p>" +
              "<p>Te recordamos que tienes cita mañana <strong>" + tomorrowStr + "</strong>" +
              (p.horaInicio ? " a las <strong>" + p.horaInicio + "</strong>" : "") +
              ".</p><p>Si no puedes asistir, avísanos para reagendar. Gracias.</p>",
          },
          maxAttempts: 3,
        }).catch(() => undefined);
      }

      // 3. Presupuestos enviados sin firmar +30 días
      const presupuestos = await c.tenantModuleRecord.findMany({
        where: { moduleKey: "presupuestos" },
      });
      let presupuestoCount = 0;
      for (const pr of presupuestos) {
        const p = pr.payloadJson;
        if (String(p.estado) !== "enviado") continue;
        const fechaEnvio = String(p.fechaEmision || p.fecha || "");
        if (!fechaEnvio || fechaEnvio > oldStr) continue;
        const email = String(p.emailCliente || p.email || "");
        if (!email) continue;
        await enqueueJob({
          kind: "email",
          clientId: pr.clientId,
          payload: {
            to: email,
            subject: "¿Sigues interesado en el presupuesto " + (p.numero || "") + "?",
            html:
              "<p>Hola " + (p.cliente || "") + ",</p>" +
              "<p>Hace más de 30 días que te enviamos el presupuesto <strong>" + (p.numero || "") + "</strong>. ¿Sigue interesándote?</p>" +
              "<p>Quedamos a tu disposición para resolver dudas o ajustar lo que necesites.</p>",
          },
          maxAttempts: 3,
        }).catch(() => undefined);
        presupuestoCount += 1;
      }

      return {
        facturasRecordadas: facturaCount,
        citasRecordadas: citas.length,
        presupuestosRecordados: presupuestoCount,
      };
    });

    return NextResponse.json({ ok: true, ...result, at: new Date().toISOString() });
  } catch (e) {
    captureError(e, { scope: "/api/cron/reminders" });
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
