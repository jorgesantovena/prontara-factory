import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyStripeWebhookSignature } from "@/lib/saas/billing-stripe";
import {
  activatePaidPlanAsync,
  readBillingSubscriptionAsync,
  saveBillingSubscriptionAsync,
} from "@/lib/persistence/billing-store-async";
import { markStripeInvoicePaid } from "@/lib/saas/stripe-invoicing";
import type { BillingPlanKey } from "@/lib/saas/billing-definition";
import { createNotificationAsync } from "@/lib/persistence/factory-notifications-store-async";
import {
  findStripeProcessedEventAsync,
  markStripeEventProcessedAsync,
} from "@/lib/persistence/stripe-events-async";
import { emitDomainEventAsync } from "@/lib/persistence/domain-events";
import type { TenantActivationFailedPayload } from "@/lib/saas/domain-event-handlers";
import { createLogger } from "@/lib/observability/logger";
import { captureError } from "@/lib/observability/error-capture";

const log = createLogger("stripe-webhook");

// Stripe webhooks must be verified against the raw body, so we must disable
// Next's body parsing and read the request as a string.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type StripeEvent = {
  id?: string;
  type?: string;
  data?: {
    object?: Record<string, unknown>;
  };
  livemode?: boolean;
};

const KNOWN_PLAN_KEYS: BillingPlanKey[] = ["trial", "basico", "estandar", "premium"];

function asPlanKey(value: unknown): BillingPlanKey | null {
  if (typeof value !== "string") return null;
  return (KNOWN_PLAN_KEYS as string[]).includes(value) ? (value as BillingPlanKey) : null;
}

function readMetadata(obj: Record<string, unknown> | undefined): Record<string, string> {
  if (!obj) return {};
  const meta = obj["metadata"];
  if (!meta || typeof meta !== "object") return {};
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(meta as Record<string, unknown>)) {
    if (typeof value === "string") result[key] = value;
  }
  return result;
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signatureHeader = request.headers.get("stripe-signature");

  let verification;
  try {
    verification = verifyStripeWebhookSignature({
      rawBody,
      signatureHeader,
    });
  } catch (error) {
    // This fires when STRIPE_WEBHOOK_SECRET is not configured. Fail closed.
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Webhook secret no configurado.",
      },
      { status: 500 }
    );
  }

  if (!verification.ok) {
    return NextResponse.json(
      { ok: false, error: "Invalid signature.", reason: verification.reason },
      { status: 400 }
    );
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(rawBody) as StripeEvent;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON payload." },
      { status: 400 }
    );
  }

  // Dedupe: si Stripe reintentó este event (ya lo procesamos antes), responder
  // 200 sin re-ejecutar la lógica para evitar duplicar activaciones / facturas.
  if (event.id) {
    const previously = await findStripeProcessedEventAsync(event.id).catch(() => null);
    if (previously) {
      log.info("duplicate event ignored", {
        id: event.id,
        type: event.type,
        previousOutcome: previously.outcome,
        previousAt: previously.processedAt,
      });
      return NextResponse.json({
        ok: true,
        eventId: event.id,
        deduped: true,
      });
    }
  }

  try {
    await dispatchStripeEvent(event);
    if (event.id) {
      await markStripeEventProcessedAsync({
        eventId: event.id,
        type: String(event.type || ""),
        outcome: "ok",
      }).catch(() => {
        /* si el dedupe falla, el handler ya hizo su trabajo; loggear sin bloquear */
        log.warn("could not record dedupe event", { id: event.id });
      });
    }
  } catch (error) {
    // Log but do not 5xx forever on persistent code bugs; Stripe retries on
    // 5xx for ~3 days. Keep visible logs to debug.
    const errMsg = error instanceof Error ? error.message : String(error);
    log.error("handler failed", { id: event.id, type: event.type, error: errMsg });
    captureError(error, {
      scope: "/api/stripe/webhook",
      tags: { eventId: String(event.id || ""), eventType: String(event.type || "") },
    });
    // IMPORTANTE: NO marcar el evento como procesado aquí.
    // Si lo marcáramos con outcome="error", Stripe reintentaría y el dedupe
    // devolvería 200 sin re-ejecutar el handler → un fallo transitorio
    // (DB caída, timeout de Resend, glitch puntual) se volvería permanente
    // y el evento se perdería. Al no marcar, Stripe reintenta hasta ~3 días
    // y el siguiente intento sí volverá a entrar al handler.
    return NextResponse.json(
      { ok: false, error: "Handler failed.", eventId: event.id },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, eventId: event.id });
}

async function dispatchStripeEvent(event: StripeEvent): Promise<void> {
  const type = String(event.type || "");
  const obj = event.data?.object;

  switch (type) {
    case "checkout.session.completed":
      await handleCheckoutSessionCompleted(obj);
      return;
    case "invoice.paid":
      handleInvoicePaid(obj);
      return;
    case "invoice.payment_failed":
      await handleInvoicePaymentFailed(obj);
      return;
    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(obj);
      return;
    case "customer.subscription.updated":
    case "customer.subscription.created":
      // Lo registramos pero no actuamos: el checkout.session.completed ya
      // dispara la activación. Estos eventos llegan después de Stripe haber
      // creado la subscription y los usamos solo para diagnóstico.
      log.info("subscription event", {
        id: event.id,
        type,
      });
      return;
    default:
      log.info("ignored event", {
        id: event.id,
        type,
      });
      return;
  }
}

async function handleCheckoutSessionCompleted(
  obj: Record<string, unknown> | undefined,
): Promise<void> {
  if (!obj) {
    log.warn("checkout.session.completed sin object");
    return;
  }

  const metadata = readMetadata(obj);
  const clientId = metadata.clientId;
  const tenantId = metadata.tenantId;
  const slug = metadata.slug;
  const planKey = asPlanKey(metadata.planKey);

  if (!clientId || !tenantId || !slug || !planKey) {
    log.warn("checkout.session.completed sin metadata válida", {
      clientId,
      tenantId,
      slug,
      planKey: metadata.planKey,
    });
    return;
  }

  const existing = await readBillingSubscriptionAsync(clientId);
  const displayName = existing?.displayName || slug;

  const sessionId = String(obj.id || "");
  const customerId = typeof obj.customer === "string" ? obj.customer : undefined;
  const subscriptionId =
    typeof obj.subscription === "string" ? obj.subscription : undefined;
  const amountTotalCents =
    typeof obj.amount_total === "number" ? obj.amount_total : undefined;
  // Identificadores necesarios para una eventual compensación (refund).
  // payment_intent solo viene en sessions de tipo `payment` (setup-fee).
  // En subscriptions hay que mirar la primera invoice del flujo, pero
  // nosotros usamos modo `payment` en checkout (ver billing-stripe.ts),
  // así que esto suele estar presente.
  const paymentIntentId =
    typeof obj.payment_intent === "string" ? obj.payment_intent : undefined;

  try {
    await activatePaidPlanAsync({
      tenantId,
      clientId,
      slug,
      displayName,
      planKey,
      stripeCheckoutSessionId: sessionId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      amountTotalCents,
    });

    log.info("activated paid plan", {
      clientId,
      planKey,
      sessionId,
    });
  } catch (activationErr) {
    // El pago se cobró pero la activación falló de forma irrecuperable
    // (no transitoria — Stripe ya reintentaría el webhook completo si
    // hubiéramos lanzado 5xx; si llegamos aquí es porque consideramos
    // que reintentar el webhook NO va a ayudar). Emitimos un evento de
    // dominio que el cron procesará para hacer refund automático y
    // avisar al operador.
    const errMsg =
      activationErr instanceof Error ? activationErr.message : String(activationErr);
    log.error("activation failed — emitting compensation event", {
      clientId,
      slug,
      planKey,
      sessionId,
      error: errMsg,
    });
    const compensationPayload: TenantActivationFailedPayload = {
      clientId,
      slug,
      displayName,
      planKey,
      stripeCheckoutSessionId: sessionId,
      stripePaymentIntentId: paymentIntentId,
      amountTotalCents,
      originalError: errMsg,
    };
    try {
      await emitDomainEventAsync({
        type: "tenant.activation.failed",
        aggregateType: "tenant",
        aggregateId: clientId,
        payload: compensationPayload as unknown as Record<string, unknown>,
      });
    } catch (emitErr) {
      // Si el emit del evento también falla, no podemos hacer nada
      // automatizado. Re-lanzamos para que el webhook devuelva 5xx y
      // Stripe reintente — quizá el siguiente intento llegue con la
      // DB ya recuperada.
      log.error("could not emit compensation event — rethrowing for Stripe retry", {
        error: emitErr instanceof Error ? emitErr.message : String(emitErr),
      });
      throw activationErr;
    }
    // No re-lanzamos: con el evento de dominio ya en cola, este webhook
    // ha cumplido su trabajo. Devolver 200 evita que Stripe duplique
    // intentos sobre algo que ya estamos compensando async.
    return;
  }

  try {
    const amountEuros =
      typeof amountTotalCents === "number"
        ? (amountTotalCents / 100).toFixed(2) + " €"
        : "(importe no informado)";
    await createNotificationAsync({
      type: "payment_received",
      title: "Pago recibido: " + displayName + " (plan " + planKey + ")",
      message:
        "Cliente " +
        displayName +
        " ha pagado el alta del plan " +
        planKey +
        ". Importe: " +
        amountEuros +
        ". Sesión Stripe: " +
        sessionId,
      metadata: {
        clientId,
        slug,
        planKey,
        sessionId,
        customerId,
        subscriptionId,
        amountTotalCents,
      },
    });
  } catch (err) {
    log.error("notification falló (checkout)", { error: err instanceof Error ? err.message : String(err) });
  }
}

function handleInvoicePaid(obj: Record<string, unknown> | undefined): void {
  if (!obj) return;

  // La factura puede venir con metadata propia o con metadata heredada de la
  // subscription. Cubrimos ambos casos.
  const metadata = readMetadata(obj);
  const clientId =
    metadata.clientId ||
    readMetadata(obj.subscription_details as Record<string, unknown> | undefined).clientId;

  const invoiceId = String(obj.id || "");
  if (!clientId || !invoiceId) {
    log.warn("invoice.paid sin clientId o id", {
      hasClientId: Boolean(clientId),
      invoiceId,
    });
    return;
  }

  const matched = markStripeInvoicePaid({ clientId, stripeInvoiceId: invoiceId });
  log.info("invoice.paid processed", {
    clientId,
    invoiceId,
    matched,
  });
}

async function handleInvoicePaymentFailed(
  obj: Record<string, unknown> | undefined,
): Promise<void> {
  if (!obj) return;
  const metadata = readMetadata(obj);
  const clientId = metadata.clientId;
  if (!clientId) return;

  const record = await readBillingSubscriptionAsync(clientId);
  if (!record) return;

  await saveBillingSubscriptionAsync({
    ...record,
    status: "past_due",
    updatedAt: new Date().toISOString(),
  });
  log.warn("invoice.payment_failed", {
    clientId,
    invoiceId: obj.id,
  });

  try {
    await createNotificationAsync({
      type: "payment_failed",
      title: "Pago fallido: " + (record.displayName || clientId),
      message:
        "El cobro mensual ha fallado. La suscripción está marcada como past_due. Hay que revisar la tarjeta del cliente. Invoice id: " +
        String(obj.id || "(sin id)") +
        ".",
      metadata: {
        clientId,
        invoiceId: obj.id,
        displayName: record.displayName,
      },
    });
  } catch (err) {
    log.error("notification falló (payment_failed)", { error: err instanceof Error ? err.message : String(err) });
  }
}

async function handleSubscriptionDeleted(
  obj: Record<string, unknown> | undefined,
): Promise<void> {
  if (!obj) return;
  const metadata = readMetadata(obj);
  const clientId = metadata.clientId;
  if (!clientId) return;

  const record = await readBillingSubscriptionAsync(clientId);
  if (!record) return;

  await saveBillingSubscriptionAsync({
    ...record,
    status: "cancelled",
    autoRenew: false,
    cancelAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  log.info("subscription.deleted", { clientId });

  try {
    await createNotificationAsync({
      type: "tenant_cancelled",
      title: "Cancelación: " + (record.displayName || clientId),
      message:
        "El cliente ha cancelado la suscripción. La cuenta queda en estado 'cancelled'. Conserva acceso de solo lectura durante 30 días para exportar datos.",
      metadata: {
        clientId,
        displayName: record.displayName,
        cancelAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    log.error("notification falló (cancelled)", { error: err instanceof Error ? err.message : String(err) });
  }
}
