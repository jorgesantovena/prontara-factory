import { NextRequest, NextResponse } from "next/server";
import { buildFactoryRuntimeBridge } from "@/lib/factory/factory-runtime-bridge";

export async function GET(request: NextRequest) {
  try {
    const bridge = buildFactoryRuntimeBridge(request);

    return NextResponse.json({
      ok: true,
      download: {
        tenantId: bridge.tenant.tenantId,
        clientId: bridge.tenant.clientId,
        slug: bridge.tenant.slug,
        displayName: bridge.tenant.displayName,
        runtimeReady: Boolean(bridge.runtime?.ok),
        diskReady: Boolean(bridge.disk),
        note: "Descarga preparada desde contexto tenant, sin depender de cliente activo global.",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Error interno en /api/factory/download",
      },
      { status: 500 }
    );
  }
}