/**
 * Adapter Resend → EmailProvider.
 *
 * Wrapper sobre `email-service.sendPlainEmail`. Si Resend no está
 * configurado, el wrapper actual cae a un outbox en disco
 * (data/saas/mail-outbox/) — el adapter mapea ambos casos a la forma
 * del puerto.
 */
import { sendPlainEmail } from "@/lib/saas/email-service";
import type {
  EmailProvider,
  EmailMessage,
  EmailSendResult,
} from "@/lib/ports/email-provider";

/**
 * Convierte HTML a texto plano de forma muy básica (strip de tags).
 * El puerto pide siempre versión texto; si el caller no la pasa,
 * derivamos una. NO es un parser HTML completo — basta para emails
 * razonables sin estructura compleja.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export const resendEmailProvider: EmailProvider = {
  name: "resend",

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const text = message.text || stripHtml(message.html);

    const result = await sendPlainEmail({
      to: message.to,
      subject: message.subject,
      text,
    });

    return {
      ok: result.ok,
      providerMessageId: result.detail,
      error: result.ok ? undefined : result.detail,
    };
  },
};
