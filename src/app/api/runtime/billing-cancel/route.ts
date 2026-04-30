import { NextRequest, NextResponse } from "next/server";
import { cancelPlanFromRequest } from "@/lib/saas/billing-engine";

export async function POST(request: NextRequest) {
  try {
    const overview = cancelPlanFromRequest(request);

    if (!overview) {
      return NextResponse.json(
        {
          ok: false,
          error: "No se pudo cancelar la suscripción del tenant solicitado.",
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
        error:
          error instanceof Error
            ? error.message
            : "Error interno cancelando suscripción.",
      },
      { status: 500 }
    );
  }
}