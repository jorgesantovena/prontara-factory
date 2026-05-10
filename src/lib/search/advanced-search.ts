/**
 * Búsqueda compuesta avanzada (H7-C7).
 *
 * Helpers puros (sin componente UI) para construir y aplicar filtros
 * complejos sobre cualquier lista de registros del ERP.
 *
 * Soporta:
 *   - Múltiples condiciones combinadas con AND / OR
 *   - 8 operadores: eq / neq / contains / startsWith / endsWith / gt / lt / between
 *   - Persistencia de búsquedas guardadas en localStorage (cliente)
 *
 * Reusable desde cualquier página: importar applyAdvancedFilters(rows, filters).
 */

export type FilterOperator =
  | "eq"
  | "neq"
  | "contains"
  | "startsWith"
  | "endsWith"
  | "gt"
  | "lt"
  | "between"
  | "notEmpty"
  | "empty";

export type FilterCondition = {
  field: string;
  operator: FilterOperator;
  value?: string;
  /** Solo para `between`: segundo valor del rango. */
  value2?: string;
};

export type AdvancedFilter = {
  combine: "AND" | "OR";
  conditions: FilterCondition[];
};

function normalize(s: unknown): string {
  return String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

function asNumber(s: unknown): number {
  const v = parseFloat(String(s ?? "").replace(/[^\d,.-]/g, "").replace(",", "."));
  return Number.isFinite(v) ? v : NaN;
}

export function evaluateCondition(record: Record<string, unknown>, c: FilterCondition): boolean {
  const fieldValue = record[c.field];
  const value = normalize(fieldValue);
  const target = normalize(c.value);
  switch (c.operator) {
    case "eq": return value === target;
    case "neq": return value !== target;
    case "contains": return value.includes(target);
    case "startsWith": return value.startsWith(target);
    case "endsWith": return value.endsWith(target);
    case "gt": {
      const v = asNumber(fieldValue);
      const t = asNumber(c.value);
      return Number.isFinite(v) && Number.isFinite(t) && v > t;
    }
    case "lt": {
      const v = asNumber(fieldValue);
      const t = asNumber(c.value);
      return Number.isFinite(v) && Number.isFinite(t) && v < t;
    }
    case "between": {
      const v = asNumber(fieldValue);
      const t1 = asNumber(c.value);
      const t2 = asNumber(c.value2);
      return Number.isFinite(v) && Number.isFinite(t1) && Number.isFinite(t2) && v >= t1 && v <= t2;
    }
    case "notEmpty": return value.length > 0;
    case "empty": return value.length === 0;
    default: return true;
  }
}

export function applyAdvancedFilters<T extends Record<string, unknown>>(rows: T[], filter: AdvancedFilter): T[] {
  if (!filter || filter.conditions.length === 0) return rows;
  const conds = filter.conditions.filter((c) => c.field && c.operator);
  if (conds.length === 0) return rows;
  return rows.filter((row) => {
    if (filter.combine === "OR") return conds.some((c) => evaluateCondition(row, c));
    return conds.every((c) => evaluateCondition(row, c));
  });
}

const STORAGE_KEY = "prontara-saved-filters";

export type SavedFilter = {
  id: string;
  name: string;
  moduleKey: string;
  filter: AdvancedFilter;
  createdAt: string;
};

export function listSavedFilters(): SavedFilter[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedFilter[]) : [];
  } catch { return []; }
}

export function saveFilter(name: string, moduleKey: string, filter: AdvancedFilter): SavedFilter {
  const all = listSavedFilters();
  const sf: SavedFilter = {
    id: "f-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
    name, moduleKey, filter, createdAt: new Date().toISOString(),
  };
  all.unshift(sf);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all.slice(0, 50)));
  }
  return sf;
}

export function deleteSavedFilter(id: string): void {
  if (typeof window === "undefined") return;
  const all = listSavedFilters().filter((f) => f.id !== id);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}
