import { NextResponse, type NextRequest } from "next/server";
import { requireTenantSession } from "@/lib/saas/auth-session";
import { withPrisma } from "@/lib/persistence/db";
import { verifyTotpCode } from "@/lib/saas/totp";
import { decryptString } from "@/lib/saas/crypto-vault";
import { consumeRateLimit, getClientIp } from "@/lib/saas/rate-limiter";
import { captureError } from "@/lib/observability/error-capture";

/**
 * POST /api/runtime/mfa/disable (DEV-MFA + H1-SEC-01 + H1-SEC-03)
 * Body: { code: "123456" }
 *
 * Desactiva MFA tras verificar un código actual válido. No se permite
 * desactivar sin código (evita que un atacante con sesión activa pueda
 * deshabilitar la 2FA del usuario).
 *
 * H1-SEC-01: descifra el secret del vault para validar.
 * H1-SEC-03: rate limit 5 intentos / 15 min — protege contra fuerza
 * bruta del código si una sesión ha sido comprometida.
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
    const gate = consumeRateLimit({
      key: "mfa:disable:" + ip + ":" + session.accountId,
      limit: MFA_ATTEMPTS,
      windowMs: MFA_WINDOW_MS,
    });
    if (!gate.allowed) {
      return NextResponse.json(
        {
          ok: false,
          error: "Demasiados intentos de desactivar MFA. Espera unos minutos.",
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
        { ok: false, error: "Para desactivar MFA hace falta el código actual." },
        { status: 400 },
      );
    }

    const ok = await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        tenantAccountMfa: {
          findUnique: (a: {
            where: { accountId: string };
          }) => Promise<{ id: string; secret: string; enabled: boolean } | null>;
          delete: (a: { where: { accountId: string } }) => Promise<unknown>;
        };
      };
      const mfa = await c.tenantAccountMfa.findUnique({
        where: { accountId: session.accountId },
      });
      if (!mfa || !mfa.enabled) return false;
      // H1-SEC-01: descifrar secret antes de validar
      const secretPlain = decryptString(mfa.secret);
      if (!verifyTotpCode(secretPlain, code)) return false;
      await c.tenantAccountMfa.delete({ where: { accountId: session.accountId } });
      return true;
    });

    if (!ok) {
      return NextResponse.json(
        { ok: false, error: "Código incorrecto o MFA no estaba activado." },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      message: "MFA desactivado. Solo necesitarás contraseña en próximos logins.",
    });
  } catch (error) {
    captureError(error, { scope: "/api/runtime/mfa/disable" });
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Error disable MFA.",
      },
      { status: 500 },
    );
  }
}
