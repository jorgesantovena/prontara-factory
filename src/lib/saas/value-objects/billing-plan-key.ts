/**
 * BillingPlanKey · value object.
 *
 * No es estrictamente "branded" porque ya es un string union literal
 * en el resto del código (`"trial" | "basico" | "estandar" | "premium"`).
 * Lo que aporta este módulo es el **parseador runtime**: convertir un
 * string crudo (que viene de query params, body JSON, env var, etc.)
 * a un BillingPlanKey con seguridad de tipos.
 *
 * Re-exporta el tipo desde billing-definition.ts para que value-objects
 * sea el único punto de entrada conceptual.
 */
import type { BillingPlanKey } from "../billing-definition";

export type { BillingPlanKey } from "../billing-definition";

const KNOWN: ReadonlyArray<BillingPlanKey> = [
  "trial",
  "basico",
  "estandar",
  "premium",
];

/**
 * Parsea un string a BillingPlanKey. Devuelve null si no es ninguno
 * de los 4 conocidos.
 */
export function parseBillingPlanKey(raw: unknown): BillingPlanKey | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim().toLowerCase();
  return (KNOWN as ReadonlyArray<string>).includes(v) ? (v as BillingPlanKey) : null;
}

export function parseBillingPlanKeyOrThrow(raw: unknown): BillingPlanKey {
  const parsed = parseBillingPlanKey(raw);
  if (!parsed) {
    throw new Error("BillingPlanKey inválido: " + JSON.stringify(raw));
  }
  return parsed;
}

/**
 * Lista de todos los planes válidos (útil para validators de Zod, UI
 * de selección, etc.).
 */
export function listBillingPlanKeys(): ReadonlyArray<BillingPlanKey> {
  return KNOWN;
}
