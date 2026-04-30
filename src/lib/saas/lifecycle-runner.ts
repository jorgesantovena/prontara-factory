/**
 * Runner del lifecycle: evalúa eventos pendientes, envía emails (si no es
 * dry-run) y graba idempotencia.
 *
 * Se puede llamar desde la UI `/factory/lifecycle` o desde un cron/scheduled
 * task. No corre solo — alguien tiene que dispararlo.
 */
import {
  evaluatePendingEvents,
  recordLifecycleSent,
  type PendingLifecycleEvent,
} from "@/lib/saas/lifecycle-evaluator";
import { sendPlainEmail } from "@/lib/saas/email-service";

export type LifecycleRunResult = {
  dryRun: boolean;
  totalPending: number;
  sent: Array<{
    clientId: string;
    event: string;
    recipient: string;
    provider: string;
    detail: string;
  }>;
  failed: Array<{
    clientId: string;
    event: string;
    recipient: string;
    error: string;
  }>;
};

export async function runLifecycle(options: { dryRun: boolean }): Promise<LifecycleRunResult> {
  const pending = evaluatePendingEvents();
  const result: LifecycleRunResult = {
    dryRun: options.dryRun,
    totalPending: pending.length,
    sent: [],
    failed: [],
  };

  if (options.dryRun) {
    // No enviamos ni grabamos. Solo reportamos el plan.
    return result;
  }

  for (const event of pending) {
    try {
      const emailResult = await sendPlainEmail({
        to: event.recipient.email,
        subject: event.rendered.subject,
        text: event.rendered.text,
      });

      // Grabamos idempotencia tanto si fue Resend real como si quedó en outbox.
      // El outbox cuenta como "intento consumado" para no insistir sin parar
      // mientras no haya proveedor configurado.
      recordLifecycleSent({
        clientId: event.clientId,
        event: event.event,
        recipient: event.recipient.email,
      });

      result.sent.push({
        clientId: event.clientId,
        event: event.event,
        recipient: event.recipient.email,
        provider: emailResult.provider,
        detail: emailResult.detail,
      });
    } catch (err) {
      result.failed.push({
        clientId: event.clientId,
        event: event.event,
        recipient: event.recipient.email,
        error: err instanceof Error ? err.message : "Error desconocido.",
      });
    }
  }

  return result;
}

export type LifecyclePreview = {
  generatedAt: string;
  pending: PendingLifecycleEvent[];
};

export function previewLifecycle(): LifecyclePreview {
  return {
    generatedAt: new Date().toISOString(),
    pending: evaluatePendingEvents(),
  };
}
