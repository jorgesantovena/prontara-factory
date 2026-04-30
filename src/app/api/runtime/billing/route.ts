import { NextRequest, NextResponse } from "next/server";
import { getBillingOverviewFromRequest } from "@/lib/saas/billing-engine";

export async function GET(request: NextRequest) {
  try {
    const overview = getBillingOverviewFromRequest(request);

    if (!overview) {
      return NextResponse.json(
        {
          ok: false,
          error: "No se pudo resolver la suscripción del tenant solicitado.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      overview,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Error interno en billing.",
      },
      { status: 500 }
    );
  }
}