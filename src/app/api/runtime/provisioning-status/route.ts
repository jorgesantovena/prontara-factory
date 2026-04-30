import { NextRequest, NextResponse } from "next/server";
import { inspectProvisioningStatusFromRequest } from "@/lib/saas/provisioning-pipeline";

export async function GET(request: NextRequest) {
  try {
    const snapshot = inspectProvisioningStatusFromRequest(request);

    return NextResponse.json({
      ok: snapshot.ok,
      provisioning: snapshot,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Error interno en /api/runtime/provisioning-status",
      },
      { status: 500 }
    );
  }
}