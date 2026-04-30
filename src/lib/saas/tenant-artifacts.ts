import fs from "node:fs";
import path from "node:path";
import { resolveActiveTenant } from "@/lib/saas/tenant-registry";

export type TenantArtifactItem = {
  fileName: string;
  fullPath: string;
  extension: string;
  size: number;
  updatedAt: string;
  downloadUrl?: string;
  kind: "installer" | "archive" | "other";
};

export type TenantArtifactsConfig = {
  tenantId: string;
  clientId: string;
  slug: string;
  artifactsPath: string;
  exists: boolean;
  count: number;
  items: TenantArtifactItem[];
  latest?: TenantArtifactItem;
};

function detectArtifactKind(fileName: string): "installer" | "archive" | "other" {
  const lower = fileName.toLowerCase();

  if (lower.endsWith(".exe") || lower.endsWith(".msi") || lower.endsWith(".appx")) {
    return "installer";
  }

  if (lower.endsWith(".zip")) {
    return "archive";
  }

  return "other";
}

export function resolveActiveTenantArtifacts(): TenantArtifactsConfig | null {
  const tenant = resolveActiveTenant();
  if (!tenant) {
    return null;
  }

  const artifactsPath = tenant.paths.artifactsPath;
  const exists = fs.existsSync(artifactsPath);

  if (!exists) {
    return {
      tenantId: tenant.tenantId,
      clientId: tenant.clientId,
      slug: tenant.slug,
      artifactsPath,
      exists: false,
      count: 0,
      items: [],
    };
  }

  const items: TenantArtifactItem[] = fs
    .readdirSync(artifactsPath, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const fullPath = path.join(artifactsPath, entry.name);
      const stat = fs.statSync(fullPath);
      const ext = path.extname(entry.name).toLowerCase();
      const kind = detectArtifactKind(entry.name);

      return {
        fileName: entry.name,
        fullPath,
        extension: ext,
        size: stat.size,
        updatedAt: stat.mtime.toISOString(),
        downloadUrl:
          kind === "installer" || kind === "archive"
            ? "/api/factory/download?clientId=" +
              encodeURIComponent(tenant.clientId) +
              "&file=" +
              encodeURIComponent(entry.name)
            : undefined,
        kind,
      };
    })
    .sort((a, b) => {
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

  return {
    tenantId: tenant.tenantId,
    clientId: tenant.clientId,
    slug: tenant.slug,
    artifactsPath,
    exists: true,
    count: items.length,
    items,
    latest: items[0],
  };
}