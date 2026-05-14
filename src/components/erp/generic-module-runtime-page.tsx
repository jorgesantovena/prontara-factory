"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import ErpRecordEditor from "@/components/erp/erp-record-editor";
import TenantShell from "@/components/erp/tenant-shell";
import ModuleExportButton from "@/components/erp/module-export-button";
import ModuleImportButton from "@/components/erp/module-import-button";
import { useCurrentVertical } from "@/lib/saas/use-current-vertical";
import DangerConfirm from "@/components/erp/danger-confirm";

/**
 * Página genérica de un módulo del runtime del tenant (H12-F — rediseño).
 *
 * Layout (igual para todos los verticales):
 *   1. Breadcrumb "Inicio / {Módulo}"
 *   2. Header: H1 + subtítulo + [+ Nuevo] [Importar] [Exportar] [Más acciones ▾]
 *   3. Toolbar: buscador + [Vistas ▾] [Filtros] [Columnas]
 *   4. Chips de filtros activos + "Limpiar filtros"
 *   5. Mini-KPIs (Total + breakdown por estado)
 *   6. Bulk action bar (visible cuando hay selección)
 *   7. Tabla: checkbox + avatar + columnas del pack + saldo coloreado + ⋮
 *   8. Paginación: "X-Y de N" | < 1 2 3 ... > | "25 por página"
 *   9. Drawer "Detalle rápido" lateral derecho (al click en fila)
 *
 * Props mantienen la firma legacy para que /tareas, /productos, /tickets
 * y demás stubs no necesiten cambios.
 */

type FieldDef = {
  key: string;
  label: string;
  kind: string;
  required?: boolean;
  relationModuleKey?: string;
  placeholder?: string;
};

type TableColumnDef = {
  fieldKey: string;
  label: string;
  isPrimary?: boolean;
};

type SavedView = { id: string; name: string; configJson: { filters?: Record<string, string>; query?: string }; esDefault?: boolean };

function readTenant() {
  if (typeof window === "undefined") return "";
  return String(new URLSearchParams(window.location.search).get("tenant") || "").trim();
}
function readSectorPack() {
  if (typeof window === "undefined") return "";
  return String(new URLSearchParams(window.location.search).get("sectorPack") || "").trim();
}

// Subtítulo amigable por moduleKey (con fallback genérico).
const MODULE_SUBTITLE: Record<string, string> = {
  clientes: "Gestiona tu base de datos de clientes y su actividad.",
  crm: "Pipeline de oportunidades y captación.",
  proyectos: "Trabajos y entregables en curso.",
  presupuestos: "Propuestas enviadas y seguimiento.",
  facturacion: "Facturas emitidas y cobros.",
  documentos: "Entregables y documentación del cliente.",
  tareas: "Lo que hay por hacer.",
  tickets: "Incidencias abiertas y soporte.",
  compras: "Órdenes de compra y proveedores.",
  productos: "Catálogo de productos y servicios.",
  reservas: "Reservas y citas.",
  encuestas: "Encuestas creadas y respuestas.",
  empleados: "Personal del equipo.",
  bodegas: "Almacenes y ubicaciones de stock.",
  kardex: "Movimientos de stock.",
  caja: "Movimientos de caja del día.",
  gastos: "Gastos imputados y notas.",
  cau: "Soporte de aplicación: tickets de los clientes.",
  aplicaciones: "Catálogo de aplicaciones y productos software.",
  "catalogo-servicios": "Tipos de servicio facturables.",
  actividades: "Imputación de horas y partes.",
  albaranes: "Albaranes pendientes y facturables.",
  "vencimientos-factura": "Vencimientos de facturas.",
  "tarifas-generales": "Tarifas estándar.",
  "tarifas-especiales": "Tarifas por cliente o grupo.",
  "formas-pago": "Formas de pago configuradas.",
  "cuentas-bancarias": "Cuentas bancarias del tenant.",
};

// TEST-2.6 — módulos donde la vista Kanban tiene sentido (pipeline real
// con fases o estados que progresan). En maestros (clientes, productos,
// empleados...) no aplica y confunde al usuario.
const KANBAN_MODULES = new Set([
  "crm", "oportunidades", "proyectos", "tareas", "tickets", "cau",
  "incidencias", "presupuestos", "compras",
]);

function fmtMoneda(v: unknown): { text: string; tone: "neutral" | "good" | "bad" } {
  const n = parseFloat(String(v ?? "").replace(/[^\d,.-]/g, "").replace(",", "."));
  if (!Number.isFinite(n)) return { text: String(v ?? "—"), tone: "neutral" };
  const abs = Math.abs(n);
  const text = (n < 0 ? "-" : "") + abs.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
  return { text, tone: n < 0 ? "bad" : n > 0 ? "good" : "neutral" };
}

function fmtFecha(v: unknown): string {
  const s = String(v ?? "");
  if (!s) return "—";
  // ISO date o date-time
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const dCopy = new Date(d); dCopy.setHours(0, 0, 0, 0);
    const diffDays = Math.round((dCopy.getTime() - today.getTime()) / 86400000);
    if (diffDays === 0) return "Hoy, " + d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
    if (diffDays === -1) return "Ayer, " + d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
  }
  return s;
}

function isDateField(key: string): boolean {
  const k = key.toLowerCase();
  return k.includes("fecha") || k.includes("date") || k === "createdat" || k === "updatedat";
}
function isMoneyField(key: string): boolean {
  const k = key.toLowerCase();
  return k.includes("importe") || k.includes("saldo") || k.includes("precio") || k.includes("total") || k.includes("valor");
}

// Pill de estado con color por valor (verde activo, rojo inactivo, etc.)
function estadoTone(v: string): { bg: string; fg: string } {
  const k = v.toLowerCase();
  if (["activo", "completado", "completada", "ganado", "cobrada", "firmado", "aceptado", "ok", "publicado", "publicada", "abierto", "abierta", "resuelto", "cerrado-ok"].includes(k)) return { bg: "#dcfce7", fg: "#15803d" };
  if (["inactivo", "inactiva", "perdido", "perdida", "rechazado", "rechazada", "anulada", "anulado", "cancelado", "cancelada", "archivado", "archivada"].includes(k)) return { bg: "#fee2e2", fg: "#b91c1c" };
  if (["bloqueado", "bloqueada", "vencida", "vencido", "expirado", "expirada", "critica"].includes(k)) return { bg: "#fecaca", fg: "#991b1b" };
  if (["pendiente", "borrador", "en_curso", "en_marcha", "en curso", "negociacion", "enviado", "esperando"].includes(k)) return { bg: "#fef3c7", fg: "#a16207" };
  if (["vip", "premium", "alta"].includes(k)) return { bg: "#ede9fe", fg: "#6d28d9" };
  if (["frecuente", "habitual", "media"].includes(k)) return { bg: "#dbeafe", fg: "#1e40af" };
  if (["empresa", "b2b"].includes(k)) return { bg: "#e0e7ff", fg: "#3730a3" };
  return { bg: "#f1f5f9", fg: "#475569" };
}

// Color del avatar por nombre (hash simple a paleta soft).
const AVATAR_PALETTE = [
  { bg: "#dbeafe", fg: "#1d4ed8" },
  { bg: "#dcfce7", fg: "#15803d" },
  { bg: "#ede9fe", fg: "#6d28d9" },
  { bg: "#ffedd5", fg: "#c2410c" },
  { bg: "#fce7f3", fg: "#be185d" },
  { bg: "#cffafe", fg: "#0e7490" },
  { bg: "#fef3c7", fg: "#a16207" },
];
function avatarTint(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}

const PAGE_SIZES = [10, 25, 50, 100];

export default function GenericModuleRuntimePage({
  moduleKey,
  href,
  extraActions,
  extraRowActions,
}: {
  moduleKey: string;
  href: string;
  extraActions?: React.ReactNode;
  extraRowActions?: (row: Record<string, string>) => React.ReactNode;
}) {
  // TEST-1.4 — hook para construir URLs vertical-aware. Antes el dropdown
  // "Más acciones" enlazaba a /vista-kanban sin prefix de vertical →
  // redirect a /acceso por el middleware.
  const { link } = useCurrentVertical();
  const [rows, setRows] = useState<Array<Record<string, string>>>([]);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Record<string, string> | null>(null);
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [accent, setAccent] = useState("#1d4ed8");
  // H12-F nuevo: filtros por columna estado, vistas, columnas visibles, selección, paginación.
  const [estadoFilter, setEstadoFilter] = useState<string>("");
  // TEST-1.6 — filtros adicionales y popover unificado.
  const [segmentoFilter, setSegmentoFilter] = useState<string>("");
  const [responsableFilter, setResponsableFilter] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [showViews, setShowViews] = useState(false);
  const [showColumns, setShowColumns] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  // TEST-1.3 — bulk action modals reales (antes eran alert("TODO: ...")).
  const [bulkModal, setBulkModal] = useState<null | "responsable" | "estado">(null);
  const [bulkValue, setBulkValue] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState("");
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
  // TEST-2.12 — menú "..." de fila con Editar / Email / Llamar / Eliminar / Copiar.
  const [rowMenuOpenId, setRowMenuOpenId] = useState<string | null>(null);
  // TEST-3.3 — confirm de eliminación (vía tecla Supr o bulk Supr).
  const [deleteSuprOpen, setDeleteSuprOpen] = useState(false);
  // TEST-3.3 — timer click/dblclick para evitar que doble-click abra primero el drawer.
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [ui, setUi] = useState<{
    label: string;
    emptyState: string;
    fields: FieldDef[];
    tableColumns: TableColumnDef[];
  }>({
    label: moduleKey,
    emptyState: "Todavía no hay datos en " + moduleKey + ".",
    fields: [],
    tableColumns: [],
  });

  async function loadUi() {
    const tenant = readTenant();
    const sectorPack = readSectorPack();
    const url = "/api/runtime/tenant-config" + (tenant || sectorPack ? "?" + [
      tenant ? "tenant=" + encodeURIComponent(tenant) : "",
      sectorPack ? "sectorPack=" + encodeURIComponent(sectorPack) : "",
    ].filter(Boolean).join("&") : "");
    const response = await fetch(url, { cache: "no-store" });
    const data = await response.json();
    if (response.ok && data.ok) {
      const config = data.config || {};
      const fieldsByModule = config.fieldsByModule || {};
      const tableColumnsByModule = (config.tableColumnsByModule || {}) as Record<string, TableColumnDef[]>;
      setUi({
        label: config.labels?.[moduleKey] || config.navigationLabelMap?.[moduleKey] || moduleKey,
        emptyState: config.emptyStateMap?.[moduleKey] || ("Todavía no hay datos en " + moduleKey + "."),
        fields: fieldsByModule[moduleKey] || [],
        tableColumns: tableColumnsByModule[moduleKey] || [],
      });
      if (config.branding?.accentColor) setAccent(config.branding.accentColor);
    }
  }

  async function loadViews() {
    try {
      const r = await fetch("/api/runtime/saved-views?moduleKey=" + moduleKey, { cache: "no-store" });
      const d = await r.json();
      if (r.ok && d.ok) setSavedViews(d.views || []);
    } catch { /* noop */ }
  }

  async function load() {
    setBusy(true);
    setError("");
    try {
      await loadUi();
      const tenant = readTenant();
      const sectorPack = readSectorPack();
      const response = await fetch(
        "/api/erp/module?module=" + encodeURIComponent(moduleKey) +
        (tenant || sectorPack ? "&" + [
          tenant ? "tenant=" + encodeURIComponent(tenant) : "",
          sectorPack ? "sectorPack=" + encodeURIComponent(sectorPack) : "",
        ].filter(Boolean).join("&") : ""),
        { cache: "no-store" },
      );
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "No se pudo cargar el módulo.");
      setRows(Array.isArray(data.rows) ? data.rows : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el módulo.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
    loadViews();
    setSelectedIds(new Set());
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleKey]);

  // TEST-3.8 — Pre-carga vía query string `?prefill_<campo>=<valor>`. Si
  // existe al menos un parámetro `prefill_*`, abrimos el editor en modo
  // "create" con esos valores ya rellenos. Útil para flujos como
  // "Nuevo proyecto desde la ficha de Cliente" (prefill_cliente=<id>).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const prefill: Record<string, string> = {};
    let hasAny = false;
    for (const [k, v] of params.entries()) {
      if (k.startsWith("prefill_") && v) {
        prefill[k.slice("prefill_".length)] = v;
        hasAny = true;
      }
    }
    if (hasAny && modalMode === null) {
      setSelected(prefill);
      setModalMode("create");
      // Limpiamos los prefill_* de la URL para no re-abrir al refrescar.
      const cleaned = new URLSearchParams(window.location.search);
      for (const k of Array.from(cleaned.keys())) {
        if (k.startsWith("prefill_")) cleaned.delete(k);
      }
      const newSearch = cleaned.toString();
      const newUrl = window.location.pathname + (newSearch ? "?" + newSearch : "");
      window.history.replaceState({}, "", newUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleKey]);

  // TEST-3.3 — Atajo de teclado: Supr/Delete elimina la selección actual o
  // el registro abierto en el drawer. Ignora si hay foco en input/textarea
  // o si está abierto el editor full-page (modalMode !== null).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Delete") return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (target?.isContentEditable) return;
      if (modalMode !== null) return; // editor abierto
      if (bulkModal || archiveConfirmOpen || deleteSuprOpen) return;
      const tienenSeleccion = selectedIds.size > 0;
      const drawerConRegistro = detailOpen && selected?.id;
      if (!tienenSeleccion && !drawerConRegistro) return;
      e.preventDefault();
      setDeleteSuprOpen(true);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedIds, detailOpen, selected, modalMode, bulkModal, archiveConfirmOpen, deleteSuprOpen]);

  // Filtrado: query + estadoFilter + segmento + responsable (TEST-1.6).
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((item) => {
      if (estadoFilter && String(item.estado || "").toLowerCase() !== estadoFilter.toLowerCase()) return false;
      if (segmentoFilter) {
        const seg = String(item.segmento || item.tipo || "").toLowerCase();
        if (seg !== segmentoFilter.toLowerCase()) return false;
      }
      if (responsableFilter) {
        const resp = String(item.responsable || item.asignado || "").toLowerCase();
        if (resp !== responsableFilter.toLowerCase()) return false;
      }
      if (q && !Object.values(item || {}).join(" ").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, query, estadoFilter, segmentoFilter, responsableFilter]);

  // KPIs derivados de los rows (Total + breakdown por estado).
  const kpis = useMemo(() => {
    const total = rows.length;
    const byEstado: Record<string, number> = {};
    for (const r of rows) {
      const e = String(r.estado || "").toLowerCase() || "—";
      byEstado[e] = (byEstado[e] || 0) + 1;
    }
    const items: Array<{ key: string; label: string; value: number; pct: string; tone: "neutral" | "good" | "bad" | "warn" | "vip" }> = [
      { key: "total", label: "Total", value: total, pct: "100% del total", tone: "neutral" },
    ];
    const sortedEstados = Object.entries(byEstado).sort((a, b) => b[1] - a[1]).slice(0, 4);
    for (const [estado, n] of sortedEstados) {
      if (estado === "—") continue;
      const pct = total > 0 ? ((n * 100) / total).toFixed(1) + "% del total" : "—";
      let tone: "neutral" | "good" | "bad" | "warn" | "vip" = "neutral";
      if (["activo", "completado", "ganado", "cobrada", "firmado", "aceptado"].includes(estado)) tone = "good";
      else if (["inactivo", "perdido", "rechazado", "anulada", "cancelado"].includes(estado)) tone = "bad";
      else if (["bloqueado", "vencida", "expirado"].includes(estado)) tone = "bad";
      else if (["pendiente", "borrador", "en_curso", "negociacion", "enviado"].includes(estado)) tone = "warn";
      else if (["vip", "premium"].includes(estado)) tone = "vip";
      items.push({ key: estado, label: estado.charAt(0).toUpperCase() + estado.slice(1), value: n, pct, tone });
    }
    return items.slice(0, 5);
  }, [rows]);

  // Paginación
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageStart = (page - 1) * pageSize;
  const pageRows = filtered.slice(pageStart, pageStart + pageSize);

  async function saveRecord(payload: Record<string, string>) {
    const tenant = readTenant();
    const sectorPack = readSectorPack();
    if (modalMode === "create") {
      const response = await fetch("/api/erp/module", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module: moduleKey, mode: "create", payload, tenant, sectorPack }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "No se pudo guardar.");
    }
    if (modalMode === "edit" && selected?.id) {
      const response = await fetch("/api/erp/module", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module: moduleKey, mode: "edit", recordId: selected.id, payload, tenant, sectorPack }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "No se pudo actualizar.");
    }
    await load();
  }

  async function removeRecord(recordId: string) {
    const tenant = readTenant();
    const sectorPack = readSectorPack();
    const response = await fetch("/api/erp/module", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ module: moduleKey, mode: "delete", recordId, tenant, sectorPack }),
    });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || "No se pudo borrar.");
    setSelected(null);
    setDetailOpen(false);
    await load();
  }

  // TEST-1.3 — actualización en bloque: aplica { field: value } a cada id
  // seleccionado mediante /api/erp/module mode=edit con el payload merge.
  async function bulkUpdate(field: string, value: string) {
    const tenant = readTenant();
    const sectorPack = readSectorPack();
    const ids = Array.from(selectedIds);
    for (const id of ids) {
      const existing = rows.find((r) => r.id === id);
      if (!existing) continue;
      const payload = { ...existing, [field]: value };
      const response = await fetch("/api/erp/module", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module: moduleKey, mode: "edit", recordId: id, payload, tenant, sectorPack }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "No se pudo actualizar " + id);
    }
    await load();
  }

  // Columnas (derivar de fields si pack no trae)
  const allColumns: TableColumnDef[] = ui.tableColumns.length > 0
    ? ui.tableColumns
    : ui.fields.slice(0, 4).map((f) => ({ fieldKey: f.key, label: f.label }));
  const columns = allColumns.filter((c) => !hiddenCols.has(c.fieldKey));

  const titleField = ui.tableColumns.find((c) => c.isPrimary)?.fieldKey || allColumns[0]?.fieldKey || ui.fields[0]?.key || "id";

  function openDetail(item: Record<string, string>) {
    setSelected(item);
    setDetailOpen(true);
  }

  function toggleAllSelection() {
    if (selectedIds.size === pageRows.length && pageRows.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pageRows.map((r) => String(r.id || ""))));
    }
  }
  function toggleRowSelection(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const subtitle = MODULE_SUBTITLE[moduleKey] || ("Gestiona los registros de " + ui.label.toLowerCase() + ".");

  // H12-G — Si estamos creando o editando, mostramos el editor full-page
  // en lugar del listado. Más limpio que un slideover y permite el
  // sidebar de info rápida + estadísticas.
  if (modalMode !== null) {
    return (
      <TenantShell>
        <ErpRecordEditor
          mode={modalMode}
          moduleKey={moduleKey}
          moduleLabel={ui.label}
          fields={ui.fields as Array<{
            key: string; label: string;
            kind: "text" | "email" | "tel" | "textarea" | "date" | "number" | "money" | "status" | "relation";
            required?: boolean; relationModuleKey?: string; placeholder?: string;
            options?: Array<{ value: string; label: string }>;
          }>}
          // TEST-2.12 Duplicar — pasar selected también en create-from-duplicate.
          initialValue={selected}
          tenant={readTenant() || undefined}
          accent={accent}
          onCancel={() => setModalMode(null)}
          onSubmit={async (payload, options) => {
            await saveRecord(payload);
            if (options?.andNew && modalMode === "create") {
              // Quedarse en modo "create" con form limpio
              setSelected(null);
              setModalMode("create");
            } else {
              setModalMode(null);
            }
          }}
        />
      </TenantShell>
    );
  }

  // Filtros activos para chips (TEST-1.6)
  const activeChips: Array<{ key: string; label: string; onClear: () => void }> = [];
  if (estadoFilter) activeChips.push({ key: "estado", label: "Estado: " + estadoFilter, onClear: () => setEstadoFilter("") });
  if (segmentoFilter) activeChips.push({ key: "segmento", label: "Segmento: " + segmentoFilter, onClear: () => setSegmentoFilter("") });
  if (responsableFilter) activeChips.push({ key: "responsable", label: "Responsable: " + responsableFilter, onClear: () => setResponsableFilter("") });
  if (query) activeChips.push({ key: "query", label: '"' + query + '"', onClear: () => setQuery("") });

  return (
    <TenantShell>
      <div style={{ maxWidth: 1320, margin: "0 auto", color: "#0f172a", fontFamily: "system-ui, -apple-system, sans-serif" }}>
        {/* Breadcrumb */}
        <div style={{ fontSize: 13, color: "#64748b", marginBottom: 6 }}>
          <Link href={link("") || "/"} style={{ color: "#64748b", textDecoration: "none" }}>Inicio</Link>
          <span style={{ margin: "0 6px" }}>/</span>
          <span style={{ color: "#0f172a", fontWeight: 600 }}>{ui.label}</span>
        </div>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 18, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: "0 0 4px 0", fontSize: 28, fontWeight: 800, letterSpacing: -0.4 }}>{ui.label}</h1>
            <div style={{ fontSize: 13, color: "#64748b" }}>{subtitle}</div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {extraActions}
            <button
              type="button"
              onClick={() => { setSelected(null); setModalMode("create"); }}
              style={primaryBtn(accent)}
            >
              <span style={{ fontSize: 14, lineHeight: 1 }}>+</span> Nuevo {singular(ui.label)}
            </button>
            <ImportWrapper><ModuleImportButton modulo={moduleKey} /></ImportWrapper>
            <ExportWrapper><ModuleExportButton modulo={moduleKey} /></ExportWrapper>
            <div style={{ position: "relative" }}>
              <button type="button" onClick={() => setShowMore(!showMore)} style={secondaryBtn}>
                Más acciones <span style={{ fontSize: 9, marginLeft: 4 }}>▾</span>
              </button>
              {showMore ? (
                <div style={popover(280)}>
                  {/* TEST-2.6 — Kanban solo tiene sentido en módulos con
                      pipeline/fases (oportunidades, proyectos, tareas,
                      tickets, cau). No en maestros tipo clientes. */}
                  {KANBAN_MODULES.has(moduleKey) ? (
                    <Link href={link("vista-kanban?moduleKey=" + moduleKey)} style={popoverItem} title="Vista tipo tablero: cada columna es un estado o fase y los registros se mueven entre ellas">
                      Tablero por fases (Kanban)
                    </Link>
                  ) : null}
                  <Link href={link("calendario")} style={popoverItem} title="Ver los registros con fecha en una grid mensual">Ver en calendario</Link>
                  <Link href={link("reportes?modulo=" + moduleKey)} style={popoverItem} title="Crear un informe descargable con los registros de este listado">Crear informe de este listado</Link>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 280 }}>
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94a3b8", fontSize: 13 }}>🔍</span>
            <input
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(1); }}
              placeholder={"Buscar en " + ui.label.toLowerCase() + "…"}
              style={{
                width: "100%",
                padding: "10px 14px 10px 36px",
                border: "1px solid #e2e8f0",
                borderRadius: 10,
                fontSize: 13,
                background: "#ffffff",
                boxSizing: "border-box",
                outline: "none",
              }}
            />
          </div>

          {/* Vistas guardadas */}
          <div style={{ position: "relative" }}>
            <button type="button" onClick={() => setShowViews(!showViews)} style={toolbarBtn}>
              <span>≣</span> Vistas <span style={{ fontSize: 9, marginLeft: 4 }}>▾</span>
            </button>
            {showViews ? (
              <div style={popover(300)}>
                <div style={popoverHeader}>Vistas guardadas</div>
                {/* TEST-2.10 — explicar diferencia entre "Todos" y vistas personalizadas */}
                <button type="button" onClick={() => { setEstadoFilter(""); setSegmentoFilter(""); setResponsableFilter(""); setQuery(""); setShowViews(false); }} style={popoverItemBtn} title="Muestra todos los registros sin filtro aplicado">
                  <span>👥</span>
                  <span style={{ flex: 1, textAlign: "left" }}>
                    Todos
                    <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 400 }}>Sin filtros — toda la lista</div>
                  </span>
                  <span style={popoverCount}>{rows.length}</span>
                </button>
                {savedViews.map((v) => {
                  // Resumir qué filtros guarda la vista
                  const f = v.configJson?.filters || {};
                  const tags: string[] = [];
                  if (f.estado) tags.push("estado=" + f.estado);
                  if (v.configJson?.query) tags.push('"' + v.configJson.query + '"');
                  const summary = tags.length > 0 ? tags.join(" · ") : "Sin filtros guardados";
                  return (
                    <button key={v.id} type="button" onClick={() => {
                      if (v.configJson?.filters?.estado) setEstadoFilter(v.configJson.filters.estado);
                      if (v.configJson?.query) setQuery(v.configJson.query);
                      setShowViews(false);
                    }} style={popoverItemBtn} title={"Aplica los filtros: " + summary}>
                      <span>★</span>
                      <span style={{ flex: 1, textAlign: "left" }}>
                        {v.name}
                        <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 400 }}>{summary}</div>
                      </span>
                    </button>
                  );
                })}
                <div style={{ borderTop: "1px solid #f1f5f9", marginTop: 4 }}>
                  <button type="button" onClick={async () => {
                    const name = prompt("Nombre de la vista:");
                    if (!name) return;
                    const body = { moduleKey, name, configJson: { filters: estadoFilter ? { estado: estadoFilter } : {}, query } };
                    await fetch("/api/runtime/saved-views", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
                    await loadViews();
                    setShowViews(false);
                  }} style={{ ...popoverItemBtn, color: accent, fontWeight: 700 }}>
                    <span>+</span><span>Guardar vista actual</span>
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          {/* TEST-1.6 — Filtros popover real con múltiples dimensiones */}
          <div style={{ position: "relative" }}>
            <button type="button" onClick={() => setShowFilters(!showFilters)} style={toolbarBtn}>
              <span>▽</span> Filtros
              {(estadoFilter || segmentoFilter || responsableFilter) ? (
                <span style={popoverCount}>{[estadoFilter, segmentoFilter, responsableFilter].filter(Boolean).length}</span>
              ) : null}
              <span style={{ fontSize: 9, marginLeft: 4 }}>▾</span>
            </button>
            {showFilters ? (
              <div style={{ ...popover(280), padding: 12 }}>
                <div style={popoverHeader}>Filtrar registros</div>
                {/* Estado */}
                {(() => {
                  const estados = Array.from(new Set(rows.map((r) => String(r.estado || "")).filter(Boolean))).sort();
                  if (estados.length === 0) return null;
                  return (
                    <div style={{ marginBottom: 10 }}>
                      <label style={filterLabel}>Estado</label>
                      <select value={estadoFilter} onChange={(e) => { setEstadoFilter(e.target.value); setPage(1); }} style={filterSelect}>
                        <option value="">Todos</option>
                        {estados.map((e) => <option key={e} value={e}>{e.charAt(0).toUpperCase() + e.slice(1)}</option>)}
                      </select>
                    </div>
                  );
                })()}
                {/* Segmento / tipo */}
                {(() => {
                  const hasField = ui.fields.some((f) => f.key === "segmento" || f.key === "tipo");
                  if (!hasField) return null;
                  const segs = Array.from(new Set(rows.map((r) => String(r.segmento || r.tipo || "")).filter(Boolean))).sort();
                  if (segs.length === 0) return null;
                  return (
                    <div style={{ marginBottom: 10 }}>
                      <label style={filterLabel}>Segmento</label>
                      <select value={segmentoFilter} onChange={(e) => { setSegmentoFilter(e.target.value); setPage(1); }} style={filterSelect}>
                        <option value="">Todos</option>
                        {segs.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  );
                })()}
                {/* Responsable */}
                {(() => {
                  const hasField = ui.fields.some((f) => f.key === "responsable" || f.key === "asignado");
                  if (!hasField) return null;
                  const resps = Array.from(new Set(rows.map((r) => String(r.responsable || r.asignado || "")).filter(Boolean))).sort();
                  if (resps.length === 0) return null;
                  return (
                    <div style={{ marginBottom: 10 }}>
                      <label style={filterLabel}>Responsable</label>
                      <select value={responsableFilter} onChange={(e) => { setResponsableFilter(e.target.value); setPage(1); }} style={filterSelect}>
                        <option value="">Todos</option>
                        {resps.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                  );
                })()}
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 10, paddingTop: 10, borderTop: "1px solid #f1f5f9" }}>
                  <button type="button" onClick={() => { setEstadoFilter(""); setSegmentoFilter(""); setResponsableFilter(""); }} style={{ background: "transparent", border: "none", color: "#64748b", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                    Limpiar
                  </button>
                  <button type="button" onClick={() => setShowFilters(false)} style={{ background: accent, color: "#fff", border: "none", padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    Aplicar
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          {/* Columnas visibles */}
          <div style={{ position: "relative" }}>
            <button type="button" onClick={() => setShowColumns(!showColumns)} style={toolbarBtn}>
              <span>▦</span> Columnas <span style={{ fontSize: 9, marginLeft: 4 }}>▾</span>
            </button>
            {showColumns ? (
              <div style={popover(220)}>
                <div style={popoverHeader}>Mostrar columnas</div>
                {allColumns.map((c) => {
                  const visible = !hiddenCols.has(c.fieldKey);
                  return (
                    <button key={c.fieldKey} type="button" onClick={() => {
                      setHiddenCols((prev) => { const n = new Set(prev); if (visible) n.add(c.fieldKey); else n.delete(c.fieldKey); return n; });
                    }} style={popoverItemBtn}>
                      <input type="checkbox" checked={visible} readOnly style={{ pointerEvents: "none" }} />
                      <span>{c.label}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>

        {/* Chips de filtros activos */}
        {activeChips.length > 0 ? (
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
            {activeChips.map((c) => (
              <span key={c.key} style={chipStyle}>
                {c.label}
                <button type="button" onClick={c.onClear} style={chipClear} aria-label="Quitar filtro">×</button>
              </span>
            ))}
            <button type="button" onClick={() => { setEstadoFilter(""); setSegmentoFilter(""); setResponsableFilter(""); setQuery(""); }} style={{ background: "transparent", border: "none", color: accent, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              Limpiar filtros
            </button>
          </div>
        ) : null}

        {/* Mini-KPIs */}
        {rows.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 14 }}>
            {kpis.map((k, i) => <MiniKpi key={k.key} kpi={k} index={i} />)}
          </div>
        ) : null}

        {/* Bulk action bar — TEST-1.3 con acciones reales (no alerts). */}
        {selectedIds.size > 0 ? (
          <div style={{ display: "flex", gap: 12, alignItems: "center", padding: "10px 14px", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, marginBottom: 10, fontSize: 13 }}>
            <strong style={{ color: "#1e40af" }}>{selectedIds.size} seleccionados</strong>
            <span style={{ color: "#cbd5e1" }}>|</span>
            {ui.fields.some((f) => f.key === "responsable") ? (
              <button type="button" onClick={() => { setBulkValue(""); setBulkError(""); setBulkModal("responsable"); }} style={bulkBtn}>Asignar responsable</button>
            ) : null}
            {ui.fields.some((f) => f.key === "estado") ? (
              <button type="button" onClick={() => { setBulkValue(""); setBulkError(""); setBulkModal("estado"); }} style={bulkBtn}>Cambiar estado</button>
            ) : null}
            {/* TEST-2.11 — copy más claro. Antes "Archivar" no era obvio para usuario no técnico. */}
            <button type="button" onClick={() => setArchiveConfirmOpen(true)} style={bulkBtn} title="Elimina los registros seleccionados de la lista (operación irreversible)">Eliminar seleccionados</button>
            <div style={{ flex: 1 }} />
            <button type="button" onClick={() => setSelectedIds(new Set())} style={{ background: "transparent", border: "none", color: "#64748b", cursor: "pointer", fontSize: 16 }}>×</button>
          </div>
        ) : null}

        {/* Tabla */}
        <section style={{ border: "1px solid #e5e7eb", borderRadius: 12, background: "#ffffff", overflow: "hidden" }}>
          {busy ? (
            <div style={{ padding: 60, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>Cargando…</div>
          ) : pageRows.length === 0 ? (
            <div style={{ padding: 60, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
              {query || estadoFilter ? "Ningún resultado con los filtros actuales." : ui.emptyState + " Pulsa “+ Nuevo” para empezar."}
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e5e7eb" }}>
                    <th style={{ ...thStyle, width: 36 }}>
                      <input
                        type="checkbox"
                        checked={pageRows.length > 0 && selectedIds.size === pageRows.length}
                        onChange={toggleAllSelection}
                        style={{ cursor: "pointer" }}
                      />
                    </th>
                    {columns.map((col) => (
                      <th key={col.fieldKey} style={thStyle}>{col.label}</th>
                    ))}
                    <th style={{ ...thStyle, textAlign: "right", width: 64 }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((item) => {
                    const id = String(item.id || "");
                    const isChecked = selectedIds.has(id);
                    const isSelected = selected?.id === id;
                    return (
                      <tr
                        key={id}
                        onClick={() => {
                          // TEST-3.3 — un solo click abre Detalle Rápido tras un
                          // pequeño delay; si llega doble-click antes, se cancela
                          // y abre el editor en su lugar.
                          if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
                          clickTimerRef.current = setTimeout(() => { openDetail(item); clickTimerRef.current = null; }, 220);
                        }}
                        onDoubleClick={() => {
                          if (clickTimerRef.current) { clearTimeout(clickTimerRef.current); clickTimerRef.current = null; }
                          setSelected(item);
                          setModalMode("edit");
                        }}
                        title="Click: detalle rápido — Doble click: editar — Supr: eliminar"
                        style={{
                          borderBottom: "1px solid #f1f5f9",
                          cursor: "pointer",
                          background: isSelected ? "#eff6ff" : (isChecked ? "#f8fafc" : "transparent"),
                        }}
                        onMouseEnter={(e) => { if (!isSelected && !isChecked) e.currentTarget.style.background = "#f9fafb"; }}
                        onMouseLeave={(e) => { if (!isSelected && !isChecked) e.currentTarget.style.background = "transparent"; }}
                      >
                        <td style={{ ...tdStyle, width: 36 }} onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleRowSelection(id)}
                            style={{ cursor: "pointer" }}
                          />
                        </td>
                        {columns.map((col, idx) => {
                          let val = item[col.fieldKey];
                          // TEST-2.4 + TEST-3.2b-ii — columna "contacto":
                          // muestra el preferido del JSON con nombre arriba y
                          // email + teléfono debajo (subtexto gris).
                          if (col.fieldKey === "contacto" && item.contactosJson) {
                            try {
                              const arr = JSON.parse(String(item.contactosJson));
                              if (Array.isArray(arr) && arr.length > 0) {
                                const preferido = arr.find((c) => c?.preferido) || arr[0];
                                if (preferido) {
                                  const nombre = String(preferido.nombre || "").trim();
                                  const email = String(preferido.email || "").trim();
                                  const tel = String(preferido.telefono || "").trim();
                                  return (
                                    <td key={col.fieldKey} style={{ ...tdStyle, color: idx === 0 ? "#0f172a" : "#475569", fontWeight: idx === 0 ? 600 : 400 }}>
                                      <div style={{ lineHeight: 1.3 }}>
                                        <div style={{ color: "#0f172a", fontWeight: 600 }}>{nombre || "—"}</div>
                                        {(email || tel) && (
                                          <div style={{ fontSize: 11, color: "#64748b", marginTop: 2, display: "flex", flexWrap: "wrap", gap: 8 }}>
                                            {email && <span title={email}>✉ {email}</span>}
                                            {tel && <span title={tel}>☎ {tel}</span>}
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                  );
                                }
                              }
                            } catch { /* fallback al campo plano */ }
                          }
                          const valStr = val == null || val === "" ? "—" : String(val);
                          return (
                            <td key={col.fieldKey} style={{ ...tdStyle, color: idx === 0 ? "#0f172a" : "#475569", fontWeight: idx === 0 ? 600 : 400 }}>
                              {renderCell(col.fieldKey, valStr, idx === 0 ? item : null)}
                            </td>
                          );
                        })}
                        {/* TEST-2.12 — menú "..." consolidado con Editar / Email
                            / Llamar / Eliminar / Copiar. Antes solo abría editor. */}
                        <td style={{ ...tdStyle, textAlign: "right", whiteSpace: "nowrap", position: "relative" }} onClick={(e) => e.stopPropagation()}>
                          {extraRowActions ? extraRowActions(item) : null}
                          <button
                            type="button"
                            onClick={() => setRowMenuOpenId(rowMenuOpenId === id ? null : id)}
                            title="Acciones rápidas"
                            style={{ background: "transparent", border: "none", padding: 4, cursor: "pointer", color: "#94a3b8", fontSize: 16 }}
                          >
                            ⋯
                          </button>
                          {rowMenuOpenId === id ? (
                            <>
                              {/* backdrop para cerrar al hacer click fuera */}
                              <div onClick={() => setRowMenuOpenId(null)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
                              <div style={{ ...popover(180), zIndex: 41 }}>
                                <button type="button" style={popoverItemBtn} onClick={() => { setRowMenuOpenId(null); setSelected(item); setModalMode("edit"); }}>
                                  <span>✎</span><span>Editar</span>
                                </button>
                                {item.email ? (
                                  <a href={"mailto:" + item.email + "?subject=" + encodeURIComponent("Contacto desde " + ui.label)} style={popoverItem} onClick={() => setRowMenuOpenId(null)}>
                                    <span>✉️</span> Enviar email
                                  </a>
                                ) : null}
                                {item.telefono || item.tel ? (
                                  <a href={"tel:" + String(item.telefono || item.tel)} style={popoverItem} onClick={() => setRowMenuOpenId(null)}>
                                    <span>📞</span> Llamar
                                  </a>
                                ) : null}
                                <button type="button" style={popoverItemBtn} onClick={async () => {
                                  setRowMenuOpenId(null);
                                  // TEST-3.3 — "Copiar" (antes "Duplicar"): clona payload
                                  // sin id y abre create con valores precargados.
                                  const clone: Record<string, string> = {};
                                  for (const [k, v] of Object.entries(item)) {
                                    if (k === "id") continue;
                                    clone[k] = String(v ?? "");
                                  }
                                  setSelected(clone);
                                  setModalMode("create");
                                }}>
                                  <span>⎘</span><span>Copiar</span>
                                </button>
                                <button type="button" style={{ ...popoverItemBtn, color: "#dc2626" }} onClick={async () => {
                                  setRowMenuOpenId(null);
                                  if (confirm("¿Eliminar este " + singular(ui.label) + "?")) await removeRecord(id);
                                }}>
                                  <span>🗑</span><span>Eliminar</span>
                                </button>
                              </div>
                            </>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Paginación */}
          {pageRows.length > 0 ? (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderTop: "1px solid #f1f5f9", fontSize: 12, color: "#64748b", flexWrap: "wrap", gap: 8 }}>
              <div>{pageStart + 1}-{Math.min(pageStart + pageSize, filtered.length)} de {filtered.length}</div>
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                <button type="button" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} style={pagerBtn(page === 1)}>‹</button>
                {pagerRange(page, totalPages).map((p, i) => p === "…" ? (
                  <span key={i} style={{ padding: "4px 6px", color: "#94a3b8" }}>…</span>
                ) : (
                  <button key={i} type="button" onClick={() => setPage(p as number)} style={{ ...pagerBtn(false), background: p === page ? "#eff6ff" : "transparent", color: p === page ? accent : "#475569", fontWeight: p === page ? 700 : 500 }}>{p}</button>
                ))}
                <button type="button" onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} style={pagerBtn(page === totalPages)}>›</button>
              </div>
              <div>
                <select value={pageSize} onChange={(e) => { setPageSize(parseInt(e.target.value, 10)); setPage(1); }} style={{ ...toolbarBtn, padding: "4px 22px 4px 8px", fontSize: 12 }}>
                  {PAGE_SIZES.map((n) => <option key={n} value={n}>{n} por página</option>)}
                </select>
              </div>
            </div>
          ) : null}
        </section>

        {error ? (
          <div style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", borderRadius: 8, padding: 12, fontSize: 13, marginTop: 12 }}>{error}</div>
        ) : null}
      </div>

      {/* Drawer de detalle rápido (TEST-3.3: solo info, sin botones de acción) */}
      {detailOpen && selected ? (
        <>
          <div onClick={() => setDetailOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.35)", zIndex: 90 }} />
          <aside style={{
            position: "fixed", top: 0, right: 0, width: "min(420px, 92%)", height: "100vh",
            background: "#ffffff", borderLeft: "1px solid #e5e7eb", boxShadow: "-12px 0 30px rgba(0,0,0,0.12)",
            zIndex: 100, overflowY: "auto",
          }}>
            <DetailDrawer
              accent={accent}
              moduleKey={moduleKey}
              moduleLabel={ui.label}
              record={selected}
              fields={ui.fields}
              titleField={titleField}
              onClose={() => setDetailOpen(false)}
            />
          </aside>
        </>
      ) : null}

      {/* TEST-1.3 — modal bulk: asignar responsable o cambiar estado */}
      {bulkModal ? (
        <>
          <div onClick={() => !bulkBusy && setBulkModal(null)} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", zIndex: 140 }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", background: "#fff", borderRadius: 12, padding: 24, width: "min(460px, 92%)", zIndex: 141, boxShadow: "0 30px 80px rgba(0,0,0,0.3)" }}>
            <h2 style={{ margin: "0 0 8px 0", fontSize: 18, fontWeight: 800 }}>
              {bulkModal === "responsable" ? "Asignar responsable" : "Cambiar estado"}
            </h2>
            <p style={{ margin: "0 0 16px 0", fontSize: 13, color: "#64748b" }}>
              Se aplicará a <strong>{selectedIds.size}</strong> registro{selectedIds.size === 1 ? "" : "s"}.
            </p>
            {bulkModal === "estado" ? (
              <select
                value={bulkValue}
                onChange={(e) => setBulkValue(e.target.value)}
                style={{ width: "100%", padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14, marginBottom: 14, boxSizing: "border-box" }}
              >
                <option value="">— elegir estado —</option>
                {(() => {
                  const seen = new Set<string>();
                  for (const r of rows) {
                    const v = String(r.estado || "").trim();
                    if (v) seen.add(v);
                  }
                  return Array.from(seen).sort().map((v) => (
                    <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>
                  ));
                })()}
              </select>
            ) : (
              <input
                type="text"
                value={bulkValue}
                onChange={(e) => setBulkValue(e.target.value)}
                placeholder="Nombre del responsable"
                autoFocus
                style={{ width: "100%", padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14, marginBottom: 14, boxSizing: "border-box" }}
              />
            )}
            {bulkError ? <div style={{ color: "#dc2626", fontSize: 12, marginBottom: 12 }}>{bulkError}</div> : null}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" disabled={bulkBusy} onClick={() => setBulkModal(null)} style={{ padding: "9px 14px", border: "1px solid #d1d5db", background: "transparent", borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: bulkBusy ? "not-allowed" : "pointer" }}>Cancelar</button>
              <button
                type="button"
                disabled={bulkBusy || !bulkValue.trim()}
                onClick={async () => {
                  setBulkBusy(true);
                  setBulkError("");
                  try {
                    await bulkUpdate(bulkModal === "responsable" ? "responsable" : "estado", bulkValue.trim());
                    setBulkModal(null);
                    setSelectedIds(new Set());
                  } catch (err) {
                    setBulkError(err instanceof Error ? err.message : "Error aplicando cambios.");
                  } finally {
                    setBulkBusy(false);
                  }
                }}
                style={{ padding: "9px 14px", border: "none", background: bulkValue.trim() && !bulkBusy ? accent : "#cbd5e1", color: "#fff", borderRadius: 6, fontSize: 14, fontWeight: 700, cursor: bulkValue.trim() && !bulkBusy ? "pointer" : "not-allowed" }}
              >
                {bulkBusy ? "Aplicando…" : "Aplicar a " + selectedIds.size}
              </button>
            </div>
          </div>
        </>
      ) : null}

      {/* TEST-1.3 — Archivar en bloque con DangerConfirm en vez de confirm() */}
      <DangerConfirm
        open={archiveConfirmOpen}
        onClose={() => setArchiveConfirmOpen(false)}
        onConfirm={async () => {
          for (const id of Array.from(selectedIds)) {
            await removeRecord(id);
          }
          setSelectedIds(new Set());
        }}
        title={"Archivar " + selectedIds.size + " registro" + (selectedIds.size === 1 ? "" : "s")}
        description="Los registros se eliminarán. Esta acción no se puede deshacer."
        mustType="ARCHIVAR"
        confirmLabel={"Archivar " + selectedIds.size}
      />

      {/* TEST-3.3 — Eliminar via tecla Supr (sobre selección o sobre la
          fila del drawer abierto). Confirmación obligatoria escribiendo
          ELIMINAR. */}
      <DangerConfirm
        open={deleteSuprOpen}
        onClose={() => setDeleteSuprOpen(false)}
        onConfirm={async () => {
          const ids = selectedIds.size > 0
            ? Array.from(selectedIds)
            : (selected?.id ? [String(selected.id)] : []);
          for (const id of ids) {
            await removeRecord(id);
          }
          setSelectedIds(new Set());
          setDetailOpen(false);
        }}
        title={(() => {
          const n = selectedIds.size > 0 ? selectedIds.size : (selected?.id ? 1 : 0);
          return "Eliminar " + n + " registro" + (n === 1 ? "" : "s");
        })()}
        description="Los registros se eliminarán. Esta acción no se puede deshacer."
        mustType="ELIMINAR"
        confirmLabel="Eliminar definitivamente"
      />

    </TenantShell>
  );
}

// === Render por tipo de campo ===
function renderCell(fieldKey: string, val: string, primaryRow: Record<string, string> | null) {
  // Estado / segmento → pill de color
  if (fieldKey === "estado" || fieldKey === "fase" || fieldKey === "tipo" || fieldKey === "segmento" || fieldKey === "modalidad" || fieldKey === "severidad" || fieldKey === "urgencia" || fieldKey === "prioridad") {
    if (val === "—") return <span style={{ color: "#94a3b8" }}>—</span>;
    const t = estadoTone(val);
    return <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 999, background: t.bg, color: t.fg, fontSize: 11, fontWeight: 700 }}>{val}</span>;
  }
  // Money
  if (isMoneyField(fieldKey)) {
    const m = fmtMoneda(val);
    return <span style={{ color: m.tone === "bad" ? "#dc2626" : m.tone === "good" ? "#15803d" : "#475569", fontWeight: 600 }}>{m.text}</span>;
  }
  // Fecha
  if (isDateField(fieldKey)) {
    return <span>{fmtFecha(val)}</span>;
  }
  // Primer campo + email/teléfono → avatar
  if (primaryRow) {
    const tint = avatarTint(val);
    const initial = (val.charAt(0) || "?").toUpperCase();
    const email = String(primaryRow.email || "");
    const tel = String(primaryRow.telefono || primaryRow.tel || "");
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <span style={{ width: 30, height: 30, borderRadius: 999, background: tint.bg, color: tint.fg, display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12, flexShrink: 0 }}>{initial}</span>
        <span style={{ minWidth: 0 }}>
          <span style={{ display: "block", color: "#0f172a", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{val}</span>
          {email || tel ? <span style={{ display: "block", color: "#94a3b8", fontSize: 11 }}>{email || tel}</span> : null}
        </span>
      </span>
    );
  }
  return <span>{val}</span>;
}

// === Singular del label (Clientes → cliente) ===
// TEST-1.2 — overrides para palabras castellanas comunes. Fallback "quitar s"
// solo si no hay override. Antes "Clientes" → "client" porque slice(-2) en "es".
const SINGULAR_OVERRIDES: Record<string, string> = {
  clientes: "cliente",
  oportunidades: "oportunidad",
  proyectos: "proyecto",
  propuestas: "propuesta",
  presupuestos: "presupuesto",
  facturas: "factura",
  documentos: "documento",
  entregables: "entregable",
  tareas: "tarea",
  tickets: "ticket",
  compras: "compra",
  productos: "producto",
  reservas: "reserva",
  encuestas: "encuesta",
  etiquetas: "etiqueta",
  plantillas: "plantilla",
  empleados: "empleado",
  gastos: "gasto",
  vencimientos: "vencimiento",
  desplazamientos: "desplazamiento",
  hitos: "hito",
  aplicaciones: "aplicación",
  notificaciones: "notificación",
  pacientes: "paciente",
  citas: "cita",
  tratamientos: "tratamiento",
  alumnos: "alumno",
  docentes: "docente",
  calificaciones: "calificación",
};
function singular(label: string): string {
  const l = label.toLowerCase().trim();
  if (SINGULAR_OVERRIDES[l]) return SINGULAR_OVERRIDES[l];
  if (l.endsWith("s") && l.length > 2) return l.slice(0, -1);
  return l;
}

// === Pager helper ===
function pagerRange(current: number, total: number): Array<number | "…"> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: Array<number | "…"> = [1];
  if (current > 3) out.push("…");
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) out.push(p);
  if (current < total - 2) out.push("…");
  out.push(total);
  return out;
}

// === Mini KPI card ===
const KPI_TINTS: Record<string, { bg: string; fg: string; icon: string }> = {
  total: { bg: "#dbeafe", fg: "#1d4ed8", icon: "👥" },
  good: { bg: "#dcfce7", fg: "#15803d", icon: "✓" },
  bad: { bg: "#fee2e2", fg: "#dc2626", icon: "⊘" },
  warn: { bg: "#fef3c7", fg: "#a16207", icon: "⏱" },
  vip: { bg: "#ede9fe", fg: "#6d28d9", icon: "★" },
  neutral: { bg: "#f1f5f9", fg: "#64748b", icon: "●" },
};
function MiniKpi({ kpi, index }: { kpi: { key: string; label: string; value: number; pct: string; tone: string }; index: number }) {
  const tint = kpi.key === "total" ? KPI_TINTS.total : (KPI_TINTS[kpi.tone] || KPI_TINTS.neutral);
  // Override tono especial saldo si key contiene "saldo"
  const finalTint = kpi.key.toLowerCase().includes("saldo") ? { bg: "#ffedd5", fg: "#c2410c", icon: "€" } : tint;
  void index;
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", padding: 14, background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 12 }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: finalTint.bg, color: finalTint.fg, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, flexShrink: 0 }}>{finalTint.icon}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, color: "#64748b", marginBottom: 2 }}>{kpi.label}</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", lineHeight: 1.1 }}>{kpi.value.toLocaleString("es-ES")}</div>
        <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>{kpi.pct}</div>
      </div>
    </div>
  );
}

// === Drawer detalle rápido ===
// TEST-3.3 — Solo información. Las acciones (Editar / Eliminar / Email /
// Llamar / Copiar) ya viven en el botón "⋯" de la fila. Aquí solo se
// muestra el contenido relevante en modo lectura.
function DetailDrawer({
  accent, moduleKey, moduleLabel, record, fields, titleField, onClose,
}: {
  accent: string;
  moduleKey: string;
  moduleLabel: string;
  record: Record<string, string>;
  fields: FieldDef[];
  titleField: string;
  onClose: () => void;
}) {
  const titulo = String(record[titleField] || "Sin título");
  const tint = avatarTint(titulo);
  const estado = String(record.estado || "");
  const segmento = String(record.tipo || record.segmento || "");
  const email = String(record.email || "");
  const tel = String(record.telefono || record.tel || "");
  const ciudad = String(record.ciudad || record.localidad || record.lugar || "");
  const responsable = String(record.responsable || record.asignado || "");
  const ultimaVisita = String(record.ultimaVisita || record.ultimaActividad || record.updatedAt || "");
  const desde = String(record.fechaAlta || record.fechaInicio || record.createdAt || "");
  const ventas = record.ventasTotales || record.importeTotal || "";
  const saldo = record.saldoPendiente || record.saldo || "";

  // Campos secundarios para "Información adicional" — los que no salgan como pills/contacto.
  const usados = new Set([titleField, "estado", "tipo", "segmento", "email", "telefono", "tel", "ciudad", "localidad", "lugar", "responsable", "asignado", "ultimaVisita", "ultimaActividad", "fechaAlta", "fechaInicio", "createdAt", "updatedAt", "ventasTotales", "importeTotal", "saldoPendiente", "saldo", "id"]);
  const extras = fields.filter((f) => !usados.has(f.key) && record[f.key]);

  return (
    <div style={{ padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>Detalle rápido</div>
        <button type="button" onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 20, color: "#94a3b8" }}>×</button>
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
        <span style={{ width: 50, height: 50, borderRadius: 999, background: tint.bg, color: tint.fg, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 700 }}>
          {(titulo.charAt(0) || "?").toUpperCase()}
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{titulo}</div>
          <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
            {segmento ? <SmallPill value={segmento} /> : null}
            {estado ? <SmallPill value={estado} /> : null}
          </div>
        </div>
      </div>

      {/* Información de contacto */}
      {(email || tel || ciudad) ? (
        <DrawerSection title="Información de contacto">
          {tel ? <DrawerRow icon="📞" label={tel} /> : null}
          {email ? <DrawerRow icon="✉️" label={email} /> : null}
          {ciudad ? <DrawerRow icon="📍" label={ciudad} /> : null}
        </DrawerSection>
      ) : null}

      {/* Información adicional */}
      {(responsable || ultimaVisita || desde || ventas || saldo || extras.length > 0) ? (
        <DrawerSection title="Información adicional">
          {responsable ? <DrawerKv label="Responsable" value={responsable} /> : null}
          {ultimaVisita ? <DrawerKv label="Última actualización" value={fmtFecha(ultimaVisita)} /> : null}
          {desde ? <DrawerKv label="Cliente desde" value={fmtFecha(desde)} /> : null}
          {ventas ? <DrawerKv label="Ventas totales" value={fmtMoneda(ventas).text} /> : null}
          {saldo ? <DrawerKv label="Saldo pendiente" value={fmtMoneda(saldo).text} valueColor={fmtMoneda(saldo).tone === "bad" ? "#dc2626" : undefined} /> : null}
          {extras.slice(0, 6).map((f) => <DrawerKv key={f.key} label={f.label} value={String(record[f.key] || "—")} />)}
        </DrawerSection>
      ) : null}

      {/* TEST-3.3 — sin sección de "Acciones rápidas". Las acciones
          (Editar / Email / Llamar / Copiar / Eliminar) están en el
          botón "⋯" de la fila. Doble-click sobre la fila edita. */}
      <div style={{ marginTop: 18, padding: 10, borderRadius: 8, background: "#f8fafc", color: "#64748b", fontSize: 12, lineHeight: 1.5 }}>
        Esto es el <strong>detalle rápido</strong> (solo lectura).<br />
        Para <strong>editar</strong>: haz <em>doble click</em> sobre la fila o usa el botón <em>⋯</em> de la línea.
      </div>
    </div>
  );
}

function DrawerSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>{title}</div>
      <div style={{ display: "grid", gap: 6 }}>{children}</div>
    </div>
  );
}
function DrawerRow({ icon, label }: { icon: string; label: string }) {
  return <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "#0f172a" }}><span style={{ color: "#94a3b8" }}>{icon}</span><span>{label}</span></div>;
}
function DrawerKv({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12, padding: "4px 0", borderBottom: "1px dashed #f1f5f9" }}>
      <span style={{ color: "#64748b" }}>{label}</span>
      <span style={{ color: valueColor || "#0f172a", fontWeight: 600, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>{value}</span>
    </div>
  );
}
function SmallPill({ value }: { value: string }) {
  const t = estadoTone(value);
  return <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 999, background: t.bg, color: t.fg, fontSize: 10, fontWeight: 700 }}>{value}</span>;
}

// Wrappers para los botones legacy de import/export con look unificado
function ImportWrapper({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "inline-block" }} className="prontara-toolbar-action">{children}</div>;
}
function ExportWrapper({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "inline-block" }} className="prontara-toolbar-action">{children}</div>;
}

// === Estilos compartidos ===
function primaryBtn(accent: string): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: "9px 16px", border: "none", borderRadius: 10,
    background: accent, color: "#ffffff",
    fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
  };
}
const secondaryBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6,
  padding: "9px 14px", border: "1px solid #e2e8f0", borderRadius: 10,
  background: "#ffffff", color: "#334155",
  fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
};
const toolbarBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6,
  padding: "8px 14px", border: "1px solid #e2e8f0", borderRadius: 10,
  background: "#ffffff", color: "#475569",
  fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
};
const bulkBtn: React.CSSProperties = {
  background: "#ffffff", border: "1px solid #bfdbfe", borderRadius: 8,
  padding: "5px 12px", fontSize: 12, fontWeight: 600, color: "#1e40af", cursor: "pointer",
};
const chipStyle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6,
  padding: "3px 4px 3px 12px", borderRadius: 999,
  background: "#f1f5f9", fontSize: 12, fontWeight: 600, color: "#334155",
};
const chipClear: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  width: 18, height: 18, borderRadius: 999, background: "transparent",
  border: "none", cursor: "pointer", color: "#64748b", fontSize: 14,
};
function popover(width: number): React.CSSProperties {
  return {
    position: "absolute", top: "calc(100% + 6px)", right: 0, minWidth: width,
    background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 10,
    boxShadow: "0 10px 30px rgba(15,23,42,0.12)", zIndex: 50, padding: 6,
  };
}
const popoverHeader: React.CSSProperties = {
  padding: "6px 10px 8px", fontSize: 11, fontWeight: 700, color: "#64748b",
  textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "1px solid #f1f5f9", marginBottom: 4,
};
const popoverItem: React.CSSProperties = {
  display: "block", padding: "8px 10px", fontSize: 13, color: "#0f172a",
  textDecoration: "none", borderRadius: 6,
};
const popoverItemBtn: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 8, width: "100%",
  padding: "8px 10px", fontSize: 13, color: "#0f172a",
  background: "transparent", border: "none", borderRadius: 6, cursor: "pointer", textAlign: "left",
};
const popoverCount: React.CSSProperties = {
  background: "#f1f5f9", color: "#475569", fontSize: 11, fontWeight: 700,
  padding: "1px 8px", borderRadius: 999,
};
const filterLabel: React.CSSProperties = {
  display: "block", fontSize: 11, fontWeight: 700, color: "#64748b",
  textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4,
};
const filterSelect: React.CSSProperties = {
  width: "100%", padding: "6px 10px", border: "1px solid #e2e8f0",
  borderRadius: 6, fontSize: 13, color: "#0f172a", background: "#fff",
  boxSizing: "border-box",
};
const thStyle: React.CSSProperties = {
  textAlign: "left", padding: "12px 14px",
  fontWeight: 600, fontSize: 11, color: "#64748b",
  textTransform: "uppercase", letterSpacing: 0.4, whiteSpace: "nowrap",
};
const tdStyle: React.CSSProperties = {
  padding: "10px 14px", verticalAlign: "middle",
};
function pagerBtn(disabled: boolean): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    minWidth: 28, height: 28, padding: "0 8px", borderRadius: 6,
    background: "transparent", border: "none",
    color: disabled ? "#cbd5e1" : "#475569",
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 13, fontWeight: 600,
  };
}
const drawerActionLink: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 8,
  padding: "9px 12px", border: "1px solid #e5e7eb", borderRadius: 8,
  background: "#ffffff", color: "#0f172a",
  fontSize: 13, fontWeight: 600, textDecoration: "none", cursor: "pointer", textAlign: "left",
};
function drawerActionBtn(accent: string): React.CSSProperties {
  return {
    display: "flex", alignItems: "center", gap: 8,
    padding: "9px 12px", border: "1px solid " + accent, borderRadius: 8,
    background: accent, color: "#ffffff",
    fontSize: 13, fontWeight: 700, cursor: "pointer", textAlign: "left",
  };
}
