import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { resolveRequestTenantRuntimeAsync } from "@/lib/saas/request-tenant-runtime-async";

export async function GET(request: NextRequest) {
  try {
    const result = await resolveRequestTenantRuntimeAsync(request);

    if (!result.ok || !result.config) {
      return NextResponse.json(
        {
          ok: false,
          source: result.source,
          requestedSlug: result.requestedSlug,
          error: "No se pudo resolver la configuración runtime del tenant.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      source: result.source,
      requestedSlug: result.requestedSlug,
      config: result.config,
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