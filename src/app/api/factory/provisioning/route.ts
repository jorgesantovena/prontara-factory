import { NextResponse } from "next/server";
import { getFactoryProvisioningSnapshot } from "@/lib/factory/factory-provisioning";

export async function GET() {
  try {
    const snapshot = getFactoryProvisioningSnapshot();

    return NextResponse.json({
      ok: true,
      snapshot,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Error interno en /api/factory/provisioning",
      },
      { status: 500 }
    );
  }
}