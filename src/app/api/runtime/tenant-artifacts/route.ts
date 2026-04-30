import { NextResponse } from "next/server";
import { resolveActiveTenantArtifacts } from "@/lib/saas/tenant-artifacts";

export async function GET() {
  try {
    const artifacts = resolveActiveTenantArtifacts();

    return NextResponse.json({
      ok: true,
      artifacts,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Error interno en /api/runtime/tenant-artifacts",
      },
      { status: 500 }
    );
  }
}