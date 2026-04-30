import { NextRequest, NextResponse } from "next/server";
import { buildDeliveryPackageFromRequest } from "@/lib/factory/delivery-package-builder";

export async function GET(request: NextRequest) {
  try {
    const deliveryPackage = buildDeliveryPackageFromRequest(request);

    return NextResponse.json({
      ok: true,
      deliveryPackage,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Error interno en /api/factory/delivery-package",
      },
      { status: 500 }
    );
  }
}