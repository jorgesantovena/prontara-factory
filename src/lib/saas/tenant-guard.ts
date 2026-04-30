import type { NextRequest } from "next/server";
import { resolveRuntimeRequestContext } from "@/lib/saas/runtime-request-context";
import { getSessionFromRequest } from "@/lib/saas/auth-session";

export type TenantGuardResult = {
  ok: boolean;
  tenantId: string | null;
  clientId: string | null;
  slug: string | null;
  displayName: string | null;
  source: string;
  requestedTenant: string | null;
  sessionTenant: string | null;
};

function normalize(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

export function requireTenantScope(request: NextRequest): TenantGuardResult {
  const context = resolveRuntimeRequestContext(request);
  const session = getSessionFromRequest(request);

  const requestedTenant =
    String(request.nextUrl.searchParams.get("tenant") || "").trim() || null;

  if (!context.ok || !context.tenant) {
    throw new Error("No se pudo resolver el tenant de la petición.");
  }

  if (session && normalize(session.slug) !== normalize(context.tenant.slug)) {
    throw new Error("La sesión activa no pertenece al tenant solicitado.");
  }

  return {
    ok: true,
    tenantId: context.tenant.tenantId,
    clientId: context.tenant.clientId,
    slug: context.tenant.slug,
    displayName:
      context.branding?.displayName ||
      context.config?.displayName ||
      context.tenant.displayName,
    source: context.source,
    requestedTenant,
    sessionTenant: session?.slug || null,
  };
}