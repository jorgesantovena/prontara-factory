"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import TenantShell from "@/components/erp/tenant-shell";
import { useCurrentVertical } from "@/lib/saas/use-current-vertical";

/**
 * Base de conocimiento del CAU (H15-B).
 *
 * Listado de soluciones reusables. Se rellena cuando un agente cierra
 * un ticket con `solucion` y elige convertirla en KB. Búsqueda full-text
 * en cliente (suficiente para volúmenes típicos).
 */

type KbEntry = {
  id: string;
  titulo: string;
  sintoma: string;
  solucion: string;
  categoria: string | null;
  aplicacion: string | null;
  ticketRefId: string | null;
  tags: string[];
  views: number;
  authorEmail: string;
  createdAt: string;
};

export default function KbPage() {
  const { link } = useCurrentVertical();
  const [entries, setEntries] = useState<KbEntry[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<KbEntry | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/runtime/cau/kb" + (query ? "?q=" + encodeURIComponent(query) : ""), { cache: "no-store" });
      const d = await r.json();
      if (d.ok) setEntries(d.entries || []);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);
  useEffect(() => { const t = setTimeout(() => load(), 200); return () => clearTimeout(t); /* eslint-disable-next-line */ }, [query]);

  return (
    <TenantShell>
      <div style={{ maxWidth: 1280, margin: "0 auto", fontFamily: "system-ui, -apple-system, sans-serif", color: "#0f172a" }}>
        <div style={{ fontSize: 13, color: "#64748b", marginBottom: 6 }}>
          <Link href={link("")} style={{ color: "#64748b", textDecoration: "none" }}>Inicio</Link>
          <span style={{ margin: "0 6px" }}>/</span>
          <Link href={link("cau")} style={{ color: "#64748b", textDecoration: "none" }}>CAU</Link>
          <span style={{ margin: "0 6px" }}>/</span>
          <span style={{ color: "#0f172a", fontWeight: 600 }}>Base de conocimiento</span>
        </div>

        <h1 style={{ margin: "0 0 4px 0", fontSize: 28, fontWeight: 800, letterSpacing: -0.4 }}>Base de conocimiento</h1>
        <p style={{ color: "#64748b", fontSize: 13, marginTop: 0, marginBottom: 18 }}>
          Soluciones reusables. Las creas al cerrar un ticket — la próxima vez que pase lo mismo, lo encuentras aquí.
        </p>

        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por título, síntoma, solución o tag…"
          style={{ width: "100%", padding: "10px 14px", border: "1px solid #e2e8f0", borderRadius: 10, fontSize: 13, boxSizing: "border-box", marginBottom: 16 }} />

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 18 }} className="kb-cols">
          <section style={{ display: "grid", gap: 8, alignContent: "start" }}>
            {loading ? <div style={{ color: "#94a3b8", padding: 20, textAlign: "center" }}>Cargando…</div> :
              entries.length === 0 ? <div style={{ color: "#94a3b8", padding: 20, textAlign: "center" }}>No hay entradas en la KB todavía.</div> :
              entries.map((e) => (
                <button key={e.id} type="button" onClick={() => setSelected(e)}
                  style={{
                    textAlign: "left", padding: 14, border: "1px solid " + (selected?.id === e.id ? "#1d4ed8" : "#e5e7eb"),
                    borderRadius: 10, background: selected?.id === e.id ? "#eff6ff" : "#ffffff", cursor: "pointer",
                  }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a", marginBottom: 4 }}>{e.titulo}</div>
                  <div style={{ fontSize: 12, color: "#64748b", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{e.sintoma}</div>
                  <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                    {e.aplicacion ? <span style={tag}>{e.aplicacion}</span> : null}
                    {e.categoria ? <span style={tag}>{e.categoria}</span> : null}
                    {(e.tags || []).slice(0, 3).map((t) => <span key={t} style={tag}>#{t}</span>)}
                  </div>
                </button>
              ))
            }
          </section>

          <section>
            {selected ? (
              <div style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 20, position: "sticky", top: 80 }}>
                <h3 style={{ margin: "0 0 8px 0", fontSize: 18, fontWeight: 800 }}>{selected.titulo}</h3>
                <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 14 }}>
                  Por {selected.authorEmail} · {new Date(selected.createdAt).toLocaleDateString("es-ES")}
                </div>
                <h4 style={{ margin: "12px 0 6px", fontSize: 12, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5 }}>Síntoma</h4>
                <div style={{ fontSize: 13, whiteSpace: "pre-wrap", color: "#334155" }}>{selected.sintoma}</div>
                <h4 style={{ margin: "14px 0 6px", fontSize: 12, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5 }}>Solución</h4>
                <div style={{ fontSize: 13, whiteSpace: "pre-wrap", color: "#0f172a", background: "#f8fafc", padding: 12, borderRadius: 8 }}>{selected.solucion}</div>
              </div>
            ) : (
              <div style={{ color: "#94a3b8", padding: 30, textAlign: "center", fontSize: 13 }}>Selecciona una entrada para ver el detalle.</div>
            )}
          </section>
        </div>

        <style>{`@media (max-width: 900px) { .kb-cols { grid-template-columns: 1fr !important; } }`}</style>
      </div>
    </TenantShell>
  );
}

const tag: React.CSSProperties = { display: "inline-block", padding: "2px 8px", borderRadius: 999, background: "#f1f5f9", color: "#475569", fontSize: 10, fontWeight: 600 };
