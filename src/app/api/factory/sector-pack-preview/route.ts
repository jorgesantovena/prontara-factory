import { NextRequest, NextResponse } from "next/server";
import { buildSectorPackPreviewFromRequest, mergePackWithBlueprint } from "@/lib/factory/sector-pack-resolver";
import { resolveBusinessBlueprintFromRequest } from "@/lib/factory/blueprint-resolver";

export async function GET(request: NextRequest) {
  try {
    const preview = buildSectorPackPreviewFromRequest(request);
    const blueprint = resolveBusinessBlueprintFromRequest(request);

    return NextResponse.json({
      ok: preview.ok,
      preview,
      merged:
        preview.resolvedPack.pack && blueprint
          ? mergePackWithBlueprint(
              preview.resolvedPack.pack,
              blueprint.modules.map((item) => item.moduleKey)
            )
          : null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Error interno en /api/factory/sector-pack-preview",
      },
      { status: 500 }
    );
  }
}