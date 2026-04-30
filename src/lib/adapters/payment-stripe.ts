/**
 * Adapter Stripe → PaymentProvider.
 *
 * Wrapper fino sobre billing-stripe.ts (que sigue siendo el código real
 * que habla con la REST API de Stripe). Este fichero existe para que
 * el dominio importe `PaymentProvider` y reciba un objeto que cumple el
 * contrato.
 *
 * Si en el futuro se sustituye Stripe por Adyen / Mollie / Redsys, se
 * crea otro adapter al lado y se cambia el factory de defaults.
 */
import {
  createStripeCheckoutSession,
  resolveStripeCheckoutSession,
  refundStripeChargeOrIntent,
  verifyStripeWebhookSignature,
  getStripeWebhookSecret,
} from "@/lib/saas/billing-stripe";
import type {
  PaymentProvider,
  PaymentCheckoutInput,
  PaymentCheckoutResult,
  PaymentResolveResult,
  PaymentRefundInput,
  PaymentRefundResult,
  WebhookVerifyInput,
} from "@/lib/ports/payment-provider";

export const stripePaymentProvider: PaymentProvider = {
  name: "stripe",

  async createCheckoutSession(
    input: PaymentCheckoutInput,
  ): Promise<PaymentCheckoutResult> {
    return createStripeCheckoutSession(input);
  },

  async resolveCheckoutSession(sessionId: string): Promise<PaymentResolveResult> {
    return resolveStripeCheckoutSession(sessionId);
  },

  async refundPayment(input: PaymentRefundInput): Promise<PaymentRefundResult> {
    return refundStripeChargeOrIntent(input);
  },

  verifyWebhookSignature(input: WebhookVerifyInput): boolean {
    // El wrapper actual devuelve `{ ok, reason? }`; reducimos a bool
    // para encajar con el contrato genérico del puerto. El caller que
    // necesite el motivo (loggeo) puede importar `verifyStripeWebhookSignature`
    // directamente.
    const result = verifyStripeWebhookSignature({
      rawBody: input.payload,
      signatureHeader: input.signatureHeader,
      secret: input.secret || getStripeWebhookSecret(),
    });
    return result.ok;
  },
};
