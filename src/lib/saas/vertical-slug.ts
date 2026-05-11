/**
 * Mapping entre URL slug del vertical (lo que ve el usuario en la URL)
 * y `businessType` del pack sectorial (lo que usamos internamente en
 * SectorPackDefinition).
 *
 * Decisión de UX (H13): URLs cortas, sin guiones, fáciles de teclear.
 *   /softwarefactory  → software-factory
 *   /dental           → clinica-dental
 *   /veterinaria      → clinica-veterinaria
 *   /abogados         → despacho-abogados
 *
 * Para verticales con businessType monoválido (peluqueria, taller, colegio,
 * etc.) el slug es idéntico al businessType.
 *
 * Aceptamos también el businessType "raw" en la URL (ej. /software-factory)
 * por compatibilidad — el normalizer reduce ambas formas a la canónica.
 */

export type VerticalSlug =
  | "softwarefactory"
  | "dental"
  | "veterinaria"
  | "colegio"
  | "peluqueria"
  | "taller"
  | "hosteleria"
  | "abogados"
  | "inmobiliaria"
  | "asesoria"
  | "gimnasio";

export const VERTICAL_SLUG_TO_BUSINESS_TYPE: Record<VerticalSlug, string> = {
  softwarefactory: "software-factory",
  dental: "clinica-dental",
  veterinaria: "clinica-veterinaria",
  colegio: "colegio",
  peluqueria: "peluqueria",
  taller: "taller",
  hosteleria: "hosteleria",
  abogados: "despacho-abogados",
  inmobiliaria: "inmobiliaria",
  asesoria: "asesoria",
  gimnasio: "gimnasio",
};

export const BUSINESS_TYPE_TO_VERTICAL_SLUG: Record<string, VerticalSlug> = (() => {
  const out: Record<string, VerticalSlug> = {};
  for (const [slug, bt] of Object.entries(VERTICAL_SLUG_TO_BUSINESS_TYPE)) {
    out[bt] = slug as VerticalSlug;
  }
  // Aliases adicionales por compatibilidad — si en algún sitio aparece
  // "veterinaria" como businessType (sin "clinica-"), lo aceptamos.
  out["veterinaria"] = "veterinaria";
  return out;
})();

export const ALL_VERTICAL_SLUGS: VerticalSlug[] = Object.keys(VERTICAL_SLUG_TO_BUSINESS_TYPE) as VerticalSlug[];

/**
 * Normaliza cualquier identificador de vertical a su URL slug canónica.
 * Acepta: "softwarefactory", "software-factory", "SOFTWARE_FACTORY", etc.
 */
export function normalizeVerticalSlug(input: string): VerticalSlug | null {
  if (!input) return null;
  const cleaned = input.toLowerCase().replace(/[_\s]/g, "-").trim();
  // Match directo a slug canónica
  if (cleaned in VERTICAL_SLUG_TO_BUSINESS_TYPE) return cleaned as VerticalSlug;
  // Match a businessType
  if (cleaned in BUSINESS_TYPE_TO_VERTICAL_SLUG) return BUSINESS_TYPE_TO_VERTICAL_SLUG[cleaned];
  // Sin guiones (intento alternativo)
  const noDash = cleaned.replace(/-/g, "");
  if (noDash in VERTICAL_SLUG_TO_BUSINESS_TYPE) return noDash as VerticalSlug;
  return null;
}

/**
 * URL slug → businessType del pack. null si la slug no es válida.
 */
export function verticalSlugToBusinessType(slug: string): string | null {
  const norm = normalizeVerticalSlug(slug);
  if (!norm) return null;
  return VERTICAL_SLUG_TO_BUSINESS_TYPE[norm] ?? norm;
}

/**
 * businessType → URL slug canónica. null si no se reconoce.
 */
export function businessTypeToVerticalSlug(businessType: string): VerticalSlug | null {
  if (!businessType) return null;
  const cleaned = businessType.toLowerCase().trim();
  return BUSINESS_TYPE_TO_VERTICAL_SLUG[cleaned] ?? null;
}

/**
 * Construye un href absoluto para una página dentro de un vertical.
 *   verticalLink("softwarefactory", "clientes")   → "/softwarefactory/clientes"
 *   verticalLink("softwarefactory", "/clientes")  → "/softwarefactory/clientes"
 *   verticalLink("softwarefactory", "")           → "/softwarefactory"
 *   verticalLink("softwarefactory", "/")          → "/softwarefactory"
 */
export function verticalLink(vertical: VerticalSlug | string, modulePath: string = ""): string {
  const slug = String(vertical || "").toLowerCase();
  const path = String(modulePath || "").replace(/^\/+/, "").replace(/\/+$/, "");
  if (!slug) return "/" + path;
  if (!path) return "/" + slug;
  return "/" + slug + "/" + path;
}
