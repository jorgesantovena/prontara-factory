import { NextResponse } from "next/server";
import { getFactoryDeliverySnapshot } from "@/lib/factory/factory-delivery";

export async function GET() {
  try {
    const snapshot = getFactoryDeliverySnapshot();

    return NextResponse.json({
      ok: true,
      snapshot,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Error interno en /api/factory/entregas",
      },
      { status: 500 }
    );
  }
}