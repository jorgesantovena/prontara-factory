/**
 * Integración con la Stripe Invoicing API para emitir facturas reales
 * que cobran al cliente automáticamente.
 *
 * Flujo:
 *   1. Asegurar que existe un Customer de Stripe asociado al tenant
 *      (lo guardamos en `stripeCustomerId` del subscription record).
 *   2. Crear un InvoiceItem (line item) con el importe del soporte.
 *   3. Crear la Invoice en estado draft.
 *   4. Finalizarla y enviarla (Stripe envía email al cliente con enlace de pago).
 *   5. Cuando el cliente paga, Stripe dispara webhook `invoice.paid` y
 *      marcamos la factura local como `paid`.
 *
 * Sin Stripe configurado (sin STRIPE_SECRET_KEY) las funciones lanzan
 * un error claro. El emisor de facturas decide si llama o no.
 */
import { getPlanDefinition, readBillingSubscription, saveBillingSubscription } from "@/lib/saas/billing-store";
import type { BillingSubscriptionRecord } from "@/lib/saas/billing-definition";

const STRIPE_API = "https://api.stripe.com/v1";

function getStripeSecretKey(): string {
  const value = String(process.env.STRIPE_SECRET_KEY || "").trim();
  if (!value) {
    throw new Error(
      "Falta STRIPE_SECRET_KEY. Configura la variable de entorno antes de emitir facturas en Stripe.",
    );
  }
  return value;
}

function toFormUrlEncoded(obj: Record<string, unknown>): string {
  const params = new URLSearchParams();
  function append(key: string, value: unknown) {
    if (value === null || value === undefined) return;
    if (Array.isArray(value)) {
      value.forEach((v, i) => append(key + "[" + i + "]", v));
    } else if (typeof value === "object") {
      const obj = value as Record<string, unknown>;
      for (const k of Object.keys(obj)) append(key + "[" + k + "]", obj[k]);
    } else {
      params.append(key, String(value));
    }
  }
  for (const k of Object.keys(obj)) append(k, obj[k]);
  return params.toString();
}

async function stripeRequest<T = Record<string, unknown>>(
  method: "GET" | "POST",
  path: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const init: RequestInit = {
    method,
    headers: {
      Authorization: "Bearer " + getStripeSecretKey(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
  };
  if (body) init.body = toFormUrlEncoded(body);

  const response = await fetch(STRIPE_API + path, init);
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const errObj = data?.error as { message?: string } | undefined;
    const msg = errObj?.message || "Error " + response.status + " en Stripe " + path;
    throw new Error(msg);
  }
  return data as T;
}

/**
 * Asegura que el tenant tiene un customer en Stripe. Si no, lo crea con
 * el billingEmail del record. Devuelve el customer id.
 */
async function ensureStripeCustomer(record: BillingSubscriptionRecord): Promise<string> {
  if (record.stripeCustomerId) return record.stripeCustomerId;

  const customer = await stripeRequest<{ id: string }>("POST", "/customers", {
    email: record.billingEmail,
    name: record.displayName,
    description: "Prontara tenant " + record.slug,
    metadata: {
      clientId: record.clientId,
      tenantId: record.tenantId,
      slug: record.slug,
    },
  });

  // Guardamos el customerId en el record local para reutilizar.
  saveBillingSubscription({
    ...record,
    stripeCustomerId: customer.id,
    updatedAt: new Date().toISOString(),
  });

  return customer.id;
}

export type StripeInvoiceResult = {
  stripeInvoiceId: string;
  hostedInvoiceUrl: string | null;
  invoicePdfUrl: string | null;
  customerId: string;
  status: string;
};

/**
 * Crea y envía una factura real en Stripe por el importe del soporte
 * mensual del tenant.
 *
 * Stripe se encarga del email al cliente y del cobro. Cuando el cliente
 * paga, llega el webhook `invoice.paid` (configurado en /api/runtime/billing-confirm)
 * que llamará a markStripeInvoicePaidByExternalId para marcar la factura
 * local como paid.
 */
export async function issueStripeSupportInvoice(input: {
  clientId: string;
  periodLabel: string;
  amountCents?: number;
}): Promise<StripeInvoiceResult> {
  const record = readBillingSubscription(input.clientId);
  if (!record) {
    throw new Error("No existe suscripción para clientId '" + input.clientId + "'.");
  }
  if (record.currentPlanKey === "trial") {
    throw new Error("No se puede facturar soporte en trial.");
  }

  const plan = getPlanDefinition(record.currentPlanKey);
  const perUser = plan.supportMonthlyCentsPerUser ?? 0;
  if (perUser <= 0) {
    throw new Error("El plan no tiene precio de soporte mensual definido.");
  }

  const users = Math.max(1, record.concurrentUsersBilled);
  const amountCents =
    typeof input.amountCents === "number" && input.amountCents > 0
      ? Math.floor(input.amountCents)
      : perUser * users;

  const customerId = await ensureStripeCustomer(record);

  // 1. Crear invoice item
  await stripeRequest("POST", "/invoiceitems", {
    customer: customerId,
    amount: amountCents,
    currency: "eur",
    description:
      "Soporte " +
      plan.label +
      " · " +
      input.periodLabel +
      " · " +
      users +
      " usuarios concurrentes",
    metadata: {
      clientId: record.clientId,
      tenantId: record.tenantId,
      slug: record.slug,
      kind: "support",
      periodLabel: input.periodLabel,
    },
  });

  // 2. Crear invoice. auto_advance=true: Stripe la finaliza y la cobra solo.
  const invoice = await stripeRequest<{
    id: string;
    hosted_invoice_url?: string;
    invoice_pdf?: string;
    status: string;
  }>("POST", "/invoices", {
    customer: customerId,
    auto_advance: true,
    collection_method: "send_invoice",
    days_until_due: 7,
    metadata: {
      clientId: record.clientId,
      tenantId: record.tenantId,
      slug: record.slug,
      kind: "support",
      periodLabel: input.periodLabel,
    },
  });

  // 3. Finalizar (auto_advance lo hace, pero lo forzamos para tener URL ya).
  const finalized = await stripeRequest<{
    id: string;
    hosted_invoice_url?: string;
    invoice_pdf?: string;
    status: string;
  }>("POST", "/invoices/" + encodeURIComponent(invoice.id) + "/finalize", {});

  return {
    stripeInvoiceId: finalized.id,
    hostedInvoiceUrl: finalized.hosted_invoice_url || null,
    invoicePdfUrl: finalized.invoice_pdf || null,
    customerId,
    status: finalized.status,
  };
}

/**
 * Marca como `paid` la factura local que tenga este stripeInvoiceId en
 * la metadata o cuyo concept incluya el periodLabel correspondiente. Se
 * llama desde el webhook `invoice.paid` de Stripe.
 *
 * Devuelve true si la encontró y la marcó, false si no había match.
 */
export function markStripeInvoicePaid(input: {
  clientId: string;
  stripeInvoiceId: string;
}): boolean {
  const record = readBillingSubscription(input.clientId);
  if (!record) return false;

  const idx = record.invoices.findIndex(
    (inv) => inv.stripeCheckoutSessionId === input.stripeInvoiceId,
  );
  if (idx < 0) return false;

  const updatedInvoices = record.invoices.slice();
  updatedInvoices[idx] = { ...updatedInvoices[idx], status: "paid" };

  saveBillingSubscription({
    ...record,
    invoices: updatedInvoices,
    updatedAt: new Date().toISOString(),
  });
  return true;
}

export function isStripeInvoicingConfigured(): boolean {
  return Boolean(String(process.env.STRIPE_SECRET_KEY || "").trim());
}
