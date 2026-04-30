import { NextRequest, NextResponse } from "next/server";
import { buildSectorPackPreviewFromRequest } from "@/lib/factory/sector-pack-resolver";

export async function GET(request: NextRequest) {
  try {
    const preview = buildSectorPackPreviewFromRequest(request);

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
            : "Error interno en /api/factory/sector-pack",
      },
      { status: 500 }
    );
  }
}