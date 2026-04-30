import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { resolveRuntimeRequestContext } from "@/lib/saas/runtime-request-context";

export async function GET(request: NextRequest) {
  try {
    const context = resolveRuntimeRequestContext(request);

    if (!context.ok) {
      return NextResponse.json(
        {
          ok: false,
          source: context.source,
          requestedSlug: context.requestedSlug,
          tenant: null,
          branding: null,
          config: null,
          artifacts: null,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      source: context.source,
      requestedSlug: context.requestedSlug,
      tenant: context.tenant,
      branding: context.branding,
      config: context.config,
      artifacts: context.artifacts,
      clientId: context.clientId,
    });
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