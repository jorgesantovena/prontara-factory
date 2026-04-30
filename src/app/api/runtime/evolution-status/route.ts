import { NextRequest, NextResponse } from "next/server";
import { getEvolutionStatusFromRequest } from "@/lib/saas/evolution-engine";

export async function GET(request: NextRequest) {
  try {
    const status = getEvolutionStatusFromRequest(request);

    return NextResponse.json({
      ok: true,
      status,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Error interno en /api/runtime/evolution-status",
      },
      { status: 500 }
    );
  }
}