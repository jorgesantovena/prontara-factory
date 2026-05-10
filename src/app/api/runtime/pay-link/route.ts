import { NextResponse, type NextRequest } from "next/server";
import { requireTenantSession } from "@/lib/saas/auth-session";
import { withPrisma, getPersistenceBackend } from "@/lib/persistence/db";
import { captureError } from "@/lib/observability/error-capture";

/**
 * Generación de Stripe Checkout link para cobrar al cliente final
 * (H6-PAY-LINK).
 *
 * POST /api/runtime/pay-link
 * Body: { facturaId?, amountEur, concept, email? }
 *
 * Crea una session de Stripe Checkout (modo payment, one-shot) y
 * persiste el TenantPayLink. Devuelve la URL para que el tenant la
 * comparta con su cliente.
 *
 * GET /api/runtime/pay-link?facturaId=X — busca link existente o
 * lista los del tenant.
 *
 * Webhook checkout.session.completed marca como paid (no implementado
 * aquí — se enchufa al webhook existente de Stripe).
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) return NextResponse.json({ ok: false, error: "Sesión inválida." }, { status: 401 });
    if (getPersistenceBackend() !== "postgres") {
      return NextResponse.json({ ok: false, error: "Postgres only" }, { status: 400 });
    }

    const body = await request.json();
    const facturaId = body?.facturaId ? String(body.facturaId).trim() : null;
    const amountEur = Number(body?.amountEur);
    const concept = String(body?.concept || "Pago").trim();
    const email = body?.email ? String(body.email).trim() : null;

    if (!Number.isFinite(amountEur) || amountEur <= 0) {
      return NextResponse.json({ ok: false, error: "amountEur debe ser número positivo." }, { status: 400 });
    }

    const stripeKey = String(process.env.STRIPE_SECRET_KEY || "").trim();
    if (!stripeKey) {
      return NextResponse.json({ ok: false, error: "Stripe no está configurado." }, { status: 500 });
    }

    const baseUrl = (process.env.PRONTARA_PUBLIC_BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
    const successUrl = baseUrl + "/pago-ok?session_id={CHECKOUT_SESSION_ID}";
    const cancelUrl = baseUrl + "/pago-cancelado";

    // Stripe acepta parámetros tipo form-encoded incluso en API.
    const params = new URLSearchParams();
    params.append("mode", "payment");
    params.append("line_items[0][price_data][currency]", "eur");
    params.append("line_items[0][price_data][product_data][name]", concept.slice(0, 250));
    params.append("line_items[0][price_data][unit_amount]", String(Math.round(amountEur * 100)));
    params.append("line_items[0][quantity]", "1");
    params.append("success_url", successUrl);
    params.append("cancel_url", cancelUrl);
    params.append("payment_method_types[]", "card");
    if (email) params.append("customer_email", email);
    params.append("metadata[clientId]", session.clientId);
    if (facturaId) params.append("metadata[facturaId]", facturaId);
    params.append("metadata[type]", "pay-link");

    const r = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + stripeKey,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
    const stripeData = await r.json();
    if (!r.ok) {
      return NextResponse.json({ ok: false, error: "Stripe: " + (stripeData?.error?.message || r.status) }, { status: 500 });
    }

    const checkoutUrl = String(stripeData.url || "");
    const stripeSession = String(stripeData.id || "");
    if (!checkoutUrl || !stripeSession) {
      return NextResponse.json({ ok: false, error: "Stripe no devolvió URL." }, { status: 500 });
    }

    const link = await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        tenantPayLink: {
          create: (a: { data: Record<string, unknown> }) => Promise<Record<string, unknown>>;
        };
      };
      return await c.tenantPayLink.create({
        data: {
          tenantId: session.tenantId,
          clientId: session.clientId,
          facturaId,
          amountEur,
          concept,
          email,
          stripeSession,
          url: checkoutUrl,
          status: "pending",
        },
      });
    });

    return NextResponse.json({ ok: true, url: checkoutUrl, link });
  } catch (e) {
    captureError(e, { scope: "/api/runtime/pay-link POST" });
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) return NextResponse.json({ ok: false, error: "Sesión inválida." }, { status: 401 });
    if (getPersistenceBackend() !== "postgres") {
      return NextResponse.json({ ok: true, links: [] });
    }
    const facturaId = request.nextUrl.searchParams.get("facturaId");
    const links = await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        tenantPayLink: {
          findMany: (a: { where: Record<string, unknown>; orderBy: { createdAt: "desc" }; take: number }) => Promise<Array<Record<string, unknown>>>;
        };
      };
      return await c.tenantPayLink.findMany({
        where: facturaId ? { clientId: session.clientId, facturaId } : { clientId: session.clientId },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
    });
    return NextResponse.json({ ok: true, links: links || [] });
  } catch (e) {
    captureError(e, { scope: "/api/runtime/pay-link GET" });
    return NextResponse.json({ ok: false, error: "Error" }, { status: 500 });
  }
}
