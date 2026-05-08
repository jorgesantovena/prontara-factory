"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Mensajería interna (H3-FUNC-04).
 *
 * Lista mensajes (broadcast + privados) + form para enviar uno nuevo.
 * Usa SSE (/messages/stream) si está disponible, fallback a polling.
 */
type Message = {
  id: string;
  fromEmail: string;
  toEmail: string | null;
  subject: string | null;
  body: string;
  createdAt: string;
};

export default function MensajesPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [toEmail, setToEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const sourceRef = useRef<EventSource | null>(null);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/runtime/messages/send", { cache: "no-store" });
      const data = await r.json();
      if (r.ok && data.ok) setMessages((data.messages || []) as Message[]);
      else setError(data.error || "Error.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // Conectar SSE
    try {
      const src = new EventSource("/api/runtime/messages/stream");
      sourceRef.current = src;
      src.addEventListener("message", (ev) => {
        try {
          const m = JSON.parse((ev as MessageEvent).data) as Message;
          setMessages((prev) => {
            if (prev.some((p) => p.id === m.id)) return prev;
            return [m, ...prev];
          });
        } catch {
          // ignore
        }
      });
      src.addEventListener("error", () => {
        // Reconect automatic by EventSource — silenciamos
      });
      return () => {
        src.close();
        sourceRef.current = null;
      };
    } catch {
      // SSE no soportado — polling cada 10s
      const t = setInterval(load, 10_000);
      return () => clearInterval(t);
    }
  }, []);

  async function handleSend() {
    if (!body.trim()) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/runtime/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toEmail: toEmail || undefined, subject: subject || undefined, body }),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        setError(data.error || "Error enviando.");
        return;
      }
      setBody("");
      setSubject("");
      setToEmail("");
      // El SSE empujará el mensaje en cualquier caso
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 24, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, color: "#0f172a", margin: "0 0 8px 0" }}>Mensajes internos</h1>
      <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 20 }}>
        Comunica con tu equipo en tiempo real. Deja "Para" vacío para enviar a todo el tenant.
      </p>

      {error ? <div style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 13 }}>{error}</div> : null}

      <section style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, background: "#ffffff", marginBottom: 20 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 10px 0", color: "#475569", textTransform: "uppercase", letterSpacing: 0.5 }}>Nuevo mensaje</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
          <input value={toEmail} onChange={(e) => setToEmail(e.target.value)} placeholder="Para (email — vacío = broadcast)" style={ipt} />
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Asunto (opcional)" style={ipt} />
        </div>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Escribe tu mensaje…" rows={3} style={{ ...ipt, width: "100%", marginBottom: 8 }} />
        <button type="button" onClick={handleSend} disabled={busy || !body.trim()} style={{ border: "none", background: "#1d4ed8", color: "#ffffff", borderRadius: 8, padding: "8px 18px", fontWeight: 700, fontSize: 14, cursor: busy ? "not-allowed" : "pointer", opacity: busy || !body.trim() ? 0.6 : 1 }}>
          {busy ? "Enviando…" : "Enviar"}
        </button>
      </section>

      <h2 style={{ fontSize: 14, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 8px 0" }}>Bandeja ({messages.length})</h2>
      {loading ? <p>Cargando…</p> : null}
      <div style={{ display: "grid", gap: 8 }}>
        {messages.map((m) => (
          <div key={m.id} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 12, background: m.toEmail ? "#fef3c7" : "#ffffff" }}>
            <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>
              <strong>{m.fromEmail}</strong> → {m.toEmail || <em>todo el tenant</em>} · {new Date(m.createdAt).toLocaleString("es-ES")}
            </div>
            {m.subject ? <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{m.subject}</div> : null}
            <div style={{ fontSize: 13, color: "#0f172a", whiteSpace: "pre-wrap" }}>{m.body}</div>
          </div>
        ))}
      </div>
    </main>
  );
}

const ipt: React.CSSProperties = {
  padding: "8px 10px",
  border: "1px solid #d1d5db",
  borderRadius: 6,
  fontSize: 13,
  fontFamily: "inherit",
  boxSizing: "border-box",
};
