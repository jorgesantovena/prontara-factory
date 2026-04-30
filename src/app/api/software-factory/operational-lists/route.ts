import { NextResponse, type NextRequest } from "next/server";
import { requireTenantSession } from "@/lib/saas/auth-session";
import {
  listProjectsAtRisk,
  listStaleProposals,
  listOverdueInvoices,
} from "@/lib/verticals/software-factory/operational-lists";

/**
 * GET /api/software-factory/operational-lists?kind=proyectos-riesgo|propuestas-estancadas|facturas-vencidas
 * Lista operativa puntual del vertical Software Factory. Si no se pasa kind,
 * devuelve los tres arrays en un solo payload.
 */
export async function GET(request: NextRequest) {
  const session = requireTenantSession(request);
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "Sesión no válida." },
      { status: 401 },
    );
  }

  const kind = request.nextUrl.searchParams.get("kind") || "all";
  try {
    if (kind === "proyectos-riesgo") {
      return NextResponse.json({
        ok: true,
        rows: listProjectsAtRisk(session.clientId),
      });
    }
    if (kind === "propuestas-estancadas") {
      return NextResponse.json({
        ok: true,
        rows: listStaleProposals(session.clientId),
      });
    }
    if (kind === "facturas-vencidas") {
      return NextResponse.json({
        ok: true,
        rows: listOverdueInvoices(session.clientId),
      });
    }
    return NextResponse.json({
      ok: true,
      projectsAtRisk: listProjectsAtRisk(session.clientId),
      staleProposals: listStaleProposals(session.clientId),
      overdueInvoices: listOverdueInvoices(session.clientId),
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Error componiendo listas.",
      },
      { status: 500 },
    );
  }
}
