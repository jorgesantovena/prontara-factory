import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { resolveRuntimeRequestContextAsync } from "@/lib/saas/runtime-request-context-async";
import { activatePaidPlan } from "@/lib/saas/billing-store";

export async function POST(request: NextRequest) {
  try {
    const context = await resolveRuntimeRequestContextAsync(request);

    if (!context.ok || !context.tenant || !context.branding) {
      return NextResponse.json(
        {
          ok: false,
          source: context.source,
          requestedSlug: context.requestedSlug,
          error: "No se pudo resolver el tenant para confirmar billing.",
        },
        { status: 404 }
      );
    }

    const body = await request.json().catch(() => ({}));

    const planKey =
      typeof body?.planKey === "string" && body.planKey.trim()
        ? body.planKey.trim()
        : "starter";

    const stripeCheckoutSessionId =
      typeof body?.stripeCheckoutSessionId === "string" && body.stripeCheckoutSessionId.trim()
        ? body.stripeCheckoutSessionId.trim()
        : "manual-confirmation";

    const stripeCustomerId =
      typeof body?.stripeCustomerId === "string" && body.stripeCustomerId.trim()
        ? body.stripeCustomerId.trim()
        : undefined;

    const stripeSubscriptionId =
      typeof body?.stripeSubscriptionId === "string" && body.stripeSubscriptionId.trim()
        ? body.stripeSubscriptionId.trim()
        : undefined;

    const amountTotalCents =
      typeof body?.amountTotalCents === "number" && Number.isFinite(body.amountTotalCents)
        ? body.amountTotalCents
        : undefined;

    const record = activatePaidPlan({
      tenantId: context.tenant.tenantId,
      clientId: context.tenant.clientId,
      slug: context.tenant.slug,
      displayName: context.branding.displayName,
      planKey,
      stripeCheckoutSessionId,
      stripeCustomerId,
      stripeSubscriptionId,
      amountTotalCents,
    });

    return NextResponse.json({
      ok: true,
      source: context.source,
      requestedSlug: context.requestedSlug,
      subscription: record,
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