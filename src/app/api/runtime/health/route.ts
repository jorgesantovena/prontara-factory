import { NextRequest, NextResponse } from "next/server";
import { buildFactoryRuntimeBridge } from "@/lib/factory/factory-runtime-bridge";
import { runFactoryHardening } from "@/lib/factory/factory-hardening";

export async function GET(request: NextRequest) {
  try {
    const bridge = buildFactoryRuntimeBridge(request);
    const hardening = runFactoryHardening();

    return NextResponse.json({
      ok: true,
      health: {
        tenant: bridge.tenant,
        runtimeReady: bridge.runtime?.ok || false,
        diskReady: Boolean(bridge.disk),
        hardening,
        stable:
          Boolean(bridge.runtime?.ok) &&
          Boolean(bridge.disk) &&
          hardening.summary.corruptClients === 0,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Error interno en /api/runtime/health",
      },
      { status: 500 }
    );
  }
}