import { NextResponse, type NextRequest } from "next/server";
import { requireTenantSession } from "@/lib/saas/auth-session";
import { withPrisma } from "@/lib/persistence/db";
import {
  generateTotpSecret,
  buildOtpAuthUrl,
  generateBackupCodes,
} from "@/lib/saas/totp";
import { encryptString } from "@/lib/saas/crypto-vault";
import { consumeRateLimit, getClientIp } from "@/lib/saas/rate-limiter";
import { captureError } from "@/lib/observability/error-capture";

/**
 * POST /api/runtime/mfa/setup (DEV-MFA + H1-SEC-01 + H1-SEC-03)
 *
 * Genera secret TOTP + backup codes para la cuenta de la sesión.
 * Devuelve URL otpauth para QR y secret en Base32 para entrada manual.
 * El MFA queda en estado disabled hasta que el usuario verifique con un
 * código en /verify.
 *
 * H1-SEC-01: el secret TOTP se cifra antes de persistirlo en BD. La
 * respuesta sigue devolviendo el secret en claro porque el usuario
 * necesita verlo una vez para escanear el QR / introducirlo en su app.
 *
 * H1-SEC-03: rate limit 5 intentos / 15 min por IP+accountId — evita que
 * una sesión robada pueda regenerar secretos en bucle.
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
      key: "mfa:setup:" + ip + ":" + session.accountId,
      limit: MFA_ATTEMPTS,
      windowMs: MFA_WINDOW_MS,
    });
    if (!gate.allowed) {
      return NextResponse.json(
        {
          ok: false,
          error: "Demasiados intentos de configurar MFA. Espera unos minutos.",
          retryAfterSeconds: gate.retryAfterSeconds,
        },
        { status: 429, headers: { "Retry-After": String(gate.retryAfterSeconds) } },
      );
    }

    const secret = generateTotpSecret();
    const backupCodes = generateBackupCodes(8);
    const issuer = "Prontara";
    const label = session.email + " · " + session.slug;
    const otpauthUrl = buildOtpAuthUrl(secret, label, issuer);

    // H1-SEC-01: cifrar secret antes de persistirlo
    const encryptedSecret = encryptString(secret);

    await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        tenantAccountMfa: {
          upsert: (a: {
            where: { accountId: string };
            create: Record<string, unknown>;
            update: Record<string, unknown>;
          }) => Promise<unknown>;
        };
      };
      await c.tenantAccountMfa.upsert({
        where: { accountId: session.accountId },
        create: {
          accountId: session.accountId,
          secret: encryptedSecret,
          enabled: false,
          backupCodesJson: backupCodes.map((code) => ({ code, consumedAt: null })),
        },
        update: {
          secret: encryptedSecret,
          enabled: false,
          backupCodesJson: backupCodes.map((code) => ({ code, consumedAt: null })),
          enabledAt: null,
        },
      });
    });

    return NextResponse.json({
      ok: true,
      secret,
      otpauthUrl,
      backupCodes,
      qrUrl:
        "https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=" +
        encodeURIComponent(otpauthUrl),
      message:
        "Escanea el QR con tu app autenticadora (Google Authenticator, Authy, etc.) o introduce el secret manualmente. Después confirma con un código en /api/runtime/mfa/verify.",
    });
  } catch (error) {
    captureError(error, { scope: "/api/runtime/mfa/setup" });
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Error setup MFA.",
      },
      { status: 500 },
    );
  }
}
