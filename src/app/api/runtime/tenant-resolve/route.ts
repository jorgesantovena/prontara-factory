import { NextRequest, NextResponse } from "next/server";
import { resolveTenantFromRequest } from "@/lib/saas/tenant-resolver";

export async function GET(request: NextRequest) {
  try {
    const resolution = resolveTenantFromRequest(request);

    if (!resolution.ok) {
      return NextResponse.json(
        {
          ok: false,
          source: resolution.source,
          requestedSlug: resolution.requestedSlug,
          tenant: null,
          error: "No se pudo resolver el tenant solicitado.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      source: resolution.source,
      requestedSlug: resolution.requestedSlug,
      tenant: resolution.tenant,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Error interno en /api/runtime/tenant-resolve",
      },
      { status: 500 }
    );
  }
}