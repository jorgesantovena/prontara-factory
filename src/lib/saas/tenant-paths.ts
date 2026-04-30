import path from "node:path";
import {
  resolveSaasTenantPaths,
  type RuntimeTenantOptions,
} from "@/lib/saas/tenant-runtime-paths";

export type TenantBasePaths = {
  root: string;
  activeClientFile: string;
  clientsDir: string;
  dataDir: string;
  artifactsDir: string;
  runtimeConfigPath: string;
};

export function getTenantBasePaths(): TenantBasePaths {
  const root = /*turbopackIgnore: true*/ process.cwd();

  return {
    root,
    activeClientFile: path.join(root, "data", "factory", "active-client.json"),
    clientsDir: path.join(root, ".prontara", "clients"),
    dataDir: path.join(root, ".prontara", "data"),
    artifactsDir: path.join(root, ".prontara", "artifacts"),
    runtimeConfigPath: path.join(root, "src", "lib", "prontara.generated.ts"),
  };
}

export function getTenantClientFilePath(
  clientId: string,
  options?: RuntimeTenantOptions
): string {
  return resolveSaasTenantPaths({
    ...options,
    clientId,
  }).definitionPath;
}

export function getTenantDataPath(
  clientId: string,
  options?: RuntimeTenantOptions
): string {
  return resolveSaasTenantPaths({
    ...options,
    clientId,
  }).dataRoot;
}

export function getTenantArtifactsPath(
  clientId: string,
  options?: RuntimeTenantOptions
): string {
  return resolveSaasTenantPaths({
    ...options,
    clientId,
  }).artifactsRoot;
}