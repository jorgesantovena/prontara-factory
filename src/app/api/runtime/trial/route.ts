import { NextRequest, NextResponse } from "next/server";
import { resolveRuntimeRequestContext } from "@/lib/saas/runtime-request-context";
import { getOrCreateTrialState } from "@/lib/saas/trial-store";
import { getSessionFromRequest } from "@/lib/saas/auth-session";

export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);

    if (session) {
      const trial = getOrCreateTrialState({
        tenantId: session.tenantId,
        clientId: session.clientId,
        slug: session.slug,
      });

      return NextResponse.json({
        ok: true,
        trial,
      });
    }

    const context = resolveRuntimeRequestContext(request);
    if (!context.ok || !context.tenant) {
      return NextResponse.json(
        {
          ok: false,
          error: "No se pudo resolver el trial del tenant solicitado.",
        },
        { status: 404 }
      );
    }

    const trial = getOrCreateTrialState({
      tenantId: context.tenant.tenantId,
      clientId: context.tenant.clientId,
      slug: context.tenant.slug,
    });

    return NextResponse.json({
      ok: true,
      trial,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Error interno en trial.",
      },
      { status: 500 }
    );
  }
}