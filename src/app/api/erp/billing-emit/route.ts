import { NextRequest, NextResponse } from "next/server";
import { requireTenantSession } from "@/lib/saas/auth-session";
import { checkTenantSubscriptionAsync } from "@/lib/saas/subscription-guard";
import { emitMonthlyBilling } from "@/lib/verticals/software-factory/billing-emit";

/**
 * POST /api/erp/billing-emit (SF-02)
 *
 * Emite facturas reales desde actividades pendientes del vertical Software
 * Factory. Body opcional:
 *   {
 *     mes?: "YYYY-MM",        // mes a facturar; default = mes actual UTC
 *     cliente?: "Acme Labs"   // si se pasa, solo se emite ese cliente
 *   }
 *
 * Devuelve la lista de facturas creadas con su número correlativo y el
 * total de actividades marcadas como facturadas.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json(
    { ok: false, error: "Sesión no válida o tenant no autorizado." },
    { status: 401 },
  );
}

export async function POST(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) return unauthorized();

    const subscription = await checkTenantSubscriptionAsync(session);
    if (!subscription.allowed) {
      return NextResponse.json(
        {
          ok: false,
          error: subscription.reason,
          code: subscription.code,
          subscriptionStatus: subscription.record.status,
        },
        { status: 403 },
      );
    }

    let body: { mes?: string; cliente?: string } = {};
    try {
      body = (await request.json()) as { mes?: string; cliente?: string };
    } catch {
      // Body opcional: si viene vacío o malformado, usamos defaults.
    }

    const result = await emitMonthlyBilling({
      clientId: session.clientId,
      mes: body?.mes,
      cliente: body?.cliente,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Error emitiendo facturas.",
      },
      { status: 500 },
    );
  }
}
