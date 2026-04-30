import { NextRequest, NextResponse } from "next/server";
import { resolveBusinessBlueprintFromRequest } from "@/lib/factory/blueprint-resolver";
import { assembleGenerationFromBlueprint } from "@/lib/factory/generation-assembler";

export async function GET(request: NextRequest) {
  try {
    const blueprint = resolveBusinessBlueprintFromRequest(request);
    const assembly = assembleGenerationFromBlueprint(blueprint);

    return NextResponse.json({
      ok: true,
      assembly,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Error interno en /api/factory/assemble",
      },
      { status: 500 }
    );
  }
}