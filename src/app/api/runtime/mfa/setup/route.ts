import { NextResponse, type NextRequest } from "next/server";
import { requireTenantSession } from "@/lib/saas/auth-session";
import { withPrisma } from "@/lib/persistence/db";
import {
  generateTotpSecret,
  buildOtpAuthUrl,
  generateBackupCodes,
} from "@/lib/saas/totp";

/**
 * POST /api/runtime/mfa/setup (DEV-MFA)
 *
 * Genera secret TOTP + backup codes para la cuenta de la sesión.
 * Devuelve URL otpauth para QR y secret en Base32 para entrada manual.
 * El MFA queda en estado disabled hasta que el usuario verifique con un
 * código en /verify.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) {
      return NextResponse.json({ ok: false, error: "Sesión inválida." }, { status: 401 });
    }

    const secret = generateTotpSecret();
    const backupCodes = generateBackupCodes(8);
    const issuer = "Prontara";
    const label = session.email + " · " + session.slug;
    const otpauthUrl = buildOtpAuthUrl(secret, label, issuer);

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
          secret,
          enabled: false,
          backupCodesJson: backupCodes.map((code) => ({ code, consumedAt: null })),
        },
        update: {
          secret,
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
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Error setup MFA.",
      },
      { status: 500 },
    );
  }
}
