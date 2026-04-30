import { NextResponse, type NextRequest } from "next/server";
import { requireFactoryAdmin } from "@/lib/factory-chat/auth";
import {
  readBillingSubscription,
  issueSupportInvoice,
  updateInvoiceStatus,
  saveBillingSubscription,
} from "@/lib/saas/billing-store";
import {
  issueStripeSupportInvoice,
  isStripeInvoicingConfigured,
} from "@/lib/saas/stripe-invoicing";
import { invalidateFactoryCaches } from "@/lib/saas/tenant-regeneration";

type RouteContext = { params: Promise<{ clientId: string }> };

/**
 * GET /api/factory/client/[clientId]/invoices
 * Devuelve todas las facturas del tenant.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const admin = requireFactoryAdmin(request);
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "Se requiere sesión con rol admin." },
      { status: 401 },
    );
  }
  const { clientId } = await context.params;
  const sub = readBillingSubscription(clientId);
  if (!sub) {
    return NextResponse.json({ ok: true, invoices: [] });
  }
  return NextResponse.json({ ok: true, invoices: sub.invoices });
}

/**
 * POST /api/factory/client/[clientId]/invoices
 * Body: { periodLabel, amountCentsOverride?, status? }
 * Emite una nueva factura de soporte.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const admin = requireFactoryAdmin(request);
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "Se requiere sesión con rol admin." },
      { status: 401 },
    );
  }
  const { clientId } = await context.params;
  let body: {
    periodLabel?: string;
    amountCentsOverride?: number;
    status?: "issued" | "paid" | "void";
    sendViaStripe?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Body inválido." }, { status: 400 });
  }
  if (!body.periodLabel || !body.periodLabel.trim()) {
    return NextResponse.json({ ok: false, error: "Falta periodLabel." }, { status: 400 });
  }

  try {
    const result = issueSupportInvoice({
      clientId,
      periodLabel: body.periodLabel.trim(),
      amountCentsOverride: body.amountCentsOverride,
      status: body.status,
    });

    let stripeInvoice: {
      stripeInvoiceId: string;
      hostedInvoiceUrl: string | null;
      invoicePdfUrl: string | null;
      status: string;
    } | null = null;

    if (body.sendViaStripe) {
      if (!isStripeInvoicingConfigured()) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Stripe no está configurado (falta STRIPE_SECRET_KEY). Factura local creada pero no enviada a Stripe.",
            invoice: result.invoice,
            invoices: result.subscription.invoices,
          },
          { status: 422 },
        );
      }
      try {
        const stripeRes = await issueStripeSupportInvoice({
          clientId,
          periodLabel: body.periodLabel.trim(),
          amountCents: result.invoice.amountCents,
        });
        stripeInvoice = {
          stripeInvoiceId: stripeRes.stripeInvoiceId,
          hostedInvoiceUrl: stripeRes.hostedInvoiceUrl,
          invoicePdfUrl: stripeRes.invoicePdfUrl,
          status: stripeRes.status,
        };

        // Guardamos el stripeInvoiceId en el campo stripeCheckoutSessionId
        // de la invoice local (ya existente en BillingInvoiceRecord) para
        // poder cruzar al recibir el webhook.
        const updated = readBillingSubscription(clientId);
        if (updated) {
          const idx = updated.invoices.findIndex((i) => i.id === result.invoice.id);
          if (idx >= 0) {
            const next = updated.invoices.slice();
            next[idx] = {
              ...next[idx],
              stripeCheckoutSessionId: stripeRes.stripeInvoiceId,
            };
            saveBillingSubscription({
              ...updated,
              invoices: next,
              updatedAt: new Date().toISOString(),
            });
          }
        }
      } catch (stripeErr) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Factura local creada pero falló el envío a Stripe: " +
              (stripeErr instanceof Error ? stripeErr.message : "error desconocido"),
            invoice: result.invoice,
            invoices: result.subscription.invoices,
          },
          { status: 502 },
        );
      }
    }

    invalidateFactoryCaches();
    return NextResponse.json({
      ok: true,
      invoice: result.invoice,
      invoices: result.subscription.invoices,
      stripeInvoice,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Error emitiendo factura.",
      },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/factory/client/[clientId]/invoices
 * Body: { invoiceId, status }
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const admin = requireFactoryAdmin(request);
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "Se requiere sesión con rol admin." },
      { status: 401 },
    );
  }
  const { clientId } = await context.params;
  let body: { invoiceId?: string; status?: "issued" | "paid" | "void" };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Body inválido." }, { status: 400 });
  }
  if (!body.invoiceId || !body.status) {
    return NextResponse.json(
      { ok: false, error: "Falta invoiceId o status." },
      { status: 400 },
    );
  }
  try {
    const updated = updateInvoiceStatus({
      clientId,
      invoiceId: body.invoiceId,
      status: body.status,
    });
    invalidateFactoryCaches();
    return NextResponse.json({ ok: true, invoices: updated.invoices });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Error actualizando factura.",
      },
      { status: 500 },
    );
  }
}
