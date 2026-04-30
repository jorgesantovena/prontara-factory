export type FieldType = "text" | "email" | "tel" | "textarea" | "select" | "date";

export type ModuleFieldOption = {
  value: string;
  label: string;
};

/**
 * Definición declarativa de un campo de módulo. Las reglas de validación
 * (required, min/maxLength, pattern) se interpretan en `field-validation.ts`
 * y se muestran inline en `module-form.tsx`. Añadir reglas aquí es la única
 * vía oficial de endurecer un formulario; no se valida en callers.
 */
export type ModuleFieldDefinition = {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  options?: ModuleFieldOption[];
  /** Longitud mínima del valor en caracteres. Ignorado si el campo está vacío y no es required. */
  minLength?: number;
  /** Longitud máxima del valor en caracteres. */
  maxLength?: number;
  /** Regex (fuente) que debe cumplir el valor. Ignorado si el campo está vacío y no es required. */
  pattern?: string;
  /** Mensaje de ayuda que se muestra cuando la regex falla. Si no se define se usa uno genérico. */
  patternMessage?: string;
  /** Texto de ayuda opcional debajo del campo, independiente del error. */
  helperText?: string;
};

export type ModuleRelationDefinition = {
  key: string;
  targetModule: string;
  sourceField: string;
  targetField: string;
  cardinality: "one-to-one" | "one-to-many" | "many-to-one" | "many-to-many";
  label?: string;
};

export type ModuleListColumnDefinition = {
  key: string;
  label: string;
};

export type ModuleAllowedAction =
  | "list"
  | "create"
  | "edit"
  | "delete"
  | "view";

export type ModuleSeedStrategy = "empty" | "demo-basic" | "demo-related";

export type ModuleDefinition = {
  moduleKey: string;
  title: string;
  primaryField: string;
  defaultSortField?: string;
  fields: ModuleFieldDefinition[];
  relations?: ModuleRelationDefinition[];
  listColumns?: ModuleListColumnDefinition[];
  allowedActions?: ModuleAllowedAction[];
  seedStrategy?: ModuleSeedStrategy;
  tags?: string[];
};

export type ModuleRecord = Record<string, string> & {
  id: string;
  createdAt: string;
  updatedAt: string;
};

export function defineModule(definition: ModuleDefinition): ModuleDefinition {
  return definition;
}

export function createEmptyValuesFromDefinition(
  definition: ModuleDefinition
): Record<string, string> {
  const values: Record<string, string> = {};

  for (const field of definition.fields) {
    if (field.type === "select" && field.options && field.options.length > 0) {
      values[field.key] = field.options[0].value;
    } else {
      values[field.key] = "";
    }
  }

  return values;
}