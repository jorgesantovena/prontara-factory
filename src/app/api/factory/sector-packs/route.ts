import { NextRequest, NextResponse } from "next/server";
import { listSectorPacks } from "@/lib/factory/sector-pack-registry";

export async function GET(_request: NextRequest) {
  try {
    return NextResponse.json({
      ok: true,
      packs: listSectorPacks(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Error interno en /api/factory/sector-packs",
      },
      { status: 500 }
    );
  }
}