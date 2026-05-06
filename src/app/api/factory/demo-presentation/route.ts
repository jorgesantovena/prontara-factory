import { NextRequest, NextResponse } from "next/server";
import { buildDemoPresentationFromRequest } from "@/lib/factory/demo-presentation";

export async function GET(request: NextRequest) {
  try {
    const presentation = await buildDemoPresentationFromRequest(request);

    return NextResponse.json({
      ok: true,
      presentation,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Error interno en /api/factory/demo-presentation",
      },
      { status: 500 }
    );
  }
}