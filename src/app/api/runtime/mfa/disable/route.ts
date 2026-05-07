import { NextResponse, type NextRequest } from "next/server";
import { requireTenantSession } from "@/lib/saas/auth-session";
import { withPrisma } from "@/lib/persistence/db";
import { verifyTotpCode } from "@/lib/saas/totp";

/**
 * POST /api/runtime/mfa/disable (DEV-MFA)
 * Body: { code: "123456" }
 *
 * Desactiva MFA tras verificar un código actual válido. No se permite
 * desactivar sin código (evita que un atacante con sesión activa pueda
 * deshabilitar la 2FA del usuario).
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) {
      return NextResponse.json({ ok: false, error: "Sesión inválida." }, { status: 401 });
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
      if (!verifyTotpCode(mfa.secret, code)) return false;
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
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Error disable MFA.",
      },
      { status: 500 },
    );
  }
}
