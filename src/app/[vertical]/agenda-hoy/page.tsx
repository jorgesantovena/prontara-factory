"use client";

import { useEffect, useState } from "react";

/**
 * Agenda del día (H6-MOBILE).
 *
 * Vista mobile-first: lista cronológica de hoy mezclando reservas,
 * proyectos (citas) y actividades. Una tarjeta grande por evento.
 */
type Item = {
  id: string;
  hora: string;
  titulo: string;
  detalle: string;
  modulo: string;
  color: string;
};

const COLOR: Record<string, string> = {
  reservas: "#7c3aed",
  proyectos: "#1d4ed8",
  actividades: "#16a34a",
  caja: "#db2777",
};

export default function AgendaHoyPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const today = new Date().toISOString().slice(0, 10);
      const all: Item[] = [];
      for (const mod of ["reservas", "proyectos", "actividades"]) {
        try {
          const r = await fetch("/api/erp/module?moduleKey=" + mod, { cache: "no-store" });
          const data = await r.json();
          if (!r.ok || !data.ok) continue;
          for (const row of (data.rows || []) as Array<Record<string, unknown>>) {
            const fecha = String(row.fecha || "").slice(0, 10);
            if (fecha !== today) continue;
            const hora = String(row.horaInicio || row.hora || "—");
            all.push({
              id: mod + ":" + String(row.id || Math.random()),
              hora,
              titulo: String(row.recurso || row.nombre || row.titulo || row.concepto || "(sin título)"),
              detalle: String(row.cliente || row.solicitante || row.responsable || ""),
              modulo: mod,
              color: COLOR[mod] || "#475569",
            });
          }
        } catch { /* ignore */ }
      }
      all.sort((a, b) => a.hora.localeCompare(b.hora));
      setItems(all);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  const todayLabel = new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: 16, fontFamily: "system-ui, -apple-system, sans-serif", background: "#f1f5f9", minHeight: "100vh" }}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", margin: "0 0 2px 0" }}>Agenda de hoy</h1>
        <p style={{ color: "#475569", fontSize: 13, margin: 0, textTransform: "capitalize" }}>{todayLabel}</p>
      </div>

      <button type="button" onClick={load} style={{ width: "100%", padding: 12, border: "1px solid #cbd5e1", background: "#ffffff", color: "#1d4ed8", borderRadius: 8, fontSize: 13, fontWeight: 700, marginBottom: 12, cursor: "pointer" }}>
        ↻ Recargar
      </button>

      {error ? <div style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", borderRadius: 8, padding: 10, marginBottom: 8, fontSize: 13 }}>{error}</div> : null}
      {loading ? <p>Cargando…</p> : null}

      {!loading && items.length === 0 ? (
        <div style={{ background: "#ffffff", borderRadius: 12, padding: 32, textAlign: "center", color: "#94a3b8", fontSize: 14 }}>
          Sin eventos para hoy.<br />
          <span style={{ fontSize: 24, marginTop: 12, display: "block" }}>🌤️</span>
        </div>
      ) : null}

      <div style={{ display: "grid", gap: 8 }}>
        {items.map((it) => (
          <div
            key={it.id}
            style={{
              background: "#ffffff",
              borderLeft: "4px solid " + it.color,
              borderRadius: 8,
              padding: 14,
              display: "grid",
              gridTemplateColumns: "60px 1fr",
              gap: 12,
              alignItems: "center",
              boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 800, color: it.color, textAlign: "center" }}>
              {it.hora.slice(0, 5)}
            </div>
            <div>
              <div style={{ fontWeight: 700, color: "#0f172a", fontSize: 15 }}>{it.titulo}</div>
              {it.detalle ? <div style={{ fontSize: 12, color: "#475569", marginTop: 2 }}>{it.detalle}</div> : null}
              <div style={{ fontSize: 10, color: it.color, fontWeight: 700, textTransform: "uppercase", marginTop: 4 }}>{it.modulo}</div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
