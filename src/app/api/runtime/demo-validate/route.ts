import { NextRequest, NextResponse } from "next/server";
import { validateCommercialFlowFromRequest } from "@/lib/commercial/demo-scenario";

export async function GET(request: NextRequest) {
  try {
    const validation = validateCommercialFlowFromRequest(request);

    return NextResponse.json({
      ok: true,
      validation,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Error interno en /api/runtime/demo-validate",
      },
      { status: 500 }
    );
  }
}