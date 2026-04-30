import { NextRequest, NextResponse } from "next/server";
import { getTenantRuntimeConfigFromRequest } from "@/lib/saas/tenant-runtime-config";

export async function GET(request: NextRequest) {
  try {
    const runtime = getTenantRuntimeConfigFromRequest(request);
    const config = runtime.config;

    if (!config) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "No se pudo resolver el tenant desde la petición (falta cookie o slug).",
          source: runtime.source,
          requestedSlug: runtime.requestedSlug,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      preview: {
        displayName: config.displayName,
        sector: config.sector,
        businessType: config.businessType,
        labels: config.labels,
        modules: config.moduleKeys,
        branding: config.branding,
        landing: config.landing,
        assistantCopy: config.assistantCopy,
        entities: config.entities,
        dashboardPriorities: config.dashboardPriorities,
        packMeta: config.packMeta,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Error interno en /api/runtime/sector-preview",
      },
      { status: 500 }
    );
  }
}
