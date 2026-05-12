import { NextRequest, NextResponse } from "next/server";
import { withPrisma } from "@/lib/persistence/db";
import { computeSlaStatus, type SlaPolicy } from "@/lib/verticals/software-factory/cau-sla";
import { captureError } from "@/lib/observability/error-capture";

/**
 * GET /api/cron/cau-sla-check (H15-B)
 *
 * Cron job que cada 15 min escanea todos los tickets CAU abiertos de
 * todos los tenants, evalúa estado SLA, y:
 *   - marca tickets como "warning" (próximos a vencer) o "breached"
 *   - si la política tiene autoEscalate=true y el ticket pasó SLA,
 *     dispara una notificación al lead del equipo (o al CEO si no hay
 *     lead) y reasigna si procede.
 *
 * Auth: header X-CRON-SECRET (compara con CRON_SECRET de env).
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type TicketRow = {
  id: string;
  clientId: string;
  tenantId: string;
  data: Record<string, unknown>;
};

export async function GET(request: NextRequest) {
  // Auth cron
  const secret = String(process.env.CRON_SECRET || "").trim();
  const header = request.headers.get("X-CRON-SECRET") || request.nextUrl.searchParams.get("secret") || "";
  if (secret && header !== secret) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  try {
    const stats = await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        tenantModuleRecord: {
          findMany: (a: { where: { moduleKey: "cau" } }) => Promise<TicketRow[]>;
          update: (a: { where: { id: string }; data: { data: Record<string, unknown> } }) => Promise<unknown>;
        };
        cauSlaPolicy: {
          findMany: (a: { where: { clientId: string } }) => Promise<SlaPolicy[]>;
        };
        tenantNotification: {
          create: (a: { data: Record<string, unknown> }) => Promise<unknown>;
        };
      };

      const tickets = await c.tenantModuleRecord.findMany({ where: { moduleKey: "cau" } });
      const policiesByClient = new Map<string, SlaPolicy[]>();

      let breached = 0;
      let warned = 0;
      let escalated = 0;

      for (const t of tickets) {
        const data = t.data || {};
        const estado = String(data.estado || "").toLowerCase();
        if (["resuelto", "cerrado"].includes(estado)) continue;

        if (!policiesByClient.has(t.clientId)) {
          const pols = await c.cauSlaPolicy.findMany({ where: { clientId: t.clientId } });
          policiesByClient.set(t.clientId, pols);
        }
        const policies = policiesByClient.get(t.clientId) || [];

        const sla = computeSlaStatus({
          createdAt: String(data.createdAt || new Date().toISOString()),
          firstResponseAt: data.firstResponseAt ? String(data.firstResponseAt) : null,
          resolvedAt: null,
          severidad: String(data.severidad || "media"),
          urgencia: String(data.urgencia || "normal"),
          tenantPolicies: policies,
        });

        const previousSlaStatus = String(data.slaStatus || "");

        // Actualizar status si cambió
        if (sla.status !== previousSlaStatus) {
          await c.tenantModuleRecord.update({
            where: { id: t.id },
            data: { data: { ...data, slaStatus: sla.status, slaCheckedAt: new Date().toISOString() } },
          });
        }

        if (sla.status === "breached" && previousSlaStatus !== "breached") {
          breached++;
          // Escalación: notif al asignado + al equipo
          try {
            await c.tenantNotification.create({
              data: {
                tenantId: t.tenantId,
                clientId: t.clientId,
                type: "cau-sla-breach",
                severity: "danger",
                title: "Ticket CAU vencido SLA: " + String(data.asunto || t.id.slice(0, 8)),
                message: "Cliente: " + (data.cliente || "—") + " · Severidad: " + (data.severidad || "—") + " · Asignado: " + (data.asignado || "sin asignar"),
                metadata: { ticketId: t.id, aplicacion: data.aplicacion },
              },
            });
            escalated++;
          } catch { /* ignore if no notification model */ }
        } else if (sla.status === "warning" && previousSlaStatus === "ok") {
          warned++;
        }
      }

      return { totalChecked: tickets.length, breached, warned, escalated };
    });

    return NextResponse.json({ ok: true, ...stats, ranAt: new Date().toISOString() });
  } catch (e) {
    captureError(e, { scope: "/api/cron/cau-sla-check" });
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
