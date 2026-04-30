import { createHmac, timingSafeEqual } from "node:crypto";
import type { BillingPlanKey, StripeCheckoutResolved } from "@/lib/saas/billing-definition";
import { getPlanDefinition } from "@/lib/saas/billing-store";

function getStripeSecretKey() {
  const value = String(process.env.STRIPE_SECRET_KEY || "").trim();
  if (!value) {
    throw new Error("Falta STRIPE_SECRET_KEY.");
  }
  return value;
}

export function getStripeWebhookSecret(): string {
  const value = String(process.env.STRIPE_WEBHOOK_SECRET || "").trim();
  if (!value) {
    throw new Error("Falta STRIPE_WEBHOOK_SECRET para verificar el webhook.");
  }
  return value;
}

/**
 * Verifies a Stripe webhook signature.
 *
 * Stripe sends a "Stripe-Signature" header of the form:
 *   t=<timestamp>,v1=<hmacSha256>,v1=<hmacSha256>,...
 *
 * The signed payload is `<timestamp>.<raw body>` and the expected HMAC is
 * computed with the webhook secret. We accept any of the v1 signatures so
 * that key rotation does not cause a hard outage.
 */
export function verifyStripeWebhookSignature(input: {
  rawBody: string;
  signatureHeader: string | null;
  secret?: string;
  toleranceSeconds?: number;
}): { ok: boolean; reason?: string; timestamp?: number } {
  const header = String(input.signatureHeader || "").trim();
  if (!header) {
    return { ok: false, reason: "missing-signature-header" };
  }

  const secret = input.secret || getStripeWebhookSecret();
  const tolerance = input.toleranceSeconds ?? 300; // 5 minutes

  let timestamp: number | null = null;
  const v1Signatures: string[] = [];
  for (const chunk of header.split(",")) {
    const [key, value] = chunk.split("=");
    if (key === "t" && value) {
      timestamp = Number(value);
    } else if (key === "v1" && value) {
      v1Signatures.push(value.trim());
    }
  }

  if (!timestamp || Number.isNaN(timestamp)) {
    return { ok: false, reason: "malformed-signature-header" };
  }

  if (v1Signatures.length === 0) {
    return { ok: false, reason: "no-v1-signature" };
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - timestamp) > tolerance) {
    return { ok: false, reason: "timestamp-out-of-tolerance", timestamp };
  }

  const signedPayload = String(timestamp) + "." + String(input.rawBody);
  const expected = createHmac("sha256", secret).update(signedPayload).digest("hex");
  const expectedBuf = Buffer.from(expected, "hex");

  for (const candidate of v1Signatures) {
    let candidateBuf: Buffer;
    try {
      candidateBuf = Buffer.from(candidate, "hex");
    } catch {
      continue;
    }
    if (candidateBuf.length !== expectedBuf.length) {
      continue;
    }
    if (timingSafeEqual(candidateBuf, expectedBuf)) {
      return { ok: true, timestamp };
    }
  }

  return { ok: false, reason: "signature-mismatch", timestamp };
}

function getAppBaseUrl() {
  const value = String(process.env.APP_BASE_URL || "").trim();
  if (!value) {
    throw new Error("Falta APP_BASE_URL.");
  }
  return value.replace(/\/+$/g, "");
}

function buildSuccessUrl(slug: string) {
  return (
    getAppBaseUrl() +
    "/suscripcion?checkout=success&session_id={CHECKOUT_SESSION_ID}&tenant=" +
    encodeURIComponent(slug)
  );
}

function buildCancelUrl(slug: string) {
  return getAppBaseUrl() + "/suscripcion?checkout=cancel&tenant=" + encodeURIComponent(slug);
}

function toFormUrlEncoded(values: Record<string, string>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    params.set(key, value);
  }
  return params.toString();
}

export async function createStripeCheckoutSession(input: {
  slug: string;
  email: string;
  planKey: BillingPlanKey;
  metadata: Record<string, string>;
}) {
  const plan = getPlanDefinition(input.planKey);

  if (!plan.stripeSetupPriceId) {
    throw new Error(
      "El plan seleccionado no tiene stripeSetupPriceId configurado. Define la variable de entorno STRIPE_SETUP_PRICE_" +
        plan.key.toUpperCase() +
        ".",
    );
  }

  // Modelo real: el checkout cobra el setup fee one-time. El soporte mensual
  // se contrata después como subscription separada (lo gestionará otro
  // endpoint cuando el operador active soporte para el tenant).
  const body = toFormUrlEncoded({
    "mode": "payment",
    "success_url": buildSuccessUrl(input.slug),
    "cancel_url": buildCancelUrl(input.slug),
    "line_items[0][price]": plan.stripeSetupPriceId,
    "line_items[0][quantity]": "1",
    "customer_email": input.email,
    "allow_promotion_codes": "true",
    "metadata[planKey]": input.planKey,
    "metadata[slug]": input.slug,
    "metadata[clientId]": input.metadata.clientId,
    "metadata[tenantId]": input.metadata.tenantId,
    "metadata[chargeKind]": "setup-fee",
  });

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + getStripeSecretKey(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || "No se pudo crear la sesión de checkout en Stripe.");
  }

  return {
    id: String(data.id || ""),
    url: String(data.url || ""),
    successUrl: buildSuccessUrl(input.slug),
    cancelUrl: buildCancelUrl(input.slug),
  };
}

export async function resolveStripeCheckoutSession(sessionId: string): Promise<StripeCheckoutResolved> {
  const response = await fetch(
    "https://api.stripe.com/v1/checkout/sessions/" + encodeURIComponent(sessionId),
    {
      method: "GET",
      headers: {
        "Authorization": "Bearer " + getStripeSecretKey(),
      },
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || "No se pudo consultar la sesión de checkout.");
  }

  const paid =
    String(data.payment_status || "").trim() === "paid" ||
    String(data.status || "").trim() === "complete";

  return {
    ok: true,
    paid,
    sessionId: String(data.id || sessionId),
    customerId: String(data.customer || "") || undefined,
    subscriptionId: String(data.subscription || "") || undefined,
    amountTotalCents:
      typeof data.amount_total === "number" ? Number(data.amount_total) : undefined,
    currency: String(data.currency || "").toUpperCase() || undefined,
    statusText:
      "status=" +
      String(data.status || "") +
      ", payment_status=" +
      String(data.payment_status || ""),
  };
}

/**
 * Lanza un refund completo sobre un payment_intent o un charge.
 * Pensado para la compensación automática del saga de alta (ARQ-7):
 * si el cliente pagó pero la activación falló de forma irrecuperable,
 * devolvemos el dinero antes de que se queje.
 *
 * Stripe acepta uno de los dos campos. Pasamos lo que tengamos.
 *
 * Idempotencia: incluimos `Idempotency-Key` derivada del id del evento
 * de dominio que dispara el refund, así si el cron reintenta el mismo
 * evento Stripe NO duplica el refund.
 */
export async function refundStripeChargeOrIntent(input: {
  paymentIntentId?: string;
  chargeId?: string;
  reason?: "duplicate" | "fraudulent" | "requested_by_customer";
  /** Para idempotencia (Stripe la respeta hasta 24h). */
  idempotencyKey: string;
  metadata?: Record<string, string>;
}): Promise<{
  ok: boolean;
  refundId?: string;
  status?: string;
  amountRefundedCents?: number;
  error?: string;
}> {
  if (!input.paymentIntentId && !input.chargeId) {
    return { ok: false, error: "Falta payment_intent_id o charge_id." };
  }

  const body = new URLSearchParams();
  if (input.paymentIntentId) body.set("payment_intent", input.paymentIntentId);
  if (input.chargeId) body.set("charge", input.chargeId);
  body.set("reason", input.reason || "requested_by_customer");
  if (input.metadata) {
    for (const [k, v] of Object.entries(input.metadata)) {
      body.set("metadata[" + k + "]", v);
    }
  }

  const response = await fetch("https://api.stripe.com/v1/refunds", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + getStripeSecretKey(),
      "Content-Type": "application/x-www-form-urlencoded",
      "Idempotency-Key": input.idempotencyKey,
    },
    body: body.toString(),
  });

  const data = (await response.json()) as Record<string, unknown>;

  if (!response.ok) {
    const errMsg =
      (data?.error && typeof data.error === "object"
        ? String((data.error as Record<string, unknown>).message || "")
        : "") || "Stripe rechazó el refund.";
    return { ok: false, error: errMsg };
  }

  return {
    ok: true,
    refundId: String(data.id || ""),
    status: String(data.status || ""),
    amountRefundedCents:
      typeof data.amount === "number" ? Number(data.amount) : undefined,
  };
}