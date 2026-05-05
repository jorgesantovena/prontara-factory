import { NextResponse } from "next/server";
import { readActiveTenantState } from "@/lib/saas/tenant-registry";
import {
  listAllTenantsAsync,
  resolveActiveTenantAsync,
} from "@/lib/saas/tenant-resolver-async";

export async function GET() {
  try {
    const activeState = readActiveTenantState();
    const activeTenant = await resolveActiveTenantAsync();
    const tenants = await listAllTenantsAsync();

    return NextResponse.json({
      ok: true,
      activeTenantState: activeState,
      activeTenant,
      tenants,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Error interno en /api/runtime/tenant",
      },
      { status: 500 }
    );
  }
}