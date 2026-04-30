import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireTenantSession } from "@/lib/saas/auth-session";
import { resolveRuntimeRequestContext } from "@/lib/saas/runtime-request-context";
import { assembleSoftwareFactoryOverview } from "@/lib/verticals/software-factory/overview";

/**
 * GET /api/software-factory/overview
 *
 * Devuelve el snapshot del dashboard del vertical Software Factory para el
 * tenant de la sesión firmada. Incluye:
 *   - KPIs específicos del vertical (pipeline, proyectos activos y en
 *     riesgo, propuestas abiertas, facturas pendientes, entregables
 *     recientes, carga operativa)
 *   - Pipeline desglosado por fase
 *   - Alertas operativas (proyectos en riesgo, facturas vencidas,
 *     propuestas estancadas)
 *   - Actividad reciente cruzada
 *   - Feed de entregables recientes
 *
 * Requiere sesión firmada (F-01) — el tenant se toma del token, no de
 * query. Sin sesión válida devuelve 401.
 *
 * No exige que el tenant tenga businessType `software-factory`: cualquier
 * tenant puede consumir la vista, pero la interpretación de campos y
 * copy es específica del vertical.
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
    const context = resolveRuntimeRequestContext(request);

    const overview = assembleSoftwareFactoryOverview({
      clientId: session.clientId,
      displayName:
        context.branding?.displayName ||
        context.config?.displayName ||
        context.tenant?.displayName ||
        "Tu software factory",
      businessType:
        context.branding?.businessType ||
        context.config?.businessType ||
        "software-factory",
    });

    return NextResponse.json(overview);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Error componiendo el overview.",
      },
      { status: 500 }
    );
  }
}
