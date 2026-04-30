import { NextRequest, NextResponse } from "next/server";
import { buildFactoryRuntimeBridge } from "@/lib/factory/factory-runtime-bridge";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const prompt = String(body?.prompt || "").trim();
    const bridge = buildFactoryRuntimeBridge(request);

    return NextResponse.json({
      ok: true,
      result: {
        prompt,
        tenant: bridge.tenant,
        summary:
          "Comando procesado con bridge factory-runtime tenant-aware y sin depender del cliente activo legacy.",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Error interno en /api/factory/command",
      },
      { status: 500 }
    );
  }
}