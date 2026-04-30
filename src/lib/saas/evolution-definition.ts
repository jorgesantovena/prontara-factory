export type EvolutionActionType =
  | "add_module"
  | "remove_module"
  | "change_branding"
  | "change_labels"
  | "regenerate_demo_data"
  | "update_dashboard"
  | "update_landing"
  | "regenerate_wrapper";

export type EvolutionActionPayload = {
  moduleKey?: string;
  brandingPatch?: {
    displayName?: string;
    shortName?: string;
    accentColor?: string;
    logoHint?: string;
    tone?: "simple" | "professional" | "sectorial";
  };
  labelPatch?: Record<string, string>;
  dashboardPriorityKeys?: string[];
  landingRulePatches?: Array<{
    key: string;
    label?: string;
    description?: string;
    instruction?: string;
  }>;
  wrapperPatch?: {
    appName?: string;
    installableName?: string;
    executableName?: string;
    desktopCaption?: string;
    iconHint?: string;
    windowTitle?: string;
  };
};

export type EvolutionHistoryEntry = {
  id: string;
  tenantId: string;
  clientId: string;
  slug: string;
  actionType: EvolutionActionType;
  payload: EvolutionActionPayload;
  createdAt: string;
  createdBy: string;
  summary: string;
  rollbackSafe: boolean;
  snapshotBefore: string;
  snapshotAfter?: string;
  rollbackOfEntryId?: string;
};

export type EvolutionRuntimeSnapshot = {
  displayName: string;
  shortName: string;
  sector: string;
  businessType: string;
  companySize: string;
  labels: Record<string, string>;
  navigationLabelMap: Record<string, string>;
  emptyStateMap: Record<string, string>;
  modules: Array<{
    moduleKey: string;
    enabled: boolean;
    label: string;
    navigationLabel: string;
    emptyState: string;
  }>;
  dashboardPriorities: Array<{
    key: string;
    label: string;
    description: string;
    order: number;
  }>;
  landingRules: Array<{
    key: string;
    label: string;
    description: string;
    instruction: string;
  }>;
  branding: {
    displayName: string;
    shortName: string;
    sectorLabel: string;
    businessTypeLabel: string;
    tone: "simple" | "professional" | "sectorial";
    accentColor: string;
    logoHint: string;
  };
  texts: {
    welcomeHeadline: string;
    welcomeSubheadline: string;
    assistantWelcome: string;
    assistantSuggestion: string;
    navigationLabelMap: Record<string, string>;
    emptyStateMap: Record<string, string>;
  };
  fieldsByModule: Record<string, Array<{
    moduleKey: string;
    fieldKey: string;
    label: string;
    kind: "text" | "email" | "tel" | "textarea" | "date" | "number" | "money" | "status" | "relation";
    required?: boolean;
    relationModuleKey?: string;
    placeholder?: string;
  }>>;
  demoDataByModule: Record<string, Record<string, string>[]>;
  flows: Array<{
    key: string;
    label: string;
    description: string;
    steps: string[];
    relatedEntities: string[];
  }>;
  entities: Array<{
    key: string;
    label: string;
    description: string;
    moduleKey: string;
    primaryFields: string[];
    relatedTo?: string[];
  }>;
  wrapper?: {
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
};

export type EvolutionStatusSnapshot = {
  ok: boolean;
  tenantId: string;
  clientId: string;
  slug: string;
  current: EvolutionRuntimeSnapshot;
  history: EvolutionHistoryEntry[];
  rollbackCandidates: EvolutionHistoryEntry[];
};