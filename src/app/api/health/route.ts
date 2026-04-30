import { NextResponse } from "next/server";
import { getPersistenceBackend, withPrisma } from "@/lib/persistence/db";

/**
 * GET /api/health — Health check público.
 *
 * Devuelve el estado de cada sistema crítico:
 *   - persistencia (DB Postgres si está, filesystem en su defecto)
 *   - Stripe (env var configurada)
 *   - Resend (env var configurada)
 *   - Anthropic (env var configurada — necesaria para chat Factory)
 *
 * Cada sistema se evalúa como "ok" / "warn" / "down":
 *   - ok: funciona y está configurado
 *   - warn: configurable pero no esencial; falta config opcional
 *   - down: configuración crítica missing o servicio caído
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
  // Postgres: probamos un SELECT 1 mínimo.
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

export async function GET() {
  const components: ComponentStatus[] = [];

  // 1. Persistencia
  components.push(await checkPersistence());

  // 2. Stripe
  components.push(
    checkEnv("stripe", "Stripe (cobros)", ["STRIPE_SECRET_KEY"], true),
  );

  // 3. Webhook Stripe
  components.push(
    checkEnv("stripe-webhook", "Webhook Stripe", ["STRIPE_WEBHOOK_SECRET"], false),
  );

  // 4. Resend (email)
  components.push(
    checkEnv("resend", "Email transaccional (Resend)", ["RESEND_API_KEY"], false),
  );

  // 5. Anthropic (chat factory — opcional)
  components.push(
    checkEnv("anthropic", "Chat IA (Anthropic)", ["ANTHROPIC_API_KEY"], false),
  );

  // 6. Sesiones
  components.push(
    checkEnv(
      "session",
      "Secreto de sesión",
      ["PRONTARA_SESSION_SECRET"],
      process.env.NODE_ENV === "production",
    ),
  );

  // Estado global
  const hasDown = components.some((c) => c.state === "down");
  const hasWarn = components.some((c) => c.state === "warn");
  const overall: "ok" | "warn" | "down" = hasDown ? "down" : hasWarn ? "warn" : "ok";

  return NextResponse.json({
    ok: true,
    overall,
    components,
    checkedAt: new Date().toISOString(),
  });
}
