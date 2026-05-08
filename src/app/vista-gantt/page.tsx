"use client";

import { useEffect, useMemo, useState } from "react";

/**
 * Vista Gantt para proyectos (H4-VIEW-GANTT).
 *
 * Lee del módulo "proyectos" y dibuja barras horizontales sobre un eje
 * temporal mensual. Usa los campos `fechaInicio` (o `fecha`) y `fechaFin`
 * (o calcula 7 días si no hay fin).
 */

type Row = Record<string, unknown> & { id: string };

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + day;
}

function parseDate(s: string): Date | null {
  if (!s) return null;
  const v = s.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(v + "T00:00:00Z");
  return isNaN(d.getTime()) ? null : d;
}

function diffDays(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

export default function VistaGanttPage() {
  const [moduleKey, setModuleKey] = useState("proyectos");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/erp/module?moduleKey=" + moduleKey, { cache: "no-store" });
      const data = await r.json();
      if (r.ok && data.ok) setRows((data.rows || []) as Row[]);
      else setError(data.error || "Error.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, [moduleKey]);

  const items = useMemo(() => {
    return rows.map((r) => {
      const start = parseDate(String(r.fechaInicio || r.fecha || ""));
      let end = parseDate(String(r.fechaFin || ""));
      if (start && !end) {
        end = new Date(start.getTime());
        end.setDate(end.getDate() + 7);
      }
      return {
        id: r.id,
        title: String(r.titulo || r.nombre || r.numero || r.asunto || "(sin título)"),
        start,
        end,
        estado: String(r.estado || ""),
      };
    }).filter((it) => it.start && it.end);
  }, [rows]);

  const range = useMemo(() => {
    if (items.length === 0) {
      const today = new Date();
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      const end = new Date(today.getFullYear(), today.getMonth() + 2, 0);
      return { start, end };
    }
    let min = items[0].start!;
    let max = items[0].end!;
    for (const it of items) {
      if (it.start! < min) min = it.start!;
      if (it.end! > max) max = it.end!;
    }
    // Pad
    const start = new Date(min);
    start.setDate(start.getDate() - 3);
    const end = new Date(max);
    end.setDate(end.getDate() + 3);
    return { start, end };
  }, [items]);

  const totalDays = Math.max(1, diffDays(range.start, range.end));

  return (
    <main style={{ maxWidth: 1400, margin: "0 auto", padding: 24, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, color: "#0f172a", margin: "0 0 8px 0" }}>Vista Gantt</h1>
      <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 16 }}>
        Cronograma de proyectos / tareas con barras temporales. Requiere campos fechaInicio y fechaFin.
      </p>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
        <label style={{ fontSize: 13, color: "#475569" }}>Módulo:</label>
        <select value={moduleKey} onChange={(e) => setModuleKey(e.target.value)} style={ipt}>
          <option value="proyectos">proyectos</option>
          <option value="tareas">tareas</option>
          <option value="actividades">actividades</option>
        </select>
        <button type="button" onClick={load} style={btn}>↻ Recargar</button>
        <span style={{ fontSize: 12, color: "#94a3b8" }}>
          Rango: {ymd(range.start)} → {ymd(range.end)} ({totalDays} días)
        </span>
      </div>

      {error ? <div style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 13 }}>{error}</div> : null}
      {loading ? <p>Cargando…</p> : null}

      {items.length === 0 && !loading ? (
        <p style={{ color: "#94a3b8", padding: 16, background: "#f9fafb", borderRadius: 8 }}>
          Sin elementos con fechas — añade fechaInicio y fechaFin a los registros.
        </p>
      ) : null}

      {items.length > 0 ? (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden", background: "#ffffff" }}>
          <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", borderBottom: "1px solid #e5e7eb", background: "#f8fafc", fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase" }}>
            <div style={{ padding: 10 }}>Tarea</div>
            <div style={{ padding: 10, position: "relative" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>{ymd(range.start)}</span>
                <span>{ymd(range.end)}</span>
              </div>
            </div>
          </div>
          {items.map((it) => {
            const offsetPct = (diffDays(range.start, it.start!) / totalDays) * 100;
            const widthPct = Math.max(2, (diffDays(it.start!, it.end!) / totalDays) * 100);
            return (
              <div key={it.id} style={{ display: "grid", gridTemplateColumns: "260px 1fr", borderBottom: "1px solid #f1f5f9", alignItems: "center" }}>
                <div style={{ padding: "8px 10px", fontSize: 13 }}>
                  <div style={{ fontWeight: 600 }}>{it.title}</div>
                  <div style={{ fontSize: 10, color: "#94a3b8" }}>{ymd(it.start!)} → {ymd(it.end!)}</div>
                </div>
                <div style={{ position: "relative", height: 32, padding: "8px 10px" }}>
                  <div style={{ position: "absolute", inset: "8px 10px" }}>
                    <div
                      title={it.title + " (" + ymd(it.start!) + " → " + ymd(it.end!) + ")"}
                      style={{
                        position: "absolute",
                        left: offsetPct + "%",
                        width: widthPct + "%",
                        top: 4,
                        bottom: 4,
                        background: barColorByEstado(it.estado),
                        borderRadius: 4,
                        display: "flex",
                        alignItems: "center",
                        paddingLeft: 6,
                        fontSize: 10,
                        color: "#ffffff",
                        fontWeight: 600,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {it.estado || it.title}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </main>
  );
}

function barColorByEstado(estado: string): string {
  const e = estado.toLowerCase();
  if (e.includes("complet") || e.includes("cobrad")) return "#16a34a";
  if (e.includes("curso") || e.includes("marcha")) return "#1d4ed8";
  if (e.includes("vencid") || e.includes("urgent") || e.includes("rechaz")) return "#dc2626";
  if (e.includes("planif") || e.includes("borrador") || e.includes("pendiente")) return "#94a3b8";
  return "#7c3aed";
}

const ipt: React.CSSProperties = {
  padding: "6px 10px",
  border: "1px solid #d1d5db",
  borderRadius: 6,
  fontSize: 13,
};

const btn: React.CSSProperties = {
  padding: "6px 12px",
  border: "1px solid #d1d5db",
  background: "#ffffff",
  borderRadius: 6,
  fontSize: 13,
  cursor: "pointer",
  fontWeight: 600,
};
