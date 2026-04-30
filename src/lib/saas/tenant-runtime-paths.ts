import {
  getRuntimeTenantContext,
  getRuntimeTenantPaths,
  type RuntimeTenantOptions,
  type RuntimeTenantPaths,
} from "@/lib/factory/runtime-tenant-context";

export type { RuntimeTenantOptions, RuntimeTenantPaths };

export { getRuntimeTenantContext, getRuntimeTenantPaths };

export function resolveSaasTenantPaths(
  options?: RuntimeTenantOptions
): RuntimeTenantPaths {
  return getRuntimeTenantPaths(options);
}