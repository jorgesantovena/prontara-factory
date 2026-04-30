import { NextResponse } from "next/server";
import { getFactorySubscriptionsSnapshot } from "@/lib/factory/factory-subscriptions";

export async function GET() {
  try {
    const snapshot = getFactorySubscriptionsSnapshot();

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
            : "Error interno en /api/factory/suscripciones",
      },
      { status: 500 }
    );
  }
}