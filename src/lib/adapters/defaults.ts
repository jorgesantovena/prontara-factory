/**
 * Defaults — adapters concretos asignados a cada puerto.
 *
 * Punto único de configuración: si en el futuro queremos cambiar de
 * Stripe a Adyen, o de Resend a Postmark, basta con apuntar aquí al
 * nuevo adapter (sin tocar consumidores).
 *
 * Uso recomendado:
 *
 *   import { paymentProvider, emailProvider } from "@/lib/adapters/defaults";
 *
 *   await emailProvider.send({ to, subject, html });
 *   await paymentProvider.refundPayment({ ... });
 */
import type { PaymentProvider } from "@/lib/ports/payment-provider";
import type { EmailProvider } from "@/lib/ports/email-provider";
import type { LLMProvider } from "@/lib/ports/llm-provider";

import { stripePaymentProvider } from "./payment-stripe";
import { resendEmailProvider } from "./email-resend";
import { anthropicLlmProvider } from "./llm-anthropic";

export const paymentProvider: PaymentProvider = stripePaymentProvider;
export const emailProvider: EmailProvider = resendEmailProvider;
export const llmProvider: LLMProvider = anthropicLlmProvider;
