"use client";

import { useEffect, useMemo, useState } from "react";
import TenantShell from "@/components/erp/tenant-shell";
import EntityBreadcrumb from "@/components/erp/entity-breadcrumb";
import EntityStatusBadge from "@/components/erp/entity-status-badge";
import ErpRecordModal from "@/components/erp/erp-record-modal";
import ErpDeleteButton from "@/components/erp/erp-delete-button";
import SlideOverPanel from "@/components/erp/slide-over-panel";

/**
 * Hub de Producción.
 *
 * El usuario elige un proyecto del selector superior; debajo, tabs con cada
 * sub-módulo de ejecución filtrado por ese proyecto:
 *   - Resumen (KPIs del proyecto)
 *   - Tareas
 *   - Actividades / parte de horas
 *   - Incidencias
 *   - Versiones
 *   - Mantenimientos
 *   - Justificantes
 *   - Descripción
 *
 * Cada tab carga el módulo correspondiente vía /api/erp/module y filtra por
 * el campo "proyecto" (que en demo es el nombre del proyecto). Al pulsar
 * Nuevo o Editar abre el slide-over con el formulario sectorial.
 */

type Project = {
  id: string;
  nombre: string;
  cliente?: string;
  responsable?: string;
  estado?: string;
  prioridad?: string;
};

type TabKey =
  | "resumen"
  | "tareas"
  | "actividades"
  | "incidencias"
  | "versiones"
  | "mantenimientos"
  | "justificantes"
  | "descripciones-proyecto";

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

type ModuleUi = {
  label: string;
  fields: FieldDef[];
  tableColumns: TableColumnDef[];
};

const TABS: Array<{ key: TabKey; label: string; helper: string }> = [
  { key: "resumen", label: "Resumen", helper: "KPIs del proyecto" },
  { key: "tareas", label: "Tareas", helper: "Backlog y trabajo en curso" },
  { key: "actividades", label: "Parte de horas", helper: "Imputación de horas" },
  { key: "incidencias", label: "Incidencias", helper: "Bugs y consultas" },
  { key: "versiones", label: "Versiones", helper: "Releases del proyecto" },
  { key: "mantenimientos", label: "Mantenimientos", helper: "Bolsas de horas" },
  { key: "justificantes", label: "Justificantes", helper: "Albaranes firmados" },
  { key: "descripciones-proyecto", label: "Descripción", helper: "Scope y riesgos" },
];

function readTenant() {
  if (typeof window === "undefined") return "";
  return String(new URLSearchParams(window.location.search).get("tenant") || "").trim();
}

function readSectorPack() {
  if (typeof window === "undefined") return "";
  return String(new URLSearchParams(window.location.search).get("sectorPack") || "").trim();
}

function buildQs(extra?: Record<string, string>) {
  const tenant = readTenant();
  const sectorPack = readSectorPack();
  const params: string[] = [];
  if (tenant) params.push("tenant=" + encodeURIComponent(tenant));
  if (sectorPack) params.push("sectorPack=" + encodeURIComponent(sectorPack));
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      if (v) params.push(encodeURIComponent(k) + "=" + encodeURIComponent(v));
    }
  }
  return params.length ? "?" + params.join("&") : "";
}

export default function ProduccionPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [tab, setTab] = useState<TabKey>("resumen");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  // Datos por módulo (los cargamos lazy cuando cambia tab)
  const [moduleRows, setModuleRows] = useState<Record<string, Array<Record<string, string>>>>({});
  const [moduleUi, setModuleUi] = useState<Record<string, ModuleUi>>({});

  // Slide-over crear/editar
  const [editingRecord, setEditingRecord] = useState<Record<string, string> | null>(null);
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);

  // Cargar lista de proyectos al inicio
  useEffect(() => {
    void loadProjects();
    void loadConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cargar datos del tab activo cuando cambia tab o proyecto
  useEffect(() => {
    if (tab === "resumen" || !selectedProject) return;
    void loadModule(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, selectedProject]);

  async function loadProjects() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/erp/module?module=proyectos" + buildQs().replace("?", "&"), { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "No se pudieron cargar los proyectos.");
      }
      const rows = (Array.isArray(data.rows) ? data.rows : []) as Project[];
      setProjects(rows);
      if (rows.length > 0 && !selectedProject) {
        setSelectedProject(rows[0].nombre || "");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar los proyectos.");
    } finally {
      setBusy(false);
    }
  }

  async function loadConfig() {
    try {
      const res = await fetch("/api/runtime/tenant-config" + buildQs(), { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.ok) return;
      const config = data.config || {};
      const fieldsByModule = (config.fieldsByModule || {}) as Record<string, FieldDef[]>;
      const tableColumnsByModule = (config.tableColumnsByModule || {}) as Record<string, TableColumnDef[]>;
      const labels = (config.labels || {}) as Record<string, string>;
      const navigationLabelMap = (config.navigationLabelMap || {}) as Record<string, string>;

      const result: Record<string, ModuleUi> = {};
      for (const t of TABS) {
        if (t.key === "resumen") continue;
        const moduleKey = t.key;
        result[moduleKey] = {
          label: labels[moduleKey] || navigationLabelMap[moduleKey] || t.label,
          fields: fieldsByModule[moduleKey] || [],
          tableColumns: tableColumnsByModule[moduleKey] || [],
        };
      }
      setModuleUi(result);
    } catch {
      // Ignoramos: usamos fallbacks.
    }
  }

  async function loadModule(moduleKey: string) {
    try {
      const res = await fetch(
        "/api/erp/module?module=" + encodeURIComponent(moduleKey) + buildQs().replace("?", "&"),
        { cache: "no-store" },
      );
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "No se pudo cargar " + moduleKey + ".");
      }
      setModuleRows((prev) => ({ ...prev, [moduleKey]: Array.isArray(data.rows) ? data.rows : [] }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar " + moduleKey + ".");
    }
  }

  // Filtrado por proyecto seleccionado
  function rowsForCurrentTab(): Array<Record<string, string>> {
    if (tab === "resumen") return [];
    const all = moduleRows[tab] || [];
    if (!selectedProject) return all;
    return all.filter(
      (r) => String(r.proyecto || "").toLowerCase() === selectedProject.toLowerCase(),
    );
  }

  async function saveRecord(payload: Record<string, string>) {
    if (tab === "resumen") return;
    const moduleKey = tab;
    const tenant = readTenant();
    const sectorPack = readSectorPack();
    const enrichedPayload = { ...payload, proyecto: payload.proyecto || selectedProject };

    if (modalMode === "create") {
      const res = await fetch("/api/erp/module", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          module: moduleKey,
          mode: "create",
          payload: enrichedPayload,
          tenant,
          sectorPack,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo guardar.");
    }

    if (modalMode === "edit" && editingRecord?.id) {
      const res = await fetch("/api/erp/module", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          module: moduleKey,
          mode: "edit",
          recordId: editingRecord.id,
          payload: enrichedPayload,
          tenant,
          sectorPack,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo actualizar.");
    }

    await loadModule(moduleKey);
  }

  async function removeRecord(recordId: string) {
    if (tab === "resumen") return;
    const moduleKey = tab;
    const tenant = readTenant();
    const sectorPack = readSectorPack();
    const res = await fetch("/api/erp/module", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        module: moduleKey,
        mode: "delete",
        recordId,
        tenant,
        sectorPack,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo borrar.");
    await loadModule(moduleKey);
  }

  // Usado por el kanban: cambia el campo "estado" de una tarea sin abrir el
  // formulario completo. Optimistic update para que la card se mueva al
  // instante; si la API falla, se recarga el módulo.
  async function changeFieldQuick(
    item: Record<string, string>,
    fieldKey: string,
    newValue: string,
  ) {
    if (tab === "resumen" || !item.id) return;
    const moduleKey = tab;
    const tenant = readTenant();
    const sectorPack = readSectorPack();

    // Optimistic: actualizamos la fila localmente.
    setModuleRows((prev) => {
      const list = prev[moduleKey] || [];
      const next = list.map((r) =>
        r.id === item.id ? { ...r, [fieldKey]: newValue } : r,
      );
      return { ...prev, [moduleKey]: next };
    });

    try {
      const res = await fetch("/api/erp/module", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          module: moduleKey,
          mode: "edit",
          recordId: item.id,
          payload: { ...item, [fieldKey]: newValue },
          tenant,
          sectorPack,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo actualizar.");
    } catch (err) {
      console.error("[changeFieldQuick] rollback:", err);
      await loadModule(moduleKey);
    }
  }

  // Calcular KPIs del Resumen
  const resumen = useMemo(() => {
    if (!selectedProject) return null;
    function cnt(moduleKey: TabKey, predicate?: (r: Record<string, string>) => boolean): number {
      const all = moduleRows[moduleKey] || [];
      const filtered = all.filter(
        (r) => String(r.proyecto || "").toLowerCase() === selectedProject.toLowerCase(),
      );
      return predicate ? filtered.filter(predicate).length : filtered.length;
    }
    function sumHoras(moduleKey: TabKey, predicate?: (r: Record<string, string>) => boolean): number {
      const all = moduleRows[moduleKey] || [];
      const filtered = all.filter(
        (r) => String(r.proyecto || "").toLowerCase() === selectedProject.toLowerCase(),
      );
      const list = predicate ? filtered.filter(predicate) : filtered;
      return list.reduce((acc, r) => acc + (parseFloat(String(r.horas || "0")) || 0), 0);
    }
    return {
      tareasTotales: cnt("tareas"),
      tareasEnCurso: cnt("tareas", (r) => r.estado === "en_curso"),
      tareasBloqueadas: cnt("tareas", (r) => r.estado === "bloqueada"),
      tareasHechas: cnt("tareas", (r) => r.estado === "hecho"),
      incidenciasAbiertas: cnt(
        "incidencias",
        (r) => r.estado !== "resuelta" && r.estado !== "cerrada",
      ),
      incidenciasCriticas: cnt(
        "incidencias",
        (r) =>
          r.severidad === "critica" && r.estado !== "resuelta" && r.estado !== "cerrada",
      ),
      horasImputadas: sumHoras("actividades"),
      horasFacturables: sumHoras("actividades", (r) => r.facturable === "si"),
      versionesPublicadas: cnt("versiones", (r) => r.estado === "publicada"),
      versionesEnDesarrollo: cnt(
        "versiones",
        (r) => r.estado === "en_desarrollo" || r.estado === "en_pruebas",
      ),
      mantenimientosActivos: cnt("mantenimientos"),
      justificantesFirmados: cnt("justificantes", (r) => r.estado === "firmado"),
    };
  }, [moduleRows, selectedProject]);

  // Pre-cargar TODOS los módulos cuando entras al Resumen para que los KPIs reflejen datos reales
  useEffect(() => {
    if (tab !== "resumen" || !selectedProject) return;
    void Promise.all([
      loadModule("tareas"),
      loadModule("incidencias"),
      loadModule("actividades"),
      loadModule("versiones"),
      loadModule("mantenimientos"),
      loadModule("justificantes"),
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, selectedProject]);

  const currentProjectMeta = projects.find((p) => p.nombre === selectedProject);
  const currentUi = tab === "resumen" ? null : moduleUi[tab];
  const filteredRows = rowsForCurrentTab();

  // Columnas: del sector pack si están, fallback derivado de fields
  const columns: TableColumnDef[] =
    currentUi && currentUi.tableColumns.length > 0
      ? currentUi.tableColumns
      : currentUi
        ? currentUi.fields.slice(0, 5).map((f) => ({ fieldKey: f.key, label: f.label }))
        : [];

  return (
    <TenantShell>
      <div style={{ maxWidth: 1280, margin: "0 auto", display: "grid", gap: 18 }}>
        <header style={{ display: "grid", gap: 10 }}>
          <EntityBreadcrumb
            items={[
              { href: "/", label: "Inicio" },
              { href: "/produccion", label: "Producción" },
              ...(selectedProject ? [{ label: selectedProject }] : []),
            ]}
          />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 28, color: "#0f172a" }}>Producción</h1>
              <p style={{ margin: "4px 0 0 0", color: "#6b7280", fontSize: 14 }}>
                Ejecución del proyecto: tareas, incidencias, horas, versiones y entregas.
              </p>
            </div>
          </div>
        </header>

        {/* Selector de proyecto */}
        <section
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: 10,
            padding: "10px 14px",
            flexWrap: "wrap",
          }}
        >
          <label style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Proyecto:</label>
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            style={{
              padding: "8px 12px",
              border: "1px solid #d1d5db",
              borderRadius: 8,
              fontSize: 14,
              background: "#ffffff",
              minWidth: 280,
            }}
          >
            {projects.length === 0 ? (
              <option value="">Sin proyectos</option>
            ) : (
              projects.map((p) => (
                <option key={p.id} value={p.nombre}>
                  {p.nombre}
                </option>
              ))
            )}
          </select>
          {currentProjectMeta?.cliente ? (
            <span style={{ fontSize: 12, color: "#6b7280" }}>
              Cliente: <strong style={{ color: "#374151" }}>{currentProjectMeta.cliente}</strong>
            </span>
          ) : null}
          {currentProjectMeta?.estado ? (
            <EntityStatusBadge value={currentProjectMeta.estado} />
          ) : null}
          {currentProjectMeta?.responsable ? (
            <span style={{ fontSize: 12, color: "#6b7280" }}>
              Lead: <strong style={{ color: "#374151" }}>{currentProjectMeta.responsable}</strong>
            </span>
          ) : null}
        </section>

        {/* Tabs */}
        <nav
          style={{
            display: "flex",
            gap: 2,
            borderBottom: "1px solid #e5e7eb",
            overflowX: "auto",
          }}
        >
          {TABS.map((t) => {
            const active = t.key === tab;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                style={{
                  border: "none",
                  background: "transparent",
                  padding: "10px 16px",
                  fontSize: 13,
                  fontWeight: active ? 700 : 500,
                  color: active ? "#1d4ed8" : "#6b7280",
                  borderBottom: active ? "2px solid #1d4ed8" : "2px solid transparent",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  marginBottom: -1,
                }}
              >
                {t.label}
              </button>
            );
          })}
        </nav>

        {error ? (
          <div
            style={{
              border: "1px solid #fecaca",
              background: "#fef2f2",
              color: "#991b1b",
              borderRadius: 8,
              padding: 12,
              fontSize: 14,
            }}
          >
            {error}
          </div>
        ) : null}

        {busy ? (
          <div style={{ padding: 40, textAlign: "center", color: "#6b7280", fontSize: 14 }}>
            Cargando proyectos...
          </div>
        ) : tab === "resumen" ? (
          <ResumenView resumen={resumen} project={currentProjectMeta || null} />
        ) : !selectedProject ? (
          <div
            style={{
              padding: 40,
              textAlign: "center",
              color: "#6b7280",
              fontSize: 14,
              border: "1px dashed #d1d5db",
              borderRadius: 12,
              background: "#ffffff",
            }}
          >
            Selecciona un proyecto para ver sus {TABS.find((t) => t.key === tab)?.label.toLowerCase()}.
          </div>
        ) : (
          <ModuleView
            tab={tab}
            label={currentUi?.label || tab}
            rows={filteredRows}
            columns={columns}
            onCreate={() => {
              setEditingRecord(null);
              setModalMode("create");
            }}
            onEdit={(item) => {
              setEditingRecord(item);
              setModalMode("edit");
            }}
            onDelete={async (id) => removeRecord(id)}
            onChangeField={changeFieldQuick}
          />
        )}
      </div>

      {/* Slide-over crear/editar */}
      {currentUi ? (
        <ErpRecordModal
          open={modalMode !== null}
          mode={modalMode || "create"}
          title={
            modalMode === "edit"
              ? "Editar en " + currentUi.label
              : "Nuevo en " + currentUi.label + " (proyecto: " + selectedProject + ")"
          }
          fields={
            currentUi.fields as Array<{
              key: string;
              label: string;
              kind: "text" | "email" | "tel" | "textarea" | "date" | "number" | "money" | "status" | "relation";
              required?: boolean;
              relationModuleKey?: string;
              placeholder?: string;
            }>
          }
          initialValue={
            modalMode === "edit"
              ? editingRecord
              : { proyecto: selectedProject } // pre-fill del proyecto al crear
          }
          tenant={readTenant() || undefined}
          onClose={() => {
            setModalMode(null);
            setEditingRecord(null);
          }}
          onSubmit={saveRecord}
        />
      ) : null}
    </TenantShell>
  );
}

// ─── Sub-vistas ───────────────────────────────────────────────────────

type ResumenSnapshot = {
  tareasTotales: number;
  tareasEnCurso: number;
  tareasBloqueadas: number;
  tareasHechas: number;
  incidenciasAbiertas: number;
  incidenciasCriticas: number;
  horasImputadas: number;
  horasFacturables: number;
  versionesPublicadas: number;
  versionesEnDesarrollo: number;
  mantenimientosActivos: number;
  justificantesFirmados: number;
};

function ResumenView({
  resumen,
  project,
}: {
  resumen: ResumenSnapshot | null;
  project: Project | null;
}) {
  if (!project) {
    return (
      <div
        style={{
          padding: 40,
          textAlign: "center",
          color: "#6b7280",
          fontSize: 14,
          border: "1px dashed #d1d5db",
          borderRadius: 12,
          background: "#ffffff",
        }}
      >
        Selecciona un proyecto para ver su resumen.
      </div>
    );
  }
  const cards = [
    { label: "Tareas en curso", value: String(resumen?.tareasEnCurso ?? "—"), helper: (resumen?.tareasTotales ?? 0) + " totales" },
    { label: "Tareas bloqueadas", value: String(resumen?.tareasBloqueadas ?? "—"), helper: "Necesitan desbloqueo", tone: (resumen?.tareasBloqueadas || 0) > 0 ? "warn" : undefined },
    { label: "Incidencias abiertas", value: String(resumen?.incidenciasAbiertas ?? "—"), helper: (resumen?.incidenciasCriticas || 0) + " críticas", tone: (resumen?.incidenciasCriticas || 0) > 0 ? "danger" : undefined },
    { label: "Horas imputadas", value: (resumen?.horasImputadas ?? 0).toFixed(1), helper: (resumen?.horasFacturables ?? 0).toFixed(1) + " facturables" },
    { label: "Versiones", value: String(resumen?.versionesPublicadas ?? "—") + " publicadas", helper: (resumen?.versionesEnDesarrollo ?? 0) + " en curso" },
    { label: "Mantenimientos", value: String(resumen?.mantenimientosActivos ?? "—"), helper: "Bolsas activas" },
    { label: "Justificantes firmados", value: String(resumen?.justificantesFirmados ?? "—"), helper: "Cliente conformado" },
    { label: "Tareas hechas", value: String(resumen?.tareasHechas ?? "—"), helper: "En este proyecto" },
  ];
  return (
    <section
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 12,
      }}
    >
      {cards.map((c) => {
        const toneColor =
          c.tone === "danger" ? "#dc2626" : c.tone === "warn" ? "#d97706" : "#0f172a";
        return (
          <article
            key={c.label}
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              background: "#ffffff",
              padding: 14,
              display: "grid",
              gap: 4,
            }}
          >
            <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>
              {c.label}
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: toneColor }}>{c.value}</div>
            <div style={{ fontSize: 12, color: "#9ca3af" }}>{c.helper}</div>
          </article>
        );
      })}
    </section>
  );
}

function ModuleView({
  tab,
  label,
  rows,
  columns,
  onCreate,
  onEdit,
  onDelete,
  onChangeField,
}: {
  tab: TabKey;
  label: string;
  rows: Array<Record<string, string>>;
  columns: TableColumnDef[];
  onCreate: () => void;
  onEdit: (item: Record<string, string>) => void;
  onDelete: (id: string) => Promise<void>;
  onChangeField?: (item: Record<string, string>, fieldKey: string, newValue: string) => Promise<void>;
}) {
  const supportsKanban = tab === "tareas" || tab === "incidencias";
  const [view, setView] = useState<"tabla" | "kanban">("tabla");

  return (
    <section
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        background: "#ffffff",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid #e5e7eb",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 16, color: "#0f172a" }}>{label}</h2>
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
            {rows.length} {rows.length === 1 ? "registro" : "registros"} en este proyecto
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {supportsKanban ? (
            <div
              style={{
                display: "flex",
                border: "1px solid #d1d5db",
                borderRadius: 8,
                overflow: "hidden",
              }}
            >
              <button
                type="button"
                onClick={() => setView("tabla")}
                style={{
                  border: "none",
                  background: view === "tabla" ? "#0f172a" : "#ffffff",
                  color: view === "tabla" ? "#ffffff" : "#374151",
                  padding: "6px 12px",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Tabla
              </button>
              <button
                type="button"
                onClick={() => setView("kanban")}
                style={{
                  border: "none",
                  background: view === "kanban" ? "#0f172a" : "#ffffff",
                  color: view === "kanban" ? "#ffffff" : "#374151",
                  padding: "6px 12px",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Kanban
              </button>
            </div>
          ) : null}
          <button
            type="button"
            onClick={onCreate}
            style={{
              border: "none",
              borderRadius: 8,
              background: "#1d4ed8",
              color: "#ffffff",
              padding: "8px 14px",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            + Nuevo
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", color: "#6b7280", fontSize: 14 }}>
          Sin {label.toLowerCase()} en este proyecto. Pulsa “Nuevo” para crear el primero.
        </div>
      ) : supportsKanban && view === "kanban" ? (
        <KanbanView tab={tab} rows={rows} onEdit={onEdit} onChangeField={onChangeField} />
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                {columns.map((col) => (
                  <th
                    key={col.fieldKey}
                    style={{
                      textAlign: "left",
                      padding: "10px 14px",
                      fontWeight: 600,
                      fontSize: 11,
                      color: "#6b7280",
                      textTransform: "uppercase",
                      letterSpacing: 0.4,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {col.label}
                  </th>
                ))}
                <th
                  style={{
                    padding: "10px 14px",
                    textAlign: "right",
                    fontWeight: 600,
                    fontSize: 11,
                    color: "#6b7280",
                    textTransform: "uppercase",
                    letterSpacing: 0.4,
                  }}
                >
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => (
                <tr
                  key={item.id}
                  style={{ borderBottom: "1px solid #f3f4f6", cursor: "pointer" }}
                  onClick={() => onEdit(item)}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f9fafb")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  {columns.map((col, idx) => {
                    const val = String(item[col.fieldKey] || "—");
                    const isStatus =
                      col.fieldKey === "estado" ||
                      col.fieldKey === "severidad" ||
                      col.fieldKey === "prioridad" ||
                      col.fieldKey === "modalidad" ||
                      col.fieldKey === "tipo" ||
                      col.fieldKey === "estadoSituacional";
                    return (
                      <td
                        key={col.fieldKey}
                        style={{
                          padding: "10px 14px",
                          color: idx === 0 ? "#0f172a" : "#374151",
                          fontWeight: idx === 0 ? 600 : 400,
                        }}
                      >
                        {isStatus ? <EntityStatusBadge value={val} /> : val}
                      </td>
                    );
                  })}
                  <td
                    style={{ padding: "8px 14px", textAlign: "right", whiteSpace: "nowrap" }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {tab === "justificantes" ? (
                      <a
                        href={
                          "/api/erp/justificante-pdf?" +
                          new URLSearchParams({
                            numero: String(item.numero || ""),
                            proyecto: String(item.proyecto || ""),
                            fecha: String(item.fecha || ""),
                            horas: String(item.horas || ""),
                            trabajos: String(item.trabajos || ""),
                            estado: String(item.estado || ""),
                            personaResponsable: String(item.personaResponsable || ""),
                            personaCliente: String(item.personaCliente || ""),
                            version: String(item.version || ""),
                            notas: String(item.notas || ""),
                          }).toString()
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          border: "1px solid #1d4ed8",
                          background: "#ffffff",
                          color: "#1d4ed8",
                          borderRadius: 6,
                          padding: "5px 10px",
                          fontSize: 12,
                          fontWeight: 700,
                          textDecoration: "none",
                          marginRight: 6,
                        }}
                      >
                        ↓ PDF
                      </a>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => onEdit(item)}
                      style={{
                        border: "1px solid #d1d5db",
                        borderRadius: 6,
                        background: "#ffffff",
                        padding: "5px 10px",
                        cursor: "pointer",
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#374151",
                        marginRight: 6,
                      }}
                    >
                      Editar
                    </button>
                    <ErpDeleteButton
                      confirmText="¿Borrar este registro?"
                      onDelete={async () => onDelete(String(item.id || ""))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ─── KanbanView ───────────────────────────────────────────────────────

type KanbanColumn = { key: string; label: string; tone: string };

const KANBAN_COLUMNS_TAREAS: KanbanColumn[] = [
  { key: "backlog", label: "Backlog", tone: "#94a3b8" },
  { key: "en_curso", label: "En curso", tone: "#1d4ed8" },
  { key: "en_revision", label: "En revisión", tone: "#7c3aed" },
  { key: "hecho", label: "Hecho", tone: "#16a34a" },
  { key: "bloqueada", label: "Bloqueada", tone: "#dc2626" },
];

const KANBAN_COLUMNS_INCIDENCIAS: KanbanColumn[] = [
  { key: "abierta", label: "Abierta", tone: "#dc2626" },
  { key: "en_curso", label: "En curso", tone: "#1d4ed8" },
  { key: "esperando_cliente", label: "Esperando cliente", tone: "#d97706" },
  { key: "resuelta", label: "Resuelta", tone: "#16a34a" },
  { key: "cerrada", label: "Cerrada", tone: "#6b7280" },
];

function KanbanView({
  tab,
  rows,
  onEdit,
  onChangeField,
}: {
  tab: TabKey;
  rows: Array<Record<string, string>>;
  onEdit: (item: Record<string, string>) => void;
  onChangeField?: (item: Record<string, string>, fieldKey: string, newValue: string) => Promise<void>;
}) {
  const columns: KanbanColumn[] =
    tab === "incidencias" ? KANBAN_COLUMNS_INCIDENCIAS : KANBAN_COLUMNS_TAREAS;

  // Agrupar filas por estado, dejando una columna "Otros" para los que no
  // matchean (defensivo por si alguien creó un estado custom).
  const grouped = useMemo(() => {
    const map: Record<string, Array<Record<string, string>>> = {};
    for (const col of columns) map[col.key] = [];
    const otros: Array<Record<string, string>> = [];
    for (const r of rows) {
      const e = String(r.estado || "").trim().toLowerCase();
      if (map[e]) map[e].push(r);
      else otros.push(r);
    }
    return { map, otros };
  }, [rows, columns]);

  const moveTo = async (item: Record<string, string>, targetState: string) => {
    if (!onChangeField) return;
    if (item.estado === targetState) return;
    await onChangeField(item, "estado", targetState);
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(" + columns.length + ", minmax(220px, 1fr))",
        gap: 12,
        padding: 14,
        overflowX: "auto",
      }}
    >
      {columns.map((col) => {
        const items = grouped.map[col.key] || [];
        return (
          <div
            key={col.key}
            style={{
              background: "#f9fafb",
              border: "1px solid #e5e7eb",
              borderRadius: 10,
              minHeight: 200,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                padding: "10px 12px",
                borderBottom: "1px solid #e5e7eb",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: col.tone, display: "inline-block" }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: 0.4 }}>
                  {col.label}
                </span>
              </div>
              <span
                style={{
                  fontSize: 11,
                  color: "#6b7280",
                  background: "#ffffff",
                  border: "1px solid #e5e7eb",
                  borderRadius: 999,
                  padding: "2px 8px",
                  fontWeight: 600,
                }}
              >
                {items.length}
              </span>
            </div>
            <div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
              {items.length === 0 ? (
                <div style={{ padding: "12px 6px", color: "#9ca3af", fontSize: 11, textAlign: "center" }}>
                  vacío
                </div>
              ) : (
                items.map((item) => (
                  <KanbanCard
                    key={item.id}
                    tab={tab}
                    item={item}
                    columns={columns}
                    accent={col.tone}
                    onEdit={() => onEdit(item)}
                    onMoveTo={moveTo}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}

      {grouped.otros.length > 0 ? (
        <div
          style={{
            background: "#fffbeb",
            border: "1px solid #fde68a",
            borderRadius: 10,
            padding: 12,
            fontSize: 12,
            color: "#92400e",
          }}
        >
          <strong>{grouped.otros.length} sin estado conocido.</strong> Ábrelas y asígnales un estado.
        </div>
      ) : null}
    </div>
  );
}

function KanbanCard({
  tab,
  item,
  columns,
  accent,
  onEdit,
  onMoveTo,
}: {
  tab: TabKey;
  item: Record<string, string>;
  columns: KanbanColumn[];
  accent: string;
  onEdit: () => void;
  onMoveTo: (item: Record<string, string>, target: string) => Promise<void>;
  key?: string | number;
}) {
  const [open, setOpen] = useState(false);
  const titleField = tab === "incidencias" ? "titulo" : "titulo";
  const title = String(item[titleField] || item.codigo || item.numero || item.id || "Sin título");

  // Datos secundarios típicos de una tarea/incidencia
  const asignado = String(item.asignado || "");
  const prioridad = String(item.prioridad || "");
  const severidad = String(item.severidad || "");
  const horasEst = String(item.horasEstimadas || "");
  const horasReal = String(item.horasReales || "");
  const fechaLim = String(item.fechaLimite || "");

  const prioBadge = (() => {
    const v = (prioridad || severidad).toLowerCase();
    if (v === "alta" || v === "critica") return { bg: "#fee2e2", color: "#991b1b", text: v };
    if (v === "media") return { bg: "#fef3c7", color: "#92400e", text: v };
    if (v === "baja") return { bg: "#ecfdf5", color: "#065f46", text: v };
    return null;
  })();

  return (
    <article
      onClick={onEdit}
      style={{
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderLeft: "3px solid " + accent,
        borderRadius: 8,
        padding: "10px 12px",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", lineHeight: 1.3 }}>
        {title}
      </div>

      {asignado || fechaLim || prioBadge ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
          {prioBadge ? (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                padding: "1px 6px",
                borderRadius: 999,
                background: prioBadge.bg,
                color: prioBadge.color,
                textTransform: "uppercase",
                letterSpacing: 0.3,
              }}
            >
              {prioBadge.text}
            </span>
          ) : null}
          {asignado ? (
            <span style={{ fontSize: 11, color: "#6b7280" }}>
              👤 {asignado}
            </span>
          ) : null}
          {fechaLim ? (
            <span style={{ fontSize: 11, color: "#6b7280" }}>
              📅 {fechaLim}
            </span>
          ) : null}
        </div>
      ) : null}

      {horasEst || horasReal ? (
        <div style={{ fontSize: 11, color: "#9ca3af" }}>
          {horasReal || "0"}h de {horasEst || "—"}h
        </div>
      ) : null}

      <div
        onClick={(e) => e.stopPropagation()}
        style={{ display: "flex", justifyContent: "flex-end", gap: 4, marginTop: 4 }}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          style={{
            border: "1px solid #d1d5db",
            background: "#ffffff",
            borderRadius: 4,
            padding: "2px 8px",
            fontSize: 10,
            color: "#374151",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Mover →
        </button>
      </div>

      {open ? (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            background: "#f3f4f6",
            border: "1px solid #d1d5db",
            borderRadius: 6,
            padding: 6,
            display: "flex",
            flexWrap: "wrap",
            gap: 4,
          }}
        >
          {columns
            .filter((c) => c.key !== item.estado)
            .map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => {
                  setOpen(false);
                  void onMoveTo(item, c.key);
                }}
                style={{
                  border: "none",
                  background: c.tone,
                  color: "#ffffff",
                  borderRadius: 4,
                  padding: "3px 8px",
                  fontSize: 10,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {c.label}
              </button>
            ))}
        </div>
      ) : null}
    </article>
  );
}
