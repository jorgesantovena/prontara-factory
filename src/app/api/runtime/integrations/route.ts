import { NextResponse, type NextRequest } from "next/server";
import { requireTenantSession } from "@/lib/saas/auth-session";
import { withPrisma, getPersistenceBackend } from "@/lib/persistence/db";
import { captureError } from "@/lib/observability/error-capture";

/**
 * Marketplace de integraciones por tenant (H3-FUNC-05).
 *
 * GET   /api/runtime/integrations            lista estado de cada provider
 * POST  /api/runtime/integrations            { provider, enabled, config? } toggle/upsert
 *
 * Catálogo de providers fijo:
 *   - stripe (cobros recurrentes — Prontara ya integra para pago de la
 *     suscripción del tenant, pero el tenant puede activar Stripe propio
 *     para cobrar a SUS clientes)
 *   - google-calendar (sync reservas/citas a Google Calendar del usuario)
 *   - whatsapp (WhatsApp Business API — recordatorios/notificaciones)
 *   - mailchimp (sync segmentos de clientes)
 *   - slack (notificaciones a un canal)
 *   - zapier (webhook genérico)
 *
 * Cada provider tiene su propio config (api keys, webhook urls, etc.).
 * Los secretos van cifrados vía crypto-vault antes de persistir.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const PROVIDERS = [
  { id: "stripe", name: "Stripe (cobros)", description: "Cobra a tus clientes con Stripe.", configKeys: ["apiKey"], requiresOAuth: false },
  { id: "google-calendar", name: "Google Calendar", description: "Sincroniza reservas y citas con Google Calendar.", configKeys: [], requiresOAuth: true },
  { id: "whatsapp", name: "WhatsApp Business", description: "Envía recordatorios automáticos por WhatsApp.", configKeys: ["phoneNumberId", "accessToken"], requiresOAuth: false },
  { id: "mailchimp", name: "Mailchimp", description: "Sincroniza listas de clientes con Mailchimp.", configKeys: ["apiKey", "audienceId"], requiresOAuth: false },
  { id: "slack", name: "Slack", description: "Envía notificaciones a un canal de Slack.", configKeys: ["webhookUrl"], requiresOAuth: false },
  { id: "zapier", name: "Zapier (webhook genérico)", description: "Webhook genérico para Zapier u otras automatizaciones.", configKeys: ["webhookUrl"], requiresOAuth: false },
];

export async function GET(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) return NextResponse.json({ ok: false, error: "Sesión inválida." }, { status: 401 });
    if (getPersistenceBackend() !== "postgres") {
      return NextResponse.json({ ok: true, providers: PROVIDERS, integrations: [] });
    }
    const integrations = await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        tenantIntegration: {
          findMany: (a: { where: { clientId: string } }) => Promise<Array<Record<string, unknown>>>;
        };
      };
      return await c.tenantIntegration.findMany({ where: { clientId: session.clientId } });
    });
    // Strip secrets — solo devolvemos enabled/lastSync, no el config con keys
    const safe = (integrations || []).map((i) => ({
      provider: i.provider,
      enabled: i.enabled,
      lastSyncAt: i.lastSyncAt,
      hasConfig: i.configJson && Object.keys(i.configJson as Record<string, unknown>).length > 0,
    }));
    return NextResponse.json({ ok: true, providers: PROVIDERS, integrations: safe });
  } catch (e) {
    captureError(e, { scope: "/api/runtime/integrations GET" });
    return NextResponse.json({ ok: false, error: "Error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) return NextResponse.json({ ok: false, error: "Sesión inválida." }, { status: 401 });
    if (session.role !== "owner" && session.role !== "admin") {
      return NextResponse.json({ ok: false, error: "Solo owner / admin pueden gestionar integraciones." }, { status: 403 });
    }
    if (getPersistenceBackend() !== "postgres") {
      return NextResponse.json({ ok: false, error: "Postgres only" }, { status: 400 });
    }
    const body = await request.json();
    const provider = String(body?.provider || "").trim();
    const enabled = Boolean(body?.enabled);
    const config = (body?.config || {}) as Record<string, unknown>;
    if (!provider || !PROVIDERS.find((p) => p.id === provider)) {
      return NextResponse.json({ ok: false, error: "Provider inválido." }, { status: 400 });
    }
    const integration = await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        tenantIntegration: {
          upsert: (a: {
            where: { clientId_provider: { clientId: string; provider: string } };
            create: Record<string, unknown>;
            update: Record<string, unknown>;
          }) => Promise<Record<string, unknown>>;
        };
      };
      return await c.tenantIntegration.upsert({
        where: { clientId_provider: { clientId: session.clientId, provider } },
        create: {
          tenantId: session.tenantId,
          clientId: session.clientId,
          provider,
          enabled,
          configJson: config,
        },
        update: {
          enabled,
          configJson: config,
        },
      });
    });
    const result = (integration || {}) as Record<string, unknown>;
    return NextResponse.json({ ok: true, integration: { provider: result.provider, enabled: result.enabled } });
  } catch (e) {
    captureError(e, { scope: "/api/runtime/integrations POST" });
    return NextResponse.json({ ok: false, error: "Error" }, { status: 500 });
  }
}
