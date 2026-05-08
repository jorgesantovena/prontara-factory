import { NextResponse, type NextRequest } from "next/server";
import {
  decodeOAuthState,
  exchangeCodeAndFetchUser,
  type OAuthProvider,
} from "@/lib/saas/oauth-providers";
import { resolveTenantBySlugAsync } from "@/lib/saas/tenant-resolver-async";
import { withPrisma, getPersistenceBackend } from "@/lib/persistence/db";
import { attachSessionCookie } from "@/lib/saas/auth-session";
import type { TenantSessionUser } from "@/lib/saas/account-definition";

/**
 * GET /api/runtime/oauth/{google|microsoft}/callback?code=X&state=Y (H2-SSO)
 *
 * El proveedor redirige aquí con un code. Lo intercambiamos por un
 * id_token, sacamos el email del usuario y buscamos una TenantAccount
 * con ese email en el tenant indicado por el state. Si existe,
 * vinculamos via TenantAccountSSO y creamos sesión. Si no, error
 * controlado.
 *
 * Política: para MVP NO creamos cuentas nuevas automáticamente desde
 * SSO — el usuario debe haber sido invitado al tenant antes (su email
 * tiene que existir en TenantAccount).
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider: providerRaw } = await params;
  const provider = providerRaw as OAuthProvider;
  if (provider !== "google" && provider !== "microsoft") {
    return errorRedirect("Proveedor no soportado.");
  }

  const code = String(request.nextUrl.searchParams.get("code") || "").trim();
  const stateRaw = String(request.nextUrl.searchParams.get("state") || "").trim();
  if (!code || !stateRaw) {
    return errorRedirect("Faltan code o state.");
  }

  const state = decodeOAuthState(stateRaw);
  if (!state || state.provider !== provider) {
    return errorRedirect("State inválido o no coincide con proveedor.");
  }

  const userInfo = await exchangeCodeAndFetchUser({ provider, code });
  if ("error" in userInfo) {
    return errorRedirect(userInfo.error);
  }

  // Resolver tenant
  const tenant = await resolveTenantBySlugAsync(state.tenantSlug);
  if (!tenant) {
    return errorRedirect("Tenant " + state.tenantSlug + " no encontrado.");
  }

  if (getPersistenceBackend() !== "postgres") {
    return errorRedirect("SSO solo opera en modo Postgres.");
  }

  // Buscar TenantAccount por email
  const account = await withPrisma(async (prisma) => {
    const c = prisma as unknown as {
      tenantAccount: {
        findFirst: (a: { where: { clientId: string; email: string } }) => Promise<{
          id: string;
          tenantId: string;
          clientId: string;
          slug: string;
          email: string;
          fullName: string;
          role: string;
          mustChangePassword: boolean;
          status: string;
        } | null>;
      };
    };
    return await c.tenantAccount.findFirst({
      where: { clientId: tenant.clientId, email: userInfo.email },
    });
  });

  if (!account) {
    return errorRedirect(
      "No hay cuenta con email " + userInfo.email + " en este tenant. Pide al administrador que te invite primero.",
    );
  }
  if (account.status === "disabled") {
    return errorRedirect("Tu cuenta está deshabilitada.");
  }

  // Vincular SSO (crear o actualizar)
  await withPrisma(async (prisma) => {
    const c = prisma as unknown as {
      tenantAccountSSO: {
        upsert: (a: {
          where: { provider_providerSub: { provider: string; providerSub: string } };
          create: Record<string, unknown>;
          update: Record<string, unknown>;
        }) => Promise<unknown>;
      };
    };
    await c.tenantAccountSSO.upsert({
      where: {
        provider_providerSub: { provider, providerSub: userInfo.sub },
      },
      create: {
        accountId: account.id,
        provider,
        providerSub: userInfo.sub,
        email: userInfo.email,
        lastLoginAt: new Date(),
      },
      update: {
        email: userInfo.email,
        lastLoginAt: new Date(),
      },
    });
  });

  // Crear sesión
  const sessionUser: TenantSessionUser = {
    accountId: account.id,
    tenantId: account.tenantId,
    clientId: account.clientId,
    slug: account.slug,
    email: account.email,
    fullName: account.fullName,
    role: account.role as TenantSessionUser["role"],
    mustChangePassword: account.mustChangePassword,
  };

  const response = NextResponse.redirect(getRuntimeBaseUrl(state.tenantSlug) + "/");
  attachSessionCookie(response, sessionUser);
  return response;
}

function getRuntimeBaseUrl(tenantSlug: string): string {
  // En multi-tenant por slug en URL, redirige a /. Si Prontara usa subdominios
  // por tenant, esto se ajustaría aquí.
  void tenantSlug;
  return process.env.PRONTARA_PUBLIC_BASE_URL || "https://app.prontara.com";
}

function errorRedirect(message: string): NextResponse {
  const base = process.env.PRONTARA_PUBLIC_BASE_URL || "https://app.prontara.com";
  const url = base + "/acceso?ssoError=" + encodeURIComponent(message);
  return NextResponse.redirect(url);
}
