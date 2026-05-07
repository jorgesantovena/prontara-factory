/**
 * Resolver de datos del emisor para los PDF de documentos comerciales
 * (AUDIT-06).
 *
 * Cuando se imprime un presupuesto, factura o pedido, en la cabecera tiene
 * que aparecer la identidad de la empresa que lo emite (razón social, CIF,
 * dirección, teléfono, email, logo/color).
 *
 * Esos datos se intentan resolver en este orden:
 *   1. Módulo ERP "ajustes" del tenant — clave/valor con nombres canónicos
 *      ("razon_social", "cif", "direccion", "telefono", "email_contacto").
 *   2. branding del runtime config (displayName, accentColor).
 *   3. Defaults razonables — el operador verá "—" en los campos que faltan
 *      y sabrá que tiene que rellenarlos en /ajustes.
 *
 * Importante: el "emisor" del PDF NO es necesariamente SISPYME, S.L. (que
 * es la entidad que factura el SaaS Prontara). Es el TENANT, que cuando
 * usa Prontara emite sus propias facturas a SUS clientes con SU identidad
 * fiscal. Por eso siempre se resuelve desde el tenant, no desde un default
 * global.
 */

import { listModuleRecordsAsync } from "@/lib/persistence/active-client-data-store-async";

export type EmisorData = {
  razonSocial: string;
  cif: string;
  direccion: string;
  telefono: string;
  email: string;
  /** color hex (#RRGGBB) — del branding del pack del tenant */
  accentColor: string;
  /** iniciales 2-3 letras para el logo placeholder */
  iniciales: string;
};

const FALLBACK_EMISOR: EmisorData = {
  razonSocial: "Tu empresa",
  cif: "—",
  direccion: "—",
  telefono: "—",
  email: "—",
  accentColor: "#1d4ed8",
  iniciales: "PR",
};

function buildIniciales(nombre: string): string {
  const parts = String(nombre || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "PR";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function findAjusteValue(
  ajustes: Array<Record<string, string>>,
  candidates: string[],
): string {
  for (const cand of candidates) {
    const lower = cand.toLowerCase();
    const hit = ajustes.find(
      (a) =>
        String(a.nombre || "").trim().toLowerCase() === lower ||
        String(a.clave || "").trim().toLowerCase() === lower ||
        String(a.key || "").trim().toLowerCase() === lower,
    );
    if (hit) {
      const val = String(hit.valor || hit.value || "").trim();
      if (val) return val;
    }
  }
  return "";
}

export async function resolveTenantEmisorAsync(input: {
  clientId: string;
  /** displayName del tenant (vendría de TenantRuntimeConfig.branding.displayName) */
  brandingDisplayName?: string;
  brandingAccentColor?: string;
}): Promise<EmisorData> {
  const ajustes = await listModuleRecordsAsync("ajustes", input.clientId).catch(
    () => [] as Array<Record<string, string>>,
  );

  const razonSocial =
    findAjusteValue(ajustes, ["razon_social", "razonSocial", "nombre_fiscal"]) ||
    String(input.brandingDisplayName || "").trim() ||
    FALLBACK_EMISOR.razonSocial;

  const cif =
    findAjusteValue(ajustes, ["cif", "nif", "nif_cif"]) || FALLBACK_EMISOR.cif;
  const direccion =
    findAjusteValue(ajustes, ["direccion", "direccion_fiscal", "domicilio"]) ||
    FALLBACK_EMISOR.direccion;
  const telefono =
    findAjusteValue(ajustes, ["telefono", "tel", "phone"]) ||
    FALLBACK_EMISOR.telefono;
  const email =
    findAjusteValue(ajustes, ["email", "email_contacto", "correo"]) ||
    FALLBACK_EMISOR.email;

  const accentColor =
    String(input.brandingAccentColor || "").match(/^#[0-9a-fA-F]{6}$/)?.[0] ||
    FALLBACK_EMISOR.accentColor;

  return {
    razonSocial,
    cif,
    direccion,
    telefono,
    email,
    accentColor,
    iniciales: buildIniciales(razonSocial),
  };
}
