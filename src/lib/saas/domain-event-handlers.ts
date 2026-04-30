/**
 * Handlers de eventos de dominio (ARQ-7).
 *
 * Cada `type` de DomainEvent tiene aquí su handler. El cron
 * `/api/cron/process-domain-events` consume eventos y los enruta
 * por type.
 *
 * Para añadir un nuevo tipo de evento:
 *   1. Define el shape de su payload (type DomainEventPayload<TType>).
 *   2. Añade la función handler.
 *   3. Regístralo en EVENT_HANDLERS.
 *
 * Convención: si el handler lanza, el cron incrementa retryCount y
 * reprograma con backoff. Si el handler devuelve sin lanzar, el
 * evento se marca completed.
 */
import { refundStripeChargeOrIntent } from "@/lib/saas/billing-stripe";
import { createNotificationAsync } from "@/lib/persistence/factory-notifications-store-async";
import { createLogger, type Logger } from "@/lib/observability/logger";
import type { DomainEventRecord } from "@/lib/persistence/domain-events";

// ---------------------------------------------------------------------
// Tipos de payload por evento
// ---------------------------------------------------------------------

export type TenantActivationFailedPayload = {
  /** Datos para identificar al cliente afectado. */
  clientId: string;
  slug: string;
  displayName?: string;
  planKey?: string;
  /** Identificadores de Stripe necesarios para el refund. */
  stripeCheckoutSessionId?: string;
  stripePaymentIntentId?: string;
  stripeChargeId?: string;
  /** Importe pagado en céntimos (para mensaje de notificación). */
  amountTotalCents?: number;
  /** Mensaje del error original que provocó el fallo. */
  originalError: string;
};

// ---------------------------------------------------------------------
// Handler: tenant.activation.failed → compensación (refund + aviso)
// ---------------------------------------------------------------------

async function handleTenantActivationFailed(
  event: DomainEventRecord,
  log: Logger,
): Promise<void> {
  const p = event.payload as unknown as TenantActivationFailedPayload;

  if (!p.stripePaymentIntentId && !p.stripeChargeId) {
    // Sin id de cobro no hay refund posible. Notificamos al operador
    // para que lo trate manual y completamos el evento (no tiene
    // sentido reintentar — es un dato que falta de forma permanente).
    await createNotificationAsync({
      type: "activation_failed_no_refund",
      title: "Activación fallida sin datos para refund: " + (p.displayName || p.slug),
      message:
        "El alta del cliente " +
        (p.displayName || p.slug) +
        " falló y NO había payment_intent_id ni charge_id en el evento. " +
        "Hay que tramitar el refund manualmente desde Stripe. Error original: " +
        p.originalError,
      metadata: {
        clientId: p.clientId,
        slug: p.slug,
        sessionId: p.stripeCheckoutSessionId,
        amountTotalCents: p.amountTotalCents,
      },
    });
    log.warn("activation failed without refund handle", {
      clientId: p.clientId,
      slug: p.slug,
    });
    return; // marca como completed: nada más que hacer automáticamente
  }

  // Ejecutar refund con idempotency-key derivada del id del evento.
  // Si el cron reintenta este mismo evento, Stripe responderá con el
  // mismo refund en lugar de crear uno nuevo.
  const result = await refundStripeChargeOrIntent({
    paymentIntentId: p.stripePaymentIntentId,
    chargeId: p.stripeChargeId,
    reason: "requested_by_customer",
    idempotencyKey: "domain-event:" + event.id,
    metadata: {
      reason: "auto_refund_activation_failed",
      clientId: p.clientId,
      slug: p.slug,
    },
  });

  if (!result.ok) {
    // Lanzamos para que el cron reintente con backoff.
    throw new Error("Stripe refund falló: " + (result.error || "error desconocido"));
  }

  log.info("auto-refund completed", {
    clientId: p.clientId,
    slug: p.slug,
    refundId: result.refundId,
    status: result.status,
    amountRefundedCents: result.amountRefundedCents,
  });

  // Avisar al operador para que sepa qué pasó (no es bloqueante).
  try {
    await createNotificationAsync({
      type: "activation_failed_refunded",
      title: "Refund automático: " + (p.displayName || p.slug),
      message:
        "La activación del cliente " +
        (p.displayName || p.slug) +
        " falló tras el pago. Se ha emitido un refund automático en Stripe. " +
        "Hay que contactar al cliente para entender el problema antes de reintentarlo. " +
        "Error original: " +
        p.originalError,
      metadata: {
        clientId: p.clientId,
        slug: p.slug,
        refundId: result.refundId,
        amountTotalCents: p.amountTotalCents,
      },
    });
  } catch (notifyErr) {
    // El refund ya está hecho. Si la notificación falla, no bloqueamos
    // el evento — el operador verá el refund en Stripe igualmente.
    log.warn("could not create operator notification after refund", {
      error: notifyErr instanceof Error ? notifyErr.message : String(notifyErr),
    });
  }
}

// ---------------------------------------------------------------------
// Registry de handlers
// ---------------------------------------------------------------------

type Handler = (event: DomainEventRecord, log: Logger) => Promise<void>;

const EVENT_HANDLERS: Record<string, Handler> = {
  "tenant.activation.failed": handleTenantActivationFailed,
};

/**
 * Procesa un evento ya claimed. Si lanza, el caller debe llamar a
 * failEventAsync. Si vuelve sin lanzar, el caller debe llamar a
 * completeEventAsync.
 */
export async function dispatchDomainEvent(event: DomainEventRecord): Promise<void> {
  const log = createLogger("domain-event-handler", {
    eventId: event.id,
    type: event.type,
    aggregateType: event.aggregateType,
    aggregateId: event.aggregateId,
    retry: event.retryCount,
  });

  const handler = EVENT_HANDLERS[event.type];
  if (!handler) {
    log.warn("no handler registered for type — skipping (will mark completed)");
    return;
  }

  await handler(event, log);
}
