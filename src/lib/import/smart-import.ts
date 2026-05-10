/**
 * Importador Excel/CSV inteligente con mapeo (H6-IMPORT).
 *
 * Estrategia:
 *   - Cliente sube xlsx/csv → lee headers + primeras filas
 *   - El sistema sugiere moduleKey por similitud con el nombre del archivo
 *     o de los headers
 *   - El sistema sugiere mapeo columna→fieldKey por similitud (Levenshtein
 *     simplificado, normalizado, eliminando acentos)
 *   - Usuario revisa y confirma
 *   - Persistimos vía createModuleRecordAsync
 *
 * SheetJS / Papaparse pueden estar disponibles en cliente, pero aquí
 * trabajamos solo con el resultado parseado en JSON.
 */

export type ImportRow = Record<string, string>;

export type ImportSuggestion = {
  /** Mapeo sugerido columna → fieldKey */
  mapping: Record<string, string>;
  /** Confianza global 0-1 */
  confidence: number;
};

/**
 * Normaliza un string para comparación: minúsculas, sin acentos,
 * sin espacios/guiones/underscores.
 */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Distancia de edición simplificada — devuelve % similitud 0-1.
 * No es Levenshtein puro (sería caro) pero suficiente para sugerir.
 */
function similarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 1;
  if (!na || !nb) return 0;
  if (na.includes(nb) || nb.includes(na)) {
    return 0.85 * (Math.min(na.length, nb.length) / Math.max(na.length, nb.length));
  }
  // Bigramas comunes
  const aGrams = new Set<string>();
  for (let i = 0; i < na.length - 1; i++) aGrams.add(na.slice(i, i + 2));
  let common = 0;
  for (let i = 0; i < nb.length - 1; i++) {
    if (aGrams.has(nb.slice(i, i + 2))) common += 1;
  }
  const totalBigrams = (na.length - 1) + (nb.length - 1);
  return totalBigrams > 0 ? (2 * common) / totalBigrams : 0;
}

/**
 * Sugiere mapeo de columnas → fieldKeys del módulo destino.
 *
 * Recibe los headers leídos y la lista de fields del módulo, devuelve
 * el mejor match para cada header con su confianza.
 */
export function suggestMapping(
  headers: string[],
  moduleFields: Array<{ fieldKey: string; label: string }>,
): ImportSuggestion {
  const mapping: Record<string, string> = {};
  let totalConfidence = 0;
  let matchedCount = 0;

  for (const h of headers) {
    let bestField = "";
    let bestScore = 0;
    for (const f of moduleFields) {
      const sKey = similarity(h, f.fieldKey);
      const sLabel = similarity(h, f.label);
      const s = Math.max(sKey, sLabel);
      if (s > bestScore) {
        bestScore = s;
        bestField = f.fieldKey;
      }
    }
    if (bestScore >= 0.5) {
      mapping[h] = bestField;
      totalConfidence += bestScore;
      matchedCount += 1;
    } else {
      mapping[h] = ""; // no sugerencia
    }
  }

  return {
    mapping,
    confidence: matchedCount > 0 ? totalConfidence / matchedCount : 0,
  };
}

/**
 * Sugiere moduleKey desde nombre de archivo o de headers.
 * Lista común: clientes, facturacion, presupuestos, productos, tareas...
 */
const MODULE_HINTS: Record<string, string[]> = {
  clientes: ["client", "customer", "paciente", "alumno", "mascota", "socio", "propietario"],
  facturacion: ["factura", "invoice"],
  presupuestos: ["presupuesto", "quote", "oferta", "honorarios"],
  productos: ["producto", "product", "articulo", "sku"],
  proyectos: ["proyecto", "project", "caso", "tratamiento", "encargo"],
  tareas: ["tarea", "task", "todo"],
  tickets: ["ticket", "incidencia"],
  compras: ["compra", "purchase", "proveedor"],
  caja: ["caja", "cobro", "ticket-caja"],
  bodegas: ["bodega", "almacen", "warehouse"],
  kardex: ["kardex", "stock-mov", "inventario"],
  documentos: ["documento", "expediente", "historial"],
  reservas: ["reserva", "booking"],
};

export function suggestModule(fileName: string, headers: string[]): { moduleKey: string; confidence: number } {
  const haystack = (fileName + " " + headers.join(" ")).toLowerCase();
  const normalized = normalize(haystack);
  let bestModule = "";
  let bestScore = 0;
  for (const [moduleKey, hints] of Object.entries(MODULE_HINTS)) {
    let score = 0;
    for (const h of hints) {
      if (normalized.includes(normalize(h))) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestModule = moduleKey;
    }
  }
  return { moduleKey: bestModule, confidence: Math.min(1, bestScore / 2) };
}

/**
 * Aplica el mapeo a las filas — convierte cada fila usando los
 * fieldKeys destino. Filas con todos los campos vacíos se descartan.
 */
export function applyMapping(rows: ImportRow[], mapping: Record<string, string>): Array<Record<string, string>> {
  const out: Array<Record<string, string>> = [];
  for (const row of rows) {
    const mapped: Record<string, string> = {};
    let hasContent = false;
    for (const [colHeader, fieldKey] of Object.entries(mapping)) {
      if (!fieldKey) continue;
      const v = String(row[colHeader] || "").trim();
      if (v) {
        mapped[fieldKey] = v;
        hasContent = true;
      }
    }
    if (hasContent) out.push(mapped);
  }
  return out;
}
