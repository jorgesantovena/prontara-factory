import { NextRequest, NextResponse } from "next/server";
import { requireTenantSession } from "@/lib/saas/auth-session";
import { withPrisma } from "@/lib/persistence/db";
import { listModuleRecordsAsync } from "@/lib/persistence/active-client-data-store-async";
import { computeCauMetrics, computeSlaStatus, type SlaPolicy } from "@/lib/verticals/software-factory/cau-sla";
import { captureError } from "@/lib/observability/error-capture";

/**
 * GET /api/runtime/cau/metrics (H15-B)
 *
 * Devuelve métricas agregadas del CAU del tenant:
 *   - totalTickets, openCount, resolvedCount
 *   - mtrHours (Mean Time to Resolve), slaCompliancePct
 *   - breachedOpenCount
 *   - topClients (top 5 clientes con más tickets)
 *   - topApplications (top 5 aplicaciones con más tickets)
 *   - distribución por estado, severidad, urgencia
 *
 * Y la lista de tickets con su SLA status para que la UI pinte los bullets
 * de color.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) return NextResponse.json({ ok: false, error: "Sesión inválida." }, { status: 401 });

    const tickets = (await listModuleRecordsAsync("cau", session.clientId)) as Array<Record<string, string>>;

    // Cargamos las políticas SLA del tenant (si hay alguna configurada)
    const policiesRaw = await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        cauSlaPolicy: {
          findMany: (a: { where: { clientId: string } }) => Promise<SlaPolicy[]>;
        };
      };
      return await c.cauSlaPolicy.findMany({ where: { clientId: session.clientId } });
    }).catch(() => [] as SlaPolicy[]);
    const policies: SlaPolicy[] = policiesRaw || [];

    const enriched = tickets.map((t) => {
      const sla = computeSlaStatus({
        createdAt: String(t.createdAt || t.fechaCreacion || new Date().toISOString()),
        firstResponseAt: t.firstResponseAt ? String(t.firstResponseAt) : null,
        resolvedAt: t.resolvedAt ? String(t.resolvedAt) : null,
        severidad: String(t.severidad || "media"),
        urgencia: String(t.urgencia || "normal"),
        tenantPolicies: policies,
      });
      return { id: t.id, ...t, slaStatus: sla.status, slaBreached: sla.firstResponseBreached || sla.resolutionBreached };
    });

    const metrics = computeCauMetrics(
      tickets.map((t) => ({
        createdAt: String(t.createdAt || t.fechaCreacion || new Date().toISOString()),
        firstResponseAt: t.firstResponseAt || null,
        resolvedAt: t.resolvedAt || null,
        severidad: String(t.severidad || "media"),
        urgencia: String(t.urgencia || "normal"),
      })),
      policies,
    );

    // Top clientes
    const byClient: Record<string, number> = {};
    for (const t of tickets) {
      const c = String(t.cliente || "—");
      byClient[c] = (byClient[c] || 0) + 1;
    }
    const topClients = Object.entries(byClient).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, n]) => ({ name, count: n }));

    // Top aplicaciones
    const byApp: Record<string, number> = {};
    for (const t of tickets) {
      const a = String(t.aplicacion || "—");
      byApp[a] = (byApp[a] || 0) + 1;
    }
    const topApplications = Object.entries(byApp).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, n]) => ({ name, count: n }));

    return NextResponse.json({
      ok: true,
      metrics,
      tickets: enriched,
      topClients,
      topApplications,
      policiesConfigured: policies.length,
    });
  } catch (e) {
    captureError(e, { scope: "/api/runtime/cau/metrics" });
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
