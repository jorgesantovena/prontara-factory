import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireTenantSession } from "@/lib/saas/auth-session";
import { getDashboardSnapshot } from "@/lib/erp/dashboard-metrics";
import { getStartupReadiness } from "@/lib/erp/startup-readiness";
import { resolveRuntimeRequestContextAsync } from "@/lib/saas/runtime-request-context-async";
import { getTenantRuntimeConfigFromRequest } from "@/lib/saas/tenant-runtime-config";
import { buildOperationalAlerts } from "@/lib/erp/operational-alerts";
import { buildSoftwareFactoryAlertsAsync } from "@/lib/verticals/software-factory/alerts";
import { getOrCreateTrialState } from "@/lib/saas/trial-store";
import { checkTenantSubscription } from "@/lib/saas/subscription-guard";

/**
 * GET /api/runtime/dashboard
 *
 * Devuelve un snapshot del runtime para el tenant de la sesión firmada:
 *   - métricas básicas por módulo (clientes, CRM, pipeline, proyectos, presupuestos, facturas)
 *   - actividad reciente cruzada (hasta 12 eventos)
 *   - acciones rápidas contextuales
 *   - readiness de arranque (score 0-100 + status textual)
 *   - branding mínimo del tenant para pintar cabecera
 *
 * Requiere sesión firmada: el tenant se toma del token, nunca de query/header
 * (ver F-01). Sin sesión válida devuelve 401.
 */
export async function GET(request: NextRequest) {
  const session = requireTenantSession(request);
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "Sesión no válida o tenant no autorizado." },
      { status: 401 }
    );
  }

  try {
    const snapshot = await getDashboardSnapshot(session.clientId);
    const readiness = getStartupReadiness(snapshot);
    const context = await resolveRuntimeRequestContextAsync(request);
    const runtimeConfig = getTenantRuntimeConfigFromRequest(request);
    const dashboardPriorities =
      runtimeConfig.ok && runtimeConfig.config
        ? runtimeConfig.config.dashboardPriorities
        : [];
    const alerts = await buildOperationalAlerts(session.clientId);

    // Si el tenant es del vertical Software Factory, añadimos alertas
    // específicas de caducidad de proyectos. La función no falla si no
    // hay módulo proyectos o no hay datos — devuelve array vacío.
    const isSoftwareFactory =
      String(context.tenant?.businessType || "").toLowerCase() ===
      "software-factory";
    if (isSoftwareFactory) {
      try {
        const sfAlerts = await buildSoftwareFactoryAlertsAsync(session.clientId);
        alerts.push(...sfAlerts);
      } catch {
        // Si falla el cálculo de alertas SF, dejamos las genéricas y seguimos.
      }
    }

    // Estado del trial. El tenant-guard marca `active | expired`; para la
    // UI también exponemos días restantes y fecha de expiración.
    const trial = (() => {
      try {
        return getOrCreateTrialState({
          tenantId: session.tenantId,
          clientId: session.clientId,
          slug: session.slug,
        });
      } catch {
        return null;
      }
    })();

    // Estado de suscripción para pintar banner bloqueante cuando aplique.
    const subscriptionCheck = (() => {
      try {
        return checkTenantSubscription(session);
      } catch {
        return null;
      }
    })();
    const subscription = subscriptionCheck
      ? {
          allowed: subscriptionCheck.allowed,
          status: subscriptionCheck.record.status,
          reason: !subscriptionCheck.allowed ? subscriptionCheck.reason : null,
        }
      : null;

    return NextResponse.json({
      ok: true,
      tenant: {
        clientId: session.clientId,
        slug: session.slug,
        displayName:
          context.branding?.displayName ||
          context.config?.displayName ||
          context.tenant?.displayName ||
          null,
        shortName: context.branding?.shortName || null,
        accentColor: context.branding?.accentColor || null,
      },
      snapshot,
      readiness,
      dashboardPriorities,
      alerts,
      trial,
      subscription,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Error cargando dashboard.",
      },
      { status: 500 }
    );
  }
}
