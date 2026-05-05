/**
 * Versión async de resolveRuntimeRequestContext que funciona en serverless.
 *
 * Igual lógica que la sync pero usando resolveRequestTenantRuntimeAsync
 * (Postgres en producción, filesystem en local).
 */
import type { NextRequest } from "next/server";
import { resolveRequestTenantRuntimeAsync } from "@/lib/saas/request-tenant-runtime-async";
import { getSessionFromRequest } from "@/lib/saas/auth-session";
import type { RuntimeRequestContext } from "@/lib/saas/runtime-request-context";

export async function resolveRuntimeRequestContextAsync(
  request: NextRequest,
): Promise<RuntimeRequestContext> {
  const runtime = await resolveRequestTenantRuntimeAsync(request);
  const session = getSessionFromRequest(request);

  if (session && runtime.tenant) {
    const sessionClientId = String(session.clientId || "").trim().toLowerCase();
    const runtimeClientId = String(runtime.tenant.clientId || "")
      .trim()
      .toLowerCase();
    if (
      sessionClientId &&
      runtimeClientId &&
      sessionClientId !== runtimeClientId
    ) {
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
    clientId:
      runtime.tenant?.clientId ||
      runtime.config?.clientId ||
      session?.clientId ||
      null,
  };
}
