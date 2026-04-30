import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { provisionTenantAdminAccountFromRequest } from "@/lib/saas/account-provisioning";

export async function POST(request: NextRequest) {
  try {
    const result = provisionTenantAdminAccountFromRequest(request);

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          source: result.source,
          requestedSlug: result.requestedSlug,
          error: "No se pudo provisionar la cuenta del tenant.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      source: result.source,
      requestedSlug: result.requestedSlug,
      account: result.account,
      snapshot: result.snapshot,
    });
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