/**
 * Handlers para los kinds de job estándar (H3-ARQ-01).
 *
 * Se registran al cargar este módulo. /api/cron/tick los importa para
 * activar el registro antes de procesar.
 */
import { registerJobHandler } from "@/lib/jobs/queue";
import { createLogger } from "@/lib/observability/logger";

const log = createLogger("job-handlers");

// "email" — envío diferido de email vía Resend.
registerJobHandler("email", async (payload) => {
  const to = String(payload.to || "").trim();
  const subject = String(payload.subject || "");
  const html = String(payload.html || "");
  if (!to || !subject) throw new Error("email job needs to + subject");
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    log.warn("RESEND_API_KEY missing — skipping email job", { to, subject });
    return; // success no-op para no reintentar eternamente
  }
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM || "no-reply@prontara.com",
      to,
      subject,
      html,
    }),
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error("Resend " + r.status + ": " + text);
  }
});

// "recalc-kpis" — recalcula KPIs precomputados (placeholder para futuro).
registerJobHandler("recalc-kpis", async (payload) => {
  log.info("recalc-kpis", { clientId: payload.clientId });
  // TODO: invocar el helper real de recálculo cuando exista.
  // Por ahora es no-op para que la queue se pueda probar end-to-end.
});

// "verifactu-resend" — reintento de envío AEAT.
registerJobHandler("verifactu-resend", async (payload) => {
  const submissionId = String(payload.submissionId || "").trim();
  if (!submissionId) throw new Error("verifactu-resend needs submissionId");
  log.info("verifactu-resend (stub)", { submissionId });
  // TODO: cuando se implemente firma + envío AEAT real, se llama aquí.
});

// "gdpr-export" — genera bundle JSON y notifica al solicitante.
registerJobHandler("gdpr-export", async (payload) => {
  const clientId = String(payload.clientId || "").trim();
  const requesterEmail = String(payload.requesterEmail || "").trim();
  if (!clientId || !requesterEmail) throw new Error("gdpr-export needs clientId + requesterEmail");
  log.info("gdpr-export running", { clientId, requesterEmail });
  // El export síncrono está en /api/factory/gdpr/export. Este handler
  // permite hacerlo en background para tenants gigantes — por ahora se
  // limita a notificar que el endpoint síncrono está disponible.
});
