/**
 * Reglas condicionales para campos personalizados (H11-K).
 *
 * Cada regla se almacena como JSON dentro de TenantCustomField.optionsJson
 * (que ya existe). Estructura:
 *
 *   {
 *     conditionalRules: [
 *       { ifField: "tipoServicio", ifValue: "coloracion", action: "show", targetField: "formulaColor" },
 *       { ifField: "tipo", ifValue: "premium", action: "require", targetField: "consentimiento" },
 *     ]
 *   }
 *
 * Acciones soportadas: show / hide / require / unrequire
 *
 * El motor evalúa las reglas dado un payload y devuelve qué campos
 * mostrar y cuáles son obligatorios.
 */

export type ConditionalAction = "show" | "hide" | "require" | "unrequire";

export type ConditionalRule = {
  ifField: string;
  ifValue: string;
  action: ConditionalAction;
  targetField: string;
};

export type FieldVisibility = {
  visible: boolean;
  required: boolean;
};

export type ApplyResult = {
  /** Mapa fieldKey → visibility/required final tras aplicar reglas */
  fieldStates: Record<string, FieldVisibility>;
};

/**
 * Aplica un conjunto de reglas dadas las claves de campos del módulo
 * y los valores actuales del payload. Devuelve el estado resuelto.
 *
 * Estado base: todos los campos visibles + required del field.
 * Cada regla puede sobrescribir.
 */
export function applyConditionalRules(
  fields: Array<{ fieldKey: string; required?: boolean }>,
  payload: Record<string, unknown>,
  rules: ConditionalRule[],
): ApplyResult {
  const fieldStates: Record<string, FieldVisibility> = {};
  for (const f of fields) {
    fieldStates[f.fieldKey] = { visible: true, required: !!f.required };
  }
  for (const rule of rules) {
    const currentValue = String(payload[rule.ifField] ?? "").trim().toLowerCase();
    const expectedValue = String(rule.ifValue ?? "").trim().toLowerCase();
    if (currentValue !== expectedValue) continue;
    const target = fieldStates[rule.targetField];
    if (!target) continue;
    switch (rule.action) {
      case "show": target.visible = true; break;
      case "hide": target.visible = false; break;
      case "require": target.required = true; break;
      case "unrequire": target.required = false; break;
    }
  }
  return { fieldStates };
}

/**
 * Helper que extrae las reglas de un campo custom (las guarda dentro
 * de optionsJson para no añadir columna al schema).
 */
export function extractRulesFromCustomField(field: { optionsJson?: unknown }): ConditionalRule[] {
  if (!field?.optionsJson) return [];
  if (Array.isArray(field.optionsJson)) return [];
  const obj = field.optionsJson as Record<string, unknown>;
  const rules = obj.conditionalRules;
  if (!Array.isArray(rules)) return [];
  return rules.filter((r): r is ConditionalRule =>
    !!r && typeof r === "object"
    && typeof (r as ConditionalRule).ifField === "string"
    && typeof (r as ConditionalRule).ifValue === "string"
    && typeof (r as ConditionalRule).action === "string"
    && typeof (r as ConditionalRule).targetField === "string"
  );
}
