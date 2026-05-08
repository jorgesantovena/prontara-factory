import { NextResponse, type NextRequest } from "next/server";
import { withPrisma, getPersistenceBackend } from "@/lib/persistence/db";

/**
 * GET /api/factory/metrics (H2-METRICS)
 *
 * Métricas operativas del SaaS Prontara para el operador. Solo accesible
 * desde el backoffice del operador (cookie de Factory). Lectura agregada
 * de Tenant + BillingSubscription + TrialState.
 *
 * Devuelve:
 *   - totalTenants
 *   - tenantsByStatus { provisioning, active, suspended, cancelled }
 *   - trialActivos
 *   - mrrEstimadoCents (suma de seats * precio_por_plan_mensual)
 *   - nuevosUltimos30Dias
 *   - cancelados30Dias
 *   - tenantsByVertical { businessType -> count }
 *
 * Hoy NO valida auth de operador (Factory) — es un endpoint público a
 * propósito en MVP. En producción protegerlo con cookie de operador.
 * TODO: añadir guard de cookie Factory.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PLAN_PRICE_CENTS: Record<string, number> = {
  trial: 0,
  basico: 1900,    // 19€/mes (placeholder)
  estandar: 4900,  // 49€/mes
  premium: 9900,   // 99€/mes
};

export async function GET(request: NextRequest) {
  void request;
  try {
    if (getPersistenceBackend() !== "postgres") {
      return NextResponse.json({ ok: false, error: "Solo Postgres." }, { status: 400 });
    }

    const data = await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        tenant: {
          findMany: (a: {
            select: {
              clientId: true;
              status: true;
              businessType: true;
              createdAt: true;
            };
          }) => Promise<Array<{
            clientId: string;
            status: string;
            businessType: string | null;
            createdAt: Date;
          }>>;
        };
        billingSubscription: {
          findMany: (a: {
            select: {
              clientId: true;
              currentPlanKey: true;
              status: true;
              seats: true;
              cancelAt: true;
              updatedAt: true;
            };
          }) => Promise<Array<{
            clientId: string;
            currentPlanKey: string;
            status: string;
            seats: number;
            cancelAt: Date | null;
            updatedAt: Date;
          }>>;
        };
        trialState: {
          count: (a: { where: { status: string } }) => Promise<number>;
        };
      };

      const tenants = await c.tenant.findMany({
        select: { clientId: true, status: true, businessType: true, createdAt: true },
      });
      const subs = await c.billingSubscription.findMany({
        select: {
          clientId: true,
          currentPlanKey: true,
          status: true,
          seats: true,
          cancelAt: true,
          updatedAt: true,
        },
      });
      const trialActivos = await c.trialState.count({ where: { status: "active" } });

      return { tenants, subs, trialActivos };
    });

    if (!data) {
      return NextResponse.json({ ok: false, error: "DB no devolvió datos." }, { status: 500 });
    }

    const { tenants, subs, trialActivos } = data;
    const now = Date.now();
    const ms30dias = 30 * 24 * 60 * 60 * 1000;

    // Conteos por status
    const tenantsByStatus: Record<string, number> = {};
    for (const t of tenants) {
      tenantsByStatus[t.status] = (tenantsByStatus[t.status] || 0) + 1;
    }

    // Conteos por vertical
    const tenantsByVertical: Record<string, number> = {};
    for (const t of tenants) {
      const bt = t.businessType || "(sin vertical)";
      tenantsByVertical[bt] = (tenantsByVertical[bt] || 0) + 1;
    }

    // MRR
    let mrrEstimadoCents = 0;
    for (const s of subs) {
      if (s.status !== "active") continue;
      const price = PLAN_PRICE_CENTS[s.currentPlanKey] ?? 0;
      mrrEstimadoCents += price * (s.seats || 1);
    }

    // Nuevos últimos 30 días
    const nuevosUltimos30Dias = tenants.filter(
      (t) => now - new Date(t.createdAt).getTime() <= ms30dias,
    ).length;

    // Cancelados últimos 30 días (subs con cancelAt en ese rango o status cancelled actualizado en ese rango)
    const cancelados30Dias = subs.filter((s) => {
      if (s.status !== "cancelled") return false;
      const ref = s.cancelAt || s.updatedAt;
      return now - new Date(ref).getTime() <= ms30dias;
    }).length;

    // Activos para churn rate
    const activos = subs.filter((s) => s.status === "active").length;
    const churnRate30Dias =
      activos + cancelados30Dias > 0
        ? Math.round((cancelados30Dias / (activos + cancelados30Dias)) * 1000) / 10
        : 0;

    return NextResponse.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      totalTenants: tenants.length,
      tenantsByStatus,
      trialActivos,
      mrrEstimadoCents,
      mrrEstimadoEur: Math.round(mrrEstimadoCents) / 100,
      nuevosUltimos30Dias,
      cancelados30Dias,
      churnRate30Dias,
      tenantsByVertical,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Error métricas" },
      { status: 500 },
    );
  }
}
