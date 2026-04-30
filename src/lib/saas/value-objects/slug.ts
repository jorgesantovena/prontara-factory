/**
 * Slug · value object.
 *
 * Garantías:
 *   - Solo `[a-z0-9-]`. Sin acentos, sin espacios, sin mayúsculas.
 *   - Longitud entre 2 y 64.
 *   - No empieza ni termina en `-`. No tiene `--` consecutivos.
 *
 * En Prontara los slugs se usan como identificador URL del tenant
 * (`/clientes/<slug>`, subdominios futuros) y como nombre de directorio
 * en el modo filesystem (`data/clients/<slug>/`). Por eso son tan
 * estrictos: cualquier valor que se cuele aquí podría romper el FS o
 * permitir directory traversal.
 */
declare const SlugBrand: unique symbol;
export type Slug = string & { readonly [SlugBrand]: true };

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function parseSlug(raw: unknown): Slug | null {
  if (typeof raw !== "string") return null;
  // Strict: NO normalizamos. Si el valor no está ya en forma canónica
  // (lowercase, sin espacios), se rechaza. Para construir un slug a
  // partir de un nombre arbitrario, usa `slugify()` explícitamente.
  const value = raw.trim();
  if (value.length < 2 || value.length > 64) return null;
  if (!SLUG_REGEX.test(value)) return null;
  return value as Slug;
}

export function parseSlugOrThrow(raw: unknown): Slug {
  const parsed = parseSlug(raw);
  if (!parsed) {
    throw new Error("Slug inválido: " + JSON.stringify(raw));
  }
  return parsed;
}

export function unsafeSlug(value: string): Slug {
  return value as Slug;
}

/**
 * Convierte un display name razonable en un slug aproximado. NO
 * garantiza unicidad — el caller tiene que comprobarla en su store.
 *
 * Ejemplos:
 *   "Clínica Dr. García" → "clinica-dr-garcia"
 *   "  Taller   Mecánico  " → "taller-mecanico"
 *   "Niño & Niña SL" → "nino-nina-sl"
 */
export function slugify(input: string): Slug | null {
  if (typeof input !== "string") return null;
  const noAccents = input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  const collapsed = noAccents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return parseSlug(collapsed);
}
