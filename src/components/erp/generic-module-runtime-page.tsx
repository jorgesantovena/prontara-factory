"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ErpRecordEditor from "@/components/erp/erp-record-editor";
import TenantShell from "@/components/erp/tenant-shell";
import ModuleExportButton from "@/components/erp/module-export-button";
import ModuleImportButton from "@/components/erp/module-import-button";
import { useCurrentVertical } from "@/lib/saas/use-current-vertical";
import DangerConfirm from "@/components/erp/danger-confirm";
// TEST-16 — singular() centralizado; ver src/lib/text/singular.ts.
import { singular } from "@/lib/text/singular";

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
  // TEST-10.2/10.9 — opciones de los campos status (vienen del pack/core).
  options?: Array<{ value: string; label: string }>;
  // TEST-11/13 — flags del rediseño Parte de horas + defaults de Proyectos.
  readOnly?: boolean;
  inheritFrom?: { from: string; field: string };
  computed?:
    | { type: "duration"; from: string; to: string }
    | { type: "derived"; from: string; map?: Record<string, string>; default?: string };
  visibleWhen?: { field: string; equals: string | string[] };
  requiredWhen?: { field: string; equals: string | string[] };
  defaultValue?: string;
};

type TableColumnDef = {
  fieldKey: string;
  label: string;
  isPrimary?: boolean;
};

// TEST-17 bis 2 C — La vista guardada ahora persiste además de los
// filtros y la búsqueda, los filtros adicionales del Parte de horas
// (segmento, responsable, empleado, cliente search, proyecto search,
// fechaDesde, fechaHasta, fechaLimiteMax) y la lista de columnas
// ocultas (hiddenCols). Al aplicar la vista todo se restaura.
type SavedView = {
  id: string;
  name: string;
  configJson: {
    filters?: Record<string, string | string[]>;
    query?: string;
    hiddenCols?: string[];
    segmento?: string[];
    responsable?: string[];
    empleado?: string[];
    clienteSearch?: string;
    proyectoSearch?: string;
    fechaDesde?: string;
    fechaHasta?: string;
    fechaLimiteMax?: string;
  };
  esDefault?: boolean;
};

function readTenant() {
  if (typeof window === "undefined") return "";
  return String(new URLSearchParams(window.location.search).get("tenant") || "").trim();
}
function readSectorPack() {
  if (typeof window === "undefined") return "";
  return String(new URLSearchParams(window.location.search).get("sectorPack") || "").trim();
}

// TEST-14 C — `MODULE_SUBTITLE` eliminado: el subtítulo descriptivo bajo
// el H1 era redundante con el título y el menú principal. La cabecera
// compactada ya no lo muestra.

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

// TEST-11 — Compat backward del Parte de horas (actividades). El formulario
// nuevo guarda `empleado`/`tiempoHoras` (hh:mm)/`actividad`; muchos lectores
// backend (bolsa-saldo, billing-preview, prefacturacion, daily-activity)
// siguen leyendo `persona`/`horas` (decimal)/`tipoTrabajo`. Espejamos los
// valores nuevos a las claves legacy antes de persistir. Se usa tanto en
// saveRecord (formulario) como en bulkUpdate.
function applyActivitiesLegacyShim(payload: Record<string, string>): Record<string, string> {
  const next: Record<string, string> = { ...payload };
  if (next.empleado && !next.persona) next.persona = next.empleado;
  if (next.tiempoHoras && !next.horas) {
    // TEST-12 #1 — `tiempoHoras` ahora es decimal con coma ("1,50").
    // Si nos llega ese formato lo pasamos a punto y a `horas` directo.
    // También toleramos el legacy "hh:mm" que pudieran traer importaciones.
    const raw = String(next.tiempoHoras).trim();
    let decimal = 0;
    if (raw.includes(":")) {
      const [hh = "0", mm = "0"] = raw.split(":");
      decimal = parseInt(hh, 10) + parseInt(mm, 10) / 60;
    } else {
      decimal = parseFloat(raw.replace(",", "."));
    }
    if (Number.isFinite(decimal) && decimal > 0) {
      next.horas = decimal.toFixed(2);
    }
  }
  if (next.actividad && !next.tipoTrabajo) next.tipoTrabajo = next.actividad;
  return next;
}

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
  // Test 18 bis 3 — Cache de labels por (moduleKey relacionado → id → label).
  // Se usa en el listado para resolver el value crudo de una columna
  // tipo `relation` (id) al label legible (concepto, nombre, etc.).
  // Antes la lista mostraba "Tarea vinculada: 9f2a-…" en Gastos y
  // Desplazamientos porque no había mapping.
  const [columnRelationLabels, setColumnRelationLabels] = useState<Record<string, Record<string, string>>>({});
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Record<string, string> | null>(null);
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [accent, setAccent] = useState("#1d4ed8");
  // H12-F + TEST-8bis2 — Filtros multi-select. Cada filtro es ahora un Set
  // de valores aceptados (en minúscula para comparación case-insensitive).
  // Set vacío = sin filtro (todos pasan). Selección múltiple permite
  // combinaciones como "Aceptado + Enviado" o "todos excepto Rechazado".
  const [estadoFilter, setEstadoFilter] = useState<Set<string>>(new Set());
  const [segmentoFilter, setSegmentoFilter] = useState<Set<string>>(new Set());
  const [responsableFilter, setResponsableFilter] = useState<Set<string>>(new Set());
  // TEST-10.2.b — Filtro por fecha límite: oculta los registros cuya
  // fechaLimite sea posterior a la fecha indicada (vacío = sin filtro).
  const [fechaLimiteMax, setFechaLimiteMax] = useState("");
  // TEST-11 — Filtros pedidos por Pedro en Parte de horas. Aparecen solo si
  // el módulo tiene los campos correspondientes:
  //   - clienteQuery / proyectoQuery: búsqueda textual sobre los campos
  //     `cliente` y `proyecto` (relación → guarda nombre o id).
  //   - fechaMin / fechaMax: rango sobre el campo `fecha`.
  // El filtro Empleado reutiliza `responsableFilter` resolviendo el campo
  // a `empleado`/`asignado`/`responsable` según exista (helper personaField).
  const [clienteQuery, setClienteQuery] = useState("");
  const [proyectoQuery, setProyectoQuery] = useState("");
  const [fechaMin, setFechaMin] = useState("");
  const [fechaMax, setFechaMax] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [showViews, setShowViews] = useState(false);
  const [showColumns, setShowColumns] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set());
  // TEST-10.11 — Selección de columnas con draft + "Aplicar". El usuario
  // marca/desmarca en `draftHiddenCols` y solo al pulsar "Aplicar" se
  // sincroniza a `hiddenCols` y se persiste en localStorage por tenant+módulo
  // para que la elección se conserve al volver al módulo o navegar a otro
  // del mismo vertical.
  const [draftHiddenCols, setDraftHiddenCols] = useState<Set<string>>(new Set());
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
  // TEST-5.G.1 — Posición calculada con getBoundingClientRect porque la
  // tabla vive dentro de un contenedor con overflow:hidden que recortaba el
  // popover (absolute) cuando había pocas filas. Lo dibujamos como `fixed`.
  const [rowMenuOpenId, setRowMenuOpenId] = useState<string | null>(null);
  const [rowMenuPos, setRowMenuPos] = useState<{ top: number; right: number } | null>(null);
  // TEST-3.3 — confirm de eliminación (vía tecla Supr o bulk Supr).
  const [deleteSuprOpen, setDeleteSuprOpen] = useState(false);
  // TEST-4.1.b — detección manual de doble-click usando timestamp del último
  // click. Más fiable que onDoubleClick + setTimeout (que dejaba pasar el
  // primer doble-click). Threshold 320ms.
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Test 19 bis H — timestamp del último click para detección robusta de
  // doble-click. La versión anterior (setTimeout + onDoubleClick nativo)
  // fallaba la PRIMERA vez: el primer doble-click abría el detalle rápido
  // en vez de editar. Ahora detectamos el doble-click por diferencia de
  // tiempo entre dos clicks (sin depender del evento nativo).
  const lastClickRef = useRef<number>(0);
  // TEST-10.10 — registro pendiente de borrado individual (diálogo propio).
  const [rowDeleteRec, setRowDeleteRec] = useState<Record<string, string> | null>(null);
  // TEST-5.W — Workflow comercial encadenado. Cuando una oportunidad pasa a
  // "Ganado" se inicia: oportunidad → cliente → propuesta. El siguiente paso
  // del wizard se transporta vía query string `wf_next` y se persiste en este
  // state durante toda la sesión del módulo.
  const router = useRouter();
  const [workflowNext, setWorkflowNext] = useState<string | null>(null);
  // TEST-8bis.1.b — control fino del editor en el encadenado oportunidad→contacto.
  const [editorInitialTab, setEditorInitialTab] = useState<string | null>(null);
  const [editorAutoContact, setEditorAutoContact] = useState(false);
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

  // Test 18 bis 3 — Cargar las options de cada columna de tipo `relation`
  // para poder resolver el value crudo (id) al label legible (concepto,
  // nombre, etc.) en `labelForValue`. Se ejecuta cuando llegan los fields
  // del módulo. Las options se almacenan por moduleKey relacionado para
  // que columnas distintas con la misma relación compartan cache.
  useEffect(() => {
    if (!ui.fields.length) return;
    const relModules = Array.from(new Set(
      ui.fields
        .filter((f) => f.kind === "relation" && f.relationModuleKey)
        .map((f) => f.relationModuleKey as string)
    ));
    if (relModules.length === 0) return;
    let cancelled = false;
    (async () => {
      for (const mk of relModules) {
        if (columnRelationLabels[mk]) continue; // ya cargado
        try {
          const tenant = readTenant();
          const url = "/api/erp/options?module=" + encodeURIComponent(mk) + (tenant ? "&tenant=" + encodeURIComponent(tenant) : "");
          const r = await fetch(url, { cache: "no-store" });
          const d = await r.json();
          if (cancelled || !r.ok || !d.ok || !Array.isArray(d.options)) continue;
          const map: Record<string, string> = {};
          for (const o of d.options as Array<{ value: string; label: string }>) {
            map[String(o.value)] = String(o.label || o.value);
          }
          setColumnRelationLabels((prev) => ({ ...prev, [mk]: map }));
        } catch { /* tolerar */ }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ui.fields]);

  // TEST-13 D — Restaurar el foco del editor al volver a la solapa.
  // Cuando el usuario abandona la solapa con el formulario abierto y
  // vuelve más tarde, Next.js re-monta la página y la vista vuelve al
  // listado. Aquí leemos de sessionStorage el modo (create|edit) y el
  // id del registro que estaba editando, y re-abrimos el editor con
  // ese mismo estado. El draft (los valores) lo restaura el propio
  // ErpRecordEditor desde su clave `prontara-draft:<modulo>:<id|new>`.
  function editorStateKey(): string {
    return "prontara-editor-mode:" + (readTenant() || "default") + ":" + moduleKey;
  }
  // Se ejecuta una sola vez por moduleKey al montar. Inmediatamente abre
  // el editor con `selected` placeholder (id si era edit); luego, cuando
  // `rows` cargue, otro effect enriquece `selected` con el row real.
  const editorRestoredRef = useRef(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    editorRestoredRef.current = false;
    try {
      const raw = window.sessionStorage.getItem(editorStateKey());
      if (!raw) return;
      const parsed = JSON.parse(raw) as { mode?: "create" | "edit"; id?: string };
      if (!parsed?.mode) return;
      if (parsed.mode === "edit" && parsed.id) {
        setSelected({ id: String(parsed.id) });
        setModalMode("edit");
      } else if (parsed.mode === "create") {
        setSelected(null);
        setModalMode("create");
      }
    } catch { /* sessionStorage corrupto: ignorar */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleKey]);

  // Cuando llegan los `rows`, si el editor está abierto en modo edit
  // con `selected` siendo un placeholder (solo id), buscamos el row
  // completo y enriquecemos selected. Una sola vez por restauración.
  useEffect(() => {
    if (editorRestoredRef.current) return;
    if (modalMode !== "edit") return;
    if (!selected?.id) return;
    if (rows.length === 0) return;
    const full = rows.find((r) => String(r.id || "") === String(selected.id));
    if (full) {
      setSelected(full);
      editorRestoredRef.current = true;
    }
  }, [rows, modalMode, selected]);

  // Sincronizar el estado del editor con sessionStorage. Al abrir, se
  // guarda; al cerrar (modalMode = null), se borra. Si se cierra el
  // editor, también se borra el draft del propio ErpRecordEditor.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (modalMode === null) {
        window.sessionStorage.removeItem(editorStateKey());
      } else {
        const payload = { mode: modalMode, id: modalMode === "edit" ? String(selected?.id || "") : "" };
        window.sessionStorage.setItem(editorStateKey(), JSON.stringify(payload));
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalMode, selected?.id, moduleKey]);

  // TEST-3.8 — Pre-carga vía query string `?prefill_<campo>=<valor>`. Si
  // existe al menos un parámetro `prefill_*`, abrimos el editor en modo
  // "create" con esos valores ya rellenos. Útil para flujos como
  // "Nuevo proyecto desde la ficha de Cliente" (prefill_cliente=<id>).
  // TEST-5.W — También capturamos `wf_next` para el workflow comercial.
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
    const wfNext = params.get("wf_next");
    if (wfNext) setWorkflowNext(wfNext);
    // TEST-6.3.a — `?action=new` también abre el editor en modo create
    // (sin prefill). Lo emite EmptyState ("Imputar horas", "Crear cliente"...).
    const actionNew = params.get("action") === "new";
    if ((hasAny || actionNew) && modalMode === null) {
      setSelected(hasAny ? prefill : null);
      setModalMode("create");
    }
    // Limpiamos los prefill_* / wf_next / action de la URL para no re-disparar al refrescar.
    const cleaned = new URLSearchParams(window.location.search);
    let touched = false;
    for (const k of Array.from(cleaned.keys())) {
      if (k.startsWith("prefill_") || k === "wf_next" || k === "action") {
        cleaned.delete(k);
        touched = true;
      }
    }
    if (touched) {
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

  // TEST-9.1 / TEST-16 bis — Navegacion cruzada:
  //   ?ver=<numero|id>  → abre el detalle rapido (drawer lateral).
  //   ?edit=<numero|id> → abre directamente el editor en modo EDIT
  //                       (Pedro pide que el botón Abrir de la sublista
  //                       de Proyectos del Cliente lleve a la ficha de
  //                       edición, no al detalle rápido).
  const verHandledRef = useRef(false);
  useEffect(() => {
    if (verHandledRef.current) return;
    if (typeof window === "undefined") return;
    if (busy) return;
    const params = new URLSearchParams(window.location.search);
    const edit = params.get("edit");
    const ver = params.get("ver");
    if (!ver && !edit) { verHandledRef.current = true; return; }
    verHandledRef.current = true;
    const target = rows.find((r) => {
      const ref = edit || ver || "";
      return String(r.numero || "") === ref || String(r.id || "") === ref;
    });
    if (target) {
      setSelected(target);
      if (edit) {
        setModalMode("edit");
      } else {
        setDetailOpen(true);
      }
    }
    const cleaned = new URLSearchParams(window.location.search);
    cleaned.delete("ver");
    cleaned.delete("edit");
    const newSearch = cleaned.toString();
    window.history.replaceState(
      {},
      "",
      window.location.pathname + (newSearch ? "?" + newSearch : ""),
    );
  }, [busy, rows]);

  // Filtrado: query + estadoFilter + segmento + responsable (TEST-1.6).
  // TEST-5.1.a — La búsqueda antes hacía `Object.values(item).join(" ").includes(q)`,
  // lo cual buscaba en TODOS los campos del registro (incluido contactosJson
  // crudo, id, notas, etc.) y producía falsos positivos. Ahora restringimos
  // la búsqueda a los campos visibles + el contacto preferido (en clientes).
  // TEST-11 — Helper: qué campo del módulo representa "persona/empleado"
  // (para el filtro de Empleado del Parte de horas y compat con módulos
  // antiguos que usan "responsable"/"asignado").
  const personaFieldKey = useMemo(() => {
    if (ui.fields.some((f) => f.key === "empleado")) return "empleado";
    if (ui.fields.some((f) => f.key === "asignado")) return "asignado";
    if (ui.fields.some((f) => f.key === "responsable")) return "responsable";
    return null;
  }, [ui.fields]);
  // TEST-17 bis 2 B — Algunos módulos (CRM/oportunidades) usan `fase`
  // en vez de `estado`. El filtro "Estado" del listado salía vacío
  // porque no había campo `estado`. Resolvemos el field "del estado"
  // dinámicamente: primero `estado`, después `fase`.
  const estadoFieldKey = useMemo(() => {
    if (ui.fields.some((f) => f.key === "estado")) return "estado";
    if (ui.fields.some((f) => f.key === "fase")) return "fase";
    return null;
  }, [ui.fields]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const columnKeys = (ui.tableColumns || []).map((c) => c.fieldKey);
    return rows.filter((item) => {
      // TEST-8bis2 — Filtros multi-select: cada Set permite varios valores.
      // Set vacío = no filtra. Si tiene valores, el item pasa si su valor
      // (lowercased) está en el set.
      // TEST-17 bis 2 B — Filtrar por el campo de estado resuelto
      // (estado o fase), no solo por `estado`.
      if (estadoFilter.size > 0) {
        const estadoVal = estadoFieldKey ? String(item[estadoFieldKey] || "").toLowerCase() : "";
        if (!estadoFilter.has(estadoVal)) return false;
      }
      if (segmentoFilter.size > 0) {
        const seg = String(item.segmento || item.tipo || "").toLowerCase();
        if (!segmentoFilter.has(seg)) return false;
      }
      if (responsableFilter.size > 0) {
        // TEST-11 — Usa el campo persona detectado (empleado / asignado /
        // responsable) en vez de mirar siempre responsable+asignado.
        const personaVal = personaFieldKey
          ? String(item[personaFieldKey] || "").toLowerCase()
          : String(item.responsable || item.asignado || "").toLowerCase();
        if (!responsableFilter.has(personaVal)) return false;
      }
      // TEST-10.2.b — Filtro por fecha límite: descartar registros con
      // fechaLimite posterior a la fecha tope indicada.
      if (fechaLimiteMax) {
        const fl = String(item.fechaLimite || "").slice(0, 10);
        if (fl && fl > fechaLimiteMax) return false;
      }
      // TEST-11 — Filtros nuevos del Parte de horas.
      if (clienteQuery) {
        const c = String(item.cliente || "").toLowerCase();
        if (!c.includes(clienteQuery.toLowerCase())) return false;
      }
      if (proyectoQuery) {
        const p = String(item.proyecto || "").toLowerCase();
        if (!p.includes(proyectoQuery.toLowerCase())) return false;
      }
      if (fechaMin || fechaMax) {
        const f = String(item.fecha || "").slice(0, 10);
        if (fechaMin && f && f < fechaMin) return false;
        if (fechaMax && f && f > fechaMax) return false;
      }
      if (q) {
        const parts: string[] = [];
        // Nombre/título primario
        parts.push(String(item.nombre || item.titulo || item.numero || item.referencia || item.asunto || ""));
        // Columnas visibles del listado
        for (const k of columnKeys) {
          if (k === "id" || k === "contactosJson") continue;
          parts.push(String(item[k] || ""));
        }
        // Datos del contacto preferido (en clientes)
        if (moduleKey === "clientes" && item.contactosJson) {
          try {
            const raw = typeof item.contactosJson === "string"
              ? JSON.parse(item.contactosJson)
              : item.contactosJson;
            if (Array.isArray(raw)) {
              const pref = raw.find((c) => c?.preferido) || raw[0];
              if (pref) {
                parts.push(String(pref.nombre || ""), String(pref.email || ""), String(pref.telefono || ""), String(pref.cargo || ""));
              }
            }
          } catch { /* ignorar */ }
        }
        const haystack = parts.join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [rows, query, estadoFilter, segmentoFilter, responsableFilter, fechaLimiteMax, clienteQuery, proyectoQuery, fechaMin, fechaMax, personaFieldKey, ui.tableColumns, moduleKey]);

  // TEST-10.4 / TEST-16 bis B / TEST-17 D — Orden por defecto del listado.
  // Pedro pide reglas concretas por módulo (Clientes por Empresa,
  // Oportunidades por Fase y Empresa, Proyectos por Estado y Cliente,
  // Tareas/actividades por Fecha+Empleado+Cliente, Propuestas por
  // Estado+Cliente, Entregables por Cliente, Compras por Estado+Fecha,
  // Servicios por Descripción, Empleados por Nombre, Actividades-
  // catálogo por Código, Formas de pago por Nombre, Facturas por Cliente).
  const sorted = useMemo(() => {
    const ABC = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
    const lower = (v: unknown) => String(v ?? "").toLowerCase().trim();
    // Tarifas: Nivel ASC, Servicio ABC.
    if (moduleKey === "tarifas-generales") {
      return [...filtered].sort((a, b) => {
        const na = parseInt(String(a.nivel || "99"), 10) || 99;
        const nb = parseInt(String(b.nivel || "99"), 10) || 99;
        if (na !== nb) return na - nb;
        return ABC(lower(a.servicio), lower(b.servicio));
      });
    }
    if (moduleKey === "tarifas-especiales") {
      // Preguntas 1.con P — Pedro: orden por Grupo ascendente.
      // Después por Nivel y Servicio (mantener orden estable interno).
      return [...filtered].sort((a, b) => {
        const g = ABC(lower(a.grupo), lower(b.grupo));
        if (g !== 0) return g;
        const na = parseInt(String(a.nivel || "99"), 10) || 99;
        const nb = parseInt(String(b.nivel || "99"), 10) || 99;
        if (na !== nb) return na - nb;
        return ABC(lower(a.servicio), lower(b.servicio));
      });
    }
    // TEST-17 D — Reglas específicas por módulo.
    if (moduleKey === "clientes") {
      return [...filtered].sort((a, b) => ABC(lower(a.nombre), lower(b.nombre)));
    }
    if (moduleKey === "crm") {
      const faseRank = (v: unknown) => {
        const s = lower(v);
        if (s.includes("lead")) return 1;
        if (s.includes("contact")) return 2;
        if (s.includes("propuesta") || s.includes("negoc")) return 3;
        if (s.includes("ganad")) return 4;
        if (s.includes("perdid")) return 5;
        return 99;
      };
      return [...filtered].sort((a, b) => {
        const r = faseRank(a.fase) - faseRank(b.fase);
        if (r !== 0) return r;
        return ABC(lower(a.empresa), lower(b.empresa));
      });
    }
    if (moduleKey === "proyectos") {
      // TEST-17 bis A — Estado no por alfa sino por valor numérico:
      // 1=pausado, 3=activo, 5=por renovar, 7=expirado, 9=finalizado.
      const rankEstado = (v: unknown) => {
        const s = lower(v).replace(/[_\s]+/g, "");
        if (s.includes("pausad")) return 1;
        if (s.includes("activ")) return 3;
        if (s.includes("porrenov") || s.includes("renovar")) return 5;
        if (s.includes("expirad")) return 7;
        if (s.includes("finalizad")) return 9;
        return 99;
      };
      return [...filtered].sort((a, b) => {
        const r = rankEstado(a.estado) - rankEstado(b.estado);
        if (r !== 0) return r;
        return ABC(lower(a.cliente), lower(b.cliente));
      });
    }
    if (moduleKey === "actividades") {
      // Parte de horas (Tareas en SF): Fecha ASC, Empleado ABC, Cliente ABC.
      return [...filtered].sort((a, b) => {
        const fa = String(a.fecha || "").slice(0, 10);
        const fb = String(b.fecha || "").slice(0, 10);
        if (fa !== fb) return ABC(fa, fb);
        const e = ABC(lower(a.empleado || a.persona), lower(b.empleado || b.persona));
        if (e !== 0) return e;
        return ABC(lower(a.cliente), lower(b.cliente));
      });
    }
    if (moduleKey === "presupuestos") {
      // TEST-17 bis A — Estado por rank: 1=pendiente, 2=borrador,
      // 3=enviada, 4=negociación, 5=aceptada, 6=rechazada.
      const rankEstado = (v: unknown) => {
        const s = lower(v);
        if (s.includes("pendient")) return 1;
        if (s.includes("borrador")) return 2;
        if (s.includes("envia")) return 3;
        if (s.includes("negoc")) return 4;
        if (s.includes("acept")) return 5;
        if (s.includes("rechaz")) return 6;
        return 99;
      };
      return [...filtered].sort((a, b) => {
        const r = rankEstado(a.estado) - rankEstado(b.estado);
        if (r !== 0) return r;
        return ABC(lower(a.cliente), lower(b.cliente));
      });
    }
    if (moduleKey === "documentos") {
      return [...filtered].sort((a, b) => ABC(lower(a.cliente), lower(b.cliente)));
    }
    if (moduleKey === "compras") {
      // Preguntas 1.con E — Estado por rank: solicitada(1) → aprobada(2)
      // → en curso(4) → recibida(6) → pagada(8) → rechazada(9).
      const rankEstado = (v: unknown) => {
        const s = lower(v).replace(/[_\s]+/g, "");
        if (s.includes("solicit")) return 1;
        if (s.includes("aprobad")) return 2;
        if (s.includes("encurso")) return 4;
        if (s.includes("recibid")) return 6;
        if (s.includes("pagad")) return 8;
        if (s.includes("rechaz")) return 9;
        return 99;
      };
      return [...filtered].sort((a, b) => {
        const r = rankEstado(a.estado) - rankEstado(b.estado);
        if (r !== 0) return r;
        return ABC(String(a.fecha || ""), String(b.fecha || ""));
      });
    }
    if (moduleKey === "facturacion") {
      // TEST-17 bis 2 E — Facturas por rank de Estado y, a igual
      // Estado, alfa Cliente. 0=borrador, 2=emitida, 4=cobrada,
      // 7=vencida, 9=anulada (Pedro escribió "cobrada" dos veces,
      // interpretado como anulada).
      const rankEstado = (v: unknown) => {
        const s = lower(v);
        if (s.includes("borrador")) return 0;
        if (s.includes("emitid")) return 2;
        if (s.includes("cobrad")) return 4;
        if (s.includes("vencid")) return 7;
        if (s.includes("anulad")) return 9;
        return 99;
      };
      return [...filtered].sort((a, b) => {
        const r = rankEstado(a.estado) - rankEstado(b.estado);
        if (r !== 0) return r;
        return ABC(lower(a.cliente), lower(b.cliente));
      });
    }
    if (moduleKey === "catalogo-servicios") {
      return [...filtered].sort((a, b) => ABC(lower(a.descripcion), lower(b.descripcion)));
    }
    if (moduleKey === "empleados") {
      return [...filtered].sort((a, b) => ABC(lower(a.nombre), lower(b.nombre)));
    }
    if (moduleKey === "actividades-catalogo") {
      return [...filtered].sort((a, b) => ABC(lower(a.codigo), lower(b.codigo)));
    }
    if (moduleKey === "formas-pago") {
      return [...filtered].sort((a, b) => ABC(lower(a.nombre), lower(b.nombre)));
    }
    // Test 19 bis — Niveles: por Tipo y Subtipo (asc).
    if (moduleKey === "niveles") {
      return [...filtered].sort((a, b) =>
        ABC(lower(a.tipoNivel), lower(b.tipoNivel)) ||
        ABC(lower(a.subtipo), lower(b.subtipo))
      );
    }
    // Test 19 bis — Contratos: por Cliente (alfa), Tipo, Subtipo (asc).
    if (moduleKey === "contratos") {
      return [...filtered].sort((a, b) =>
        ABC(lower(a.cliente), lower(b.cliente)) ||
        ABC(lower(a.tipoNivel), lower(b.tipoNivel)) ||
        ABC(lower(a.subtipo), lower(b.subtipo))
      );
    }
    // Test 19 bis — Proyectos: por Cliente (alfa), Contrato y Servicio (asc).
    if (moduleKey === "proyectos") {
      return [...filtered].sort((a, b) =>
        ABC(lower(a.cliente), lower(b.cliente)) ||
        ABC(lower(a.contrato), lower(b.contrato)) ||
        ABC(lower(a.codigoTipo), lower(b.codigoTipo))
      );
    }
    if (moduleKey === "vencimientos-factura") {
      // Test 18 bis 3 — Lista de Vencimientos ordenada por fecha asc.
      return [...filtered].sort((a, b) => {
        const fa = String(a.fecha || "").slice(0, 10);
        const fb = String(b.fecha || "").slice(0, 10);
        if (fa !== fb) return fa < fb ? -1 : 1;
        return ABC(String(a.factura || ""), String(b.factura || ""));
      });
    }
    // Default: si el módulo tiene fechaLimite, fecha ASC + prioridad.
    const hasFechaLimite = ui.fields.some((f) => f.key === "fechaLimite");
    if (!hasFechaLimite) return filtered;
    const rank = (v: unknown): number => {
      const s = lower(v);
      const n = Number(s);
      if (Number.isFinite(n) && n > 0) return n;
      if (s.includes("urgent")) return 1;
      if (s.includes("alta")) return 3;
      if (s.includes("media")) return 6;
      if (s.includes("baja")) return 8;
      return 99;
    };
    return [...filtered].sort((a, b) => {
      const fa = String(a.fechaLimite || "").slice(0, 10);
      const fb = String(b.fechaLimite || "").slice(0, 10);
      if (fa && fb && fa !== fb) return fa < fb ? -1 : 1;
      if (fa && !fb) return -1;
      if (!fa && fb) return 1;
      return rank(a.prioridad) - rank(b.prioridad);
    });
  }, [filtered, ui.fields, moduleKey]);

  // TEST-14 C — Los mini-KPIs (Total + breakdown por estado) ya no se
  // renderizan en la cabecera del listado (cabecera compactada). Se
  // mantiene el `MiniKpi` y `KPI_TINTS` exportables para el dashboard
  // sectorial que sí los consume. El cómputo concreto se elimina aquí.

  // Paginación (TEST-10.4 — sobre la lista ya ordenada).
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageStart = (page - 1) * pageSize;
  const pageRows = sorted.slice(pageStart, pageStart + pageSize);

  async function saveRecord(payload: Record<string, string>): Promise<Record<string, string> | null> {
    const tenant = readTenant();
    const sectorPack = readSectorPack();
    // TEST-11 — Compat backward del Parte de horas (actividades). Aplicado
    // tanto aquí (save individual) como en bulkUpdate.
    if (moduleKey === "actividades") {
      payload = applyActivitiesLegacyShim(payload);
    }
    let savedRow: Record<string, string> | null = null;
    if (modalMode === "create") {
      const response = await fetch("/api/erp/module", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module: moduleKey, mode: "create", payload, tenant, sectorPack }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "No se pudo guardar.");
      savedRow = (data.row || null) as Record<string, string> | null;
    }
    if (modalMode === "edit" && selected?.id) {
      const response = await fetch("/api/erp/module", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module: moduleKey, mode: "edit", recordId: selected.id, payload, tenant, sectorPack }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "No se pudo actualizar.");
      savedRow = (data.row || null) as Record<string, string> | null;
    }
    await load();
    return savedRow;
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
      let payload: Record<string, string> = { ...existing, [field]: value };
      // TEST-11 — Aplicar el shim también en bulk para no dejar registros
      // inconsistentes (empleado vs persona, tiempoHoras vs horas).
      if (moduleKey === "actividades") {
        payload = applyActivitiesLegacyShim(payload);
      }
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

  // Columnas — TEST-10.1. El selector "Mostrar columnas" debe ofrecer TODOS
  // los campos del módulo. `baseColumns` son las visibles por defecto (las que
  // define el pack/core); el resto de campos se añaden como columnas
  // disponibles pero ocultas de inicio.
  const allColumns: TableColumnDef[] = useMemo(() => {
    const base: TableColumnDef[] = ui.tableColumns.length > 0
      ? ui.tableColumns
      : ui.fields.slice(0, 6).map((f) => ({ fieldKey: f.key, label: f.label }));
    const seen = new Set(base.map((c) => c.fieldKey));
    const extra: TableColumnDef[] = ui.fields
      .filter((f) => !seen.has(f.key) && f.key !== "contactosJson" && f.key !== "id")
      .map((f) => ({ fieldKey: f.key, label: f.label }));
    return [...base, ...extra];
  }, [ui.tableColumns, ui.fields]);
  // TEST-17 bis C — En Clientes y Oportunidades, las columnas email y
  // telefono NUNCA se renderizan como columnas separadas (porque la
  // columna CONTACTO ya enseña esos datos). Lo que sí controla el
  // selector "Mostrar columnas" es si se muestra el subtítulo de email
  // y/o telefono bajo el nombre del primer campo (Empresa/Código).
  // Si están en hiddenCols (= no marcados) no se muestra subtítulo;
  // si NO están en hiddenCols (= marcados), se añaden al subtítulo.
  const HIDE_AS_COLUMN_IN_CLIENT = new Set(["email", "telefono", "tel"]);
  const columns = allColumns.filter((c) => {
    if (hiddenCols.has(c.fieldKey)) return false;
    if ((moduleKey === "clientes" || moduleKey === "crm") && HIDE_AS_COLUMN_IN_CLIENT.has(c.fieldKey)) {
      return false;
    }
    return true;
  });
  // TEST-18 bis — Bug: el flag `showTelSubtitle` usaba la OR de
  // `telefono` y `tel`, pero `tel` NO es un fieldKey declarado del
  // módulo, por lo tanto `hiddenCols.has("tel")` siempre era false y
  // `showTelSubtitle` siempre quedaba en true (el teléfono salía aunque
  // el usuario no lo hubiera marcado). Solo miramos el field real
  // (`telefono`); el alias `tel` se sigue aceptando como dato de origen
  // pero no como llave de visibilidad.
  const showEmailSubtitle = (moduleKey === "clientes" || moduleKey === "crm") && !hiddenCols.has("email");
  const showTelSubtitle = (moduleKey === "clientes" || moduleKey === "crm") && !hiddenCols.has("telefono");

  const titleField = ui.tableColumns.find((c) => c.isPrimary)?.fieldKey || allColumns[0]?.fieldKey || ui.fields[0]?.key || "id";

  // TEST-10.11 — Clave de persistencia por tenant+módulo para la selección
  // de columnas visibles. Si no hay tenant en la URL, usa "default".
  function colsStorageKey(): string {
    const tenant = readTenant();
    return "prontara:cols:" + (tenant || "default") + ":" + moduleKey;
  }

  // TEST-10.1 / TEST-10.11 — Al cargar el módulo, decide qué columnas ocultar:
  //   1) Si hay preferencia guardada en localStorage para este tenant+módulo,
  //      úsala (filtrando claves que ya no existen en la definición).
  //   2) Si no, oculta las columnas extra (las que no están en el set base
  //      del pack/core). Se recalcula al cambiar la definición o el módulo.
  useEffect(() => {
    const baseKeys = ui.tableColumns.length > 0
      ? new Set(ui.tableColumns.map((c) => c.fieldKey))
      : new Set(ui.fields.slice(0, 6).map((f) => f.key));
    const validKeys = new Set(ui.fields.map((f) => f.key));
    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(colsStorageKey());
        if (raw) {
          const arr = JSON.parse(raw);
          if (Array.isArray(arr)) {
            // Filtra claves obsoletas (campos que ya no existen en el schema).
            const filtered = arr.map(String).filter((k) => validKeys.has(k));
            // TEST-11 fix #8 — Si tras el filtrado quedaron 0 claves Y el
            // array original NO estaba vacío, significa que TODAS las
            // preferencias guardadas eran de campos obsoletos (típico tras
            // un rediseño de schema: el usuario tenía urgencia/descripcion
            // ocultos, ya no existen). Caemos al default en vez de mostrar
            // todas las columnas. Si el array original SÍ estaba vacío,
            // respetamos la elección "ver todo".
            if (filtered.length === 0 && arr.length > 0) {
              setHiddenCols(new Set(ui.fields.map((f) => f.key).filter((k) => !baseKeys.has(k))));
              return;
            }
            setHiddenCols(new Set(filtered));
            return;
          }
        }
      } catch { /* localStorage no disponible: caemos al default */ }
    }
    setHiddenCols(new Set(ui.fields.map((f) => f.key).filter((k) => !baseKeys.has(k))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ui.tableColumns, ui.fields, moduleKey]);

  // TEST-10.2 / 10.5 / 10.9 — Opciones de un campo (definición del pack/core
  // + valores presentes en los datos). Se usa en filtros y en "Cambiar estado".
  function fieldOptions(fieldKey: string): Array<{ value: string; label: string }> {
    const f = ui.fields.find((x) => x.key === fieldKey);
    const out: Array<{ value: string; label: string }> = [];
    const seen = new Set<string>();
    for (const o of f?.options || []) {
      const v = String(o.value);
      const lk = v.toLowerCase();
      if (seen.has(lk)) continue;
      seen.add(lk);
      out.push({ value: v, label: String(o.label || o.value) });
    }
    for (const r of rows) {
      const v = String(r[fieldKey] ?? "").trim();
      if (v && !seen.has(v.toLowerCase())) {
        seen.add(v.toLowerCase());
        out.push({ value: v, label: v });
      }
    }
    return out;
  }
  // TEST-10.5 / Test 18 bis 3 — Devuelve la etiqueta visible de un
  // valor de campo. Primero busca en `f.options` (campos status); si
  // no, busca en `columnRelationLabels` (mapping cargado desde
  // /api/erp/options para fields de tipo relation, útil en columnas
  // como `tarea`, `formaPago`, `tipoCliente`).
  function labelForValue(fieldKey: string, rawVal: string): string {
    if (rawVal === "—" || rawVal === "") return rawVal;
    const f = ui.fields.find((x) => x.key === fieldKey);
    if (f?.options) {
      const hit = f.options.find((o) => String(o.value) === rawVal);
      if (hit) return String(hit.label || hit.value);
    }
    if (f?.kind === "relation" && f.relationModuleKey) {
      const map = columnRelationLabels[f.relationModuleKey];
      if (map && map[rawVal]) return map[rawVal];
    }
    return rawVal;
  }

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

  // TEST-14 C — `subtitle` y `MODULE_SUBTITLE` ya no se renderizan en
  // la cabecera del listado (subtítulo descriptivo eliminado por ser
  // genérico y redundante con el H1 y el menú principal). Si en un
  // futuro se quiere reintroducir, basta con consumir MODULE_SUBTITLE.

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
            kind: "text" | "email" | "tel" | "textarea" | "date" | "time" | "number" | "money" | "status" | "relation";
            required?: boolean; relationModuleKey?: string; placeholder?: string;
            options?: Array<{ value: string; label: string }>;
            readOnly?: boolean;
            inheritFrom?: { from: string; field: string };
            // TEST-13 E — añadido "derived" para Facturable=f(tipoFacturacion).
            computed?:
              | { type: "duration"; from: string; to: string }
              | { type: "derived"; from: string; map?: Record<string, string>; default?: string };
            visibleWhen?: { field: string; equals: string | string[] };
            requiredWhen?: { field: string; equals: string | string[] };
            defaultValue?: string;
          }>}
          // TEST-2.12 Duplicar — pasar selected también en create-from-duplicate.
          initialValue={selected}
          tenant={readTenant() || undefined}
          accent={accent}
          initialTab={editorInitialTab || undefined}
          autoStartContact={editorAutoContact}
          onCancel={() => {
            setEditorInitialTab(null);
            setEditorAutoContact(false);
            setModalMode(null);
            // TEST-20 D — Si la URL trae `?returnTo=...` (alta lanzada
            // desde la sublista de otro módulo), volver allí en vez de
            // quedarse en el listado.
            if (typeof window !== "undefined") {
              const ret = new URLSearchParams(window.location.search).get("returnTo");
              if (ret) {
                const cleaned = new URLSearchParams(window.location.search);
                cleaned.delete("returnTo");
                router.push(ret);
              }
            }
          }}
          onSubmit={async (payload, options) => {
            const wasCreating = modalMode === "create";
            const savedRow = await saveRecord(payload);
            const savedId = String(savedRow?.id || selected?.id || "");
            const savedNumero = String(savedRow?.numero || payload.numero || "");

            // TEST-8bis.1.b — Oportunidad recién creada sin contactos: en
            // lugar de mostrar mensaje "faltan campos", se mantiene el editor
            // abierto en modo edit con tab=Contactos y un draft activo, para
            // que el usuario lo rellene de inmediato.
            if (moduleKey === "crm" && wasCreating) {
              const hayContactos = (() => {
                const raw = payload.contactosJson;
                if (!raw) return false;
                try {
                  const arr = typeof raw === "string" ? JSON.parse(raw) : raw;
                  if (!Array.isArray(arr)) return false;
                  return arr.some((c) => c && typeof c === "object" && (String(c.nombre || "").trim() || String(c.email || "").trim() || String(c.telefono || "").trim()));
                } catch { return false; }
              })();
              if (!hayContactos && savedRow) {
                setSelected({ ...payload, ...savedRow });
                setEditorInitialTab("contacto");
                setEditorAutoContact(true);
                setModalMode("edit");
                return;
              }
            }
            // Si el editor venía con flags forzados (encadenado), resetearlos
            // para que el siguiente guardado no los arrastre.
            if (editorInitialTab || editorAutoContact) {
              setEditorInitialTab(null);
              setEditorAutoContact(false);
            }

            // TEST-8bis.1.c.ii — Resuelve el id UUID interno a partir del
            // código nemotécnico (OP-YYYY-NNN). Se usa en las transiciones
            // de propuesta→oportunidad para hacer mode=edit por id.
            const tenant = readTenant();
            const sectorPack = readSectorPack();
            async function findCrmIdByNumero(num: string): Promise<string | null> {
              if (!num) return null;
              try {
                const r = await fetch("/api/erp/module?module=crm", { cache: "no-store" });
                const d = await r.json();
                if (!r.ok || !d.ok) return null;
                const rows = (Array.isArray(d.rows) ? d.rows : []) as Array<Record<string, string>>;
                const found = rows.find((row) => String(row.numero || "") === num);
                return found ? String(found.id || "") : null;
              } catch { return null; }
            }

            const fase = String(payload.fase || "").toLowerCase();
            const estado = String(payload.estado || "").toLowerCase();

            // TEST-5.W + TEST-8.1.d — Workflow comercial encadenado:
            //
            //   crm.fase=propuesta → abrir editor Propuesta con cliente y
            //     código de oportunidad precargados; al guardar la propuesta
            //     se actualiza crm.referenciaPropuesta de la oportunidad.
            //
            //   crm.fase=ganado → abrir editor Cliente con empresa precargada;
            //     al guardar el cliente se abre editor Proyecto con
            //     cliente + referenciaPropuesta precargados.
            //
            //   presupuestos.estado=aceptado/rechazado → actualizar
            //     automáticamente crm.fase de la oportunidad referenciada
            //     (codigoOportunidad) a ganado/perdido respectivamente.

            // === Transición 1: oportunidad → propuesta ===
            if (moduleKey === "crm" && fase === "propuesta") {
              const empresa = String(payload.empresa || payload.nombre || "").trim();
              const valor = String(payload.valorEstimado || "").trim();
              const concepto = String(payload.proximoPaso || "").trim().slice(0, 80);
              const qs: string[] = [];
              if (empresa) qs.push("prefill_cliente=" + encodeURIComponent(empresa));
              // TEST-8bis.1.c.ii — Mostrar el código nemotécnico al usuario,
              // mantener el id interno aparte para la actualización de vuelta.
              if (savedNumero) qs.push("prefill_codigoOportunidad=" + encodeURIComponent(savedNumero));
              if (valor) qs.push("prefill_importe=" + encodeURIComponent(valor));
              if (concepto) qs.push("prefill_concepto=" + encodeURIComponent(concepto));
              if (savedId) qs.push("wf_back_crm=" + encodeURIComponent(savedId));
              router.push(link("presupuestos") + "?" + qs.join("&"));
              return;
            }

            // === Transición 2: oportunidad → cliente → proyecto (ganado) ===
            if (moduleKey === "crm" && fase === "ganado") {
              const empresa = String(payload.empresa || payload.nombre || "").trim();
              const contacto = String(payload.contacto || "").trim();
              const emailV = String(payload.email || "").trim();
              const telV = String(payload.telefono || "").trim();
              const referenciaPropuesta = String(payload.referenciaPropuesta || "").trim();
              const qs: string[] = [];
              if (empresa) qs.push("prefill_nombre=" + encodeURIComponent(empresa));
              if (contacto) qs.push("prefill_contacto=" + encodeURIComponent(contacto));
              if (emailV) qs.push("prefill_email=" + encodeURIComponent(emailV));
              if (telV) qs.push("prefill_telefono=" + encodeURIComponent(telV));
              qs.push("wf_next=proyectos");
              if (referenciaPropuesta) qs.push("wf_referencia_propuesta=" + encodeURIComponent(referenciaPropuesta));
              router.push(link("clientes") + "?" + qs.join("&"));
              return;
            }

            // === Encadenado cliente → proyecto ===
            if (workflowNext === "proyectos" && moduleKey === "clientes") {
              const nombre = String(payload.nombre || "").trim();
              const referencia = typeof window !== "undefined"
                ? new URLSearchParams(window.location.search).get("wf_referencia_propuesta") || ""
                : "";
              setWorkflowNext(null);
              const qs: string[] = [];
              if (nombre) qs.push("prefill_cliente=" + encodeURIComponent(nombre));
              if (referencia) qs.push("prefill_referenciaPropuesta=" + encodeURIComponent(referencia));
              router.push(link("proyectos") + (qs.length ? "?" + qs.join("&") : ""));
              return;
            }

            // === Transición 3a: propuesta aceptada → oportunidad ganada → wizard cliente+proyecto ===
            // === Transición 3b: propuesta rechazada → oportunidad perdida ===
            if (moduleKey === "presupuestos" && (estado === "aceptado" || estado === "rechazado")) {
              const codigoOport = String(payload.codigoOportunidad || "").trim();
              if (codigoOport) {
                const nuevaFase = estado === "aceptado" ? "ganado" : "perdido";
                // TEST-8bis.1.c.ii — codigoOportunidad es el código
                // nemotécnico (OP-YYYY-NNN); hay que resolverlo al UUID
                // interno antes de hacer mode=edit por recordId.
                const oportId = await findCrmIdByNumero(codigoOport);
                if (oportId) {
                  try {
                    await fetch("/api/erp/module", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        module: "crm",
                        mode: "edit",
                        recordId: oportId,
                        payload: { fase: nuevaFase, referenciaPropuesta: savedNumero || savedId },
                        tenant,
                        sectorPack,
                      }),
                    });
                  } catch { /* tolerar */ }

                  // TEST-8bis.1.c.i — Si la propuesta acaba ACEPTADA, además
                  // de marcar la oportunidad como ganada, disparar el wizard
                  // de Cliente → Proyecto con los datos de la oportunidad
                  // (mismo comportamiento que si el usuario cambiara la fase
                  // a Ganado manualmente).
                  if (estado === "aceptado") {
                    try {
                      const r = await fetch("/api/erp/module?module=crm", { cache: "no-store" });
                      const d = await r.json();
                      const oport = Array.isArray(d?.rows)
                        ? (d.rows as Array<Record<string, string>>).find((row) => String(row.id || "") === oportId)
                        : null;
                      if (oport) {
                        const qsW: string[] = [];
                        const empresa = String(oport.empresa || "").trim();
                        const contacto = String(oport.contacto || "").trim();
                        const emailV = String(oport.email || "").trim();
                        const telV = String(oport.telefono || "").trim();
                        if (empresa) qsW.push("prefill_nombre=" + encodeURIComponent(empresa));
                        if (contacto) qsW.push("prefill_contacto=" + encodeURIComponent(contacto));
                        if (emailV) qsW.push("prefill_email=" + encodeURIComponent(emailV));
                        if (telV) qsW.push("prefill_telefono=" + encodeURIComponent(telV));
                        qsW.push("wf_next=proyectos");
                        qsW.push("wf_referencia_propuesta=" + encodeURIComponent(savedNumero || savedId));
                        router.push(link("clientes") + "?" + qsW.join("&"));
                        return;
                      }
                    } catch { /* tolerar */ }
                  }
                }
              }
            }

            // === Vuelta CRM: tras crear la propuesta desde una oportunidad,
            // actualizar la oportunidad con la referenciaPropuesta ===
            if (moduleKey === "presupuestos" && typeof window !== "undefined") {
              const wfBack = new URLSearchParams(window.location.search).get("wf_back_crm") || "";
              if (wfBack) {
                try {
                  await fetch("/api/erp/module", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      module: "crm",
                      mode: "edit",
                      recordId: wfBack,
                      payload: { referenciaPropuesta: savedNumero || savedId },
                      tenant,
                      sectorPack,
                    }),
                  });
                } catch { /* tolerar fallo */ }
                // Limpiar wf_back_crm de la URL antes de navegar
                const cleaned = new URLSearchParams(window.location.search);
                cleaned.delete("wf_back_crm");
                router.push(link("crm"));
                return;
              }
            }

            if (options?.andNew && modalMode === "create") {
              // Quedarse en modo "create" con form limpio
              setSelected(null);
              setModalMode("create");
            } else {
              setModalMode(null);
              // TEST-20 D — Tras guardar, si la URL trae `?returnTo=...`
              // (alta desde la sublista de otro módulo, p.ej. Proyecto
              // desde Cliente), volver a ese sitio.
              if (typeof window !== "undefined") {
                const ret = new URLSearchParams(window.location.search).get("returnTo");
                if (ret) router.push(ret);
              }
            }
          }}
        />
      </TenantShell>
    );
  }

  // Filtros activos para chips (TEST-1.6 + TEST-8bis2 multi-select).
  const activeChips: Array<{ key: string; label: string; onClear: () => void }> = [];
  if (estadoFilter.size > 0) activeChips.push({
    key: "estado",
    // TEST-17 bis 2 B — Etiqueta del chip = Fase si el módulo usa fase.
    label: (estadoFieldKey === "fase" ? "Fase: " : "Estado: ") + Array.from(estadoFilter).join(", "),
    onClear: () => setEstadoFilter(new Set()),
  });
  if (segmentoFilter.size > 0) activeChips.push({
    key: "segmento",
    label: "Segmento: " + Array.from(segmentoFilter).join(", "),
    onClear: () => setSegmentoFilter(new Set()),
  });
  if (responsableFilter.size > 0) activeChips.push({
    key: "responsable",
    label: "Responsable: " + Array.from(responsableFilter).join(", "),
    onClear: () => setResponsableFilter(new Set()),
  });
  if (fechaLimiteMax) activeChips.push({
    key: "fechaLimite",
    label: "Fecha límite ≤ " + fechaLimiteMax,
    onClear: () => setFechaLimiteMax(""),
  });
  // TEST-11 — Chips de los nuevos filtros del Parte de horas.
  if (clienteQuery) activeChips.push({
    key: "clienteQuery",
    label: "Cliente: " + clienteQuery,
    onClear: () => setClienteQuery(""),
  });
  if (proyectoQuery) activeChips.push({
    key: "proyectoQuery",
    label: "Proyecto: " + proyectoQuery,
    onClear: () => setProyectoQuery(""),
  });
  if (fechaMin) activeChips.push({
    key: "fechaMin",
    label: "Desde " + fechaMin,
    onClear: () => setFechaMin(""),
  });
  if (fechaMax) activeChips.push({
    key: "fechaMax",
    label: "Hasta " + fechaMax,
    onClear: () => setFechaMax(""),
  });
  if (query) activeChips.push({ key: "query", label: '"' + query + '"', onClear: () => setQuery("") });

  return (
    <TenantShell>
      <div style={{ maxWidth: 1320, margin: "0 auto", color: "#0f172a", fontFamily: "system-ui, -apple-system, sans-serif" }}>
        {/* TEST-16 bis (2) — Franja 4 eliminada (Pedro): este breadcrumb
            "Inicio / {Módulo}" duplicaba lo que ya dicen la tab activa
            y el H1. Quitándolo, el nombre del módulo aparece 2 veces
            (TabBar + H1) en vez de 4. */}

        {/* TEST-14 C — Cabecera compactada: H1 + acciones en UNA fila
            (antes el H1 ocupaba su propia fila con subtítulo y los
            botones iban debajo). El subtítulo descriptivo (genérico,
            redundante con el título y el menú) se elimina. La fila de
            mini-KPIs (Total / Pendiente cards) también se quita más
            abajo, lo que recupera ~140px verticales de espacio para la
            propia tabla, que es lo que el usuario viene a ver. */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginBottom: 12, flexWrap: "wrap" }}>
          <h1 className="titulo-pagina" style={{ margin: 0, fontSize: 24 }}>{ui.label}</h1>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {extraActions}
            <button
              type="button"
              onClick={() => { setSelected(null); setModalMode("create"); }}
              className="boton boton-primario"
              style={primaryBtn(accent)}
            >
              <span style={{ fontSize: 14, lineHeight: 1 }}>+</span> Alta de {singular(ui.label).toLowerCase()}
            </button>
            <ImportWrapper><ModuleImportButton modulo={moduleKey} /></ImportWrapper>
            <ExportWrapper><ModuleExportButton modulo={moduleKey} /></ExportWrapper>
            <div style={{ position: "relative" }}>
              <button type="button" onClick={() => setShowMore(!showMore)} className="boton boton-secundario" style={secondaryBtn}>
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
                <button type="button" onClick={() => { setEstadoFilter(new Set()); setSegmentoFilter(new Set()); setResponsableFilter(new Set()); setFechaLimiteMax(""); setClienteQuery(""); setProyectoQuery(""); setFechaMin(""); setFechaMax(""); setQuery(""); setShowViews(false); }} style={popoverItemBtn} title="Muestra todos los registros sin filtro aplicado">
                  <span>👥</span>
                  <span style={{ flex: 1, textAlign: "left" }}>
                    Todos
                    <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 400 }}>Sin filtros — toda la lista</div>
                  </span>
                  <span style={popoverCount}>{rows.length}</span>
                </button>
                {savedViews.map((v) => {
                  // Resumir qué filtros guarda la vista (TEST-8bis2: arrays).
                  const cfg = v.configJson || {};
                  const f = cfg.filters || {};
                  const tags: string[] = [];
                  const estadoVal = f.estado;
                  if (Array.isArray(estadoVal) && estadoVal.length > 0) tags.push("estado=" + estadoVal.join("|"));
                  else if (typeof estadoVal === "string" && estadoVal) tags.push("estado=" + estadoVal);
                  if (cfg.query) tags.push('"' + cfg.query + '"');
                  if (Array.isArray(cfg.empleado) && cfg.empleado.length > 0) tags.push("empleado=" + cfg.empleado.join("|"));
                  if (cfg.clienteSearch) tags.push("cliente~" + cfg.clienteSearch);
                  if (cfg.proyectoSearch) tags.push("proyecto~" + cfg.proyectoSearch);
                  if (cfg.fechaDesde || cfg.fechaHasta) tags.push("fechas " + (cfg.fechaDesde || "?") + "→" + (cfg.fechaHasta || "?"));
                  if (Array.isArray(cfg.hiddenCols) && cfg.hiddenCols.length > 0) tags.push(cfg.hiddenCols.length + " col. ocultas");
                  const summary = tags.length > 0 ? tags.join(" · ") : "Sin filtros guardados";
                  return (
                    <button key={v.id} type="button" onClick={() => {
                      // TEST-17 bis 2 C — Aplicar TODA la vista: filtros,
                      // búsqueda, filtros nuevos y columnas ocultas.
                      const ev = cfg.filters?.estado;
                      if (Array.isArray(ev)) setEstadoFilter(new Set(ev.map((s: unknown) => String(s).toLowerCase())));
                      else if (typeof ev === "string" && ev) setEstadoFilter(new Set([ev.toLowerCase()]));
                      else setEstadoFilter(new Set());
                      setSegmentoFilter(new Set(Array.isArray(cfg.segmento) ? cfg.segmento.map((s) => s.toLowerCase()) : []));
                      // En este componente, el filtro Empleado reutiliza
                      // `responsableFilter` (ver comment en línea ~235),
                      // así que ambos se restauran al mismo state.
                      const respOrEmp = Array.isArray(cfg.responsable) && cfg.responsable.length > 0
                        ? cfg.responsable
                        : (Array.isArray(cfg.empleado) ? cfg.empleado : []);
                      setResponsableFilter(new Set(respOrEmp.map((s) => s.toLowerCase())));
                      setClienteQuery(cfg.clienteSearch || "");
                      setProyectoQuery(cfg.proyectoSearch || "");
                      setFechaMin(cfg.fechaDesde || "");
                      setFechaMax(cfg.fechaHasta || "");
                      setFechaLimiteMax(cfg.fechaLimiteMax || "");
                      setQuery(cfg.query || "");
                      if (Array.isArray(cfg.hiddenCols)) setHiddenCols(new Set(cfg.hiddenCols));
                      setShowViews(false);
                    }} style={{ ...popoverItemBtn, paddingRight: 6 }} title={"Aplica los filtros: " + summary}>
                      <span>★</span>
                      <span style={{ flex: 1, textAlign: "left" }}>
                        {v.name}
                        <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 400 }}>{summary}</div>
                      </span>
                      {/* TEST-18 B — Botón × para eliminar la vista
                          guardada. Pedro pide explícitamente la función. */}
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={async (e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          if (!window.confirm("¿Eliminar la vista \"" + v.name + "\"?")) return;
                          try {
                            await fetch("/api/runtime/saved-views?id=" + encodeURIComponent(v.id), { method: "DELETE" });
                            await loadViews();
                          } catch { /* tolerar */ }
                        }}
                        title={"Eliminar vista \"" + v.name + "\""}
                        aria-label={"Eliminar vista " + v.name}
                        style={{
                          display: "inline-flex", alignItems: "center", justifyContent: "center",
                          width: 22, height: 22, borderRadius: 4,
                          background: "transparent", color: "#94a3b8", cursor: "pointer", fontSize: 14,
                          marginLeft: 4, flexShrink: 0,
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "#fee2e2"; e.currentTarget.style.color = "#dc2626"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#94a3b8"; }}
                      >
                        🗑
                      </span>
                    </button>
                  );
                })}
                <div style={{ borderTop: "1px solid #f1f5f9", marginTop: 4 }}>
                  <button type="button" onClick={async () => {
                    const name = prompt("Nombre de la vista:");
                    if (!name) return;
                    // TEST-17 bis 2 C — Snapshot completo del estado del
                    // listado: filtros + búsqueda + filtros nuevos +
                    // columnas ocultas. Antes solo se guardaba estado+query.
                    const body = {
                      moduleKey,
                      name,
                      configJson: {
                        filters: estadoFilter.size > 0 ? { estado: Array.from(estadoFilter) } : {},
                        query,
                        segmento: Array.from(segmentoFilter),
                        // `responsableFilter` se reutiliza también como
                        // filtro Empleado (mismo state); lo serializamos
                        // bajo ambas claves para que cualquier consumer
                        // futuro pueda leerlo.
                        responsable: Array.from(responsableFilter),
                        empleado: Array.from(responsableFilter),
                        clienteSearch: clienteQuery,
                        proyectoSearch: proyectoQuery,
                        fechaDesde: fechaMin,
                        fechaHasta: fechaMax,
                        fechaLimiteMax,
                        hiddenCols: Array.from(hiddenCols),
                      },
                    };
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

          {/* TEST-1.6 + TEST-8bis2 — Filtros multi-select con checkboxes.
              Cada bloque permite seleccionar varios valores (combinaciones
              como "Aceptado + Enviado" o "todo excepto Rechazado"). */}
          <div style={{ position: "relative" }}>
            <button type="button" onClick={() => setShowFilters(!showFilters)} style={toolbarBtn}>
              <span>▽</span> Filtros
              {(estadoFilter.size + segmentoFilter.size + responsableFilter.size + (fechaLimiteMax ? 1 : 0) + (clienteQuery ? 1 : 0) + (proyectoQuery ? 1 : 0) + (fechaMin ? 1 : 0) + (fechaMax ? 1 : 0)) > 0 ? (
                <span style={popoverCount}>{estadoFilter.size + segmentoFilter.size + responsableFilter.size + (fechaLimiteMax ? 1 : 0) + (clienteQuery ? 1 : 0) + (proyectoQuery ? 1 : 0) + (fechaMin ? 1 : 0) + (fechaMax ? 1 : 0)}</span>
              ) : null}
              <span style={{ fontSize: 9, marginLeft: 4 }}>▾</span>
            </button>
            {showFilters ? (
              <div style={{ ...popover(280), padding: 12 }}>
                <div style={popoverHeader}>Filtrar registros</div>
                {/* TEST-10.2.a / TEST-17 bis 2 B — El filtro de Estado
                    ofrece TODOS los estados definidos en el campo (no
                    solo los presentes en datos). Si el módulo usa
                    `fase` (CRM) en vez de `estado`, el filtro pasa a
                    etiquetarse y a operar sobre `fase`. */}
                <CheckboxFilterGroup
                  label={estadoFieldKey === "fase" ? "Fase" : "Estado"}
                  options={estadoFieldKey ? fieldOptions(estadoFieldKey) : []}
                  selected={estadoFilter}
                  onChange={(next) => { setEstadoFilter(next); setPage(1); }}
                  accent={accent}
                />
                <CheckboxFilterGroup
                  label="Segmento"
                  options={
                    ui.fields.some((f) => f.key === "segmento") ? fieldOptions("segmento")
                      : ui.fields.some((f) => f.key === "tipo") ? fieldOptions("tipo")
                      : []
                  }
                  selected={segmentoFilter}
                  onChange={(next) => { setSegmentoFilter(next); setPage(1); }}
                  accent={accent}
                />
                <CheckboxFilterGroup
                  // TEST-11 — Etiqueta "Empleado" cuando el módulo tiene
                  // ese campo (Parte de horas), si no mantiene "Responsable".
                  label={personaFieldKey === "empleado" ? "Empleado" : "Responsable"}
                  options={personaFieldKey ? fieldOptions(personaFieldKey) : []}
                  selected={responsableFilter}
                  onChange={(next) => { setResponsableFilter(next); setPage(1); }}
                  accent={accent}
                />
                {/* TEST-11 — Filtros de búsqueda (Cliente / Proyecto) y de
                    rango de fechas (Fecha desde / Fecha hasta), solo si el
                    módulo tiene los campos correspondientes. */}
                {ui.fields.some((f) => f.key === "cliente") ? (
                  <div style={{ marginBottom: 10 }}>
                    <div style={filterLabel}>Cliente</div>
                    <input
                      type="text"
                      value={clienteQuery}
                      onChange={(e) => { setClienteQuery(e.target.value); setPage(1); }}
                      placeholder="Buscar por cliente…"
                      style={{ width: "100%", padding: "6px 8px", border: "1px solid #e5e7eb", borderRadius: 6, fontSize: 13, boxSizing: "border-box" }}
                    />
                  </div>
                ) : null}
                {ui.fields.some((f) => f.key === "proyecto") ? (
                  <div style={{ marginBottom: 10 }}>
                    <div style={filterLabel}>Proyecto</div>
                    <input
                      type="text"
                      value={proyectoQuery}
                      onChange={(e) => { setProyectoQuery(e.target.value); setPage(1); }}
                      placeholder="Buscar por proyecto…"
                      style={{ width: "100%", padding: "6px 8px", border: "1px solid #e5e7eb", borderRadius: 6, fontSize: 13, boxSizing: "border-box" }}
                    />
                  </div>
                ) : null}
                {ui.fields.some((f) => f.key === "fecha") ? (
                  <div style={{ marginBottom: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div>
                      <div style={filterLabel}>Fecha desde</div>
                      <input
                        type="date"
                        value={fechaMin}
                        onChange={(e) => { setFechaMin(e.target.value); setPage(1); }}
                        style={{ width: "100%", padding: "6px 8px", border: "1px solid #e5e7eb", borderRadius: 6, fontSize: 13, boxSizing: "border-box" }}
                      />
                    </div>
                    <div>
                      <div style={filterLabel}>Fecha hasta</div>
                      <input
                        type="date"
                        value={fechaMax}
                        onChange={(e) => { setFechaMax(e.target.value); setPage(1); }}
                        style={{ width: "100%", padding: "6px 8px", border: "1px solid #e5e7eb", borderRadius: 6, fontSize: 13, boxSizing: "border-box" }}
                      />
                    </div>
                  </div>
                ) : null}
                {/* TEST-10.2.b — Filtro por fecha límite (solo si el módulo
                    tiene ese campo). Omite las tareas con fecha posterior. */}
                {ui.fields.some((f) => f.key === "fechaLimite") ? (
                  <div style={{ marginBottom: 10 }}>
                    <div style={filterLabel}>Fecha límite hasta</div>
                    <input
                      type="date"
                      value={fechaLimiteMax}
                      onChange={(e) => { setFechaLimiteMax(e.target.value); setPage(1); }}
                      style={{ width: "100%", padding: "6px 8px", border: "1px solid #e5e7eb", borderRadius: 6, fontSize: 13, boxSizing: "border-box" }}
                    />
                  </div>
                ) : null}
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 10, paddingTop: 10, borderTop: "1px solid #f1f5f9" }}>
                  <button type="button" onClick={() => { setEstadoFilter(new Set()); setSegmentoFilter(new Set()); setResponsableFilter(new Set()); setFechaLimiteMax(""); setClienteQuery(""); setProyectoQuery(""); setFechaMin(""); setFechaMax(""); }} style={{ background: "transparent", border: "none", color: "#64748b", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                    Limpiar
                  </button>
                  <button type="button" onClick={() => setShowFilters(false)} style={{ background: accent, color: "#fff", border: "none", padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    Aplicar
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          {/* Columnas visibles — TEST-10.11. Draft + Aplicar: el usuario
              marca/desmarca columnas, opcionalmente usa "Seleccionar todos",
              y al pulsar "Aplicar" la elección se aplica al listado y se
              guarda en localStorage para conservarse entre navegaciones. */}
          <div style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => {
                if (!showColumns) setDraftHiddenCols(new Set(hiddenCols));
                setShowColumns(!showColumns);
              }}
              style={toolbarBtn}
            >
              <span>▦</span> Columnas <span style={{ fontSize: 9, marginLeft: 4 }}>▾</span>
            </button>
            {showColumns ? (
              <div style={popover(240)}>
                <div style={popoverHeader}>Mostrar columnas</div>
                {(() => {
                  const total = allColumns.length;
                  const visiblesEnDraft = allColumns.filter((c) => !draftHiddenCols.has(c.fieldKey)).length;
                  const todosMarcados = visiblesEnDraft === total && total > 0;
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        if (todosMarcados) {
                          setDraftHiddenCols(new Set(allColumns.map((c) => c.fieldKey)));
                        } else {
                          setDraftHiddenCols(new Set());
                        }
                      }}
                      style={{ ...popoverItemBtn, fontWeight: 700, color: accent, borderBottom: "1px solid #f1f5f9", borderRadius: 0 }}
                    >
                      <input
                        type="checkbox"
                        checked={todosMarcados}
                        ref={(el) => { if (el) el.indeterminate = visiblesEnDraft > 0 && !todosMarcados; }}
                        readOnly
                        style={{ pointerEvents: "none" }}
                      />
                      <span>Seleccionar todos</span>
                    </button>
                  );
                })()}
                {allColumns.map((c) => {
                  const visible = !draftHiddenCols.has(c.fieldKey);
                  return (
                    <button key={c.fieldKey} type="button" onClick={() => {
                      setDraftHiddenCols((prev) => { const n = new Set(prev); if (visible) n.add(c.fieldKey); else n.delete(c.fieldKey); return n; });
                    }} style={popoverItemBtn}>
                      <input type="checkbox" checked={visible} readOnly style={{ pointerEvents: "none" }} />
                      <span>{c.label}</span>
                    </button>
                  );
                })}
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 6, paddingTop: 8, borderTop: "1px solid #f1f5f9" }}>
                  <button
                    type="button"
                    onClick={() => setShowColumns(false)}
                    style={{ background: "transparent", border: "none", color: "#64748b", fontSize: 12, fontWeight: 600, cursor: "pointer", padding: "6px 10px" }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const next = new Set(draftHiddenCols);
                      setHiddenCols(next);
                      if (typeof window !== "undefined") {
                        try {
                          window.localStorage.setItem(colsStorageKey(), JSON.stringify(Array.from(next)));
                        } catch { /* localStorage lleno o bloqueado: aplicar sin persistir */ }
                      }
                      setShowColumns(false);
                    }}
                    style={{ background: accent, color: "#fff", border: "none", padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                  >
                    Aplicar
                  </button>
                </div>
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
            <button type="button" onClick={() => { setEstadoFilter(new Set()); setSegmentoFilter(new Set()); setResponsableFilter(new Set()); setFechaLimiteMax(""); setClienteQuery(""); setProyectoQuery(""); setFechaMin(""); setFechaMax(""); setQuery(""); }} style={{ background: "transparent", border: "none", color: accent, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              Limpiar filtros
            </button>
          </div>
        ) : null}

        {/* TEST-14 C — Mini-KPIs (Total / Pendiente cards) eliminados:
            redundantes con la paginación "X-Y de N" del pie de tabla y
            con los KPIs del dashboard sectorial. Liberan ~120px que
            recuperan visibilidad para los datos. */}

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
              {query || estadoFilter.size > 0 || segmentoFilter.size > 0 || responsableFilter.size > 0 || fechaLimiteMax || clienteQuery || proyectoQuery || fechaMin || fechaMax ? "Ningún resultado con los filtros actuales." : ui.emptyState + " Pulsa “+ Alta de…” para empezar."}
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="tabla" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
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
                          // Test 19 bis H — Detección por timestamp. Si este
                          // click llega < 350ms después del anterior y hay un
                          // detalle pendiente, es un DOBLE-CLICK → cancelamos
                          // el detalle y abrimos el editor. Si no, es un click
                          // simple → programamos abrir el detalle rápido.
                          const now = Date.now();
                          if (clickTimerRef.current && now - lastClickRef.current < 350) {
                            clearTimeout(clickTimerRef.current);
                            clickTimerRef.current = null;
                            lastClickRef.current = 0;
                            setSelected(item);
                            setModalMode("edit");
                            return;
                          }
                          lastClickRef.current = now;
                          if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
                          clickTimerRef.current = setTimeout(() => {
                            openDetail(item);
                            clickTimerRef.current = null;
                          }, 350);
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
                          const val = item[col.fieldKey];
                          // TEST-2.4 + TEST-3.2b-ii + TEST-4.1.a.iii —
                          // columna "contacto" unificada: si hay
                          // contactosJson, usa el preferido; si no, sintetiza
                          // un "preferido virtual" desde los fields del propio
                          // record (item.contacto / item.email / item.telefono).
                          // Así el formato enriquecido es siempre el mismo.
                          if (col.fieldKey === "contacto") {
                            let nombre = "";
                            let email = "";
                            let tel = "";
                            // Intento 1: contactosJson válido.
                            if (item.contactosJson) {
                              try {
                                const raw = typeof item.contactosJson === "string"
                                  ? JSON.parse(item.contactosJson)
                                  : item.contactosJson;
                                if (Array.isArray(raw) && raw.length > 0) {
                                  const preferido = raw.find((c) => c?.preferido) || raw[0];
                                  if (preferido) {
                                    nombre = String(preferido.nombre || "").trim();
                                    email = String(preferido.email || "").trim();
                                    tel = String(preferido.telefono || "").trim();
                                  }
                                }
                              } catch { /* fallback abajo */ }
                            }
                            // Intento 2 (fallback): record planos.
                            if (!nombre && !email && !tel) {
                              nombre = String(item.contacto || "").trim();
                              email = String(item.email || "").trim();
                              tel = String(item.telefono || item.tel || "").trim();
                            }
                            // TEST-18 A — En la columna CONTACTO solo se
                            // muestra email/tel si el usuario los marca en
                            // "Mostrar columnas" (mismo toggle que el
                            // subtítulo bajo Empresa, ver showEmailSubtitle
                            // / showTelSubtitle). Si no, solo el nombre.
                            const showEmailEnContacto = !(moduleKey === "clientes" || moduleKey === "crm") || showEmailSubtitle;
                            const showTelEnContacto = !(moduleKey === "clientes" || moduleKey === "crm") || showTelSubtitle;
                            const emailLinea = showEmailEnContacto ? email : "";
                            const telLinea = showTelEnContacto ? tel : "";
                            if (nombre || emailLinea || telLinea) {
                              return (
                                <td key={col.fieldKey} style={{ ...tdStyle, color: idx === 0 ? "#0f172a" : "#475569", fontWeight: idx === 0 ? 600 : 400 }}>
                                  <div style={{ lineHeight: 1.3 }}>
                                    <div style={{ color: "#0f172a", fontWeight: 600 }}>{nombre || "—"}</div>
                                    {(emailLinea || telLinea) && (
                                      <div style={{ fontSize: 11, color: "#64748b", marginTop: 2, display: "flex", flexWrap: "wrap", gap: 8 }}>
                                        {emailLinea && <span title={emailLinea}>✉ {emailLinea}</span>}
                                        {telLinea && <span title={telLinea}>☎ {telLinea}</span>}
                                      </div>
                                    )}
                                  </div>
                                </td>
                              );
                            }
                          }
                          const valStr = val == null || val === "" ? "—" : String(val);
                          // Test 23 — Niveles Tipo E: la columna Servicio muestra
                          // "Mantº Errores <aplicación>" (el Servicio de un Nivel E
                          // es una Aplicación, guardada en el campo `aplicacion`).
                          if (moduleKey === "niveles" && col.fieldKey === "servicio" && String(item.tipoNivel || "").toUpperCase() === "E") {
                            const appRaw = String(item.aplicacion || "").trim();
                            const appLabel = appRaw ? labelForValue("aplicacion", appRaw) : "";
                            return (
                              <td key={col.fieldKey} style={{ ...tdStyle, color: idx === 0 ? "#0f172a" : "#475569" }}>
                                {appLabel ? "Mantº Errores " + appLabel : <span style={{ color: "#94a3b8" }}>—</span>}
                              </td>
                            );
                          }
                          // Test 21 — Niveles: la columna Valor se muestra con su
                          // unidad contextual (€ / €/h / h) según Tipo+Modelo, no
                          // siempre € como haría el formato money por defecto.
                          if (moduleKey === "niveles" && col.fieldKey === "precio") {
                            // Test 22 bis — En la LISTA, el Valor se formatea
                            // xxx.xxx,xx (miles + 2 decimales), con su unidad
                            // contextual, y alineado a la derecha. (En el
                            // formulario se deja a la izquierda, como pidió Pedro.)
                            const unidad = valStr === "—" ? "" : nivelValorUnidad(String(item.tipoNivel || ""), String(item.modelo || ""));
                            const num = parseFloat(valStr.replace(/\./g, "").replace(",", "."));
                            const fmt = Number.isFinite(num)
                              ? num.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                              : valStr;
                            // Test 22 bis (corrección Pedro) — El NÚMERO se alinea
                            // a la derecha y la UNIDAD va en una columna fija a su
                            // lado. Así los números cuadran aunque la unidad mida
                            // distinto ("€" vs "€/h"): antes se alineaba el bloque
                            // "número+unidad" entero y la unidad desplazaba el número.
                            return (
                              <td key={col.fieldKey} style={{ ...tdStyle, color: idx === 0 ? "#0f172a" : "#475569", fontWeight: 600 }}>
                                {valStr === "—" ? (
                                  <span style={{ color: "#94a3b8", display: "block", textAlign: "right" }}>—</span>
                                ) : (
                                  <span style={{ display: "flex", justifyContent: "flex-end", alignItems: "baseline", gap: 6, fontVariantNumeric: "tabular-nums" }}>
                                    <span style={{ textAlign: "right" }}>{fmt}</span>
                                    <span style={{ display: "inline-block", minWidth: 34, textAlign: "left", color: "#94a3b8", fontWeight: 500 }}>{unidad}</span>
                                  </span>
                                )}
                              </td>
                            );
                          }
                          // TEST-10.5 — Para campos con opciones (prioridad,
                          // estado…) se muestra la etiqueta, no el valor crudo
                          // (p.ej. prioridad "1" → "Urgente").
                          const display = labelForValue(col.fieldKey, valStr);
                          return (
                            <td key={col.fieldKey} style={{ ...tdStyle, color: idx === 0 ? "#0f172a" : "#475569", fontWeight: idx === 0 ? 600 : 400 }}>
                              {renderCell(col.fieldKey, display, idx === 0 ? item : null, moduleKey, { showEmailSubtitle, showTelSubtitle })}
                            </td>
                          );
                        })}
                        {/* TEST-2.12 — menú "..." consolidado con Editar / Email
                            / Llamar / Eliminar / Copiar. Antes solo abría editor. */}
                        <td style={{ ...tdStyle, textAlign: "right", whiteSpace: "nowrap" }} onClick={(e) => e.stopPropagation()}>
                          {extraRowActions ? extraRowActions(item) : null}
                          <button
                            type="button"
                            onClick={(e) => {
                              if (rowMenuOpenId === id) {
                                setRowMenuOpenId(null);
                                setRowMenuPos(null);
                                return;
                              }
                              const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                              setRowMenuPos({
                                top: rect.bottom + 6,
                                right: window.innerWidth - rect.right,
                              });
                              setRowMenuOpenId(id);
                            }}
                            title="Acciones rápidas"
                            style={{ background: "transparent", border: "none", padding: 4, cursor: "pointer", color: "#94a3b8", fontSize: 16 }}
                          >
                            ⋯
                          </button>
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

      {/* TEST-5.G.1 — Popover de fila renderizado a nivel raíz con position:fixed
          para que NO lo recorte el overflow:hidden de la tabla. Se posiciona
          con las coordenadas capturadas en el click del botón ⋯. */}
      {rowMenuOpenId && rowMenuPos ? (() => {
        const item = rows.find((r) => String(r.id) === rowMenuOpenId);
        if (!item) return null;
        const closeMenu = () => { setRowMenuOpenId(null); setRowMenuPos(null); };
        return (
          <>
            <div onClick={closeMenu} style={{ position: "fixed", inset: 0, zIndex: 1000 }} />
            <div style={{
              position: "fixed",
              top: rowMenuPos.top,
              right: rowMenuPos.right,
              minWidth: 180,
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: 10,
              boxShadow: "0 10px 30px rgba(15,23,42,0.18)",
              zIndex: 1001,
              padding: 6,
            }}>
              <button type="button" style={popoverItemBtn} onClick={() => { closeMenu(); setSelected(item); setModalMode("edit"); }}>
                <span>✎</span><span>Editar</span>
              </button>
              {item.email ? (
                <a href={"mailto:" + item.email + "?subject=" + encodeURIComponent("Contacto desde " + ui.label)} style={popoverItem} onClick={closeMenu}>
                  <span>✉️</span> Enviar email
                </a>
              ) : null}
              {item.telefono || item.tel ? (
                <a href={"tel:" + String(item.telefono || item.tel)} style={popoverItem} onClick={closeMenu}>
                  <span>📞</span> Llamar
                </a>
              ) : null}
              <button type="button" style={popoverItemBtn} onClick={async () => {
                closeMenu();
                // TEST-3.3 — "Copiar" (antes "Duplicar"): clona payload sin id.
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
              <button type="button" style={{ ...popoverItemBtn, color: "#dc2626" }} onClick={() => {
                // TEST-10.10 — Diálogo propio (no confirm() del navegador) que
                // indica QUÉ registro se va a eliminar.
                closeMenu();
                setRowDeleteRec(item);
              }}>
                <span>🗑</span><span>Eliminar</span>
              </button>
            </div>
          </>
        );
      })() : null}

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
                {/* TEST-10.9 — Todos los estados definidos en el campo, no
                    solo los presentes en los datos. */}
                {fieldOptions("estado").map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
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

      {/* TEST-10.10 — Borrado de un registro: diálogo propio que nombra el
          registro (sustituye al confirm() nativo "app.prontara.com dice").
          Confirmación directa, sin pedir escribir literal. */}
      <DangerConfirm
        open={rowDeleteRec !== null}
        onClose={() => setRowDeleteRec(null)}
        onConfirm={async () => {
          if (rowDeleteRec?.id) await removeRecord(String(rowDeleteRec.id));
          setRowDeleteRec(null);
        }}
        title={
          "¿Eliminar " + singular(ui.label).toLowerCase() +
          (rowDeleteRec
            ? ' "' + String(
                rowDeleteRec[titleField] || rowDeleteRec.titulo || rowDeleteRec.nombre ||
                rowDeleteRec.numero || rowDeleteRec.asunto || "sin título",
              ) + '"'
            : "") + "?"
        }
        description="Esta acción no se puede deshacer."
        requireType={false}
        confirmLabel="Eliminar"
      />

    </TenantShell>
  );
}

// === Render por tipo de campo ===
// Test 21 — Unidad del campo "Valor" de Niveles según Tipo + Modelo
// (coherente con la etiqueta contextual del formulario).
function nivelValorUnidad(tipoNivel: string, modelo: string): string {
  const t = String(tipoNivel || "").toUpperCase();
  const m = String(modelo || "").toLowerCase();
  if (m === "cuota" && (t === "M" || t === "A")) return "€";
  if (m === "horas" && t === "M") return "€/h";
  if (m === "horas" && (t === "A" || t === "B")) return "h";
  return "";
}

function renderCell(
  fieldKey: string,
  val: string,
  primaryRow: Record<string, string> | null,
  moduleKey?: string,
  contactSub?: { showEmailSubtitle?: boolean; showTelSubtitle?: boolean },
) {
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
    // TEST-17 / TEST-17 bis C — En Clientes/Oportunidades el subtítulo
    // de email/tel SOLO aparece si el usuario marcó esas columnas en
    // "Mostrar columnas" (el componente padre nos pasa los flags). En
    // el resto de módulos se mantiene el comportamiento legacy.
    const isClienteOrCrm = moduleKey === "clientes" || moduleKey === "crm";
    const subtitleParts: string[] = [];
    if (isClienteOrCrm) {
      if (contactSub?.showEmailSubtitle && email) subtitleParts.push(email);
      if (contactSub?.showTelSubtitle && tel) subtitleParts.push(tel);
    } else if (email || tel) {
      subtitleParts.push(email || tel);
    }
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <span style={{ width: 30, height: 30, borderRadius: 999, background: tint.bg, color: tint.fg, display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12, flexShrink: 0 }}>{initial}</span>
        <span style={{ minWidth: 0 }}>
          <span style={{ display: "block", color: "#0f172a", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{val}</span>
          {subtitleParts.length > 0 ? (
            <span style={{ display: "block", color: "#94a3b8", fontSize: 11 }}>
              {subtitleParts.join(" · ")}
            </span>
          ) : null}
        </span>
      </span>
    );
  }
  return <span>{val}</span>;
}

// === Singular del label (Clientes → cliente) ===
// TEST-1.2 — overrides para palabras castellanas comunes. Fallback "quitar s"
// solo si no hay override. Antes "Clientes" → "client" porque slice(-2) en "es".
// TEST-16 — `singular()` y `SINGULAR_OVERRIDES` movidos al helper
// compartido `@/lib/text/singular`. Ver el fichero para la lista actual.
// Esta página lo importa arriba (no se reexporta aquí para evitar tener
// dos puntos de import).

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

// TEST-14 C — `MiniKpi` y `KPI_TINTS` eliminados: solo se usaban en la
// cabecera del listado, que ya no muestra las cards de Total/Pendiente
// (cabecera compactada). Si en el futuro algún dashboard quiere
// reutilizar la card, se reextrae a su propio fichero shared.

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
  // TEST-10.5 — Resuelve la etiqueta de un campo con opciones (prioridad "1"
  // → "Urgente", estado "en_progreso" → "En progreso").
  const resolveLabel = (key: string, raw: string): string => {
    const f = fields.find((x) => x.key === key);
    if (f?.options && raw) {
      const hit = f.options.find((o) => String(o.value) === raw);
      if (hit) return String(hit.label || hit.value);
    }
    return raw;
  };
  const estado = resolveLabel("estado", String(record.estado || ""));
  const segmento = record.tipo
    ? resolveLabel("tipo", String(record.tipo))
    : resolveLabel("segmento", String(record.segmento || ""));
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
          {extras.slice(0, 6).map((f) => <DrawerKv key={f.key} label={f.label} value={resolveLabel(f.key, String(record[f.key] || "")) || "—"} />)}
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
// TEST-8bis2 — Bloque de filtro con checkboxes multi-select genérico.
// Recibe la lista de valores posibles, el Set seleccionado (lowercased) y
// devuelve el nuevo Set vía onChange. Si la lista de valores es vacía, no
// renderiza nada (no hay opciones para filtrar).
function CheckboxFilterGroup({
  label,
  options,
  selected,
  onChange,
  accent,
}: {
  label: string;
  // TEST-10.2 — cada opción lleva value (lo que se guarda/compara, en
  // minúscula) y label (lo que se muestra).
  options: Array<{ value: string; label: string }>;
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  accent: string;
}) {
  if (options.length === 0) return null;
  function toggle(v: string) {
    const key = v.toLowerCase();
    const next = new Set(selected);
    if (next.has(key)) next.delete(key); else next.add(key);
    onChange(next);
  }
  function selectAll() { onChange(new Set(options.map((o) => o.value.toLowerCase()))); }
  function clearAll() { onChange(new Set()); }
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
        <span style={filterLabel}>{label}</span>
        <span style={{ fontSize: 10, color: "#94a3b8" }}>
          {selected.size > 0 ? (
            <button type="button" onClick={clearAll} style={{ background: "transparent", border: "none", color: "#64748b", fontSize: 10, fontWeight: 600, cursor: "pointer", padding: 0 }}>Limpiar</button>
          ) : (
            <button type="button" onClick={selectAll} style={{ background: "transparent", border: "none", color: accent, fontSize: 10, fontWeight: 600, cursor: "pointer", padding: 0 }}>Todos</button>
          )}
        </span>
      </div>
      <div style={{ display: "grid", gap: 4, maxHeight: 180, overflowY: "auto", padding: "4px 2px", border: "1px solid #e5e7eb", borderRadius: 6 }}>
        {options.map((o) => {
          const key = o.value.toLowerCase();
          const checked = selected.has(key);
          return (
            <label key={o.value} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 6px", borderRadius: 4, cursor: "pointer", fontSize: 13, color: "#0f172a", background: checked ? "#eff6ff" : "transparent" }}>
              <input type="checkbox" checked={checked} onChange={() => toggle(o.value)} style={{ cursor: "pointer" }} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {o.label.charAt(0).toUpperCase() + o.label.slice(1)}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

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
