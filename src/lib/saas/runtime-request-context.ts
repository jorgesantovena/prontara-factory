import type { NextRequest } from "next/server";
import type { TenantDefinition } from "@/lib/saas/tenant-definition";
import type { TenantBrandingConfig } from "@/lib/saas/tenant-branding";
import type { TenantArtifactsConfig } from "@/lib/saas/tenant-artifacts";
import type { TenantRuntimeConfig } from "@/lib/saas/tenant-runtime-config";
import { resolveRequestTenantRuntime } from "@/lib/saas/request-tenant-runtime";
import { getSessionFromRequest } from "@/lib/saas/auth-session";

export type RuntimeRequestContext = {
  ok: boolean;
  source: "query" | "header" | "active-fallback" | "not-found" | "session";
  requestedSlug: string | null;
  tenant: TenantDefinition | null;
  branding: TenantBrandingConfig | null;
  config: TenantRuntimeConfig | null;
  artifacts: TenantArtifactsConfig | null;
  clientId: string | null;
  sessionMismatch?: boolean;
};

export function resolveRuntimeRequestContext(
  request: NextRequest
): RuntimeRequestContext {
  const runtime = resolveRequestTenantRuntime(request);
  const session = getSessionFromRequest(request);

  // If there is a session, the session is the trusted source of truth.
  // Any tenant/client resolved from query or header MUST match the session.
  if (session && runtime.tenant) {
    const sessionClientId = String(session.clientId || "").trim().toLowerCase();
    const runtimeClientId = String(runtime.tenant.clientId || "").trim().toLowerCase();
    if (sessionClientId && runtimeClientId && sessionClientId !== runtimeClientId) {
      return {
        ok: false,
        source: "session",
        requestedSlug: runtime.requestedSlug,
        tenant: null,
        branding: null,
        config: null,
        artifacts: null,
        clientId: null,
        sessionMismatch: true,
      };
    }
  }

  return {
    ok: runtime.ok,
    source: runtime.source,
    requestedSlug: runtime.requestedSlug,
    tenant: runtime.tenant,
    branding: runtime.branding,
    config: runtime.config,
    artifacts: runtime.artifacts,
    clientId: runtime.tenant?.clientId || runtime.config?.clientId || session?.clientId || null,
  };
}