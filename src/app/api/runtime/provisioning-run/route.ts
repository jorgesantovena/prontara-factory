import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { runProvisioningPipelineFromRequest } from "@/lib/saas/provisioning-pipeline";

export async function POST(request: NextRequest) {
  try {
    const result = runProvisioningPipelineFromRequest(request);

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          source: result.source,
          requestedSlug: result.requestedSlug,
          error: "No se pudo ejecutar el provisioning pipeline.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Error inesperado.",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}