"use client";

import { useEffect, useState } from "react";
import ReportChart from "@/components/erp/report-chart";

/**
 * Página de reportes (DEV-REP).
 *
 * Lista los reportes guardados, permite crear uno nuevo (selector de
 * módulo + columnas + filtros simples + agrupación) y al pulsar uno
 * lo ejecuta y muestra los resultados en tabla.
 */
type Report = {
  id: string;
  name: string;
  description: string | null;
  moduleKey: string;
  chartType: "none" | "bar" | "line" | "pie";
};

type ReportResult = {
  rows: Array<Record<string, string>>;
  total: number;
  groups?: Array<{ key: string; count: number; sum?: Record<string, number> }>;
};

const MODULES = [
  "clientes", "crm", "proyectos", "presupuestos", "facturacion", "documentos",
  "tareas", "tickets", "compras", "productos", "reservas",
  "calificaciones", "asistencia", "becas", "inventario",
];

const OPERATORS = [
  { value: "eq", label: "= igual a" },
  { value: "neq", label: "≠ distinto de" },
  { value: "contains", label: "contiene" },
  { value: "gt", label: "> mayor que" },
  { value: "lt", label: "< menor que" },
  { value: "notEmpty", label: "tiene valor" },
  { value: "empty", label: "está vacío" },
];

export default function ReportesPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [activeReport, setActiveReport] = useState<Report | null>(null);
  const [activeResult, setActiveResult] = useState<ReportResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Form
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [moduleKey, setModuleKey] = useState("clientes");
  const [columnsRaw, setColumnsRaw] = useState("nombre,email,estado");
  const [filterField, setFilterField] = useState("");
  const [filterOperator, setFilterOperator] = useState<string>("eq");
  const [filterValue, setFilterValue] = useState("");
  const [groupBy, setGroupBy] = useState("");
  const [chartType, setChartType] = useState<"none" | "bar" | "line" | "pie">("none");

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/erp/reports", { cache: "no-store" });
      const data = await r.json();
      if (r.ok && data.ok) setReports(data.reports || []);
      else setError(data.error || "Error.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function handleRun(report: Report) {
    setActiveReport(report);
    setActiveResult(null);
    setBusy(true);
    try {
      const r = await fetch("/api/erp/reports?run=" + encodeURIComponent(report.id), { cache: "no-store" });
      const data = await r.json();
      if (r.ok && data.ok) {
        setActiveResult({ rows: data.rows || [], total: data.total || 0, groups: data.groups });
      } else setError(data.error || "Error.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreate() {
    setBusy(true);
    setError("");
    try {
      const columns = columnsRaw.split(",").map((s) => s.trim()).filter(Boolean);
      const filters = filterField
        ? [{ field: filterField, operator: filterOperator, value: filterValue }]
        : [];
      const r = await fetch("/api/erp/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, description, moduleKey, columns, filters,
          groupBy: groupBy || null,
          chartType,
        }),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        setError(data.error || "Error creando.");
        return;
      }
      setName(""); setDescription(""); setFilterField(""); setFilterValue(""); setGroupBy("");
      setShowForm(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Borrar este reporte?")) return;
    setBusy(true);
    try {
      await fetch("/api/erp/reports?id=" + encodeURIComponent(id), { method: "DELETE" });
      if (activeReport?.id === id) {
        setActiveReport(null);
        setActiveResult(null);
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 1200, margin: "0 auto", padding: 24, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "#0f172a", margin: 0 }}>Reportes</h1>
          <p style={{ color: "#6b7280", fontSize: 14, margin: "4px 0 0 0" }}>
            Reportes operativos sobre cualquier módulo del ERP.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          style={{ border: "none", background: "#1d4ed8", color: "#ffffff", borderRadius: 8, padding: "10px 18px", fontWeight: 700, fontSize: 14, cursor: "pointer" }}
        >
          {showForm ? "Cancelar" : "+ Nuevo reporte"}
        </button>
      </div>

      {error ? (
        <div style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 13 }}>
          {error}
        </div>
      ) : null}

      {showForm ? (
        <section style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 18, background: "#ffffff", marginBottom: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 12px 0" }}>Definir reporte</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Nombre"><input value={name} onChange={(e) => setName(e.target.value)} style={ipt} /></Field>
            <Field label="Módulo">
              <select value={moduleKey} onChange={(e) => setModuleKey(e.target.value)} style={ipt}>
                {MODULES.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </Field>
            <Field label="Descripción (opcional)"><input value={description} onChange={(e) => setDescription(e.target.value)} style={ipt} /></Field>
            <Field label="Columnas a mostrar (separadas por coma)"><input value={columnsRaw} onChange={(e) => setColumnsRaw(e.target.value)} placeholder="nombre,email,estado" style={ipt} /></Field>
            <Field label="Filtro: campo"><input value={filterField} onChange={(e) => setFilterField(e.target.value)} placeholder="estado" style={ipt} /></Field>
            <Field label="Filtro: operador">
              <select value={filterOperator} onChange={(e) => setFilterOperator(e.target.value)} style={ipt}>
                {OPERATORS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Filtro: valor"><input value={filterValue} onChange={(e) => setFilterValue(e.target.value)} placeholder="activo" style={ipt} /></Field>
            <Field label="Agrupar por (opcional)"><input value={groupBy} onChange={(e) => setGroupBy(e.target.value)} placeholder="estado" style={ipt} /></Field>
            <Field label="Tipo de gráfico">
              <select value={chartType} onChange={(e) => setChartType(e.target.value as "none" | "bar" | "line" | "pie")} style={ipt}>
                <option value="none">Sin gráfico (solo tabla)</option>
                <option value="bar">Barras</option>
                <option value="line">Líneas</option>
                <option value="pie">Tarta</option>
              </select>
            </Field>
          </div>
          <button
            type="button"
            onClick={handleCreate}
            disabled={busy || !name || !moduleKey}
            style={{ marginTop: 16, border: "none", background: "#16a34a", color: "#ffffff", borderRadius: 8, padding: "10px 18px", fontWeight: 700, fontSize: 14, cursor: busy ? "not-allowed" : "pointer", opacity: busy || !name ? 0.6 : 1 }}
          >
            {busy ? "Guardando..." : "Crear reporte"}
          </button>
        </section>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 20 }}>
        <aside>
          <h2 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 8px 0", color: "#475569", textTransform: "uppercase", letterSpacing: 0.5 }}>Mis reportes</h2>
          {loading ? <p>Cargando…</p> : null}
          {!loading && reports.length === 0 ? (
            <p style={{ color: "#6b7280", padding: 12, background: "#f9fafb", borderRadius: 8, fontSize: 13 }}>
              No hay reportes guardados.
            </p>
          ) : null}
          <div style={{ display: "grid", gap: 6 }}>
            {reports.map((r) => (
              <div
                key={r.id}
                style={{
                  border: "1px solid " + (activeReport?.id === r.id ? "#1d4ed8" : "#e5e7eb"),
                  background: activeReport?.id === r.id ? "#eff6ff" : "#ffffff",
                  borderRadius: 8,
                  padding: 10,
                  cursor: "pointer",
                  fontSize: 13,
                }}
                onClick={() => handleRun(r)}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                  <strong>{r.name}</strong>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleDelete(r.id); }}
                    style={{ background: "transparent", border: "none", color: "#dc2626", cursor: "pointer", fontSize: 14 }}
                    title="Borrar"
                  >×</button>
                </div>
                <div style={{ fontSize: 11, color: "#6b7280" }}>{r.moduleKey}</div>
                {r.description ? <div style={{ fontSize: 11, color: "#475569", marginTop: 4 }}>{r.description}</div> : null}
              </div>
            ))}
          </div>
        </aside>

        <section>
          {!activeReport ? (
            <div style={{ padding: 30, color: "#6b7280", textAlign: "center", border: "1px dashed #d1d5db", borderRadius: 12 }}>
              Selecciona un reporte para ejecutarlo.
            </div>
          ) : null}
          {activeReport && busy ? <p>Ejecutando…</p> : null}
          {activeReport && activeResult ? (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 4px 0" }}>{activeReport.name}</h2>
                  <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>{activeResult.total} registro(s)</p>
                </div>
                {/* TEST-2.8 — botones para descargar el reporte como archivo real.
                    TEST-3.6 — añadido botón Word (.docx) que llama al endpoint
                    server-side y genera un documento de Word de verdad. */}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => downloadCsv(activeReport.name, activeResult.rows)}
                    style={{ border: "1px solid #d1d5db", background: "#ffffff", borderRadius: 8, padding: "8px 14px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
                    title="Descargar como archivo CSV (abrir con Excel)"
                  >
                    ↓ Excel (CSV)
                  </button>
                  <a
                    href={"/api/erp/reports/" + encodeURIComponent(activeReport.id) + "/export?format=docx"}
                    download
                    style={{ display: "inline-flex", alignItems: "center", border: "1px solid #1d4ed8", background: "#1d4ed8", color: "#ffffff", borderRadius: 8, padding: "8px 14px", fontWeight: 600, fontSize: 13, cursor: "pointer", textDecoration: "none" }}
                    title="Descargar como documento de Microsoft Word (.docx)"
                  >
                    ↓ Word (.docx)
                  </a>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    style={{ border: "1px solid #d1d5db", background: "#ffffff", borderRadius: 8, padding: "8px 14px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
                    title="Imprimir o guardar como PDF desde el diálogo de impresión"
                  >
                    🖨 Imprimir / PDF
                  </button>
                </div>
              </div>

              {/* H2-CHART: gráfico cuando el reporte lo pida */}
              {activeReport.chartType !== "none" && activeResult.groups && activeResult.groups.length > 0 ? (
                <ReportChart
                  chartType={activeReport.chartType}
                  groups={activeResult.groups.map((g) => ({ key: g.key, count: g.count }))}
                  title={activeReport.name}
                />
              ) : null}

              {activeResult.groups && activeResult.groups.length > 0 ? (
                <section style={{ marginBottom: 24 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 8px 0" }}>
                    Agrupación
                  </h3>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
                    <thead><tr style={{ background: "#f9fafb" }}>
                      <th style={th}>Grupo</th>
                      <th style={th}>Count</th>
                    </tr></thead>
                    <tbody>{activeResult.groups.map((g) => (
                      <tr key={g.key}><td style={td}>{g.key}</td><td style={td}>{g.count}</td></tr>
                    ))}</tbody>
                  </table>
                </section>
              ) : null}

              <h3 style={{ fontSize: 13, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 8px 0" }}>
                Detalle ({activeResult.rows.length})
              </h3>
              <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 8, background: "#ffffff" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#f9fafb" }}>
                      {Object.keys(activeResult.rows[0] || {}).filter((k) => k !== "id").map((k) => (
                        <th key={k} style={th}>{k}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activeResult.rows.map((row, i) => (
                      <tr key={String(row.id || i)} style={{ borderTop: "1px solid #f3f4f6" }}>
                        {Object.entries(row).filter(([k]) => k !== "id").map(([k, v]) => (
                          <td key={k} style={td}>{String(v ?? "")}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}

// TEST-2.8 — convierte rows a CSV y dispara descarga en el navegador.
function downloadCsv(name: string, rows: Array<Record<string, string>>) {
  if (!rows || rows.length === 0) {
    alert("Este reporte no tiene filas para descargar.");
    return;
  }
  const keys = Object.keys(rows[0] || {}).filter((k) => k !== "id");
  const escape = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const lines: string[] = [];
  lines.push(keys.join(";"));
  for (const r of rows) lines.push(keys.map((k) => escape(r[k])).join(";"));
  const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const safe = name.replace(/[^a-z0-9_-]+/gi, "_");
  a.href = url;
  a.download = safe + "_" + new Date().toISOString().slice(0, 10) + ".csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const ipt: React.CSSProperties = { width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" };
const th: React.CSSProperties = { padding: "8px 12px", textAlign: "left", fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 600 };
const td: React.CSSProperties = { padding: "10px 12px" };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 4 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: "#475569", textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</span>
      {children}
    </label>
  );
}
