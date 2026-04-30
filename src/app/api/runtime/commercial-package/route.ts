import { NextRequest, NextResponse } from "next/server";
import { buildCommercialDeliveryPackageFromRequest } from "@/lib/commercial/commercial-composer";

export async function GET(request: NextRequest) {
  try {
    const delivery = buildCommercialDeliveryPackageFromRequest(request);

    return NextResponse.json({
      ok: true,
      delivery,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Error interno en /api/runtime/commercial-package",
      },
      { status: 500 }
    );
  }
}