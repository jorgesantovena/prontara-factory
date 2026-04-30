import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { buildActivationEmailFromRequest } from "@/lib/saas/activation-email-builder";

export async function GET(request: NextRequest) {
  try {
    const result = buildActivationEmailFromRequest(request);

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          source: result.source,
          requestedSlug: result.requestedSlug,
          error: "No se pudo generar el preview del email.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Error inesperado.",
      },
      { status: 500 }
    );
  }
}