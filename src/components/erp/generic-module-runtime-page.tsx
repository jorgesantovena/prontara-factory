"use client";

import { useEffect, useMemo, useState } from "react";
import EntityBreadcrumb from "@/components/erp/entity-breadcrumb";
import EntityContextCard from "@/components/erp/entity-context-card";
import EntityStatusBadge from "@/components/erp/entity-status-badge";
import ErpRecordModal from "@/components/erp/erp-record-modal";
import ErpDeleteButton from "@/components/erp/erp-delete-button";
import TenantShell from "@/components/erp/tenant-shell";
import SlideOverPanel from "@/components/erp/slide-over-panel";

/**
 * Página genérica de un módulo del runtime del tenant.
 *
 * Se encarga de:
 *   - Resolver labels, fields y columnas desde /api/runtime/tenant-config.
 *   - Listar registros desde /api/erp/module en una tabla con búsqueda.
 *   - Crear/editar registros en SlideOverPanel (vía ErpRecordModal).
 *   - Mostrar la ficha del registro seleccionado en SlideOverPanel.
 *   - Envolver todo en TenantShell con sidebar lateral fija.
 *
 * Las páginas /crm, /proyectos, /presupuestos, /facturacion y /documentos
 * son stubs de 5 líneas que solo le pasan el moduleKey + href.
 *
 * /clientes tiene su propia implementación (no usa esta) porque añade el
 * panel "Resumen 360" con actividad cruzada.
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

function readTenant() {
  if (typeof window === "undefined") return "";
  return String(new URLSearchParams(window.location.search).get("tenant") || "").trim();
}

function readSectorPack() {
  if (typeof window === "undefined") return "";
  return String(new URLSearchParams(window.location.search).get("sectorPack") || "").trim();
}

export default function GenericModuleRuntimePage({
  moduleKey,
  href,
  extraActions,
  extraRowActions,
}: {
  moduleKey: string;
  href: string;
  /** Botones adicionales (ej. "Emitir mes" del vertical SF) que se pintan
   *  junto al botón "+ Nuevo" en el header de la página. */
  extraActions?: React.ReactNode;
  /** Render por fila (ej. botón "Renovar" en proyectos del vertical SF).
   *  Se inyecta en la celda Acciones, antes de Editar/Borrar. */
  extraRowActions?: (row: Record<string, string>) => React.ReactNode;
}) {
  const [rows, setRows] = useState<Array<Record<string, string>>>([]);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Record<string, string> | null>(null);
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
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
    const url =
      "/api/runtime/tenant-config" +
      (tenant || sectorPack
        ? "?" +
          [
            tenant ? "tenant=" + encodeURIComponent(tenant) : "",
            sectorPack ? "sectorPack=" + encodeURIComponent(sectorPack) : "",
          ]
            .filter(Boolean)
            .join("&")
        : "");

    const response = await fetch(url, { cache: "no-store" });
    const data = await response.json();

    if (response.ok && data.ok) {
      const config = data.config || {};
      const fieldsByModule = config.fieldsByModule || {};
      const tableColumnsByModule = (config.tableColumnsByModule || {}) as Record<
        string,
        TableColumnDef[]
      >;
      setUi({
        label:
          config.labels?.[moduleKey] ||
          config.navigationLabelMap?.[moduleKey] ||
          moduleKey,
        emptyState:
          config.emptyStateMap?.[moduleKey] ||
          ("Todavía no hay datos en " + moduleKey + "."),
        fields: fieldsByModule[moduleKey] || [],
        tableColumns: tableColumnsByModule[moduleKey] || [],
      });
    }
  }

  async function load() {
    setBusy(true);
    setError("");
    try {
      await loadUi();

      const tenant = readTenant();
      const sectorPack = readSectorPack();
      const response = await fetch(
        "/api/erp/module?module=" +
          encodeURIComponent(moduleKey) +
          (tenant || sectorPack
            ? "&" +
              [
                tenant ? "tenant=" + encodeURIComponent(tenant) : "",
                sectorPack ? "sectorPack=" + encodeURIComponent(sectorPack) : "",
              ]
                .filter(Boolean)
                .join("&")
            : ""),
        { cache: "no-store" },
      );
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "No se pudo cargar el módulo.");
      }

      setRows(Array.isArray(data.rows) ? data.rows : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el módulo.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleKey]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((item) =>
      Object.values(item || {})
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [rows, query]);

  async function saveRecord(payload: Record<string, string>) {
    const tenant = readTenant();
    const sectorPack = readSectorPack();

    if (modalMode === "create") {
      const response = await fetch("/api/erp/module", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          module: moduleKey,
          mode: "create",
          payload,
          tenant,
          sectorPack,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "No se pudo guardar.");
      }
    }

    if (modalMode === "edit" && selected?.id) {
      const response = await fetch("/api/erp/module", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          module: moduleKey,
          mode: "edit",
          recordId: selected.id,
          payload,
          tenant,
          sectorPack,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "No se pudo actualizar.");
      }
    }

    await load();
  }

  async function removeRecord(recordId: string) {
    const tenant = readTenant();
    const sectorPack = readSectorPack();

    const response = await fetch("/api/erp/module", {
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

    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(data.error || "No se pudo borrar.");
    }

    setSelected(null);
    setDetailOpen(false);
    await load();
  }

  // Si el sector pack no trajo columnas, derivar las primeras 4 fields.
  const columns: TableColumnDef[] = ui.tableColumns.length > 0
    ? ui.tableColumns
    : ui.fields.slice(0, 4).map((f) => ({ fieldKey: f.key, label: f.label }));

  const titleField =
    ui.tableColumns.find((item) => item.isPrimary)?.fieldKey ||
    columns[0]?.fieldKey ||
    ui.fields[0]?.key ||
    "id";

  function openDetail(item: Record<string, string>) {
    setSelected(item);
    setDetailOpen(true);
  }

  return (
    <TenantShell>
      <div style={{ maxWidth: 1280, margin: "0 auto", display: "grid", gap: 20 }}>
        <header style={{ display: "grid", gap: 12 }}>
          <EntityBreadcrumb
            items={[
              { href: "/", label: "Inicio" },
              { href, label: ui.label },
            ]}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div>
              <h1 style={{ margin: 0, fontSize: 28, color: "#0f172a" }}>{ui.label}</h1>
              <p style={{ margin: "4px 0 0 0", color: "#6b7280", fontSize: 14 }}>
                {filtered.length} {filtered.length === 1 ? "registro" : "registros"}
                {query ? " (filtrados)" : ""}
              </p>
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
              {extraActions ? extraActions : null}
              <button
                type="button"
                onClick={() => {
                  setSelected(null);
                  setModalMode("create");
                }}
                style={{
                  border: "none",
                  borderRadius: 8,
                  background: "#1d4ed8",
                  color: "#ffffff",
                  padding: "10px 18px",
                  cursor: "pointer",
                  fontWeight: 700,
                  fontSize: 14,
                  whiteSpace: "nowrap",
                }}
              >
                + Nuevo
              </button>
            </div>
          </div>
        </header>

        <div>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={"Buscar en " + ui.label.toLowerCase() + "..."}
            style={{
              width: "100%",
              padding: "10px 14px",
              border: "1px solid #d1d5db",
              borderRadius: 8,
              fontSize: 14,
              background: "#ffffff",
              boxSizing: "border-box",
            }}
          />
        </div>

        <section
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            background: "#ffffff",
            overflow: "hidden",
          }}
        >
          {busy ? (
            <div style={{ padding: 40, textAlign: "center", color: "#6b7280", fontSize: 14 }}>
              Cargando...
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "#6b7280", fontSize: 14 }}>
              {query
                ? "Ningún resultado para “" + query + "”."
                : ui.emptyState + " Pulsa “Nuevo” para empezar."}
            </div>
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
                          fontSize: 12,
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
                        fontSize: 12,
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
                  {filtered.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => openDetail(item)}
                      style={{
                        borderBottom: "1px solid #f3f4f6",
                        cursor: "pointer",
                        background: selected?.id === item.id ? "#eff6ff" : "transparent",
                      }}
                      onMouseEnter={(e) => {
                        if (selected?.id !== item.id) e.currentTarget.style.background = "#f9fafb";
                      }}
                      onMouseLeave={(e) => {
                        if (selected?.id !== item.id) e.currentTarget.style.background = "transparent";
                      }}
                    >
                      {columns.map((col, idx) => {
                        const val = String(item[col.fieldKey] || "—");
                        return (
                          <td
                            key={col.fieldKey}
                            style={{
                              padding: "12px 14px",
                              color: idx === 0 ? "#0f172a" : "#374151",
                              fontWeight: idx === 0 ? 600 : 400,
                            }}
                          >
                            {col.fieldKey === "estado" ? (
                              <EntityStatusBadge value={val} />
                            ) : (
                              val
                            )}
                          </td>
                        );
                      })}
                      <td
                        style={{ padding: "8px 14px", textAlign: "right", whiteSpace: "nowrap" }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {extraRowActions ? extraRowActions(item) : null}
                        <button
                          type="button"
                          onClick={() => {
                            setSelected(item);
                            setModalMode("edit");
                          }}
                          style={{
                            border: "1px solid #d1d5db",
                            borderRadius: 6,
                            background: "#ffffff",
                            padding: "6px 12px",
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
                          onDelete={async () => removeRecord(String(item.id || ""))}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

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
      </div>

      {/* Slide-over de detalle */}
      <SlideOverPanel
        open={detailOpen && selected !== null}
        onClose={() => setDetailOpen(false)}
        title={String(selected?.[titleField] || "Sin título")}
        subtitle={"Ficha · " + ui.label}
        size="md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setDetailOpen(false)}
              style={{
                border: "1px solid #d1d5db",
                borderRadius: 8,
                background: "#ffffff",
                padding: "10px 16px",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 14,
                color: "#374151",
              }}
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={() => {
                setDetailOpen(false);
                setModalMode("edit");
              }}
              style={{
                border: "none",
                borderRadius: 8,
                background: "#1d4ed8",
                color: "#ffffff",
                padding: "10px 18px",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: 14,
              }}
            >
              Editar
            </button>
          </>
        }
      >
        <EntityContextCard
          title="Datos del registro"
          items={ui.fields.map((field) => ({
            label: field.label,
            value: String(selected?.[field.key] || "—"),
          }))}
        />
      </SlideOverPanel>

      {/* Slide-over de crear/editar */}
      <ErpRecordModal
        open={modalMode !== null}
        mode={modalMode || "create"}
        title={modalMode === "edit" ? "Editar " + ui.label : "Nuevo en " + ui.label}
        fields={
          ui.fields as Array<{
            key: string;
            label: string;
            kind:
              | "text"
              | "email"
              | "tel"
              | "textarea"
              | "date"
              | "number"
              | "money"
              | "status"
              | "relation";
            required?: boolean;
            relationModuleKey?: string;
            placeholder?: string;
            options?: Array<{ value: string; label: string }>;
          }>
        }
        initialValue={modalMode === "edit" ? selected : null}
        tenant={readTenant() || undefined}
        onClose={() => setModalMode(null)}
        onSubmit={saveRecord}
      />
    </TenantShell>
  );
}
