import { NextResponse } from "next/server";
import {
  listDiskTenants,
  readActiveTenantState,
  resolveActiveTenant,
} from "@/lib/saas/tenant-registry";

export async function GET() {
  try {
    const activeState = readActiveTenantState();
    const activeTenant = resolveActiveTenant();
    const tenants = listDiskTenants();

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