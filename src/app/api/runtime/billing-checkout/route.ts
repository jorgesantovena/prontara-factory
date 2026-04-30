import { NextRequest, NextResponse } from "next/server";
import { createBillingCheckoutFromRequest } from "@/lib/saas/billing-engine";
import type { BillingPlanKey } from "@/lib/saas/billing-definition";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const planKey = String(body?.planKey || "").trim() as BillingPlanKey;

    if (!planKey || planKey === "trial") {
      return NextResponse.json(
        {
          ok: false,
          error: "Debes indicar un plan de pago válido.",
        },
        { status: 400 }
      );
    }

    const checkout = await createBillingCheckoutFromRequest(request, planKey);

    if (!checkout) {
      return NextResponse.json(
        {
          ok: false,
          error: "No se pudo crear el checkout para el tenant solicitado.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      checkout,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Error interno creando checkout de Stripe.",
      },
      { status: 500 }
    );
  }
}