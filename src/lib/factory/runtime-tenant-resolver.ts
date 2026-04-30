import { getActiveClientId } from "@/lib/factory/active-client-registry";
import { resolveTenantContext, type TenantContext } from "@/lib/factory/tenant-context";

export type RuntimeTenantResolutionOptions = {
  clientId?: string | null;
  fallbackToActiveClient?: boolean;
};

function normalizeClientId(value?: string | null): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized === "" ? null : normalized;
}

export function resolveRequestedClientId(
  options?: RuntimeTenantResolutionOptions
): string {
  const requested = normalizeClientId(options?.clientId);
  if (requested) {
    return requested;
  }

  const allowFallback = options?.fallbackToActiveClient !== false;
  if (allowFallback) {
    const active = normalizeClientId(getActiveClientId());
    if (active) {
      return active;
    }
  }

  throw new Error(
    "Unable to resolve tenant clientId. Pass clientId explicitly or define an active client in data/factory/active-client.json."
  );
}

export function resolveRuntimeTenantContext(
  options?: RuntimeTenantResolutionOptions
): TenantContext {
  const clientId = resolveRequestedClientId(options);
  return resolveTenantContext(clientId);
}