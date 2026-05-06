import { NextResponse, type NextRequest } from "next/server";
import { requireTenantSession } from "@/lib/saas/auth-session";
import { getMonthlyBillingPreview } from "@/lib/verticals/software-factory/billing-preview";

/**
 * GET /api/runtime/software-factory/billing-preview?mes=YYYY-MM
 *
 * Devuelve la previsión de facturación del mes para el tenant de la sesión.
 * Si `mes` no se pasa, usa el mes actual.
 *
 * Solo aplica al vertical Software Factory. Otros verticales obtienen 200
 * con clientes vacíos (no falla, simplemente no hay datos).
 */
export async function GET(request: NextRequest) {
  const session = requireTenantSession(request);
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "Sesión no válida o tenant no autorizado." },
      { status: 401 },
    );
  }

  const mes = request.nextUrl.searchParams.get("mes") || undefined;

  try {
    const preview = await getMonthlyBillingPreview(session.clientId, mes);
    return NextResponse.json({ ok: true, preview });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Error calculando previsión.",
      },
      { status: 500 },
    );
  }
}
