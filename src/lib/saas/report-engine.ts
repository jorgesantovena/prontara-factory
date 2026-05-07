/**
 * Motor de reportes (DEV-REP).
 *
 * Ejecuta un reporte definido por el operador: lee registros del módulo,
 * aplica filtros, agrupa por campo si procede y devuelve filas + totales.
 *
 * Operadores de filtro soportados:
 *   - eq: igual (case-insensitive para strings)
 *   - neq: distinto
 *   - contains: contiene (substring case-insensitive)
 *   - gt / lt: mayor / menor que (parsea como número)
 *   - notEmpty: tiene valor
 *   - empty: sin valor
 */
import { listModuleRecordsAsync } from "@/lib/persistence/active-client-data-store-async";

export type ReportFilter = {
  field: string;
  operator: "eq" | "neq" | "contains" | "gt" | "lt" | "notEmpty" | "empty";
  value?: string;
};

export type ReportDefinition = {
  moduleKey: string;
  columns: string[];
  filters: ReportFilter[];
  groupBy?: string | null;
};

export type ReportResult = {
  rows: Array<Record<string, string>>;
  total: number;
  groups?: Array<{ key: string; count: number; sum?: Record<string, number> }>;
};

function applyFilter(record: Record<string, string>, filter: ReportFilter): boolean {
  const value = String(record[filter.field] ?? "");
  const target = String(filter.value ?? "").trim();

  switch (filter.operator) {
    case "eq":
      return value.trim().toLowerCase() === target.toLowerCase();
    case "neq":
      return value.trim().toLowerCase() !== target.toLowerCase();
    case "contains":
      return value.toLowerCase().includes(target.toLowerCase());
    case "gt": {
      const v = parseFloat(value.replace(",", "."));
      const t = parseFloat(target.replace(",", "."));
      return Number.isFinite(v) && Number.isFinite(t) && v > t;
    }
    case "lt": {
      const v = parseFloat(value.replace(",", "."));
      const t = parseFloat(target.replace(",", "."));
      return Number.isFinite(v) && Number.isFinite(t) && v < t;
    }
    case "notEmpty":
      return value.trim().length > 0;
    case "empty":
      return value.trim().length === 0;
    default:
      return true;
  }
}

export async function runReport(
  clientId: string,
  definition: ReportDefinition,
): Promise<ReportResult> {
  const records = await listModuleRecordsAsync(definition.moduleKey, clientId).catch(
    () => [] as Array<Record<string, string>>,
  );

  // Aplicar filtros
  const filtered = records.filter((r) => {
    for (const f of definition.filters) {
      if (!applyFilter(r, f)) return false;
    }
    return true;
  });

  // Proyectar columnas (si la lista está vacía, devolvemos todo)
  const projected =
    definition.columns.length > 0
      ? filtered.map((r) => {
          const row: Record<string, string> = {};
          for (const col of definition.columns) {
            row[col] = String(r[col] ?? "");
          }
          if (r.id) row.id = String(r.id);
          return row;
        })
      : filtered;

  // Agrupación opcional
  let groups: ReportResult["groups"];
  if (definition.groupBy) {
    const map = new Map<string, { key: string; count: number; sum: Record<string, number> }>();
    for (const r of filtered) {
      const key = String(r[definition.groupBy] ?? "(vacío)");
      const existing = map.get(key) || { key, count: 0, sum: {} };
      existing.count += 1;
      // Agregamos sum para columnas numéricas detectadas
      for (const col of definition.columns) {
        const v = parseFloat(String(r[col] ?? "").replace(",", "."));
        if (Number.isFinite(v)) {
          existing.sum[col] = (existing.sum[col] || 0) + v;
        }
      }
      map.set(key, existing);
    }
    groups = Array.from(map.values()).sort((a, b) => b.count - a.count);
  }

  return {
    rows: projected,
    total: filtered.length,
    groups,
  };
}
