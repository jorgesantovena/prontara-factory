import fs from "node:fs";
import path from "node:path";
import {
  getTenantArtifactsRoot,
  getTenantDefinition,
  getTenantDefinitionPath,
  listTenantIds,
} from "@/lib/factory/tenant-context";

export type FactoryDiskHistoryItem = {
  clientId: string;
  slug: string;
  displayName: string;
  path: string;
  updatedAt: string | null;
  hasTenant: boolean;
  hasBranding: boolean;
  hasArtifacts: boolean;
  hasRuntimeConfig: boolean;
  hasEvolution: boolean;
  state: "healthy" | "partial" | "corrupt";
  notes: string[];
};

type TenantDefinitionLike = Record<string, unknown>;

function normalizeText(value: unknown): string {
  return String(value || "")
    .replace(/ÃƒÆ’Ã‚Â¡/g, "á")
    .replace(/ÃƒÆ’Ã‚Â©/g, "é")
    .replace(/ÃƒÆ’Ã‚Â­/g, "í")
    .replace(/ÃƒÆ’Ã‚Â³/g, "ó")
    .replace(/ÃƒÆ’Ã‚Âº/g, "ú")
    .replace(/ÃƒÆ’Ã‚Â±/g, "ñ")
    .replace(/Ãƒâ€šÃ‚Â·/g, "·")
    .trim();
}

function latestMtime(paths: string[]): string | null {
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

  return normalizeText(
    definition.slug ||
      definition.tenantSlug ||
      branding?.slug ||
      clientId
  );
}

function getDisplayNameFromDefinition(definition: TenantDefinitionLike, clientId: string): string {
  const branding =
    definition.branding && typeof definition.branding === "object"
      ? (definition.branding as Record<string, unknown>)
      : null;

  return normalizeText(
    branding?.displayName ||
      branding?.companyName ||
      definition.displayName ||
      definition.name ||
      clientId
  );
}

export function readFactoryDiskHistory(): FactoryDiskHistoryItem[] {
  const root = /*turbopackIgnore: true*/ process.cwd();
  const runtimeConfigRoot = path.join(root, "data", "saas", "tenant-runtime-config");
  const evolutionRoot = path.join(root, "data", "saas", "evolution");

  const clientIds = listTenantIds();

  return clientIds
    .map((clientId) => {
      const definitionPath = getTenantDefinitionPath(clientId);
      const definition = getTenantDefinition(clientId) as TenantDefinitionLike;
      const artifactsRoot = getTenantArtifactsRoot(clientId);

      const runtimeConfigFile = path.join(runtimeConfigRoot, clientId + ".json");
      const evolutionStateFile = path.join(evolutionRoot, clientId, "current-runtime-config.json");
      const evolutionHistoryFile = path.join(evolutionRoot, clientId, "history.json");

      const hasTenant = fs.existsSync(definitionPath);
      const hasBranding = !!(definition.branding && typeof definition.branding === "object");
      const hasArtifacts = fs.existsSync(artifactsRoot);
      const hasRuntimeConfig = fs.existsSync(runtimeConfigFile);
      const hasEvolution = fs.existsSync(evolutionStateFile) || fs.existsSync(evolutionHistoryFile);

      const notes: string[] = [];
      if (!hasTenant) notes.push("Falta definición canónica del tenant");
      if (!hasBranding) notes.push("Falta branding en la definición del tenant");
      if (!hasArtifacts) notes.push("Faltan artifacts");
      if (!hasRuntimeConfig) notes.push("Falta runtime config");
      if (!hasEvolution) notes.push("Sin estado de evolución");

      const displayName = getDisplayNameFromDefinition(definition, clientId);
      const slug = getSlugFromDefinition(definition, clientId);

      const state =
        hasTenant && hasBranding && hasArtifacts && hasRuntimeConfig
          ? "healthy"
          : hasTenant || hasBranding || hasArtifacts
            ? "partial"
            : "corrupt";

      return {
        clientId,
        slug: slug || clientId,
        displayName: displayName || clientId,
        path: definitionPath,
        updatedAt: latestMtime([
          definitionPath,
          runtimeConfigFile,
          evolutionStateFile,
          evolutionHistoryFile,
        ]),
        hasTenant,
        hasBranding,
        hasArtifacts,
        hasRuntimeConfig,
        hasEvolution,
        state,
        notes,
      } satisfies FactoryDiskHistoryItem;
    })
    .sort((a, b) => {
      return (
        new Date(b.updatedAt || 0).getTime() -
        new Date(a.updatedAt || 0).getTime()
      );
    });
}