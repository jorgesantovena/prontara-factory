import { NextResponse } from "next/server";
import { resolveActiveTenantBranding } from "@/lib/saas/tenant-branding";

export async function GET() {
  try {
    const branding = resolveActiveTenantBranding();

    return NextResponse.json({
      ok: true,
      branding,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Error interno en /api/runtime/tenant-branding",
      },
      { status: 500 }
    );
  }
}