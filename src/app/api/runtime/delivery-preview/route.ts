import { NextRequest, NextResponse } from "next/server";
import { buildDeliveryPreviewFromRequest } from "@/lib/commercial/delivery-experience";

export async function GET(request: NextRequest) {
  try {
    const preview = buildDeliveryPreviewFromRequest(request);

    return NextResponse.json({
      ok: true,
      preview,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Error interno en /api/runtime/delivery-preview",
      },
      { status: 500 }
    );
  }
}