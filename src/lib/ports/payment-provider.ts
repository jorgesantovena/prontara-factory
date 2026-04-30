/**
 * PaymentProvider · puerto.
 *
 * Lo que el dominio de Prontara necesita de un proveedor de pagos.
 * Pensado para Stripe pero deliberadamente sin tipos Stripe-específicos
 * para permitir un futuro switch (Adyen, Mollie, Redsys...).
 *
 * Las garantías que el dominio asume:
 *   - createCheckoutSession devuelve URL a la que redirigir al cliente.
 *   - refundPayment es idempotente cuando se usa la misma idempotencyKey.
 *   - verifyWebhookSignature valida el body crudo + firma + secret.
 */
import type { BillingPlanKey } from "@/lib/saas/value-objects";

export type PaymentCheckoutInput = {
  slug: string;
  email: string;
  planKey: BillingPlanKey;
  metadata: Record<string, string>;
};

export type PaymentCheckoutResult = {
  id: string;
  url: string;
  successUrl: string;
  cancelUrl: string;
};

export type PaymentResolveResult = {
  ok: boolean;
  paid: boolean;
  sessionId: string;
  customerId?: string;
  subscriptionId?: string;
  amountTotalCents?: number;
  currency?: string;
  statusText?: string;
};

export type PaymentRefundInput = {
  paymentIntentId?: string;
  chargeId?: string;
  reason?: "duplicate" | "fraudulent" | "requested_by_customer";
  /** Para idempotencia. */
  idempotencyKey: string;
  metadata?: Record<string, string>;
};

export type PaymentRefundResult = {
  ok: boolean;
  refundId?: string;
  status?: string;
  amountRefundedCents?: number;
  error?: string;
};

export type WebhookVerifyInput = {
  payload: string;
  signatureHeader: string;
  secret: string;
};

export interface PaymentProvider {
  /** Nombre del adapter (para logs / debug). */
  readonly name: string;

  createCheckoutSession(input: PaymentCheckoutInput): Promise<PaymentCheckoutResult>;

  resolveCheckoutSession(sessionId: string): Promise<PaymentResolveResult>;

  refundPayment(input: PaymentRefundInput): Promise<PaymentRefundResult>;

  verifyWebhookSignature(input: WebhookVerifyInput): boolean;
}
