import { NextResponse, type NextRequest } from "next/server";
import { requireTenantSession } from "@/lib/saas/auth-session";
import { withPrisma } from "@/lib/persistence/db";
import { verifyTotpCode } from "@/lib/saas/totp";
import { decryptString } from "@/lib/saas/crypto-vault";
import { consumeRateLimit, clearRateLimit, getClientIp } from "@/lib/saas/rate-limiter";
import { captureError } from "@/lib/observability/error-capture";

/**
 * POST /api/runtime/mfa/verify (DEV-MFA + H1-SEC-01 + H1-SEC-03)
 * Body: { code: "123456" }
 *
 * Verifica el código TOTP. Si coincide y el MFA aún estaba en setup
 * (enabled=false), lo activa (enabled=true). Si ya estaba activo, solo
 * confirma que el código es válido.
 *
 * H1-SEC-01: el secret se descifra del vault antes de validar el código.
 * H1-SEC-03: rate limit 5 intentos / 15 min por IP+accountId — protege
 * contra fuerza bruta del código de 6 dígitos.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MFA_WINDOW_MS = 15 * 60 * 1000;
const MFA_ATTEMPTS = 5;

export async function POST(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) {
      return NextResponse.json({ ok: false, error: "Sesión inválida." }, { status: 401 });
    }

    const ip = getClientIp(request.headers);
    const gateKey = "mfa:verify:" + ip + ":" + session.accountId;
    const gate = consumeRateLimit({
      key: gateKey,
      limit: MFA_ATTEMPTS,
      windowMs: MFA_WINDOW_MS,
    });
    if (!gate.allowed) {
      return NextResponse.json(
        {
          ok: false,
          error: "Demasiados intentos de verificar el código. Espera unos minutos.",
          retryAfterSeconds: gate.retryAfterSeconds,
        },
        { status: 429, headers: { "Retry-After": String(gate.retryAfterSeconds) } },
      );
    }

    let body: { code?: string } = {};
    try {
      body = (await request.json()) as { code?: string };
    } catch {
      // body opcional
    }
    const code = String(body?.code || "").trim();
    if (!code) {
      return NextResponse.json(
        { ok: false, error: "Falta el código." },
        { status: 400 },
      );
    }

    const result = await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        tenantAccountMfa: {
          findUnique: (a: {
            where: { accountId: string };
          }) => Promise<{ id: string; secret: string; enabled: boolean } | null>;
          update: (a: {
            where: { accountId: string };
            data: Record<string, unknown>;
          }) => Promise<unknown>;
        };
      };
      const mfa = await c.tenantAccountMfa.findUnique({
        where: { accountId: session.accountId },
      });
      if (!mfa) return { ok: false as const, reason: "no_mfa_setup" };
      // H1-SEC-01: descifrar secret antes de validar (compat con datos legacy plaintext).
      const secretPlain = decryptString(mfa.secret);
      const valid = verifyTotpCode(secretPlain, code);
      if (!valid) return { ok: false as const, reason: "invalid_code" };
      if (!mfa.enabled) {
        await c.tenantAccountMfa.update({
          where: { accountId: session.accountId },
          data: { enabled: true, enabledAt: new Date() },
        });
        return { ok: true as const, activated: true };
      }
      return { ok: true as const, activated: false };
    });

    if (!result || !result.ok) {
      const reason = result?.reason || "unknown";
      const msg =
        reason === "no_mfa_setup"
          ? "MFA no configurado. Llama primero a /setup."
          : "Código incorrecto. Verifica que tu app esté sincronizada e inténtalo otra vez.";
      return NextResponse.json({ ok: false, error: msg, reason }, { status: 400 });
    }

    // Éxito → liberar bucket para no penalizar al usuario tras unos errores previos
    clearRateLimit(gateKey);

    return NextResponse.json({
      ok: true,
      activated: result.activated,
      message: result.activated
        ? "MFA activado correctamente. La próxima vez que inicies sesión te pediremos el código."
        : "Código válido.",
    });
  } catch (error) {
    captureError(error, { scope: "/api/runtime/mfa/verify" });
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Error verify MFA.",
      },
      { status: 500 },
    );
  }
}
