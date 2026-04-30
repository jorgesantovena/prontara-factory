import type {
  RuntimeComposableBlueprint,
  RuntimeComposableConfig,
  BlueprintFieldConfig,
} from "@/lib/factory/blueprint-definition";
import { getSectorPackByKey } from "@/lib/factory/sector-pack-registry";

function groupFieldsByModule(fields: BlueprintFieldConfig[]) {
  const grouped: Record<string, BlueprintFieldConfig[]> = {};

  for (const field of fields) {
    if (!grouped[field.moduleKey]) {
      grouped[field.moduleKey] = [];
    }
    grouped[field.moduleKey].push(field);
  }

  return grouped;
}

export function composeRuntimeConfigFromBlueprint(
  blueprint: RuntimeComposableBlueprint
): RuntimeComposableConfig {
  const fieldsByModule = groupFieldsByModule(blueprint.fields);
  const enabledModuleKeys = blueprint.modules
    .filter((item) => item.enabled)
    .map((item) => item.moduleKey);

  const demoDataByModule: Record<string, Record<string, string>[]> = {};
  for (const item of blueprint.demoData) {
    demoDataByModule[item.moduleKey] = item.records;
  }

  const sectorPack = getSectorPackByKey(blueprint.businessType);

  return {
    displayName: blueprint.branding.displayName,
    shortName: blueprint.branding.shortName,
    sector: blueprint.sector,
    businessType: blueprint.businessType,
    companySize: blueprint.companySize,
    labels: blueprint.labels,
    navigationLabelMap: blueprint.texts.navigationLabelMap,
    emptyStateMap: blueprint.texts.emptyStateMap,
    modules: blueprint.modules,
    enabledModuleKeys,
    fieldsByModule,
    dashboardPriorities: blueprint.dashboardPriorities.sort((a, b) => a.order - b.order),
    landingRules: blueprint.landingRules,
    branding: blueprint.branding,
    texts: blueprint.texts,
    demoDataByModule,
    flows: blueprint.flows,
    entities: blueprint.entities,
    renameMap: sectorPack?.renameMap || {},
    tableColumnsByModule: sectorPack
      ? sectorPack.tableColumns.reduce((acc, column) => {
          if (!acc[column.moduleKey]) {
            acc[column.moduleKey] = [];
          }
          acc[column.moduleKey].push(column);
          return acc;
        }, {} as Record<string, Array<{ moduleKey: string; fieldKey: string; label: string; isPrimary?: boolean }>>)
      : {},
    landing: sectorPack?.landing || null,
    assistantCopy: sectorPack?.assistantCopy || null,
  } as RuntimeComposableConfig & {
    renameMap: Record<string, string>;
    tableColumnsByModule: Record<string, Array<{ moduleKey: string; fieldKey: string; label: string; isPrimary?: boolean }>>;
    landing: {
      headline: string;
      subheadline: string;
      bullets: string[];
      cta: string;
    } | null;
    assistantCopy: {
      welcome: string;
      suggestion: string;
    } | null;
  };
}