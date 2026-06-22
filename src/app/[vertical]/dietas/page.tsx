"use client";

import { useEffect, useState } from "react";
import TenantShell from "@/components/erp/tenant-shell";
// Pedro 22-06 — Notación española centralizada (dd/mm/aaaa, X.XXX.XXX,XX).
import { fechaES, numeroES } from "@/lib/ui/format-es";

/**
 * Dietas — TEST 25 (Pedro).
 *
 * Proceso de selección, cálculo y listado de las Dietas a pagar a cada
 * empleado. Parámetros: Empleado + Mes. Selecciona los Desplazamientos del
 * empleado y mes, totaliza el Total Dietas, y lista cada desplazamiento
 * (Fecha, Cliente del Punto, Km, Dieta, Total). Permite exportar a CSV/Excel.
 */
type Row = { id: string; fecha: string; empleado: string; cliente: string; km: number; dieta: number; total: number };

function num(v: unknown): number {
  return parseFloat(String(v ?? "0").replace(/\./g, "").replace(",", ".")) || 0;
}
function fmt(n: number): string {
  return numeroES(n, 2); // X.XXX.XXX,XX
}
// Pedro 22-06 — Fecha siempre dd/mm/aaaa.
function fmtFecha(ymd: string): string {
  return fechaES(ymd);
}

export default function DietasPage() {
  const [empleados, setEmpleados] = useState<Array<{ value: string; label: string }>>([]);
  const [empleado, setEmpleado] = useState("");
  const [mes, setMes] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ejecutado, setEjecutado] = useState(false);

  useEffect(() => {
    fetch("/api/erp/options?module=empleados", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (d?.ok && Array.isArray(d.options)) setEmpleados(d.options); })
      .catch(() => undefined);
    if (!mes) setMes(new Date().toISOString().slice(0, 7));
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  async function ejecutar() {
    setLoading(true);
    setError("");
    setEjecutado(true);
    try {
      const r = await fetch("/api/erp/module?module=desplazamientos", { cache: "no-store" });
      const d = await r.json();
      const all = (r.ok && d.ok && Array.isArray(d.rows)) ? d.rows as Array<Record<string, string>> : [];
      const filtered: Row[] = all
        .filter((x) => {
          if (empleado && String(x.empleado || "") !== empleado) return false;
          if (mes && String(x.fecha || "").slice(0, 7) !== mes) return false;
          return true;
        })
        .map((x) => ({
          id: String(x.id || ""),
          fecha: String(x.fecha || ""),
          empleado: String(x.empleado || ""),
          cliente: String(x.puntoVenta || x.cliente || ""),
          km: num(x.kilometros),
          dieta: num(x.dieta),
          total: num(x.totalDietas),
        }))
        .sort((a, b) => (a.empleado === b.empleado ? a.fecha.localeCompare(b.fecha) : a.empleado.localeCompare(b.empleado)));
      setRows(filtered);
      setTotal(filtered.reduce((s, x) => s + x.total, 0));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
      setRows([]); setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  function exportCSV() {
    const sep = ";";
    const header = ["Empleado", "Fecha", "Cliente", "Km", "Dieta", "Total"].join(sep);
    const body = rows.map((x) => [x.empleado, fmtFecha(x.fecha), x.cliente, fmt(x.km), fmt(x.dieta), fmt(x.total)].join(sep)).join("\n");
    const foot = ["", "", "", "", "Total Dietas", fmt(total)].join(sep);
    const csv = "﻿" + header + "\n" + body + "\n" + foot;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "dietas-" + (empleado || "todos").replace(/\s+/g, "_") + "-" + (mes || "") + ".csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <TenantShell>
      <div style={{ maxWidth: 1100, margin: "0 auto", fontFamily: "system-ui, -apple-system, sans-serif" }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", margin: "0 0 8px 0" }}>Dietas</h1>
        <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 16 }}>
          Dietas a pagar a cada empleado por sus desplazamientos. Elige Empleado y Mes; el total se calcula a partir de los desplazamientos del periodo.
        </p>

        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16, flexWrap: "wrap", padding: 14, border: "1px solid #e5e7eb", background: "#f8fafc", borderRadius: 8 }}>
          <label style={{ fontSize: 12, color: "#475569", fontWeight: 700 }}>Empleado:</label>
          <select value={empleado} onChange={(e) => setEmpleado(e.target.value)} style={ipt}>
            <option value="">Todos</option>
            {empleados.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
          </select>
          <label style={{ fontSize: 12, color: "#475569", fontWeight: 700, marginLeft: 12 }}>Mes:</label>
          <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} style={ipt} />
          <button type="button" onClick={ejecutar} style={btnPrimary} disabled={loading}>
            {loading ? "Calculando…" : "Calcular dietas"}
          </button>
          {rows.length > 0 ? (
            <button type="button" onClick={exportCSV} style={{ ...btnPrimary, background: "#0891b2", borderColor: "#0e7490", marginLeft: 0 }}>
              Exportar (Excel)
            </button>
          ) : null}
        </div>

        {error ? <div style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 13 }}>{error}</div> : null}

        {rows.length > 0 ? (
          <div style={{ marginBottom: 16, display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, maxWidth: 480 }}>
            <Kpi label="Desplazamientos" value={String(rows.length)} accent="#1d4ed8" />
            <Kpi label="Total Dietas" value={fmt(total) + " €"} accent="#16a34a" />
          </div>
        ) : null}

        <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 8, background: "#ffffff" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead style={{ background: "#f8fafc" }}>
              <tr>
                <Th>Empleado</Th>
                <Th>Fecha</Th>
                <Th>Cliente</Th>
                <Th align="right">Km</Th>
                <Th align="right">Dieta (€/Km)</Th>
                <Th align="right">Total</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((x) => (
                <tr key={x.id} style={{ borderTop: "1px solid #f1f5f9" }}>
                  <Td>{x.empleado}</Td>
                  <Td>{fmtFecha(x.fecha)}</Td>
                  <Td>{x.cliente}</Td>
                  <Td align="right">{fmt(x.km)}</Td>
                  <Td align="right">{fmt(x.dieta)}</Td>
                  <Td align="right" style={{ fontWeight: 700, color: "#16a34a" }}>{fmt(x.total)} €</Td>
                </tr>
              ))}
              {rows.length === 0 && !loading && ejecutado ? (
                <tr><td colSpan={6} style={{ padding: 32, textAlign: "center", color: "#94a3b8" }}>Sin desplazamientos para ese empleado y mes.</td></tr>
              ) : null}
            </tbody>
            {rows.length > 0 ? (
              <tfoot>
                <tr style={{ borderTop: "2px solid #e5e7eb", background: "#f8fafc" }}>
                  <Td><strong>Total Dietas</strong></Td>
                  <Td>{""}</Td><Td>{""}</Td><Td>{""}</Td><Td>{""}</Td>
                  <Td align="right"><strong style={{ color: "#16a34a" }}>{fmt(total)} €</strong></Td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </div>
    </TenantShell>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: "left" | "right" }) {
  return <th style={{ padding: "8px 10px", textAlign: align || "left", fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: 0.4 }}>{children}</th>;
}
function Td({ children, align, style }: { children: React.ReactNode; align?: "left" | "right"; style?: React.CSSProperties }) {
  return <td style={{ padding: "8px 10px", textAlign: align || "left", ...style }}>{children}</td>;
}
function Kpi({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 12, background: "#ffffff" }}>
      <div style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: accent, marginTop: 4 }}>{value}</div>
    </div>
  );
}

const ipt: React.CSSProperties = { padding: "6px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13 };
const btnPrimary: React.CSSProperties = { padding: "6px 14px", border: "1px solid #1d4ed8", background: "#2563eb", color: "#fff", borderRadius: 6, fontSize: 13, cursor: "pointer", fontWeight: 700, marginLeft: "auto" };
