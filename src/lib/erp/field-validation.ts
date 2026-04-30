/**
 * Motor de validación declarativa para módulos ERP.
 *
 * Lee las reglas desde `ModuleFieldDefinition` (required, minLength,
 * maxLength, pattern) y comprueba también reglas implícitas por tipo
 * (formato email, formato teléfono).
 *
 * Devuelve mensajes en español alineados con la tonalidad de la UI.
 * Consumido desde `module-form.tsx`; no validar en el caller.
 */

import type { ModuleFieldDefinition } from "@/lib/erp/module-definition";

export type FieldValidationResult =
  | { valid: true }
  | { valid: false; message: string };

export type FieldsValidationResult = {
  valid: boolean;
  errors: Record<string, string>;
};

// Regex conservadores, escritos para que no falsen formatos razonables
// que usa una pyme en España. No pretenden ser RFC-completos.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TEL_REGEX = /^[+]?[\d\s\-().]{6,}$/;

function isEmpty(value: unknown): boolean {
  return value === undefined || value === null || String(value).trim() === "";
}

export function validateField(
  field: ModuleFieldDefinition,
  rawValue: unknown
): FieldValidationResult {
  const value = rawValue === undefined || rawValue === null ? "" : String(rawValue);
  const trimmed = value.trim();

  if (isEmpty(trimmed)) {
    if (field.required) {
      return { valid: false, message: "Este campo es obligatorio." };
    }
    return { valid: true };
  }

  // Reglas por tipo.
  if (field.type === "email" && !EMAIL_REGEX.test(trimmed)) {
    return { valid: false, message: "El email no tiene un formato válido." };
  }

  if (field.type === "tel" && !TEL_REGEX.test(trimmed)) {
    return {
      valid: false,
      message: "Introduce un teléfono válido (mínimo 6 dígitos, admite +, espacios y guiones).",
    };
  }

  // Reglas declarativas del campo.
  if (typeof field.minLength === "number" && trimmed.length < field.minLength) {
    return {
      valid: false,
      message: "Debe tener al menos " + field.minLength + " caracteres.",
    };
  }

  if (typeof field.maxLength === "number" && trimmed.length > field.maxLength) {
    return {
      valid: false,
      message: "No puede superar los " + field.maxLength + " caracteres.",
    };
  }

  if (field.pattern) {
    let regex: RegExp;
    try {
      regex = new RegExp(field.pattern);
    } catch {
      // Si el patrón está mal compuesto, no bloqueamos al usuario final:
      // lo tratamos como "sin validación".
      return { valid: true };
    }
    if (!regex.test(trimmed)) {
      return {
        valid: false,
        message: field.patternMessage || "El valor introducido no es válido.",
      };
    }
  }

  return { valid: true };
}

export function validateFields(
  fields: ModuleFieldDefinition[],
  values: Record<string, unknown>
): FieldsValidationResult {
  const errors: Record<string, string> = {};
  for (const field of fields) {
    const result = validateField(field, values[field.key]);
    if (!result.valid) {
      errors[field.key] = result.message;
    }
  }
  return { valid: Object.keys(errors).length === 0, errors };
}
