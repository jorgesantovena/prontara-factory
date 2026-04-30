import { buildActivationPackageFromRequest } from "@/lib/saas/activation-package";
import { sendPlainEmail, type SentEmailResult } from "@/lib/saas/email-service";
import type { NextRequest } from "next/server";

export type ActivationDeliveryResult = {
  ok: boolean;
  emailReady: boolean;
  delivery: SentEmailResult | null;
  to: string | null;
  subject: string | null;
};

export async function sendActivationEmailFromRequest(
  request: NextRequest
): Promise<ActivationDeliveryResult> {
  const activationPackage = buildActivationPackageFromRequest(request);

  const recipient = activationPackage.admin.email;

  if (!activationPackage.email || !recipient) {
    return {
      ok: false,
      emailReady: false,
      delivery: null,
      to: null,
      subject: null,
    };
  }

  const delivery = await sendPlainEmail({
    to: recipient,
    subject: activationPackage.email.subject,
    text: activationPackage.email.text,
  });

  return {
    ok: delivery.ok,
    emailReady: true,
    delivery,
    to: recipient,
    subject: activationPackage.email.subject,
  };
}