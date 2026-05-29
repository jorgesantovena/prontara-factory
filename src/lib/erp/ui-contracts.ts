export type UiFieldKind =
  | "text"
  | "email"
  | "tel"
  | "textarea"
  | "date"
  // TEST-11 — "time" (hh:mm) para campos tipo "Hora desde / Hora hasta"
  // del rediseño Parte de horas. Mantener alineado con SectorPackField
  // (sector-pack-definition.ts) y BlueprintFieldConfig (blueprint-definition.ts).
  | "time"
  | "number"
  | "money"
  | "status"
  | "relation";

export type UiFieldOption = {
  value: string;
  label: string;
};

export type UiFieldDefinition = {
  key: string;
  label: string;
  kind: UiFieldKind;
  required?: boolean;
  placeholder?: string;
  relationModuleKey?: string;
  options?: UiFieldOption[];
  // TEST-11 — Flags transversales para el rediseño Parte de horas. Quien
  // produzca UiFieldDefinition (sector packs, blueprint, custom fields)
  // puede marcar un campo como solo-salida, heredado de otra relación,
  // calculado o condicionalmente visible. Si no los usa, no pasa nada:
  // todos son opcionales. Ver SectorPackField para semántica completa.
  readOnly?: boolean;
  inheritFrom?: { from: string; field: string };
  // TEST-13 E — añadido "derived" para Facturable = f(tipoFacturacion).
  computed?:
    | { type: "duration"; from: string; to: string }
    | { type: "derived"; from: string; map?: Record<string, string>; default?: string };
  visibleWhen?: { field: string; equals: string | string[] };
  requiredWhen?: { field: string; equals: string | string[] };
  defaultValue?: string;
};

export type UiModuleContract = {
  moduleKey: string;
  singularLabel: string;
  pluralLabel: string;
  emptyTitle: string;
  emptyDescription: string;
  createTitle: string;
  editTitle: string;
  deleteConfirmText: string;
  fields: UiFieldDefinition[];
  titleField: string;
  subtitleField?: string;
  demoRecords: Record<string, string>[];
};

export type UiStatusTone = "neutral" | "info" | "ok" | "warn" | "danger";