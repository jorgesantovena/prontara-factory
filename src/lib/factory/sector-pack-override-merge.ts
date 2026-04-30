/**
 * Aplica un SectorPackOverride sobre un SectorPackDefinition base y devuelve
 * el resultado mergeado. Las reglas de merge son conservadoras: los campos
 * que el override no toque se mantienen del base.
 *
 * Importante: devuelve una copia nueva, no muta el base. Esto importa
 * porque el base vive como constante en memoria del módulo y no debe
 * contaminarse entre lecturas.
 */
import type {
  SectorPackDefinition,
  SectorPackEntity,
  SectorPackField,
} from "@/lib/factory/sector-pack-definition";
import type {
  SectorPackOverride,
  VerticalDashboardPriorityOverride,
  VerticalModuleOverride,
} from "@/lib/factory/sector-pack-override-types";

export function applyVerticalOverride(
  base: SectorPackDefinition,
  override: SectorPackOverride | null,
): SectorPackDefinition {
  if (!override) {
    // Devolvemos una shallow copy para consistencia (consumers no deberían
    // mutarlo, pero por si acaso).
    return { ...base };
  }

  const merged: SectorPackDefinition = {
    ...base,
    label: override.label ?? base.label,
    description: override.description ?? base.description,
    branding: mergeBranding(base.branding, override),
    labels: mergeDictionary(base.labels, override.labels),
    renameMap: mergeDictionary(base.renameMap, override.renameMap),
    modules: mergeModules(base.modules, override.modules, Boolean(override.modulesFullReplace)),
    dashboardPriorities: mergeDashboardPriorities(
      base.dashboardPriorities,
      override.dashboardPriorities,
    ),
    entities: mergeEntities(base.entities, override.entities),
    fields: mergeFields(base.fields, override.fields),
    landing: mergeLanding(base.landing, override),
    assistantCopy: mergeAssistantCopy(base.assistantCopy, override),
  };

  return merged;
}

function mergeEntities(
  base: SectorPackEntity[],
  overrides: SectorPackEntity[] | undefined,
): SectorPackEntity[] {
  if (!overrides) return base.map((e) => ({ ...e }));
  // Full replacement cuando hay override.
  return overrides.map((e) => ({
    ...e,
    primaryFields: Array.isArray(e.primaryFields) ? e.primaryFields.slice() : [],
    relatedTo: Array.isArray(e.relatedTo) ? e.relatedTo.slice() : undefined,
  }));
}

function mergeFields(
  base: SectorPackField[],
  overrides: SectorPackField[] | undefined,
): SectorPackField[] {
  if (!overrides) return base.map((f) => ({ ...f }));
  return overrides.map((f) => ({ ...f }));
}

function mergeBranding(
  base: SectorPackDefinition["branding"],
  override: SectorPackOverride,
): SectorPackDefinition["branding"] {
  const b = override.branding;
  if (!b) return { ...base };
  return {
    displayName: b.displayName ?? base.displayName,
    shortName: b.shortName ?? base.shortName,
    accentColor: b.accentColor ?? base.accentColor,
    logoHint: b.logoHint ?? base.logoHint,
    tone: b.tone ?? base.tone,
  };
}

function mergeLanding(
  base: SectorPackDefinition["landing"],
  override: SectorPackOverride,
): SectorPackDefinition["landing"] {
  const l = override.landing;
  if (!l) return { ...base };
  return {
    headline: l.headline ?? base.headline,
    subheadline: l.subheadline ?? base.subheadline,
    bullets: Array.isArray(l.bullets) ? l.bullets.slice() : base.bullets.slice(),
    cta: l.cta ?? base.cta,
  };
}

function mergeAssistantCopy(
  base: SectorPackDefinition["assistantCopy"],
  override: SectorPackOverride,
): SectorPackDefinition["assistantCopy"] {
  const a = override.assistantCopy;
  if (!a) return { ...base };
  return {
    welcome: a.welcome ?? base.welcome,
    suggestion: a.suggestion ?? base.suggestion,
  };
}

function mergeDictionary(
  base: Record<string, string>,
  override: Record<string, string> | undefined,
): Record<string, string> {
  if (!override) return { ...base };
  return { ...base, ...override };
}

function mergeModules(
  base: SectorPackDefinition["modules"],
  overrides: VerticalModuleOverride[] | undefined,
  fullReplace: boolean,
): SectorPackDefinition["modules"] {
  if (!overrides || overrides.length === 0) {
    return base.map((m) => ({ ...m }));
  }

  if (fullReplace) {
    // Milestone 2: la lista override es la verdad.
    const withOrder = overrides.map((ov, i) => ({
      moduleKey: String(ov.moduleKey || "").trim(),
      enabled: ov.enabled ?? true,
      label: ov.label ?? ov.moduleKey ?? "",
      navigationLabel: ov.navigationLabel ?? ov.label ?? ov.moduleKey ?? "",
      emptyState: ov.emptyState ?? "",
      _order: typeof ov.order === "number" ? ov.order : i,
    }));
    withOrder.sort((a, b) => a._order - b._order);
    return withOrder.map((m) => ({
      moduleKey: m.moduleKey,
      enabled: m.enabled,
      label: m.label,
      navigationLabel: m.navigationLabel,
      emptyState: m.emptyState,
    }));
  }

  // Milestone 1: patch por moduleKey preservando base.
  const overrideByKey = new Map<string, VerticalModuleOverride>();
  for (const ov of overrides) {
    if (ov && typeof ov.moduleKey === "string") {
      overrideByKey.set(ov.moduleKey, ov);
    }
  }

  const mergedList = base.map((m) => {
    const ov = overrideByKey.get(m.moduleKey);
    if (!ov) return { ...m };
    return {
      moduleKey: m.moduleKey,
      enabled: ov.enabled ?? m.enabled,
      label: ov.label ?? m.label,
      navigationLabel: ov.navigationLabel ?? m.navigationLabel,
      emptyState: ov.emptyState ?? m.emptyState,
    };
  });

  const indexed = mergedList.map((m, i) => {
    const ov = overrideByKey.get(m.moduleKey);
    const order =
      ov && typeof ov.order === "number" ? ov.order : i + 10_000;
    return { m, order };
  });
  indexed.sort((a, b) => a.order - b.order);
  return indexed.map((x) => x.m);
}

function mergeDashboardPriorities(
  base: SectorPackDefinition["dashboardPriorities"],
  overrides: VerticalDashboardPriorityOverride[] | undefined,
): SectorPackDefinition["dashboardPriorities"] {
  if (!overrides || overrides.length === 0) {
    return base.map((p) => ({ ...p }));
  }

  const overrideByKey = new Map<string, VerticalDashboardPriorityOverride>();
  for (const ov of overrides) {
    if (ov && typeof ov.key === "string") overrideByKey.set(ov.key, ov);
  }

  const mergedList = base.map((p) => {
    const ov = overrideByKey.get(p.key);
    if (!ov) return { ...p };
    return {
      key: p.key,
      label: ov.label ?? p.label,
      description: ov.description ?? p.description,
      order: typeof ov.order === "number" ? ov.order : p.order,
    };
  });

  mergedList.sort((a, b) => a.order - b.order);
  return mergedList;
}
