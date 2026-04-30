import { NextRequest, NextResponse } from "next/server";
import { resolveRuntimeRequestContext } from "@/lib/saas/runtime-request-context";

export async function GET(request: NextRequest) {
  try {
    const context = resolveRuntimeRequestContext(request);

    if (!context.ok || !context.config) {
      return NextResponse.json(
        {
          ok: false,
          source: context.source,
          requestedSlug: context.requestedSlug,
          clientId: context.clientId,
          error: "No se pudo resolver la configuracion runtime para el tenant solicitado.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      source: context.source,
      requestedSlug: context.requestedSlug,
      clientId: context.clientId,
      tenant: context.tenant,
      branding: context.branding,
      config: context.config,
      artifacts: context.artifacts,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Error interno en /api/factory/runtime-config",
      },
      { status: 500 }
    );
  }
}