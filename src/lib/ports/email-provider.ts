/**
 * EmailProvider · puerto.
 *
 * Lo que el dominio necesita de un proveedor de email transaccional.
 * Adapter actual: Resend (REST). Permite cambiar a Postmark / Sendgrid
 * / Amazon SES sin tocar el resto del código.
 */
export type EmailMessage = {
  to: string;
  subject: string;
  /** HTML render del cuerpo. */
  html: string;
  /** Versión texto plano (opcional, recomendado por filtros antispam). */
  text?: string;
  /** From override; si se omite usa el del adapter. */
  from?: string;
  /** Reply-To opcional. */
  replyTo?: string;
};

export type EmailSendResult = {
  ok: boolean;
  /** ID asignado por el proveedor (para tracking). */
  providerMessageId?: string;
  error?: string;
};

export interface EmailProvider {
  readonly name: string;

  /**
   * Envía un email. NO debe lanzar en errores normales (rate limit,
   * dominio no verificado, etc) — devuelve `ok: false` con el error
   * en el campo `error`. Lanzar se reserva para errores de programación.
   */
  send(message: EmailMessage): Promise<EmailSendResult>;
}
