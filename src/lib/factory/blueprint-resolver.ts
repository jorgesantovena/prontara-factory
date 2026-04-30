import type { NextRequest } from "next/server";
import { getBlueprintByBusinessType, getBlueprintFallback } from "@/lib/factory/blueprint-registry";
import { getSectorPackByKey } from "@/lib/factory/sector-pack-registry";
import type { RuntimeComposableBlueprint } from "@/lib/factory/blueprint-definition";

function normalize(value: string | null | undefined) {
  return String(value || "").trim();
}

function resolveCompanySizeFromInput(input: string): "solo" | "micro" | "small" | "medium" {
  const normalized = normalize(input).toLowerCase();

  if (["1", "solo", "single"].includes(normalized)) {
    return "solo";
  }

  if (["2", "3", "4", "micro"].includes(normalized)) {
    return "micro";
  }

  if (["5", "6", "7", "8", "9", "10", "small", "pyme", "small-team"].includes(normalized)) {
    return "small";
  }

  return "medium";
}

export function resolveBusinessBlueprintFromRequest(
  request: NextRequest
): RuntimeComposableBlueprint {
  const sectorPackKey =
    normalize(request.nextUrl.searchParams.get("sectorPack")) ||
    normalize(request.nextUrl.searchParams.get("pack"));

  const businessType =
    normalize(request.nextUrl.searchParams.get("businessType")) ||
    sectorPackKey;

  const sectorPack = getSectorPackByKey(sectorPackKey || businessType);
  const found = getBlueprintByBusinessType(businessType);
  const base = found || getBlueprintFallback();

  const companySizeOverride = normalize(request.nextUrl.searchParams.get("companySize"));
  const displayNameOverride = normalize(request.nextUrl.searchParams.get("displayName"));
  const accentColorOverride = normalize(request.nextUrl.searchParams.get("accentColor"));

  const merged: RuntimeComposableBlueprint = {
    ...base,
    sector: sectorPack?.sector || base.sector,
    sectorLabel: sectorPack?.label || base.sectorLabel,
    businessType: sectorPack?.businessType || base.businessType,
    businessTypeLabel: sectorPack?.label || base.businessTypeLabel,
    companySize: companySizeOverride
      ? resolveCompanySizeFromInput(companySizeOverride)
      : base.companySize,
    branding: {
      ...base.branding,
      displayName:
        displayNameOverride ||
        sectorPack?.branding.displayName ||
        base.branding.displayName,
      shortName:
        sectorPack?.branding.shortName ||
        base.branding.shortName,
      accentColor:
        accentColorOverride ||
        sectorPack?.branding.accentColor ||
        base.branding.accentColor,
      logoHint:
        sectorPack?.branding.logoHint ||
        base.branding.logoHint,
      tone:
        sectorPack?.branding.tone ||
        base.branding.tone,
      sectorLabel: sectorPack?.label || base.branding.sectorLabel,
      businessTypeLabel: sectorPack?.label || base.branding.businessTypeLabel,
    },
    labels: {
      ...base.labels,
      ...(sectorPack?.labels || {}),
    },
    modules: sectorPack?.modules || base.modules,
    entities: sectorPack?.entities || base.entities,
    dashboardPriorities: sectorPack?.dashboardPriorities || base.dashboardPriorities,
    landingRules: sectorPack
      ? [
          {
            key: "sector-headline",
            label: "Headline sectorial",
            description: "Headline principal de la landing sectorial.",
            instruction: sectorPack.landing.headline,
          },
          {
            key: "sector-subheadline",
            label: "Subheadline sectorial",
            description: "Subheadline principal de la landing sectorial.",
            instruction: sectorPack.landing.subheadline,
          },
          {
            key: "sector-cta",
            label: "CTA sectorial",
            description: "CTA principal de la landing sectorial.",
            instruction: sectorPack.landing.cta,
          },
        ]
      : base.landingRules,
    texts: {
      ...base.texts,
      welcomeHeadline:
        sectorPack?.landing.headline ||
        displayNameOverride
          ? (displayNameOverride || sectorPack?.branding.displayName || base.branding.displayName) +
            " ya está listo para ayudarte a trabajar con orden."
          : base.texts.welcomeHeadline,
      welcomeSubheadline:
        sectorPack?.landing.subheadline || base.texts.welcomeSubheadline,
      assistantWelcome:
        sectorPack?.assistantCopy.welcome || base.texts.assistantWelcome,
      assistantSuggestion:
        sectorPack?.assistantCopy.suggestion || base.texts.assistantSuggestion,
      navigationLabelMap: {
        ...base.texts.navigationLabelMap,
        ...(sectorPack?.labels || {}),
      },
      emptyStateMap: sectorPack
        ? Object.fromEntries(
            sectorPack.modules.map((item) => [item.moduleKey, item.emptyState])
          )
        : base.texts.emptyStateMap,
    },
    fields: sectorPack?.fields?.length
      ? [
          ...base.fields.filter(
            (field) =>
              !sectorPack.fields.some(
                (override) =>
                  override.moduleKey === field.moduleKey &&
                  override.fieldKey === field.fieldKey
              )
          ),
          ...sectorPack.fields,
        ]
      : base.fields,
    demoData: sectorPack?.demoData || base.demoData,
  };

  return merged;
}