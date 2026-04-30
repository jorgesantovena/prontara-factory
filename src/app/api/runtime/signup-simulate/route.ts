import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { simulateSignupFromRequest } from "@/lib/saas/signup-simulator";

export async function POST(request: NextRequest) {
  try {
    const result = await simulateSignupFromRequest(request);

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          source: result.source,
          requestedSlug: result.requestedSlug,
          error: "No se pudo simular el signup del tenant.",
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

export async function GET(request: NextRequest) {
  return POST(request);
}