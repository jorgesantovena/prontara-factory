export type UiFieldKind =
  | "text"
  | "email"
  | "tel"
  | "textarea"
  | "date"
  | "number"
  | "money"
  | "status"
  | "relation";

export type UiFieldDefinition = {
  key: string;
  label: string;
  kind: UiFieldKind;
  required?: boolean;
  placeholder?: string;
  relationModuleKey?: string;
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