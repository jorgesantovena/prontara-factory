import fs from "node:fs";
import path from "node:path";
import type { NextRequest } from "next/server";
import { resolveRuntimeRequestContext } from "@/lib/saas/runtime-request-context";
import { getSectorPackByKey } from "@/lib/factory/sector-pack-registry";
import {
  mergePackWithBlueprint,
} from "@/lib/factory/sector-pack-resolver";
import type {
  SectorPackDefinition,
  SectorPackEntity,
  SectorPackField,
  SectorPackTableColumn,
} from "@/lib/factory/sector-pack-definition";

/**
 * TenantRuntimeConfig is the single runtime-facing shape consumed by UI
 * pages, commercial composers, evolution engine, the ERP module UI resolver
 * and the sector-preview API. It is a superset of `EvolutionRuntimeSnapshot`
 * so that the snapshot can be derived by spreading the config.
 *
 * The type has three layers:
 *   1. Tenant identity + paths + health (always populated).
 *   2. Sector pack layer (labels, renameMap, branding extensions,
 *      module descriptors, fieldsByModule, tableColumnsByModule,
 *      dashboardPriorities, landing, assistantCopy, etc). Populated from
 *      the tenant's sector pack (resolved by `businessType`), merged with
 *      the blueprint's enabled modules via `mergePackWithBlueprint`.
 *      When no pack resolves, every field is filled with empty but
 *      well-typed defaults so consumers never need null-guards.
 *   3. Commercial wrapper (optional — added by the delivery composer).
 */

export type TenantRuntimeConfigBranding = {
  displayName: string;
  shortName: string;
  sector: string;
  businessType: string;
  sectorLabel: string;
  businessTypeLabel: string;
  tone: "simple" | "professional" | "sectorial";
  accentColor: string;
  logoHint: string;
};

export type TenantRuntimeConfigWrapper = {
  appName: string;
  installableName: string;
  executableName: string;
  bundleId: string;
  desktopCaption: string;
  iconHint: string;
  accentColor: string;
  windowTitle: string;
  deliveryMode: "web-first" | "desktop-wrapper";
};

export type TenantRuntimeConfigModule = {
  moduleKey: string;
  enabled: boolean;
  label: string;
  navigationLabel: string;
  emptyState: string;
};

export type TenantRuntimeConfigTexts = {
  welcomeHeadline: string;
  welcomeSubheadline: string;
  assistantWelcome: string;
  assistantSuggestion: string;
  navigationLabelMap: Record<string, string>;
  emptyStateMap: Record<string, string>;
};

export type TenantRuntimeConfigLanding = {
  headline: string;
  subheadline: string;
  bullets: string[];
  cta: string;
};

export type TenantRuntimeConfigAssistantCopy = {
  welcome: string;
  suggestion: string;
};

export type TenantRuntimeConfigFlow = {
  key: string;
  label: string;
  description: string;
  steps: string[];
  relatedEntities: string[];
};

export type TenantRuntimeConfigDashboardPriority = {
  key: string;
  label: string;
  description: string;
  order: number;
};

export type TenantRuntimeConfigLandingRule = {
  key: string;
  label: string;
  description: string;
  instruction: string;
};

export type TenantRuntimeConfigPackMeta = {
  packKey: string | null;
  found: boolean;
  packOnlyModules: string[];
  blueprintOnlyModules: string[];
};

export type TenantRuntimeConfig = {
  // --- identity ---
  tenantId: string;
  clientId: string;
  slug: string;
  displayName: string;
  shortName: string;
  sector: string;
  businessType: string;
  companySize: string;

  // --- branding + sector pack layer (always populated with defaults) ---
  branding: TenantRuntimeConfigBranding;
  labels: Record<string, string>;
  renameMap: Record<string, string>;
  navigationLabelMap: Record<string, string>;
  emptyStateMap: Record<string, string>;

  modules: TenantRuntimeConfigModule[];
  moduleKeys: string[];

  fieldsByModule: Record<string, SectorPackField[]>;
  tableColumnsByModule: Record<string, SectorPackTableColumn[]>;
  demoDataByModule: Record<string, Record<string, string>[]>;

  dashboardPriorities: TenantRuntimeConfigDashboardPriority[];
  landingRules: TenantRuntimeConfigLandingRule[];
  entities: SectorPackEntity[];
  flows: TenantRuntimeConfigFlow[];

  texts: TenantRuntimeConfigTexts;
  landing: TenantRuntimeConfigLanding;
  assistantCopy: TenantRuntimeConfigAssistantCopy;

  // --- commercial wrapper (optional, delivery composer populates) ---
  wrapper?: TenantRuntimeConfigWrapper;

  // --- paths + health ---
  paths: {
    clientFilePath: string;
    runtimeConfigPath: string;
    dataPath: string;
    artifactsPath: string;
  };
  health: {
    clientFileExists: boolean;
    dataPathExists: boolean;
    artifactsPathExists: boolean;
    runtimeConfigExists: boolean;
  };

  // --- pack resolution metadata ---
  packMeta: TenantRuntimeConfigPackMeta;

  updatedAt?: string;
};

export type TenantRuntimeConfigResult = {
  ok: boolean;
  config: TenantRuntimeConfig | null;
  source: string;
  requestedSlug: string | null;
};

function readJsonSafe<T>(filePath: string): T | null {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function getRuntimeConfigFilePath(clientId: string): string {
  return path.join(
    /*turbopackIgnore: true*/ process.cwd(),
    "data",
    "saas",
    "tenant-runtime-config",
    clientId + ".json"
  );
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asStringRecord(value: unknown): Record<string, string> {
  const record = asRecord(value);
  const result: Record<string, string> = {};
  for (const [key, raw] of Object.entries(record)) {
    if (typeof raw === "string") {
      result[key] = raw;
    }
  }
  return result;
}

function extractModuleKeysFromDisk(value: unknown): {
  moduleKeys: string[];
  moduleObjects: TenantRuntimeConfigModule[];
} {
  if (!Array.isArray(value)) {
    return { moduleKeys: [], moduleObjects: [] };
  }

  const moduleKeys: string[] = [];
  const moduleObjects: TenantRuntimeConfigModule[] = [];

  for (const item of value) {
    if (typeof item === "string") {
      moduleKeys.push(item);
      continue;
    }
    if (item && typeof item === "object") {
      const record = item as Record<string, unknown>;
      const moduleKey = asString(record.moduleKey || record.key);
      if (!moduleKey) continue;
      moduleKeys.push(moduleKey);
      moduleObjects.push({
        moduleKey,
        enabled: record.enabled !== false,
        label: asString(record.label, moduleKey),
        navigationLabel: asString(record.navigationLabel, asString(record.label, moduleKey)),
        emptyState: asString(
          record.emptyState,
          "Todavía no hay datos en " + moduleKey + "."
        ),
      });
    }
  }

  return { moduleKeys, moduleObjects };
}

/**
 * Build a sector-pack layer from a resolved SectorPackDefinition, optionally
 * intersected with blueprint module keys. When no pack is found, returns a
 * fully-typed empty layer so every consumer can destructure safely without
 * null-guards.
 */
function buildPackLayer(
  pack: SectorPackDefinition | null,
  blueprintModuleKeys: string[]
): {
  modules: TenantRuntimeConfigModule[];
  moduleKeys: string[];
  labels: Record<string, string>;
  renameMap: Record<string, string>;
  navigationLabelMap: Record<string, string>;
  emptyStateMap: Record<string, string>;
  fieldsByModule: Record<string, SectorPackField[]>;
  tableColumnsByModule: Record<string, SectorPackTableColumn[]>;
  demoDataByModule: Record<string, Record<string, string>[]>;
  dashboardPriorities: TenantRuntimeConfigDashboardPriority[];
  entities: SectorPackEntity[];
  landing: TenantRuntimeConfigLanding;
  assistantCopy: TenantRuntimeConfigAssistantCopy;
  packMeta: TenantRuntimeConfigPackMeta;
  packBranding: SectorPackDefinition["branding"] | null;
} {
  if (!pack) {
    return {
      modules: [],
      moduleKeys: blueprintModuleKeys.slice(),
      labels: {},
      renameMap: {},
      navigationLabelMap: {},
      emptyStateMap: {},
      fieldsByModule: {},
      tableColumnsByModule: {},
      demoDataByModule: {},
      dashboardPriorities: [],
      entities: [],
      landing: { headline: "", subheadline: "", bullets: [], cta: "" },
      assistantCopy: { welcome: "", suggestion: "" },
      packMeta: {
        packKey: null,
        found: false,
        packOnlyModules: [],
        blueprintOnlyModules: blueprintModuleKeys.slice(),
      },
      packBranding: null,
    };
  }

  const merged = mergePackWithBlueprint(pack, blueprintModuleKeys);

  const navigationLabelMap: Record<string, string> = {};
  const emptyStateMap: Record<string, string> = {};
  for (const moduleDescriptor of merged.modules) {
    navigationLabelMap[moduleDescriptor.moduleKey] =
      moduleDescriptor.navigationLabel;
    emptyStateMap[moduleDescriptor.moduleKey] = moduleDescriptor.emptyState;
  }

  const fieldsByModule: Record<string, SectorPackField[]> = {};
  for (const field of merged.fields) {
    if (!fieldsByModule[field.moduleKey]) {
      fieldsByModule[field.moduleKey] = [];
    }
    fieldsByModule[field.moduleKey].push(field);
  }

  const tableColumnsByModule: Record<string, SectorPackTableColumn[]> = {};
  for (const column of merged.tableColumns) {
    if (!tableColumnsByModule[column.moduleKey]) {
      tableColumnsByModule[column.moduleKey] = [];
    }
    tableColumnsByModule[column.moduleKey].push(column);
  }

  const demoDataByModule: Record<string, Record<string, string>[]> = {};
  for (const demoEntry of pack.demoData) {
    if (blueprintModuleKeys.length === 0 ||
        blueprintModuleKeys.includes(demoEntry.moduleKey)) {
      demoDataByModule[demoEntry.moduleKey] = demoEntry.records;
    }
  }

  const moduleKeys = merged.modules.map((item) => item.moduleKey);

  return {
    modules: merged.modules.map((item) => ({ ...item })),
    moduleKeys,
    labels: { ...merged.labels },
    renameMap: { ...merged.renameMap },
    navigationLabelMap,
    emptyStateMap,
    fieldsByModule,
    tableColumnsByModule,
    demoDataByModule,
    dashboardPriorities: pack.dashboardPriorities.slice(),
    entities: merged.entities.slice(),
    landing: {
      headline: pack.landing.headline,
      subheadline: pack.landing.subheadline,
      bullets: pack.landing.bullets.slice(),
      cta: pack.landing.cta,
    },
    assistantCopy: {
      welcome: pack.assistantCopy.welcome,
      suggestion: pack.assistantCopy.suggestion,
    },
    packMeta: {
      packKey: pack.key,
      found: true,
      packOnlyModules: merged.packOnlyModules,
      blueprintOnlyModules: merged.blueprintOnlyModules,
    },
    packBranding: pack.branding,
  };
}

export function resolveActiveTenantRuntimeConfig(): TenantRuntimeConfig | null {
  return null;
}

export function getTenantRuntimeConfigFromRequest(
  request: NextRequest
): TenantRuntimeConfigResult {
  const context = resolveRuntimeRequestContext(request);

  if (!context.ok || !context.tenant) {
    return {
      ok: false,
      config: null,
      source: context.source,
      requestedSlug: context.requestedSlug,
    };
  }

  const tenant = context.tenant;
  const runtimeConfigPath = getRuntimeConfigFilePath(tenant.clientId);
  const diskConfig = readJsonSafe<Record<string, unknown>>(runtimeConfigPath);

  const { moduleKeys: diskModuleKeys, moduleObjects: diskModuleObjects } =
    extractModuleKeysFromDisk(diskConfig?.modules);

  const businessType =
    asString(diskConfig?.businessType, tenant.businessType || "");
  const sector = asString(diskConfig?.sector, tenant.sector || "");
  const companySize = asString(diskConfig?.companySize, "");

  const pack = getSectorPackByKey(businessType);
  const packLayer = buildPackLayer(pack, diskModuleKeys);

  const displayName =
    context.branding?.displayName ||
    asString(diskConfig?.displayName, tenant.displayName);

  const packBranding = packLayer.packBranding;
  const shortName =
    asString(diskConfig?.shortName) ||
    packBranding?.shortName ||
    displayName.slice(0, 2).toUpperCase();
  const accentColor =
    context.branding?.accentColor ||
    asString((asRecord(diskConfig?.branding)).accentColor) ||
    packBranding?.accentColor ||
    "#111827";
  const logoHint =
    asString((asRecord(diskConfig?.branding)).logoHint) ||
    packBranding?.logoHint ||
    "logo limpio y profesional";
  const tone: TenantRuntimeConfigBranding["tone"] = (() => {
    const diskTone = asString((asRecord(diskConfig?.branding)).tone);
    if (diskTone === "simple" || diskTone === "professional" || diskTone === "sectorial") {
      return diskTone;
    }
    if (packBranding?.tone) return packBranding.tone;
    return "professional";
  })();

  const branding: TenantRuntimeConfigBranding = {
    displayName,
    shortName,
    sector,
    businessType,
    sectorLabel:
      asString((asRecord(diskConfig?.branding)).sectorLabel) ||
      sector ||
      "",
    businessTypeLabel:
      asString((asRecord(diskConfig?.branding)).businessTypeLabel) ||
      businessType ||
      "",
    tone,
    accentColor,
    logoHint,
  };

  // Favour pack-derived descriptors; fall back to whatever was on disk.
  const modules =
    packLayer.modules.length > 0 ? packLayer.modules : diskModuleObjects;
  const moduleKeys =
    packLayer.moduleKeys.length > 0
      ? packLayer.moduleKeys
      : diskModuleKeys.length > 0
      ? diskModuleKeys
      : diskModuleObjects.map((item) => item.moduleKey);

  const diskTextsRecord = asRecord(diskConfig?.texts);
  const texts: TenantRuntimeConfigTexts = {
    welcomeHeadline:
      asString(diskTextsRecord.welcomeHeadline) ||
      packLayer.landing.headline,
    welcomeSubheadline:
      asString(diskTextsRecord.welcomeSubheadline) ||
      packLayer.landing.subheadline,
    assistantWelcome:
      asString(diskTextsRecord.assistantWelcome) ||
      packLayer.assistantCopy.welcome,
    assistantSuggestion:
      asString(diskTextsRecord.assistantSuggestion) ||
      packLayer.assistantCopy.suggestion,
    navigationLabelMap: {
      ...packLayer.navigationLabelMap,
      ...asStringRecord(diskTextsRecord.navigationLabelMap),
    },
    emptyStateMap: {
      ...packLayer.emptyStateMap,
      ...asStringRecord(diskTextsRecord.emptyStateMap),
    },
  };

  // Fallback dashboard priorities / landingRules from disk if pack empty.
  const diskDashboard = Array.isArray(diskConfig?.dashboardPriorities)
    ? (diskConfig.dashboardPriorities as unknown[])
        .map((item) => {
          const record = asRecord(item);
          if (!record.key) return null;
          return {
            key: asString(record.key),
            label: asString(record.label, asString(record.key)),
            description: asString(record.description, ""),
            order: typeof record.order === "number" ? record.order : 0,
          } as TenantRuntimeConfigDashboardPriority;
        })
        .filter(Boolean) as TenantRuntimeConfigDashboardPriority[]
    : [];
  const dashboardPriorities =
    packLayer.dashboardPriorities.length > 0
      ? packLayer.dashboardPriorities
      : diskDashboard;

  const diskLandingRules = Array.isArray(diskConfig?.landingRules)
    ? (diskConfig.landingRules as unknown[])
        .map((item) => {
          const record = asRecord(item);
          if (!record.key) return null;
          return {
            key: asString(record.key),
            label: asString(record.label, ""),
            description: asString(record.description, ""),
            instruction: asString(record.instruction, ""),
          } as TenantRuntimeConfigLandingRule;
        })
        .filter(Boolean) as TenantRuntimeConfigLandingRule[]
    : [];

  const diskFlows = Array.isArray(diskConfig?.flows)
    ? (diskConfig.flows as unknown[])
        .map((item) => {
          const record = asRecord(item);
          if (!record.key) return null;
          return {
            key: asString(record.key),
            label: asString(record.label, asString(record.key)),
            description: asString(record.description, ""),
            steps: Array.isArray(record.steps)
              ? (record.steps as unknown[]).map((s) => String(s))
              : [],
            relatedEntities: Array.isArray(record.relatedEntities)
              ? (record.relatedEntities as unknown[]).map((s) => String(s))
              : [],
          } as TenantRuntimeConfigFlow;
        })
        .filter(Boolean) as TenantRuntimeConfigFlow[]
    : [];

  const config: TenantRuntimeConfig = {
    tenantId: tenant.tenantId,
    clientId: tenant.clientId,
    slug: tenant.slug,
    displayName,
    shortName,
    sector,
    businessType,
    companySize,

    branding,
    labels: packLayer.labels,
    renameMap: packLayer.renameMap,
    navigationLabelMap: texts.navigationLabelMap,
    emptyStateMap: texts.emptyStateMap,

    modules,
    moduleKeys,

    fieldsByModule: packLayer.fieldsByModule,
    tableColumnsByModule: packLayer.tableColumnsByModule,
    demoDataByModule: packLayer.demoDataByModule,

    dashboardPriorities,
    landingRules: diskLandingRules,
    entities: packLayer.entities,
    flows: diskFlows,

    texts,
    landing: packLayer.landing,
    assistantCopy: packLayer.assistantCopy,

    paths: {
      clientFilePath: tenant.paths.clientFilePath,
      runtimeConfigPath,
      dataPath: tenant.paths.dataPath,
      artifactsPath: tenant.paths.artifactsPath,
    },
    health: {
      clientFileExists: fs.existsSync(tenant.paths.clientFilePath),
      dataPathExists: fs.existsSync(tenant.paths.dataPath),
      artifactsPathExists: fs.existsSync(tenant.paths.artifactsPath),
      runtimeConfigExists: fs.existsSync(runtimeConfigPath),
    },
    packMeta: packLayer.packMeta,
    updatedAt:
      typeof diskConfig?.updatedAt === "string"
        ? String(diskConfig.updatedAt)
        : tenant.updatedAt,
  };

  return {
    ok: true,
    config,
    source: context.source,
    requestedSlug: context.requestedSlug,
  };
}
