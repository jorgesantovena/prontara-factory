import { NextRequest, NextResponse } from "next/server";
import { buildFactoryRuntimeBridge } from "@/lib/factory/factory-runtime-bridge";
import { listTenantClientsIndex } from "@/lib/saas/tenant-clients-index";

export async function GET(request: NextRequest) {
  try {
    const bridge = buildFactoryRuntimeBridge(request);
    const clients = listTenantClientsIndex();

    return NextResponse.json({
      ok: true,
      active: bridge,
      clients,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Error interno en /api/factory/active",
      },
      { status: 500 }
    );
  }
}