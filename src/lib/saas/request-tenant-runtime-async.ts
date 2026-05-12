/**
 * Versión async de resolveRequestTenantRuntime que funciona en serverless.
 *
 * Igual que tenant-resolver-async.ts: la versión sync legacy lee
 * `.prontara/clients/*.json` que no existe en producción Vercel. Aquí
 * usamos la cadena async que consulta Postgres cuando
 * `PRONTARA_PERSISTENCE=postgres`.
 *
 * Solo se usa desde rutas async críticas (login, etc.). El resto del
 * código sigue usando la versión sync hasta que se migre.
 */
import type { NextRequest } from "next/server";
import type { TenantArtifactsConfig } from "@/lib/saas/tenant-artifacts";
import type { TenantBrandingConfig } from "@/lib/saas/tenant-branding";
import type { TenantRuntimeConfig } from "@/lib/saas/tenant-runtime-config";
import type { TenantDefinition } from "@/lib/saas/tenant-definition";
import { resolveTenantBySlugAsync, resolveTenantFromRequestAsync } from "@/lib/saas/tenant-resolver-async";
import {
  resolveRequestTenantRuntime as fsResolveRequestTenantRuntime,
  type RequestTenantRuntime,
} from "@/lib/saas/request-tenant-runtime";
import { getPersistenceBackend } from "@/lib/persistence/db";
import { getSectorPackByKey } from "@/lib/factory/sector-pack-registry";
import { applyCoreModulesToConfig } from "@/lib/factory/core-modules";
import { getCustomFieldsAsync, applyCustomFieldsToConfig } from "@/lib/saas/custom-fields-resolver";
import type { TenantRuntimeConfigBranding } from "@/lib/saas/tenant-runtime-config";

type BrandingShape = Record<string, unknown>;

function getBrandingShape(tenant: TenantDefinition): BrandingShape {
  return tenant.branding && typeof tenant.branding === "object"
    ? (tenant.branding as BrandingShape)
    : {};
}

function getBrandingValue(
  branding: BrandingShape,
  key: string,
): string | undefined {
  const value = branding[key];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function buildShortName(displayName: string): string {
  const parts = String(displayName || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "PR";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function rebuildBrandingForTenant(tenant: TenantDefinition): TenantBrandingConfig {
  const branding = getBrandingShape(tenant);
  const displayName =
    getBrandingValue(branding, "displayName") ||
    getBrandingValue(branding, "companyName") ||
    tenant.displayName;
  const sector = getBrandingValue(branding, "sector") || tenant.sector;
  const businessType =
    getBrandingValue(branding, "businessType") || tenant.businessType;
  const logoUrl = getBrandingValue(branding, "logoUrl");
  const pack = businessType ? getSectorPackByKey(businessType) : null;
  // H12-E: accent del pack como fallback (mismo razonamiento que en rebuildConfigForTenant).
  const accentColor =
    getBrandingValue(branding, "accentColor") ||
    getBrandingValue(branding, "primaryColor") ||
    pack?.branding.accentColor;
  const iconUrl = getBrandingValue(branding, "iconUrl");

  return {
    tenantId: tenant.tenantId,
    clientId: tenant.clientId,
    slug: tenant.slug,
    displayName,
    sector,
    businessType,
    logoUrl,
    accentColor,
    iconUrl,
    appName: displayName,
    shortName: buildShortName(displayName),
    available: {
      logoUrl: Boolean(logoUrl),
      iconUrl: Boolean(iconUrl),
      accentColor: Boolean(accentColor),
    },
    source: { fromTenantBranding: true, fromClientJson: false },
  };
}

function rebuildConfigForTenant(tenant: TenantDefinition): TenantRuntimeConfig {
  const branding = getBrandingShape(tenant);
  const displayName =
    getBrandingValue(branding, "displayName") ||
    getBrandingValue(branding, "companyName") ||
    tenant.displayName;
  const sector = getBrandingValue(branding, "sector") || tenant.sector || "";
  const businessType =
    getBrandingValue(branding, "businessType") || tenant.businessType || "";

  const pack = getSectorPackByKey(businessType);
  // H12-E: el accentColor del PACK del vertical es prioritario sobre el
  // gris por defecto. Antes el item activo del sidebar salía negro
  // (#111827) en tenants sin accentColor propio porque ignorábamos el
  // del pack. Ahora la cadena es: tenant.branding > pack.branding > gris.
  const accentColor =
    getBrandingValue(branding, "accentColor") ||
    getBrandingValue(branding, "primaryColor") ||
    pack?.branding.accentColor ||
    "#1d4ed8";
  const shortName = pack?.branding.shortName || buildShortName(displayName);
  const logoHint = pack?.branding.logoHint || "logo limpio y profesional";
  const tone: TenantRuntimeConfigBranding["tone"] =
    pack?.branding.tone || "professional";

  const brandingBlock: TenantRuntimeConfigBranding = {
    displayName,
    shortName,
    sector,
    businessType,
    sectorLabel: sector,
    businessTypeLabel: businessType,
    tone,
    accentColor,
    logoHint,
  };

  const labels: Record<string, string> = pack ? { ...pack.labels } : {};
  const renameMap: Record<string, string> = pack ? { ...pack.renameMap } : {};
  const modules = pack ? pack.modules.map((item) => ({ ...item })) : [];

  const navigationLabelMap: Record<string, string> = {};
  const emptyStateMap: Record<string, string> = {};
  for (const m of modules) {
    navigationLabelMap[m.moduleKey] = m.navigationLabel;
    emptyStateMap[m.moduleKey] = m.emptyState;
  }

  const fieldsByModule: TenantRuntimeConfig["fieldsByModule"] = {};
  if (pack) {
    for (const field of pack.fields) {
      if (!fieldsByModule[field.moduleKey])
        fieldsByModule[field.moduleKey] = [];
      // SF-16: el frontend (ErpRecordModal, generic-module-runtime-page) lee
      // field.key (UiFieldDefinition), pero el sector pack los define con
      // field.fieldKey (SectorPackField). Sin este alias todos los inputs
      // del modal comparten state (key undefined) y se sobrescriben unos a
      // otros al teclear. Mantenemos fieldKey por compatibilidad sync legacy.
      fieldsByModule[field.moduleKey].push({
        ...field,
        key: field.fieldKey,
      } as typeof field);
    }
  }

  const tableColumnsByModule: TenantRuntimeConfig["tableColumnsByModule"] = {};
  if (pack) {
    for (const column of pack.tableColumns) {
      if (!tableColumnsByModule[column.moduleKey])
        tableColumnsByModule[column.moduleKey] = [];
      tableColumnsByModule[column.moduleKey].push(column);
    }
  }

  const demoDataByModule: TenantRuntimeConfig["demoDataByModule"] = {};
  if (pack) {
    for (const demoEntry of pack.demoData) {
      demoDataByModule[demoEntry.moduleKey] = demoEntry.records;
    }
  }

  // CORE-02: aplicar módulos universales del core (tareas, tickets,
  // compras, productos, reservas, encuestas, etiquetas, plantillas).
  // Mutamos los maps in-place — el pack del vertical tiene prioridad si
  // ya define algo para esos módulos.
  applyCoreModulesToConfig(
    {
      modules,
      fieldsByModule,
      tableColumnsByModule,
      navigationLabelMap,
      emptyStateMap,
    },
    { disabledCoreModules: pack?.disabledCoreModules },
  );
  // moduleKeys se reconstruye porque modules se mutó.
  const moduleKeysFinal = modules.map((m) => m.moduleKey);

  return {
    tenantId: tenant.tenantId,
    clientId: tenant.clientId,
    slug: tenant.slug,
    displayName,
    shortName,
    sector,
    businessType,
    companySize: "",
    branding: brandingBlock,
    labels,
    renameMap,
    navigationLabelMap,
    emptyStateMap,
    modules,
    moduleKeys: moduleKeysFinal,
    fieldsByModule,
    tableColumnsByModule,
    demoDataByModule,
    dashboardPriorities: pack ? pack.dashboardPriorities.slice() : [],
    landingRules: [],
    entities: pack ? pack.entities.slice() : [],
    flows: [],
    texts: {
      welcomeHeadline: pack?.landing.headline || "Bienvenido a " + displayName,
      welcomeSubheadline:
        pack?.landing.subheadline ||
        "Tu espacio de gestión ya está listo para empezar a trabajar.",
      assistantWelcome: pack?.assistantCopy.welcome || "",
      assistantSuggestion: pack?.assistantCopy.suggestion || "",
      navigationLabelMap,
      emptyStateMap,
    },
    landing: pack
      ? {
          headline: pack.landing.headline,
          subheadline: pack.landing.subheadline,
          bullets: pack.landing.bullets.slice(),
          cta: pack.landing.cta,
        }
      : { headline: "", subheadline: "", bullets: [], cta: "" },
    assistantCopy: pack
      ? { welcome: pack.assistantCopy.welcome, suggestion: pack.assistantCopy.suggestion }
      : { welcome: "", suggestion: "" },
    paths: {
      clientFilePath: tenant.paths.clientFilePath,
      runtimeConfigPath: tenant.paths.runtimeConfigPath,
      dataPath: tenant.paths.dataPath,
      artifactsPath: tenant.paths.artifactsPath,
    },
    health: {
      clientFileExists: true,
      dataPathExists: true,
      artifactsPathExists: true,
      runtimeConfigExists: Boolean(tenant.paths.runtimeConfigPath),
    },
    packMeta: {
      packKey: pack?.key || null,
      found: Boolean(pack),
      packOnlyModules: [],
      blueprintOnlyModules: [],
    },
    updatedAt: tenant.updatedAt,
  };
}

function rebuildArtifactsForTenant(tenant: TenantDefinition): TenantArtifactsConfig {
  return {
    tenantId: tenant.tenantId,
    clientId: tenant.clientId,
    slug: tenant.slug,
    artifactsPath: tenant.paths.artifactsPath,
    exists: false,
    count: 0,
    items: [],
  };
}

export async function resolveRequestTenantRuntimeAsync(
  request: NextRequest,
): Promise<RequestTenantRuntime> {
  if (getPersistenceBackend() === "filesystem") {
    return fsResolveRequestTenantRuntime(request);
  }

  const resolution = await resolveTenantFromRequestAsync(request);

  if (!resolution.ok || !resolution.tenant) {
    return {
      ok: false,
      source: resolution.source,
      requestedSlug: resolution.requestedSlug,
      tenant: null,
      branding: null,
      config: null,
      artifacts: null,
    };
  }

  let resolvedTenant = resolution.tenant;
  if (resolution.requestedSlug && resolution.source !== "active-fallback") {
    const bySlug = await resolveTenantBySlugAsync(resolution.requestedSlug);
    if (bySlug) resolvedTenant = bySlug;
  }

  const config = rebuildConfigForTenant(resolvedTenant);

  // DEV-CF: aplicar custom fields del tenant al config. Los custom
  // fields tienen prioridad sobre el pack (override total por
  // moduleKey+fieldKey).
  try {
    const customFields = await getCustomFieldsAsync(resolvedTenant.clientId);
    if (customFields.length > 0) {
      applyCustomFieldsToConfig(config, customFields);
    }
  } catch {
    // Silencioso — si custom fields fallan, seguimos con el config base.
  }

  return {
    ok: true,
    source: resolution.source,
    requestedSlug: resolution.requestedSlug,
    tenant: resolvedTenant,
    branding: rebuildBrandingForTenant(resolvedTenant),
    config,
    artifacts: rebuildArtifactsForTenant(resolvedTenant),
  };
}
