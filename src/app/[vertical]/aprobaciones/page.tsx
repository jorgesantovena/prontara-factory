"use client";

import { useEffect, useState } from "react";

/**
 * Lista de aprobaciones pendientes (H11-N).
 *
 * Muestra workflows multi-paso (H4-WF-PRO) en estado pendiente de
 * aprobación para el usuario actual. Card por solicitud con detalle +
 * botones Aprobar / Rechazar / Solicitar cambios + comentario.
 */
type Approval = {
  id: string;
  ruleId: string;
  triggerRecordId: string;
  stepIndex: number;
  decidedBy: string;
  decision: string;
  comment: string | null;
  createdAt: string;
};

type Pending = {
  ruleId: string;
  ruleName: string;
  triggerRecordId: string;
  triggerModule: string;
  stepIndex: number;
  stepDescription: string;
  requesterEmail: string;
  requestedAt: string;
};

export default function AprobacionesPage() {
  const [pending, setPending] = useState<Pending[]>([]);
  const [history, setHistory] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [decision, setDecision] = useState<{ ruleId: string; recordId: string; stepIndex: number; type: "approve" | "reject" | "request_changes" } | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    try {
      // No tenemos endpoint de "pendientes" todavía — cargamos solo el histórico
      // Los pendientes se generarían con una lógica que escanea workflows extendidos.
      const r = await fetch("/api/runtime/workflows/approve", { cache: "no-store" });
      const data = await r.json();
      if (r.ok && data.ok) {
        setHistory((data.approvals || []) as Approval[]);
      } else if (data.error) {
        setError(data.error);
      }
      // Por ahora pending vacío — se puebla cuando exista endpoint dedicado
      setPending([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function submitDecision() {
    if (!decision) return;
    setBusy(true);
    try {
      const r = await fetch("/api/runtime/workflows/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ruleId: decision.ruleId,
          triggerRecordId: decision.recordId,
          stepIndex: decision.stepIndex,
          decision: decision.type === "request_changes" ? "reject" : decision.type,
          comment: decision.type === "request_changes" ? "[CAMBIOS] " + comment : comment,
        }),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        setError(data.error || "Error registrando decisión.");
      } else {
        setDecision(null);
        setComment("");
        await load();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: 24, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, color: "var(--fg, #0f172a)", margin: "0 0 8px 0" }}>Aprobaciones</h1>
      <p style={{ color: "var(--fg-muted, #6b7280)", fontSize: 14, marginBottom: 20 }}>
        Workflows multi-paso pendientes de tu decisión + histórico reciente.
      </p>

      {error ? <div style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 13 }}>{error}</div> : null}

      <h2 style={sectionTitle}>Pendientes</h2>
      {loading ? <p>Cargando…</p> : null}
      {!loading && pending.length === 0 ? (
        <div style={emptyBox}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>✓</div>
          <strong style={{ color: "var(--fg, #0f172a)" }}>Sin aprobaciones pendientes</strong>
          <p style={{ color: "var(--fg-muted, #475569)", fontSize: 13, marginTop: 4 }}>
            Cuando un workflow multi-paso requiera tu decisión, aparecerá aquí.
          </p>
        </div>
      ) : null}
      <div style={{ display: "grid", gap: 10, marginBottom: 28 }}>
        {pending.map((p) => (
          <div key={p.ruleId + ":" + p.triggerRecordId + ":" + p.stepIndex} style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 8 }}>
              <div>
                <strong style={{ fontSize: 15, color: "var(--fg, #0f172a)" }}>{p.ruleName}</strong>
                <div style={{ fontSize: 12, color: "var(--fg-muted, #475569)" }}>{p.triggerModule} · paso {p.stepIndex + 1}</div>
              </div>
              <span style={{ fontSize: 11, color: "var(--fg-muted, #94a3b8)" }}>{new Date(p.requestedAt).toLocaleString("es-ES")}</span>
            </div>
            <p style={{ fontSize: 13, color: "var(--fg, #0f172a)", margin: "0 0 12px 0" }}>{p.stepDescription}</p>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={() => setDecision({ ruleId: p.ruleId, recordId: p.triggerRecordId, stepIndex: p.stepIndex, type: "approve" })} style={btnApprove}>Aprobar</button>
              <button type="button" onClick={() => setDecision({ ruleId: p.ruleId, recordId: p.triggerRecordId, stepIndex: p.stepIndex, type: "request_changes" })} style={btnNeutral}>Solicitar cambios</button>
              <button type="button" onClick={() => setDecision({ ruleId: p.ruleId, recordId: p.triggerRecordId, stepIndex: p.stepIndex, type: "reject" })} style={btnReject}>Rechazar</button>
            </div>
          </div>
        ))}
      </div>

      <h2 style={sectionTitle}>Histórico reciente</h2>
      <div style={{ display: "grid", gap: 6 }}>
        {history.length === 0 ? (
          <div style={{ ...emptyBox, padding: 16 }}>Sin decisiones registradas.</div>
        ) : history.map((h) => (
          <div key={h.id} style={{ ...cardStyle, padding: 12, borderLeft: "4px solid " + (h.decision === "approve" ? "#16a34a" : "#dc2626") }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
              <span><strong>{h.decidedBy}</strong> · {h.decision === "approve" ? "✓ Aprobado" : "× Rechazado"} · paso {h.stepIndex + 1}</span>
              <span style={{ color: "var(--fg-muted, #94a3b8)" }}>{new Date(h.createdAt).toLocaleString("es-ES")}</span>
            </div>
            {h.comment ? <div style={{ fontSize: 12, color: "var(--fg-muted, #475569)", marginTop: 4 }}>{h.comment}</div> : null}
          </div>
        ))}
      </div>

      {/* Modal decisión */}
      {decision ? (
        <>
          <div onClick={() => setDecision(null)} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", zIndex: 100 }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", background: "var(--bg-card, #ffffff)", borderRadius: 12, padding: 24, width: "min(480px, 92%)", zIndex: 101 }}>
            <h2 style={{ margin: "0 0 12px 0", fontSize: 18, fontWeight: 800, color: "var(--fg, #0f172a)" }}>
              {decision.type === "approve" ? "Aprobar paso" : decision.type === "request_changes" ? "Solicitar cambios" : "Rechazar paso"}
            </h2>
            <p style={{ fontSize: 13, color: "var(--fg-muted, #475569)", marginBottom: 12 }}>
              Comentario {decision.type === "approve" ? "(opcional)" : "(obligatorio)"}
            </p>
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={4} placeholder="Motivo o nota…" style={{ width: "100%", padding: 10, border: "1px solid var(--border, #d1d5db)", borderRadius: 6, fontSize: 13, boxSizing: "border-box", fontFamily: "inherit" }} />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
              <button type="button" onClick={() => setDecision(null)} style={btnNeutral}>Cancelar</button>
              <button type="button" onClick={submitDecision} disabled={busy || (decision.type !== "approve" && !comment.trim())} style={decision.type === "approve" ? btnApprove : btnReject}>
                {busy ? "Procesando…" : "Confirmar"}
              </button>
            </div>
          </div>
        </>
      ) : null}
    </main>
  );
}

const sectionTitle: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: "var(--fg-muted, #475569)", textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 10px 0" };
const cardStyle: React.CSSProperties = { background: "var(--bg-card, #ffffff)", border: "1px solid var(--border, #e5e7eb)", borderRadius: 10, padding: 16 };
const emptyBox: React.CSSProperties = { background: "var(--bg-card, #ffffff)", border: "1px dashed var(--border, #cbd5e1)", borderRadius: 10, padding: 30, textAlign: "center", color: "var(--fg-muted, #6b7280)", fontSize: 13 };
const btnApprove: React.CSSProperties = { padding: "8px 14px", border: "none", background: "#16a34a", color: "#ffffff", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: "pointer" };
const btnReject: React.CSSProperties = { padding: "8px 14px", border: "none", background: "#dc2626", color: "#ffffff", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: "pointer" };
const btnNeutral: React.CSSProperties = { padding: "8px 14px", border: "1px solid var(--border, #d1d5db)", background: "var(--bg-secondary, #ffffff)", color: "var(--fg, #0f172a)", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer" };
