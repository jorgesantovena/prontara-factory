/**
 * Formato español unificado (CORE) — Pedro 22-06.
 *
 * Reglas de uso GENERAL en todo el proyecto, en todas las listas, detalles y
 * edición:
 *   · FECHAS  → siempre dd/mm/aaaa.
 *   · NÚMEROS → siempre X.XXX.XXX,XX  (punto de miles, coma decimal).
 *
 * Centralizado aquí para que cualquier vista (lista genérica, detalle, páginas
 * propias y editores) comparta exactamente el mismo criterio.
 */

/** Parsea un valor numérico tolerando ambos formatos (es-ES "1.234,56" y el
 *  canónico de almacenamiento "1234.56" / "1234,56"). Devuelve null si no es
 *  numérico. */
export function parseNumero(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  let s = String(value ?? "").trim();
  if (!s) return null;
  s = s.replace(/[^\d,.\-]/g, "");
  if (!s || s === "-" || s === "." || s === ",") return null;
  // Si trae coma, es el decimal es-ES: los puntos son miles → fuera.
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

/** Número en notación española: X.XXX.XXX,XX. Por defecto 0–2 decimales; con
 *  `decimals` fija exactamente esos decimales (p.ej. 2 para importes). */
export function numeroES(value: unknown, decimals?: number): string {
  const n = parseNumero(value);
  if (n == null) return value == null ? "" : String(value);
  const opts: Intl.NumberFormatOptions =
    decimals != null
      ? { minimumFractionDigits: decimals, maximumFractionDigits: decimals }
      : { minimumFractionDigits: 0, maximumFractionDigits: 2 };
  return n.toLocaleString("es-ES", opts);
}

/** Importe en euros: X.XXX.XXX,XX €  (siempre 2 decimales). */
export function monedaES(value: unknown): string {
  const n = parseNumero(value);
  if (n == null) return value == null ? "" : String(value);
  return n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

/** Fecha en notación española: dd/mm/aaaa (siempre, sin "Hoy/Ayer"). Acepta
 *  ISO (yyyy-mm-dd[ T hh:mm ]), dd-mm-aaaa, dd/mm/aaaa y, como último recurso,
 *  cualquier cadena parseable por Date. */
export function fechaES(value: unknown): string {
  const s = String(value ?? "").trim();
  if (!s) return "";
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (dmy) return `${dmy[1].padStart(2, "0")}/${dmy[2].padStart(2, "0")}/${dmy[3]}`;
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${dd}/${mm}/${d.getFullYear()}`;
  }
  return s;
}

/** dd/mm/aaaa → ISO yyyy-mm-dd (para guardar). Devuelve "" si no parsea. Si ya
 *  viene en ISO, lo deja igual. */
export function fechaESaISO(value: unknown): string {
  const s = String(value ?? "").trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  return "";
}
