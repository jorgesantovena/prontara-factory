"use client";

import { useState, useRef, useEffect } from "react";

/**
 * Preguntas 1.con / mail 2 punto 11 — Asistente como caja flotante en
 * la esquina inferior derecha del dashboard de Inicio. Pedro lo quitó
 * del MP y pidió este formato. La caja:
 *   - Cerrada: muestra un botón redondo con icono "💬".
 *   - Abierta: panel pequeño (340×420) con historial de la sesión y
 *     un input para preguntar.
 *
 * Llama a /api/runtime/assistant (POST) que resuelve la consulta
 * contra el TenantRuntimeConfig + intents del vertical (ver
 * `lib/verticals/.../assistant-intents.ts`).
 */
type Msg = { role: "user" | "assistant"; text: string };

const STORAGE_KEY = "prontara-asistente-msgs";

export default function AsistenteFlotante({ accent = "#1d4ed8" }: { accent?: string }) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const listRef = useRef<HTMLDivElement>(null);

  // Restaurar conversación previa al montar.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) setMsgs(arr.slice(-30));
      }
    } catch { /* ignore */ }
  }, []);

  // Persistir conversación tras cambios.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(msgs.slice(-30)));
    } catch { /* ignore */ }
  }, [msgs]);

  // Auto-scroll al final cuando llega mensaje nuevo.
  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [msgs, busy]);

  async function send(text?: string) {
    const p = (text ?? prompt).trim();
    if (!p || busy) return;
    setBusy(true);
    setMsgs((prev) => [...prev, { role: "user", text: p }]);
    setPrompt("");
    try {
      const r = await fetch("/api/runtime/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: p }),
      });
      const d = await r.json();
      if (r.ok && d.ok) {
        setMsgs((prev) => [...prev, { role: "assistant", text: String(d.answer || "—") }]);
        if (Array.isArray(d.suggestions)) setSuggestions(d.suggestions.slice(0, 3));
      } else {
        setMsgs((prev) => [...prev, { role: "assistant", text: "No he podido responder: " + (d?.error || "error") }]);
      }
    } catch {
      setMsgs((prev) => [...prev, { role: "assistant", text: "No he podido conectar con el asistente." }]);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir asistente"
        title="Asistente"
        style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 70,
          width: 56, height: 56, borderRadius: 999,
          background: accent, color: "#ffffff", border: "none",
          boxShadow: "0 10px 24px rgba(15,23,42,0.25)", cursor: "pointer",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          fontSize: 22,
        }}
      >
        💬
      </button>
    );
  }

  return (
    <aside
      role="dialog"
      aria-label="Asistente"
      style={{
        position: "fixed", bottom: 24, right: 24, zIndex: 70,
        width: 340, height: 460, display: "flex", flexDirection: "column",
        background: "#ffffff", borderRadius: 12,
        boxShadow: "0 18px 40px rgba(15,23,42,0.28)",
        border: "1px solid #e2e8f0",
      }}
    >
      {/* Cabecera */}
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderBottom: "1px solid #f1f5f9" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
          <span style={{ fontSize: 16 }}>💬</span> Asistente
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Cerrar"
          style={{ background: "transparent", border: "none", color: "#94a3b8", fontSize: 18, cursor: "pointer", lineHeight: 1 }}
        >
          ×
        </button>
      </header>

      {/* Historial */}
      <div ref={listRef} style={{ flex: 1, overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
        {msgs.length === 0 ? (
          <div style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", marginTop: 16 }}>
            Pregúntame por tu negocio: <em>“facturas vencidas”</em>, <em>“pipeline”</em>, <em>“horas imputadas este mes”</em>…
          </div>
        ) : null}
        {msgs.map((m, i) => (
          <div
            key={i}
            style={{
              maxWidth: "85%",
              alignSelf: m.role === "user" ? "flex-end" : "flex-start",
              background: m.role === "user" ? accent : "#f1f5f9",
              color: m.role === "user" ? "#ffffff" : "#0f172a",
              padding: "8px 12px", borderRadius: 10,
              fontSize: 13, lineHeight: 1.4, whiteSpace: "pre-wrap",
            }}
          >
            {m.text}
          </div>
        ))}
        {busy ? (
          <div style={{ alignSelf: "flex-start", color: "#94a3b8", fontSize: 12 }}>Pensando…</div>
        ) : null}
      </div>

      {/* Sugerencias rápidas */}
      {suggestions.length > 0 && !busy ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "8px 12px", borderTop: "1px solid #f1f5f9" }}>
          {suggestions.map((s, i) => (
            <button key={i} type="button" onClick={() => send(s)} style={{
              background: "#eff6ff", color: "#1e40af", border: "1px solid #bfdbfe",
              borderRadius: 999, padding: "3px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer",
            }}>
              {s}
            </button>
          ))}
        </div>
      ) : null}

      {/* Input */}
      <form
        onSubmit={(e) => { e.preventDefault(); send(); }}
        style={{ display: "flex", gap: 6, padding: 10, borderTop: "1px solid #f1f5f9" }}
      >
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Escribe tu consulta…"
          disabled={busy}
          style={{
            flex: 1, padding: "8px 12px", border: "1px solid #e2e8f0", borderRadius: 8,
            fontSize: 13, outline: "none",
          }}
        />
        <button
          type="submit"
          disabled={busy || !prompt.trim()}
          style={{
            background: prompt.trim() && !busy ? accent : "#cbd5e1", color: "#ffffff",
            border: "none", borderRadius: 8, padding: "8px 14px",
            fontWeight: 700, fontSize: 13, cursor: prompt.trim() && !busy ? "pointer" : "not-allowed",
          }}
        >
          ↑
        </button>
      </form>
    </aside>
  );
}
