export type BlueprintCompanySize = "solo" | "micro" | "small" | "medium";

export type BlueprintBusinessEntity = {
  key: string;
  label: string;
  description: string;
  moduleKey: string;
  primaryFields: string[];
  relatedTo?: string[];
};

export type BlueprintBusinessFlow = {
  key: string;
  label: string;
  description: string;
  steps: string[];
  relatedEntities: string[];
};

export type BlueprintDashboardPriority = {
  key: string;
  label: string;
  description: string;
  order: number;
};

export type BlueprintLandingRule = {
  key: string;
  label: string;
  description: string;
  instruction: string;
};

export type BlueprintBrandingConfig = {
  displayName: string;
  shortName: string;
  sectorLabel: string;
  businessTypeLabel: string;
  tone: "simple" | "professional" | "sectorial";
  accentColor: string;
  logoHint: string;
};

export type BlueprintTextConfig = {
  welcomeHeadline: string;
  welcomeSubheadline: string;
  assistantWelcome: string;
  assistantSuggestion: string;
  navigationLabelMap: Record<string, string>;
  emptyStateMap: Record<string, string>;
};

export type BlueprintFieldConfig = {
  moduleKey: string;
  fieldKey: string;
  label: string;
  kind: "text" | "email" | "tel" | "textarea" | "date" | "number" | "money" | "status" | "relation";
  required?: boolean;
  relationModuleKey?: string;
  placeholder?: string;
};

export type BlueprintDemoDataConfig = {
  moduleKey: string;
  records: Record<string, string>[];
};

export type BlueprintModuleConfig = {
  moduleKey: string;
  enabled: boolean;
  label: string;
  navigationLabel: string;
  emptyState: string;
};

export type RuntimeComposableBlueprint = {
  version: string;
  sector: string;
  sectorLabel: string;
  businessType: string;
  businessTypeLabel: string;
  companySize: BlueprintCompanySize;
  modules: BlueprintModuleConfig[];
  entities: BlueprintBusinessEntity[];
  flows: BlueprintBusinessFlow[];
  dashboardPriorities: BlueprintDashboardPriority[];
  landingRules: BlueprintLandingRule[];
  branding: BlueprintBrandingConfig;
  texts: BlueprintTextConfig;
  fields: BlueprintFieldConfig[];
  demoData: BlueprintDemoDataConfig[];
  labels: Record<string, string>;
};

export type RuntimeComposableConfig = {
  displayName: string;
  shortName: string;
  sector: string;
  businessType: string;
  companySize: BlueprintCompanySize;
  labels: Record<string, string>;
  navigationLabelMap: Record<string, string>;
  emptyStateMap: Record<string, string>;
  modules: BlueprintModuleConfig[];
  enabledModuleKeys: string[];
  fieldsByModule: Record<string, BlueprintFieldConfig[]>;
  dashboardPriorities: BlueprintDashboardPriority[];
  landingRules: BlueprintLandingRule[];
  branding: BlueprintBrandingConfig;
  texts: BlueprintTextConfig;
  demoDataByModule: Record<string, Record<string, string>[]>;
  flows: BlueprintBusinessFlow[];
  entities: BlueprintBusinessEntity[];
};

export type GenerationAssemblyResult = {
  ok: boolean;
  blueprint: RuntimeComposableBlueprint;
  runtimeConfig: RuntimeComposableConfig;
  summary: {
    moduleCount: number;
    enabledModuleCount: number;
    entityCount: number;
    flowCount: number;
    dashboardPriorityCount: number;
    landingRuleCount: number;
    demoDataModuleCount: number;
  };
};