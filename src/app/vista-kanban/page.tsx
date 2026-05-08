"use client";

import { useEffect, useMemo, useState } from "react";

/**
 * Vista Kanban universal (H4-VIEW-KAN).
 *
 * Toma cualquier moduleKey y agrupa los registros por su campo "estado".
 * Drag & drop nativo HTML5 entre columnas — al soltar, persiste el cambio
 * de estado vía /api/erp/module modo=update.
 */

type Row = Record<string, unknown> & { id: string; estado?: string };

const COMMON_MODULES = [
  "tareas", "tickets", "compras", "proyectos", "presupuestos", "facturacion",
  "crm", "reservas", "actividades", "caja", "kardex",
];

export default function VistaKanbanPage() {
  const [moduleKey, setModuleKey] = useState("tareas");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dragRowId, setDragRowId] = useState<string | null>(null);
  const [dropEstado, setDropEstado] = useState<string | null>(null);

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

  const grouped = useMemo(() => {
    const g = new Map<string, Row[]>();
    for (const r of rows) {
      const e = String(r.estado || "(sin estado)").trim() || "(sin estado)";
      if (!g.has(e)) g.set(e, []);
      g.get(e)!.push(r);
    }
    return Array.from(g.entries());
  }, [rows]);

  async function persistEstado(rowId: string, nuevoEstado: string) {
    const row = rows.find((r) => r.id === rowId);
    if (!row) return;
    if (row.estado === nuevoEstado) return;

    // Optimistic update
    setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, estado: nuevoEstado } : r)));

    try {
      const r = await fetch("/api/erp/module", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "update",
          moduleKey,
          recordId: rowId,
          payload: { ...row, estado: nuevoEstado },
        }),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        setError(data.error || "Error guardando.");
        await load(); // revert
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
      await load();
    }
  }

  function getPrimary(row: Row): string {
    return String(
      row.titulo || row.nombre || row.numero || row.asunto || row.concepto || row.id || "",
    );
  }

  return (
    <main style={{ maxWidth: 1400, margin: "0 auto", padding: 24, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, color: "#0f172a", margin: "0 0 8px 0" }}>Vista Kanban</h1>
      <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 16 }}>
        Arrastra las tarjetas entre columnas para cambiar su estado.
      </p>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
        <label style={{ fontSize: 13, color: "#475569" }}>Módulo:</label>
        <select value={moduleKey} onChange={(e) => setModuleKey(e.target.value)} style={ipt}>
          {COMMON_MODULES.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <button type="button" onClick={load} style={btn}>↻ Recargar</button>
      </div>

      {error ? <div style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 13 }}>{error}</div> : null}
      {loading ? <p>Cargando…</p> : null}

      <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 12 }}>
        {grouped.map(([estado, items]) => (
          <div
            key={estado}
            onDragOver={(e) => { e.preventDefault(); setDropEstado(estado); }}
            onDragLeave={() => setDropEstado(null)}
            onDrop={() => {
              if (dragRowId) persistEstado(dragRowId, estado);
              setDragRowId(null);
              setDropEstado(null);
            }}
            style={{
              minWidth: 280,
              flex: "0 0 280px",
              background: dropEstado === estado ? "#eff6ff" : "#f1f5f9",
              border: "1px solid " + (dropEstado === estado ? "#1d4ed8" : "#e5e7eb"),
              borderRadius: 8,
              padding: 10,
              transition: "background 0.15s, border-color 0.15s",
            }}
          >
            <h3 style={{ fontSize: 12, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: 0.4, margin: "0 0 8px 0", display: "flex", justifyContent: "space-between" }}>
              <span>{estado}</span>
              <span style={{ background: "#94a3b8", color: "#ffffff", padding: "1px 6px", borderRadius: 8 }}>{items.length}</span>
            </h3>
            <div style={{ display: "grid", gap: 6 }}>
              {items.map((r) => (
                <div
                  key={r.id}
                  draggable
                  onDragStart={() => setDragRowId(r.id)}
                  onDragEnd={() => { setDragRowId(null); setDropEstado(null); }}
                  style={{
                    background: "#ffffff",
                    border: "1px solid #e5e7eb",
                    borderRadius: 6,
                    padding: 10,
                    fontSize: 13,
                    cursor: "grab",
                    opacity: dragRowId === r.id ? 0.5 : 1,
                    boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                  }}
                >
                  <div style={{ fontWeight: 600, color: "#0f172a", marginBottom: 4 }}>{getPrimary(r)}</div>
                  {r.asignado ? <div style={{ fontSize: 11, color: "#6b7280" }}>{String(r.asignado)}</div> : null}
                  {r.cliente ? <div style={{ fontSize: 11, color: "#6b7280" }}>{String(r.cliente)}</div> : null}
                  {r.importe ? <div style={{ fontSize: 11, color: "#475569", fontWeight: 600 }}>{String(r.importe)}</div> : null}
                  {r.fechaLimite || r.fecha ? <div style={{ fontSize: 11, color: "#94a3b8" }}>{String(r.fechaLimite || r.fecha)}</div> : null}
                </div>
              ))}
              {items.length === 0 ? <div style={{ fontSize: 11, color: "#94a3b8", padding: 8, textAlign: "center" }}>—</div> : null}
            </div>
          </div>
        ))}
        {grouped.length === 0 && !loading ? <p style={{ color: "#94a3b8" }}>Este módulo no tiene registros con campo estado.</p> : null}
      </div>
    </main>
  );
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
