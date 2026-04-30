import fs from "node:fs";
import path from "node:path";
import {
  getTenantArtifactsRoot,
  getTenantDefinition,
  getTenantDefinitionPath,
  listTenantIds,
} from "@/lib/factory/tenant-context";

export type TenantClientIndexItem = {
  tenantId: string;
  clientId: string;
  slug: string;
  displayName: string;
  hasRuntimeConfig: boolean;
  hasBranding: boolean;
  hasArtifacts: boolean;
  hasEvolution: boolean;
  lastUpdatedAt: string | null;
};

type TenantDefinitionLike = Record<string, unknown>;

function pathExists(filePath: string) {
  return fs.existsSync(filePath);
}

function normalizeDisplayName(value: string, fallback: string) {
  const clean = String(value || "").trim();
  return clean || fallback;
}

function getLatestMtime(paths: string[]): string | null {
  const mtimes = paths
    .filter((item) => fs.existsSync(item))
    .map((item) => fs.statSync(item).mtime.toISOString())
    .sort()
    .reverse();

  return mtimes[0] || null;
}

function getSlugFromDefinition(definition: TenantDefinitionLike, clientId: string): string {
  const branding =
    definition.branding && typeof definition.branding === "object"
      ? (definition.branding as Record<string, unknown>)
      : null;

  return (
    String(
      definition.slug ||
        definition.tenantSlug ||
        branding?.slug ||
        clientId
    ).trim() || clientId
  );
}

function getDisplayNameFromDefinition(definition: TenantDefinitionLike, clientId: string): string {
  const branding =
    definition.branding && typeof definition.branding === "object"
      ? (definition.branding as Record<string, unknown>)
      : null;

  return normalizeDisplayName(
    String(
      branding?.displayName ||
        branding?.companyName ||
        definition.displayName ||
        definition.name ||
        clientId
    ),
    clientId
  );
}

export function listTenantClientsIndex(): TenantClientIndexItem[] {
  const root = /*turbopackIgnore: true*/ process.cwd();
  const runtimeConfigRoot = path.join(root, "data", "saas", "tenant-runtime-config");
  const evolutionRoot = path.join(root, "data", "saas", "evolution");

  const clientIds = listTenantIds();

  // Tolerante a ficheros corruptos: si un .json en .prontara/clients/
  // no es JSON valido (p.ej. quedo a medias o un script escribio TSX
  // por error), lo saltamos con un warning en vez de tirar abajo todo
  // el dashboard.
  const items: TenantClientIndexItem[] = [];
  for (const clientId of clientIds) {
    try {
      const definitionPath = getTenantDefinitionPath(clientId);
      const definition = getTenantDefinition(clientId) as TenantDefinitionLike;
      const artifactsRoot = getTenantArtifactsRoot(clientId);

      const runtimeConfigFile = path.join(runtimeConfigRoot, clientId + ".json");
      const evolutionStateFile = path.join(evolutionRoot, clientId, "current-runtime-config.json");
      const evolutionHistoryFile = path.join(evolutionRoot, clientId, "history.json");

      const slug = getSlugFromDefinition(definition, clientId);
      const displayName = getDisplayNameFromDefinition(definition, clientId);

      items.push({
        tenantId: String(definition.tenantId || definition.clientId || slug),
        clientId,
        slug,
        displayName,
        hasRuntimeConfig: pathExists(runtimeConfigFile),
        hasBranding: !!(definition.branding && typeof definition.branding === "object"),
        hasArtifacts: pathExists(artifactsRoot) && fs.readdirSync(artifactsRoot).length > 0,
        hasEvolution: pathExists(evolutionStateFile) || pathExists(evolutionHistoryFile),
        lastUpdatedAt: getLatestMtime([
          definitionPath,
          runtimeConfigFile,
          evolutionStateFile,
          evolutionHistoryFile,
        ]),
      });
    } catch (err) {
      console.warn(
        "[tenant-clients-index] Saltando tenant corrupto '" +
          clientId +
          "': " +
          (err instanceof Error ? err.message : String(err)),
      );
    }
  }

  return items.sort((a, b) => {
    return (
      new Date(b.lastUpdatedAt || 0).getTime() -
      new Date(a.lastUpdatedAt || 0).getTime()
    );
  });
}