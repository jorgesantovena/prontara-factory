"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * Ficha de detalle de registro reusable (H10-A + H10-B + H10-F).
 *
 * Header con nombre + badges + acciones primarias.
 * Tabs: Resumen | Datos | Actividad (timeline) | Documentos | Comentarios | Historial
 */
type Record = Record<string, unknown> & { id: string };

type Comment = {
  id: string;
  authorEmail: string;
  body: string;
  mentions: string[];
  createdAt: string;
};

type TimelineEvent = {
  id: string;
  tool: string;
  actorEmail: string | null;
  outcome: string;
  createdAt: string;
};

type Tab = "resumen" | "datos" | "actividad" | "documentos" | "comentarios" | "historial";

export default function RecordDetail({
  moduleKey,
  recordId,
  record,
  onClose,
  accent = "#1d4ed8",
}: {
  moduleKey: string;
  recordId: string;
  record: Record;
  onClose?: () => void;
  accent?: string;
}) {
  const [tab, setTab] = useState<Tab>("resumen");
  const [comments, setComments] = useState<Comment[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [newComment, setNewComment] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (tab === "comentarios") loadComments();
    if (tab === "actividad" || tab === "historial") loadTimeline();
  }, [tab, recordId, moduleKey]);

  async function loadComments() {
    const r = await fetch("/api/runtime/record-comments?moduleKey=" + moduleKey + "&recordId=" + recordId, { cache: "no-store" });
    const d = await r.json();
    if (d.ok) setComments(d.comments || []);
  }
  async function loadTimeline() {
    const r = await fetch("/api/erp/record-timeline?moduleKey=" + moduleKey + "&recordId=" + recordId, { cache: "no-store" });
    const d = await r.json();
    if (d.ok) setTimeline(d.events || []);
  }

  async function postComment() {
    if (!newComment.trim()) return;
    setBusy(true);
    try {
      await fetch("/api/runtime/record-comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleKey, recordId, body: newComment }),
      });
      setNewComment("");
      await loadComments();
    } finally { setBusy(false); }
  }

  const titulo = String(record.nombre || record.titulo || record.numero || record.referencia || record.asunto || record.id);
  const estado = String(record.estado || "");
  const subtitulo = String(record.cliente || record.email || record.descripcion || "").slice(0, 80);

  return (
    <div style={{ background: "var(--bg-card, #ffffff)", border: "1px solid var(--border, #e5e7eb)", borderRadius: 12, overflow: "hidden", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {/* Header */}
      <div style={{ padding: 20, borderBottom: "1px solid var(--border, #e5e7eb)", display: "flex", justifyContent: "space-between", alignItems: "start", gap: 16 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h2 style={{ margin: "0 0 4px 0", fontSize: 22, fontWeight: 800, color: "var(--fg, #0f172a)" }}>{titulo}</h2>
          {subtitulo ? <div style={{ fontSize: 13, color: "var(--fg-muted, #475569)" }}>{subtitulo}</div> : null}
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            {estado ? (
              <span style={{ background: accent + "1a", color: accent, padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>{estado}</span>
            ) : null}
            <span style={{ background: "var(--bg-secondary, #f1f5f9)", color: "var(--fg-muted, #475569)", padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>{moduleKey}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <Link href={"/" + moduleKey} style={btnSec}>Ver lista</Link>
          {onClose ? <button type="button" onClick={onClose} style={btnSec}>Cerrar</button> : null}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border, #e5e7eb)", overflowX: "auto" }}>
        {(["resumen", "datos", "actividad", "documentos", "comentarios", "historial"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            style={{
              padding: "10px 18px",
              border: "none",
              background: "transparent",
              color: tab === t ? accent : "var(--fg-muted, #6b7280)",
              borderBottom: "2px solid " + (tab === t ? accent : "transparent"),
              fontSize: 13,
              fontWeight: tab === t ? 700 : 600,
              cursor: "pointer",
              textTransform: "capitalize",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Contenido */}
      <div style={{ padding: 20, minHeight: 300 }}>
        {tab === "resumen" || tab === "datos" ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            {Object.entries(record).filter(([k]) => k !== "id" && (tab === "datos" || ["nombre", "titulo", "cliente", "fecha", "importe", "estado", "telefono", "email", "responsable"].includes(k))).map(([k, v]) => (
              <div key={k} style={{ padding: "8px 10px", background: "var(--bg-secondary, #f8fafc)", borderRadius: 6 }}>
                <div style={{ fontSize: 10, color: "var(--fg-muted, #6b7280)", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700, marginBottom: 4 }}>{k}</div>
                <div style={{ fontSize: 13, color: "var(--fg, #0f172a)", wordBreak: "break-word" }}>{String(v ?? "—")}</div>
              </div>
            ))}
          </div>
        ) : null}

        {tab === "actividad" || tab === "historial" ? (
          <div style={{ display: "grid", gap: 8 }}>
            {timeline.length === 0 ? (
              <div style={{ color: "var(--fg-muted, #94a3b8)", fontSize: 13, textAlign: "center", padding: 30 }}>Sin eventos registrados.</div>
            ) : timeline.map((e) => (
              <div key={e.id} style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 12, padding: "8px 10px", borderLeft: "3px solid " + (e.outcome === "ok" ? "#16a34a" : "#dc2626"), background: "var(--bg-secondary, #f8fafc)", borderRadius: 6 }}>
                <div style={{ fontSize: 11, color: "var(--fg-muted, #6b7280)" }}>{new Date(e.createdAt).toLocaleString("es-ES")}</div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--fg, #0f172a)" }}>{e.tool}</div>
                  <div style={{ fontSize: 11, color: "var(--fg-muted, #475569)" }}>{e.actorEmail || "sistema"}</div>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {tab === "documentos" ? (
          <div style={{ color: "var(--fg-muted, #94a3b8)", fontSize: 13, padding: 20 }}>
            <Link href={"/documentos?cliente=" + encodeURIComponent(titulo)} style={{ color: accent }}>Ver documentos del módulo →</Link>
          </div>
        ) : null}

        {tab === "comentarios" ? (
          <div>
            <div style={{ display: "grid", gap: 10, marginBottom: 14 }}>
              {comments.length === 0 ? (
                <div style={{ color: "var(--fg-muted, #94a3b8)", fontSize: 13, textAlign: "center", padding: 20 }}>Sin comentarios. Sé el primero.</div>
              ) : comments.map((c) => (
                <div key={c.id} style={{ padding: 10, background: "var(--bg-secondary, #f8fafc)", borderRadius: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <strong style={{ fontSize: 12, color: "var(--fg, #0f172a)" }}>{c.authorEmail}</strong>
                    <span style={{ fontSize: 10, color: "var(--fg-muted, #94a3b8)" }}>{new Date(c.createdAt).toLocaleString("es-ES")}</span>
                  </div>
                  <div style={{ fontSize: 13, color: "var(--fg, #0f172a)", whiteSpace: "pre-wrap" }}>{c.body}</div>
                </div>
              ))}
            </div>
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Comenta aquí. Usa @email para mencionar."
              rows={3}
              style={{ width: "100%", padding: 10, border: "1px solid var(--border, #d1d5db)", borderRadius: 6, fontSize: 13, fontFamily: "inherit", boxSizing: "border-box", resize: "vertical" }}
            />
            <button type="button" onClick={postComment} disabled={busy || !newComment.trim()} style={{ marginTop: 8, ...btnPrimary(accent) }}>
              {busy ? "Publicando…" : "Publicar comentario"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

const btnSec: React.CSSProperties = {
  padding: "6px 12px",
  border: "1px solid var(--border, #d1d5db)",
  background: "var(--bg-secondary, #ffffff)",
  color: "var(--fg, #0f172a)",
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 600,
  textDecoration: "none",
  cursor: "pointer",
};

function btnPrimary(accent: string): React.CSSProperties {
  return {
    padding: "8px 14px",
    border: "none",
    background: accent,
    color: "#ffffff",
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
  };
}
