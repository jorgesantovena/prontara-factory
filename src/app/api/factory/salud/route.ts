import { NextResponse } from "next/server";
import { getFactoryHealthSnapshot } from "@/lib/factory/factory-health";

export async function GET() {
  try {
    const snapshot = getFactoryHealthSnapshot();

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
            : "Error interno en /api/factory/salud",
      },
      { status: 500 }
    );
  }
}