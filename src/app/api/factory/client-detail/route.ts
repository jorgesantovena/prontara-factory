import { NextRequest, NextResponse } from "next/server";
import { getFactoryClientDetail } from "@/lib/factory/factory-client-detail";

export async function GET(request: NextRequest) {
  try {
    const clientId = String(request.nextUrl.searchParams.get("clientId") || "").trim();

    if (!clientId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Falta clientId.",
        },
        { status: 400 }
      );
    }

    const snapshot = await getFactoryClientDetail(clientId);

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
            : "Error interno en /api/factory/client-detail",
      },
      { status: 500 }
    );
  }
}