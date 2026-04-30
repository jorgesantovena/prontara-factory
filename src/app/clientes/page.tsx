"use client";

import { useEffect, useMemo, useState } from "react";
import EntityBreadcrumb from "@/components/erp/entity-breadcrumb";
import EntityContextCard from "@/components/erp/entity-context-card";
import EntityStatusBadge from "@/components/erp/entity-status-badge";
import ErpRecordModal from "@/components/erp/erp-record-modal";
import ErpDeleteButton from "@/components/erp/erp-delete-button";
import TenantShell from "@/components/erp/tenant-shell";
import SlideOverPanel from "@/components/erp/slide-over-panel";

function formatRelativeDate(iso: string): string {
  if (!iso) return "";
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts) || ts === 0) return "";
  const diff = Date.now() - ts;
  if (diff < 0) return "Ahora";
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Ahora";
  if (minutes < 60) return "Hace " + minutes + " min";
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return "Hace " + hours + " h";
  const days = Math.floor(hours / 24);
  if (days < 30) return "Hace " + days + " d";
  return new Date(ts).toLocaleDateString("es-ES");
}

type Client360 = {
  summary: {
    oportunidades: number;
    proyectos: number;
    presupuestos: number;
    facturas: number;
    documentos: number;
  };
  related: Array<{
    id: string;
    moduleKey: string;
    moduleLabel: string;
    title: string;
    subtitle: string;
    href: string;
    status: string;
    updatedAt: string;
  }>;
};

function readTenant() {
  if (typeof window === "undefined") return "";
  return String(new URLSearchParams(window.location.search).get("tenant") || "").trim();
}

function readSectorPack() {
  if (typeof window === "undefined") return "";
  return String(new URLSearchParams(window.location.search).get("sectorPack") || "").trim();
}

type FieldDef = {
  key: string;
  label: string;
  kind: string;
  required?: boolean;
  relationModuleKey?: string;
  placeholder?: string;
};

export default function ClientesPage() {
  const [rows, setRows] = useState<Array<Record<string, string>>>([]);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Record<string, string> | null>(null);
  const [client360, setClient360] = useState<Client360 | null>(null);
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [ui, setUi] = useState<{
    label: string;
    emptyState: string;
    fields: FieldDef[];
    renameMap: Record<string, string>;
    columns: Array<{ key: string; label: string }>;
  }>({
    label: "Clientes",
    emptyState: "Todavía no hay clientes.",
    fields: [
      { key: "nombre", label: "Nombre", kind: "text", required: true, placeholder: "Empresa o persona" },
      { key: "email", label: "Email", kind: "email", placeholder: "contacto@empresa.com" },
      { key: "telefono", label: "Teléfono", kind: "tel", placeholder: "+34 ..." },
      { key: "estado", label: "Estado", kind: "status", placeholder: "activo / seguimiento / inactivo" },
      { key: "segmento", label: "Segmento", kind: "text", placeholder: "Pyme / Particular / Retail..." },
      { key: "notas", label: "Notas", kind: "textarea", placeholder: "Observaciones útiles" },
    ],
    renameMap: {},
    columns: [
      { key: "nombre", label: "Nombre" },
      { key: "email", label: "Email" },
      { key: "telefono", label: "Teléfono" },
      { key: "estado", label: "Estado" },
    ],
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
      const tableColumnsByModule = config.tableColumnsByModule || {};
      const moduleFields: FieldDef[] = fieldsByModule.clientes ||
        [
          { key: "nombre", label: "Nombre", kind: "text", required: true, placeholder: "Empresa o persona" },
          { key: "email", label: "Email", kind: "email", placeholder: "contacto@empresa.com" },
          { key: "telefono", label: "Teléfono", kind: "tel", placeholder: "+34 ..." },
        ];
      const columns: Array<{ key: string; label: string }> =
        Array.isArray(tableColumnsByModule.clientes) && tableColumnsByModule.clientes.length > 0
          ? tableColumnsByModule.clientes.map((c: { key?: string; fieldKey?: string; label: string }) => ({
              key: c.key || c.fieldKey || "",
              label: c.label,
            })).filter((c: { key: string }) => c.key)
          : moduleFields.slice(0, 4).map((f) => ({ key: f.key, label: f.label }));

      setUi({
        label:
          config.labels?.clientes ||
          config.navigationLabelMap?.clientes ||
          "Clientes",
        emptyState:
          config.emptyStateMap?.clientes ||
          "Todavía no hay clientes.",
        fields: moduleFields,
        renameMap: data.sectorPreview?.renameMap || config.renameMap || {},
        columns,
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
      const url =
        "/api/erp/module?module=clientes" +
        (tenant || sectorPack
          ? "&" +
            [
              tenant ? "tenant=" + encodeURIComponent(tenant) : "",
              sectorPack ? "sectorPack=" + encodeURIComponent(sectorPack) : "",
            ]
              .filter(Boolean)
              .join("&")
          : "");

      const response = await fetch(url, { cache: "no-store" });
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "No se pudieron cargar los registros.");
      }

      const loaded = Array.isArray(data.rows) ? data.rows : [];
      setRows(loaded);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar los registros.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadClient360() {
      if (!selected?.nombre) {
        setClient360(null);
        return;
      }

      try {
        const tenant = readTenant();
        const sectorPack = readSectorPack();
        const url =
          "/api/erp/client-360?client=" +
          encodeURIComponent(String(selected.nombre || "")) +
          (tenant || sectorPack
            ? "&" +
              [
                tenant ? "tenant=" + encodeURIComponent(tenant) : "",
                sectorPack ? "sectorPack=" + encodeURIComponent(sectorPack) : "",
              ]
                .filter(Boolean)
                .join("&")
            : "");

        const response = await fetch(url, { cache: "no-store" });
        const data = await response.json();

        if (!cancelled && response.ok && data.ok) {
          setClient360(data.snapshot || null);
        }
      } catch {
        // ignoramos
      }
    }

    loadClient360();

    return () => {
      cancelled = true;
    };
  }, [selected]);

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
          module: "clientes",
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
          module: "clientes",
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
        module: "clientes",
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

  const singular =
    ui.renameMap?.cliente ||
    ui.renameMap?.clientes ||
    "cliente";

  function openDetail(item: Record<string, string>) {
    setSelected(item);
    setDetailOpen(true);
  }

  return (
    <TenantShell>
      <div style={{ maxWidth: 1280, margin: "0 auto", display: "grid", gap: 20 }}>
        {/* Cabecera */}
        <header style={{ display: "grid", gap: 12 }}>
          <EntityBreadcrumb
            items={[
              { href: "/", label: "Inicio" },
              { href: "/clientes", label: ui.label },
            ]}
          />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 28, color: "#0f172a" }}>{ui.label}</h1>
              <p style={{ margin: "4px 0 0 0", color: "#6b7280", fontSize: 14 }}>
                {filtered.length} {filtered.length === 1 ? "registro" : "registros"}
                {query ? " (filtrados)" : ""}
              </p>
            </div>
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
              + Nuevo {singular}
            </button>
          </div>
        </header>

        {/* Buscador */}
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={"Buscar en " + ui.label.toLowerCase() + "..."}
            style={{
              flex: 1,
              padding: "10px 14px",
              border: "1px solid #d1d5db",
              borderRadius: 8,
              fontSize: 14,
              background: "#ffffff",
            }}
          />
        </div>

        {/* Tabla */}
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
                : ui.emptyState + " Pulsa “Nuevo " + singular + "” para empezar."}
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                    {ui.columns.map((col) => (
                      <th
                        key={col.key}
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
                      {ui.columns.map((col, idx) => (
                        <td
                          key={col.key}
                          style={{
                            padding: "12px 14px",
                            color: idx === 0 ? "#0f172a" : "#374151",
                            fontWeight: idx === 0 ? 600 : 400,
                          }}
                        >
                          {col.key === "estado" ? (
                            <EntityStatusBadge value={String(item[col.key] || "—")} />
                          ) : (
                            String(item[col.key] || "—")
                          )}
                        </td>
                      ))}
                      <td
                        style={{ padding: "8px 14px", textAlign: "right", whiteSpace: "nowrap" }}
                        onClick={(e) => e.stopPropagation()}
                      >
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
                          confirmText={"¿Borrar este " + singular + "?"}
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

      {/* Slide-over de detalle 360 */}
      <SlideOverPanel
        open={detailOpen && selected !== null}
        onClose={() => setDetailOpen(false)}
        title={String(selected?.nombre || "Sin nombre")}
        subtitle={"Ficha del " + singular}
        size="lg"
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
              Editar {singular}
            </button>
          </>
        }
      >
        <div style={{ display: "grid", gap: 16 }}>
          <EntityContextCard
            title={"Datos del " + singular}
            items={ui.fields.map((field) => ({
              label: field.label,
              value: String(selected?.[field.key] || "—"),
            }))}
          />

          <EntityContextCard
            title="Resumen 360"
            items={[
              { label: ui.renameMap?.crm || "Oportunidades", value: String(client360?.summary.oportunidades || 0) },
              { label: ui.renameMap?.proyectos || "Proyectos", value: String(client360?.summary.proyectos || 0) },
              { label: ui.renameMap?.presupuestos || "Propuestas", value: String(client360?.summary.presupuestos || 0) },
              { label: ui.renameMap?.facturacion || "Facturas", value: String(client360?.summary.facturas || 0) },
              { label: ui.renameMap?.documentos || "Documentos", value: String(client360?.summary.documentos || 0) },
            ]}
          />

          <article
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              background: "#ffffff",
              padding: 14,
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a", marginBottom: 10 }}>
              Actividad relacionada
              {client360 && client360.related.length > 0 ? (
                <span style={{ fontWeight: 400, fontSize: 12, color: "#6b7280", marginLeft: 8 }}>
                  ({client360.related.length})
                </span>
              ) : null}
            </div>

            {!client360 || client360.related.length === 0 ? (
              <div style={{ color: "#9ca3af", fontSize: 13 }}>
                Sin actividad relacionada todavía.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {client360.related.slice(0, 12).map((item) => {
                  const relative = formatRelativeDate(item.updatedAt);
                  return (
                    <a
                      key={item.moduleKey + "/" + item.id}
                      href={item.href}
                      style={{
                        border: "1px solid #f3f4f6",
                        borderRadius: 8,
                        background: "#fafafa",
                        padding: 10,
                        textDecoration: "none",
                        color: "inherit",
                        display: "grid",
                        gap: 4,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                        <span
                          style={{
                            background: "#dbeafe",
                            color: "#1e3a8a",
                            borderRadius: 999,
                            padding: "2px 10px",
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                        >
                          {item.moduleLabel}
                        </span>
                        <EntityStatusBadge value={item.status || "—"} />
                      </div>
                      <strong style={{ fontSize: 13, color: "#0f172a" }}>{item.title}</strong>
                      <div style={{ fontSize: 12, color: "#6b7280" }}>{item.subtitle || "—"}</div>
                      {relative ? (
                        <div style={{ fontSize: 11, color: "#9ca3af" }}>{relative}</div>
                      ) : null}
                    </a>
                  );
                })}
              </div>
            )}
          </article>
        </div>
      </SlideOverPanel>

      {/* Slide-over de crear/editar */}
      <ErpRecordModal
        open={modalMode !== null}
        mode={modalMode || "create"}
        title={modalMode === "edit" ? "Editar " + singular : "Nuevo " + singular}
        fields={
          ui.fields as Array<{
            key: string;
            label: string;
            kind: "text" | "email" | "tel" | "textarea" | "date" | "number" | "money" | "status" | "relation";
            required?: boolean;
            relationModuleKey?: string;
            placeholder?: string;
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
