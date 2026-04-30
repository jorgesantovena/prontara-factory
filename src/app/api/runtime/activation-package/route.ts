import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { buildActivationPackageFromRequest } from "@/lib/saas/activation-package";

export async function GET(request: NextRequest) {
  try {
    const result = buildActivationPackageFromRequest(request);

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          source: result.source,
          requestedSlug: result.requestedSlug,
          error: "No se pudo generar el activation package.",
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