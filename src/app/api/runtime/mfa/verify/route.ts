import { NextResponse, type NextRequest } from "next/server";
import { requireTenantSession } from "@/lib/saas/auth-session";
import { withPrisma } from "@/lib/persistence/db";
import { verifyTotpCode } from "@/lib/saas/totp";

/**
 * POST /api/runtime/mfa/verify (DEV-MFA)
 * Body: { code: "123456" }
 *
 * Verifica el código TOTP. Si coincide y el MFA aún estaba en setup
 * (enabled=false), lo activa (enabled=true). Si ya estaba activo, solo
 * confirma que el código es válido.
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
      const valid = verifyTotpCode(mfa.secret, code);
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

    return NextResponse.json({
      ok: true,
      activated: result.activated,
      message: result.activated
        ? "MFA activado correctamente. La próxima vez que inicies sesión te pediremos el código."
        : "Código válido.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Error verify MFA.",
      },
      { status: 500 },
    );
  }
}
