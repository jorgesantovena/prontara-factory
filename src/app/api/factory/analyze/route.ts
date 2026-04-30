import { NextRequest, NextResponse } from "next/server";
import { buildFactoryRuntimeBridge } from "@/lib/factory/factory-runtime-bridge";
import { readFactoryDiskHistory } from "@/lib/factory/factory-disk-history";

export async function GET(request: NextRequest) {
  try {
    const bridge = buildFactoryRuntimeBridge(request);
    const history = readFactoryDiskHistory();

    return NextResponse.json({
      ok: true,
      analysis: {
        tenant: bridge.tenant,
        disk: bridge.disk,
        totalClients: history.length,
        healthyClients: history.filter((item) => item.state === "healthy").length,
        partialClients: history.filter((item) => item.state === "partial").length,
        corruptClients: history.filter((item) => item.state === "corrupt").length,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Error interno en /api/factory/analyze",
      },
      { status: 500 }
    );
  }
}