/**
 * Cliente WhatsApp Business Cloud API (H6-WHATSAPP).
 *
 * Documentación oficial: https://developers.facebook.com/docs/whatsapp/cloud-api
 *
 * Lee la TenantIntegration provider="whatsapp" del clientId. La config
 * tiene { phoneNumberId, accessToken }. Si no está enabled, no-op.
 *
 * Limita a templates pre-aprobados (Meta exige plantillas verificadas
 * para mensajes proactivos fuera de la ventana 24h).
 */
import { withPrisma, getPersistenceBackend } from "@/lib/persistence/db";
import { captureError } from "@/lib/observability/error-capture";
import { createLogger } from "@/lib/observability/logger";

const log = createLogger("whatsapp");

export type WhatsAppTemplateMessage = {
  to: string; // formato E.164: +34600111222
  templateName: string;
  languageCode?: string; // "es" / "es_ES"
  variables?: string[]; // valores para placeholders {{1}}, {{2}}, etc.
};

export async function sendWhatsAppTemplate(
  clientId: string,
  msg: WhatsAppTemplateMessage,
): Promise<{ ok: true; messageId: string } | { ok: false; reason: string }> {
  if (getPersistenceBackend() !== "postgres") {
    return { ok: false, reason: "filesystem mode" };
  }

  const integ = await withPrisma(async (prisma) => {
    const c = prisma as unknown as {
      tenantIntegration: {
        findUnique: (a: { where: { clientId_provider: { clientId: string; provider: string } } }) => Promise<{ enabled: boolean; configJson: Record<string, unknown> } | null>;
      };
    };
    return await c.tenantIntegration.findUnique({
      where: { clientId_provider: { clientId, provider: "whatsapp" } },
    });
  });

  if (!integ || !integ.enabled) return { ok: false, reason: "integration_disabled" };
  const cfg = integ.configJson || {};
  const phoneNumberId = String(cfg.phoneNumberId || "").trim();
  const accessToken = String(cfg.accessToken || "").trim();
  if (!phoneNumberId || !accessToken) return { ok: false, reason: "missing_credentials" };

  const url = "https://graph.facebook.com/v20.0/" + phoneNumberId + "/messages";
  const body: Record<string, unknown> = {
    messaging_product: "whatsapp",
    to: msg.to.replace(/\D/g, ""),
    type: "template",
    template: {
      name: msg.templateName,
      language: { code: msg.languageCode || "es" },
    },
  };

  if (msg.variables && msg.variables.length > 0) {
    (body.template as Record<string, unknown>).components = [
      {
        type: "body",
        parameters: msg.variables.map((v) => ({ type: "text", text: String(v) })),
      },
    ];
  }

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    const r = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    const data = await r.json();
    if (!r.ok) {
      return { ok: false, reason: "api_error: " + (data?.error?.message || r.status) };
    }
    const messageId = String(data?.messages?.[0]?.id || "");
    log.info("whatsapp sent", { clientId, to: msg.to, template: msg.templateName });
    return { ok: true, messageId };
  } catch (err) {
    captureError(err, { scope: "integrations.whatsapp", tags: { clientId } });
    return { ok: false, reason: err instanceof Error ? err.message : "request_failed" };
  }
}

/**
 * Envío de texto libre — solo válido dentro de la ventana de 24h tras
 * que el cliente haya escrito primero. Para uso proactivo, usar
 * sendWhatsAppTemplate con plantilla aprobada por Meta.
 */
export async function sendWhatsAppText(
  clientId: string,
  to: string,
  text: string,
): Promise<{ ok: true; messageId: string } | { ok: false; reason: string }> {
  if (getPersistenceBackend() !== "postgres") return { ok: false, reason: "filesystem mode" };
  const integ = await withPrisma(async (prisma) => {
    const c = prisma as unknown as {
      tenantIntegration: {
        findUnique: (a: { where: { clientId_provider: { clientId: string; provider: string } } }) => Promise<{ enabled: boolean; configJson: Record<string, unknown> } | null>;
      };
    };
    return await c.tenantIntegration.findUnique({
      where: { clientId_provider: { clientId, provider: "whatsapp" } },
    });
  });
  if (!integ || !integ.enabled) return { ok: false, reason: "integration_disabled" };
  const cfg = integ.configJson || {};
  const phoneNumberId = String(cfg.phoneNumberId || "").trim();
  const accessToken = String(cfg.accessToken || "").trim();
  if (!phoneNumberId || !accessToken) return { ok: false, reason: "missing_credentials" };

  try {
    const r = await fetch("https://graph.facebook.com/v20.0/" + phoneNumberId + "/messages", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: to.replace(/\D/g, ""),
        type: "text",
        text: { body: text.slice(0, 4096) },
      }),
    });
    const data = await r.json();
    if (!r.ok) return { ok: false, reason: data?.error?.message || ("api_" + r.status) };
    return { ok: true, messageId: String(data?.messages?.[0]?.id || "") };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "request_failed" };
  }
}
