import { NextRequest, NextResponse } from "next/server";
import { resolveBusinessBlueprintFromRequest } from "@/lib/factory/blueprint-resolver";
import { composeRuntimeConfigFromBlueprint } from "@/lib/factory/runtime-config-composer";

export async function GET(request: NextRequest) {
  try {
    const blueprint = resolveBusinessBlueprintFromRequest(request);
    const runtimeConfig = composeRuntimeConfigFromBlueprint(blueprint);

    return NextResponse.json({
      ok: true,
      blueprint,
      runtimeConfig,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Error interno en /api/factory/blueprint",
      },
      { status: 500 }
    );
  }
}