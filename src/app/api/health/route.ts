import { NextResponse } from "next/server";
import { getPersistenceBackend, withPrisma } from "@/lib/persistence/db";
import { isErrorCaptureEnabled } from "@/lib/observability/error-capture";

/**
 * GET /api/health — Health check público (H1-STAB-02).
 *
 * Devuelve el estado de cada sistema crítico:
 *   - persistencia (DB Postgres si está, filesystem en su defecto)
 *   - Stripe (env var + ping real a api.stripe.com con timeout 5s)
 *   - Resend (env var + ping real a api.resend.com)
 *   - Anthropic (env var + ping real a api.anthropic.com)
 *   - Sentry / captura de errores (si SENTRY_DSN está)
 *
 * Cada sistema se evalúa como "ok" / "warn" / "down":
 *   - ok: funciona y está configurado
 *   - warn: configurable pero no esencial; falta config opcional
 *   - down: configuración crítica missing o servicio caído
 *
 * Overall:
 *   - ok: todo "ok"
 *   - degraded: algún componente en warn pero ninguno down
 *   - down: al menos un componente down
 *
 * IMPORTANTE: el endpoint nunca debe tardar más de ~6s. Cada ping
 * externo tiene timeout 5s individual, y se ejecutan en paralelo.
 *
 * Es público a propósito (no requiere auth) para que la página /status
 * pueda mostrarse sin sesión iniciada y para integraciones externas
 * (status pages tipo statuscake, betterstack, uptimerobot).
 */

type ComponentStatus = {
  key: string;
  label: string;
  state: "ok" | "warn" | "down";
  detail: string;
  durationMs?: number;
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PING_TIMEOUT_MS = 5000;

async function checkPersistence(): Promise<ComponentStatus> {
  const start = Date.now();
  const backend = getPersistenceBackend();
  if (backend === "filesystem") {
    return {
      key: "persistence",
      label: "Persistencia",
      state: "warn",
      detail: "Modo filesystem (solo desarrollo local). En Vercel debe ser postgres.",
      durationMs: Date.now() - start,
    };
  }
  try {
    await withPrisma(async (prisma) => prisma.$queryRaw`SELECT 1 as ok`);
    return {
      key: "persistence",
      label: "Persistencia (Postgres)",
      state: "ok",
      detail: "Conexión a Neon Postgres operativa.",
      durationMs: Date.now() - start,
    };
  } catch (err) {
    return {
      key: "persistence",
      label: "Persistencia (Postgres)",
      state: "down",
      detail: err instanceof Error ? err.message : "Error desconocido conectando a Postgres.",
      durationMs: Date.now() - start,
    };
  }
}

/**
 * Hace un fetch GET con timeout y devuelve { ok, status, durationMs, error }.
 * No lanza nunca — siempre devuelve resultado.
 */
async function pingUrl(
  url: string,
  options: RequestInit & { okStatuses?: number[] } = {},
): Promise<{ ok: boolean; status: number; durationMs: number; error?: string }> {
  const start = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PING_TIMEOUT_MS);
  try {
    const r = await fetch(url, {
      method: options.method || "GET",
      headers: options.headers,
      body: options.body,
      signal: ctrl.signal,
      cache: "no-store",
    });
    const durationMs = Date.now() - start;
    const okStatuses = options.okStatuses || [200, 401, 403, 404];
    return { ok: okStatuses.includes(r.status), status: r.status, durationMs };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      durationMs: Date.now() - start,
      error: err instanceof Error ? err.message : "ping failed",
    };
  } finally {
    clearTimeout(timer);
  }
}

async function checkStripe(): Promise<ComponentStatus> {
  const start = Date.now();
  const key = String(process.env.STRIPE_SECRET_KEY || "").trim();
  if (!key) {
    return {
      key: "stripe",
      label: "Stripe (cobros)",
      state: "down",
      detail: "Falta STRIPE_SECRET_KEY. El servicio no funciona sin esta variable.",
      durationMs: Date.now() - start,
    };
  }
  // Ping a /v1/balance — endpoint barato que valida la API key.
  // Esperamos 200 si la key es válida, 401 si no.
  const ping = await pingUrl("https://api.stripe.com/v1/balance", {
    headers: { Authorization: "Bearer " + key },
    okStatuses: [200],
  });
  if (ping.status === 401) {
    return {
      key: "stripe",
      label: "Stripe (cobros)",
      state: "down",
      detail: "STRIPE_SECRET_KEY inválida (401). " + (ping.durationMs) + "ms.",
      durationMs: Date.now() - start,
    };
  }
  if (!ping.ok) {
    return {
      key: "stripe",
      label: "Stripe (cobros)",
      state: "down",
      detail: "API Stripe inalcanzable: " + (ping.error || "status " + ping.status),
      durationMs: Date.now() - start,
    };
  }
  return {
    key: "stripe",
    label: "Stripe (cobros)",
    state: "ok",
    detail: "API key válida, Stripe operativo (" + ping.durationMs + "ms).",
    durationMs: Date.now() - start,
  };
}

async function checkResend(): Promise<ComponentStatus> {
  const start = Date.now();
  const key = String(process.env.RESEND_API_KEY || "").trim();
  if (!key) {
    return {
      key: "resend",
      label: "Email transaccional (Resend)",
      state: "warn",
      detail: "Sin configurar (opcional). RESEND_API_KEY no establecido.",
      durationMs: Date.now() - start,
    };
  }
  // Ping a /domains — endpoint que valida la API key.
  const ping = await pingUrl("https://api.resend.com/domains", {
    headers: { Authorization: "Bearer " + key },
    okStatuses: [200],
  });
  if (ping.status === 401 || ping.status === 403) {
    return {
      key: "resend",
      label: "Email transaccional (Resend)",
      state: "down",
      detail: "RESEND_API_KEY inválida (" + ping.status + ").",
      durationMs: Date.now() - start,
    };
  }
  if (!ping.ok) {
    return {
      key: "resend",
      label: "Email transaccional (Resend)",
      state: "warn",
      detail: "API Resend inalcanzable: " + (ping.error || "status " + ping.status),
      durationMs: Date.now() - start,
    };
  }
  return {
    key: "resend",
    label: "Email transaccional (Resend)",
    state: "ok",
    detail: "API key válida (" + ping.durationMs + "ms).",
    durationMs: Date.now() - start,
  };
}

async function checkAnthropic(): Promise<ComponentStatus> {
  const start = Date.now();
  const key = String(process.env.ANTHROPIC_API_KEY || "").trim();
  if (!key) {
    return {
      key: "anthropic",
      label: "Chat IA (Anthropic)",
      state: "warn",
      detail: "Sin configurar (opcional). ANTHROPIC_API_KEY no establecido.",
      durationMs: Date.now() - start,
    };
  }
  // No hay un endpoint público "barato" en la API — hacemos HEAD a /v1/messages.
  // Esperamos 405 / 400 / 401 / 200 — cualquiera de ellos significa que el host
  // está vivo. Solo nos preocupa que falle por timeout/red.
  const ping = await pingUrl("https://api.anthropic.com/v1/messages", {
    method: "HEAD",
    headers: {
      "anthropic-version": "2023-06-01",
      "x-api-key": key,
    },
    okStatuses: [200, 400, 401, 403, 404, 405, 415],
  });
  if (!ping.ok) {
    return {
      key: "anthropic",
      label: "Chat IA (Anthropic)",
      state: "warn",
      detail: "API Anthropic inalcanzable: " + (ping.error || "status " + ping.status),
      durationMs: Date.now() - start,
    };
  }
  return {
    key: "anthropic",
    label: "Chat IA (Anthropic)",
    state: "ok",
    detail: "Host alcanzable (" + ping.durationMs + "ms, status " + ping.status + ").",
    durationMs: Date.now() - start,
  };
}

function checkEnv(
  key: string,
  label: string,
  envVars: string[],
  required: boolean,
): ComponentStatus {
  for (const v of envVars) {
    const val = String(process.env[v] || "").trim();
    if (val) {
      return {
        key,
        label,
        state: "ok",
        detail: "Configurado correctamente.",
      };
    }
  }
  return {
    key,
    label,
    state: required ? "down" : "warn",
    detail: required
      ? "Falta configurar " + envVars[0] + ". El servicio no funciona sin esta variable."
      : "Sin configurar (opcional). " + envVars[0] + " no establecido.",
  };
}

function checkErrorCapture(): ComponentStatus {
  const enabled = isErrorCaptureEnabled();
  return {
    key: "error-capture",
    label: "Captura de errores (Sentry)",
    state: enabled ? "ok" : "warn",
    detail: enabled
      ? "Sentry configurado. Errores enviados al backend de observabilidad."
      : "Sin SENTRY_DSN — los errores solo se ven en Vercel logs (7 días).",
  };
}

export async function GET() {
  // Lanzamos todas las comprobaciones en paralelo. Cada una con timeout
  // individual, así el global está acotado por max(comprobaciones) ≈ 5s + overhead.
  const [persistence, stripe, resend, anthropic] = await Promise.all([
    checkPersistence(),
    checkStripe(),
    checkResend(),
    checkAnthropic(),
  ]);

  const components: ComponentStatus[] = [
    persistence,
    stripe,
    checkEnv("stripe-webhook", "Webhook Stripe", ["STRIPE_WEBHOOK_SECRET"], false),
    resend,
    anthropic,
    checkEnv(
      "session",
      "Secreto de sesión",
      ["PRONTARA_SESSION_SECRET"],
      process.env.NODE_ENV === "production",
    ),
    checkErrorCapture(),
  ];

  const hasDown = components.some((c) => c.state === "down");
  const hasWarn = components.some((c) => c.state === "warn");
  const overall: "ok" | "degraded" | "down" = hasDown
    ? "down"
    : hasWarn
      ? "degraded"
      : "ok";

  return NextResponse.json({
    ok: true,
    overall,
    components,
    checkedAt: new Date().toISOString(),
  });
}
