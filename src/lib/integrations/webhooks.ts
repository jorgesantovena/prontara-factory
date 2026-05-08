/**
 * Webhooks outgoing — Slack y Zapier (H4-INTEG-SLACK + H4-INTEG-ZAPIER).
 *
 * Lee la TenantIntegration del clientId, y si el provider está enabled
 * con webhookUrl configurado, dispara un POST con payload del evento.
 *
 * Idempotente y silencioso: si la integración no está configurada, no
 * hace nada. Si el POST falla, captura el error pero NO bloquea el
 * flujo del caller.
 *
 * Uso típico desde workflow handler:
 *
 *   import { dispatchWebhook } from "@/lib/integrations/webhooks";
 *   await dispatchWebhook(clientId, "invoice.created", { number, amount, client });
 */
import { withPrisma, getPersistenceBackend } from "@/lib/persistence/db";
import { captureError } from "@/lib/observability/error-capture";
import { createLogger } from "@/lib/observability/logger";

const log = createLogger("webhooks");

export type WebhookEventKind =
  | "invoice.created"
  | "invoice.paid"
  | "invoice.overdue"
  | "task.created"
  | "task.completed"
  | "ticket.opened"
  | "ticket.resolved"
  | "manual";

const SUPPORTED_PROVIDERS = ["slack", "zapier"] as const;

export async function dispatchWebhook(
  clientId: string,
  event: WebhookEventKind,
  data: Record<string, unknown>,
): Promise<void> {
  if (getPersistenceBackend() !== "postgres") return;

  const integrations = await withPrisma(async (prisma) => {
    const c = prisma as unknown as {
      tenantIntegration: {
        findMany: (a: { where: Record<string, unknown> }) => Promise<Array<Record<string, unknown>>>;
      };
    };
    return await c.tenantIntegration.findMany({
      where: {
        clientId,
        enabled: true,
        provider: { in: SUPPORTED_PROVIDERS as unknown as string[] },
      },
    });
  });

  if (!integrations || integrations.length === 0) return;

  for (const integ of integrations) {
    const provider = String(integ.provider);
    const config = (integ.configJson || {}) as Record<string, unknown>;
    const webhookUrl = String(config.webhookUrl || "").trim();
    if (!webhookUrl) continue;

    const body = provider === "slack"
      ? formatSlackPayload(event, data)
      : formatZapierPayload(event, data);

    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 5000);
      try {
        await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: ctrl.signal,
        });
      } finally {
        clearTimeout(timer);
      }
      log.info("webhook dispatched", { clientId, provider, event });
    } catch (err) {
      captureError(err, {
        scope: "integrations.webhooks",
        tags: { clientId, provider, event },
      });
    }
  }
}

function formatSlackPayload(event: WebhookEventKind, data: Record<string, unknown>): Record<string, unknown> {
  // Slack incoming webhook acepta { text } simple, o blocks rich.
  const lines = [
    "*[Prontara] " + event + "*",
    ...Object.entries(data).map(([k, v]) => "• " + k + ": " + String(v)),
  ];
  return { text: lines.join("\n") };
}

function formatZapierPayload(event: WebhookEventKind, data: Record<string, unknown>): Record<string, unknown> {
  // Zapier acepta cualquier shape — devolvemos un payload genérico
  // con event, timestamp y data.
  return {
    event,
    timestamp: new Date().toISOString(),
    source: "prontara",
    data,
  };
}
