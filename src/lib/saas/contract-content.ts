/**
 * Datos del contrato compartidos entre:
 *   - generador del PDF que se adjunta al email post-pago
 *     (`contract-generator.ts`)
 *   - página pública `/contrato` que el cliente lee antes de pagar
 *     (`app/contrato/page.tsx`)
 *
 * Tener una única fuente de verdad evita que el HTML y el PDF se
 * desincronicen en cláusulas o cifras. Si quieres cambiar términos del
 * contrato, edítalos aquí.
 */
import type { BillingPlanKey } from "@/lib/saas/billing-definition";

export const CONTRACT_PROVIDER = {
  legalName: "SISPYME, S.L.",
  cif: "B-33047580",
  address:
    "Edificio multiusos, calle Ildefonso Sánchez del Río nº 10, 33510 Pola de Siero, Asturias, España",
  city: "Pola de Siero",
  province: "Asturias",
  jurisdiction: "Oviedo",
  phone: "+34 985 233 697",
  email: "info@sispyme.com",
  productEmail: "hola@prontara.com",
  productName: "Prontara",
  productSite: "prontara.com",
} as const;

export const CONTRACT_VERSION = "1.0";
export const CONTRACT_LAST_UPDATED = "28 de abril de 2026";

export const CONTRACT_PLAN_LABEL: Record<BillingPlanKey, string> = {
  trial: "Trial",
  basico: "Básico",
  estandar: "Estándar",
  premium: "Premium",
};

export const CONTRACT_PLAN_FEATURES: Record<BillingPlanKey, string[]> = {
  trial: ["Periodo de prueba sin coste."],
  basico: [
    "ERP completo del vertical contratado.",
    "Branding básico (logo + color).",
    "Datos demo iniciales coherentes con el vertical.",
    "Acceso 100 % online para todos los usuarios contratados.",
    "Acompañamiento durante el arranque.",
  ],
  estandar: [
    "Todo lo del plan Básico.",
    "Chat de personalización con IA: añadir campos, renombrar etiquetas, ajustar formularios y vistas mediante lenguaje natural.",
    "Branding completo personalizable.",
    "Datos demo ampliados del sector.",
  ],
  premium: [
    "Todo lo del plan Estándar.",
    "Chat de creación con IA: añadir módulos, KPIs, vistas y automatizaciones nuevas.",
    "Migración de datos desde el sistema previo.",
    "Soporte prioritario.",
    "Onboarding personalizado por videollamada (opcional).",
  ],
};

export function formatContractEuros(cents: number): string {
  const amount = cents / 100;
  return (
    amount.toLocaleString("es-ES", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + " €"
  );
}

export function formatContractDate(date: Date): string {
  return date.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
