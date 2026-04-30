import type { NextRequest } from "next/server";
import { getSectorPackByKey, listSectorPacks } from "@/lib/factory/sector-pack-registry";
import type { SectorPackDefinition } from "@/lib/factory/sector-pack-definition";

function normalize(value: string | null | undefined) {
  return String(value || "").trim();
}

export function resolveSectorPackFromRequest(request: NextRequest) {
  const key =
    normalize(request.nextUrl.searchParams.get("sectorPack")) ||
    normalize(request.nextUrl.searchParams.get("pack")) ||
    normalize(request.nextUrl.searchParams.get("businessType"));

  const found = getSectorPackByKey(key);

  return {
    requestedKey: key || null,
    pack: found,
    found: Boolean(found),
  };
}

export function buildSectorPackPreviewFromRequest(request: NextRequest) {
  const resolved = resolveSectorPackFromRequest(request);

  return {
    ok: true,
    requestedKey: resolved.requestedKey,
    resolvedPack: resolved,
    availablePacks: listSectorPacks().map((item) => ({
      key: item.key,
      label: item.label,
      businessType: item.businessType,
      sector: item.sector,
      description: item.description,
    })),
  };
}

/**
 * Produces a preview of how a sector pack merges with a blueprint's module
 * set. The intersection is what the tenant will actually see: modules enabled
 * by the blueprint AND covered by the pack. Anything the pack adds beyond the
 * blueprint is surfaced as `packOnlyModules` so the Factory UI can warn.
 */
export function mergePackWithBlueprint(
  pack: SectorPackDefinition,
  blueprintModuleKeys: string[]
): {
  modules: SectorPackDefinition["modules"];
  fields: SectorPackDefinition["fields"];
  tableColumns: SectorPackDefinition["tableColumns"];
  entities: SectorPackDefinition["entities"];
  labels: Record<string, string>;
  renameMap: Record<string, string>;
  packOnlyModules: string[];
  blueprintOnlyModules: string[];
} {
  const blueprintKeys = new Set(
    blueprintModuleKeys.map((key) => String(key || "").trim()).filter(Boolean)
  );
  const packKeys = new Set(pack.modules.map((m) => m.moduleKey));

  const modules = pack.modules.filter((m) => blueprintKeys.has(m.moduleKey));
  const fields = pack.fields.filter((f) => blueprintKeys.has(f.moduleKey));
  const tableColumns = pack.tableColumns.filter((c) =>
    blueprintKeys.has(c.moduleKey)
  );
  const entities = pack.entities.filter((e) => blueprintKeys.has(e.moduleKey));

  const labels: Record<string, string> = {};
  for (const [key, value] of Object.entries(pack.labels || {})) {
    if (blueprintKeys.has(key)) {
      labels[key] = value;
    }
  }

  const renameMap: Record<string, string> = {};
  for (const [key, value] of Object.entries(pack.renameMap || {})) {
    if (blueprintKeys.has(key)) {
      renameMap[key] = value;
    }
  }

  const packOnlyModules = pack.modules
    .map((m) => m.moduleKey)
    .filter((key) => !blueprintKeys.has(key));

  const blueprintOnlyModules = Array.from(blueprintKeys).filter(
    (key) => !packKeys.has(key)
  );

  return {
    modules,
    fields,
    tableColumns,
    entities,
    labels,
    renameMap,
    packOnlyModules,
    blueprintOnlyModules,
  };
}