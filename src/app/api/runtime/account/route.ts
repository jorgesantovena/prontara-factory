import { NextRequest, NextResponse } from "next/server";
import { inspectTenantAccountsFromRequest } from "@/lib/saas/account-provisioning";

export async function GET(request: NextRequest) {
  try {
    const result = inspectTenantAccountsFromRequest(request);

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          source: result.source,
          requestedSlug: result.requestedSlug,
          error: "No se pudo resolver la cuenta del tenant solicitado.",
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
        error: error instanceof Error ? error.message : "Error interno en /api/runtime/account",
      },
      { status: 500 }
    );
  }
}