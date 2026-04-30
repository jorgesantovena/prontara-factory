import { resolveRuntimeTenantContext } from "@/lib/factory/runtime-tenant-resolver";
import type { TenantContext } from "@/lib/factory/tenant-context";

export type RuntimeTenantOptions = {
  clientId?: string | null;
  fallbackToActiveClient?: boolean;
};

export type RuntimeTenantPaths = {
  clientId: string;
  definitionPath: string;
  dataRoot: string;
  artifactsRoot: string;
  exportsRoot: string;
  deploymentsRoot: string;
};

export function getRuntimeTenantContext(
  options?: RuntimeTenantOptions
): TenantContext {
  return resolveRuntimeTenantContext(options);
}

export function getRuntimeTenantPaths(
  options?: RuntimeTenantOptions
): RuntimeTenantPaths {
  const context = resolveRuntimeTenantContext(options);

  return {
    clientId: context.clientId,
    definitionPath: context.definitionPath,
    dataRoot: context.dataRoot,
    artifactsRoot: context.artifactsRoot,
    exportsRoot: context.exportsRoot,
    deploymentsRoot: context.deploymentsRoot,
  };
}