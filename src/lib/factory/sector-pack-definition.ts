export type SectorPackEntity = {
  key: string;
  label: string;
  description: string;
  moduleKey: string;
  primaryFields: string[];
  relatedTo?: string[];
};

export type SectorPackFieldOption = {
  value: string;
  label: string;
};

export type SectorPackField = {
  moduleKey: string;
  fieldKey: string;
  label: string;
  kind: "text" | "email" | "tel" | "textarea" | "date" | "number" | "money" | "status" | "relation";
  required?: boolean;
  relationModuleKey?: string;
  placeholder?: string;
  options?: SectorPackFieldOption[];
};

export type SectorPackTableColumn = {
  moduleKey: string;
  fieldKey: string;
  label: string;
  isPrimary?: boolean;
};

export type SectorPackDefinition = {
  key: string;
  label: string;
  sector: string;
  businessType: string;
  description: string;
  branding: {
    displayName: string;
    shortName: string;
    accentColor: string;
    logoHint: string;
    tone: "simple" | "professional" | "sectorial";
  };
  labels: Record<string, string>;
  renameMap: Record<string, string>;
  modules: Array<{
    moduleKey: string;
    enabled: boolean;
    label: string;
    navigationLabel: string;
    emptyState: string;
  }>;
  entities: SectorPackEntity[];
  fields: SectorPackField[];
  tableColumns: SectorPackTableColumn[];
  dashboardPriorities: Array<{
    key: string;
    label: string;
    description: string;
    order: number;
  }>;
  demoData: Array<{
    moduleKey: string;
    records: Record<string, string>[];
  }>;
  landing: {
    headline: string;
    subheadline: string;
    bullets: string[];
    cta: string;
  };
  assistantCopy: {
    welcome: string;
    suggestion: string;
  };
};