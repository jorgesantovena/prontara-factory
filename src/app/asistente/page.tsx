"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type AssistantAnswer = {
  title: string;
  summary: string;
  bullets: string[];
};

type AssistantApiResponse = {
  ok: boolean;
  error?: string;
  answer?: AssistantAnswer;
  suggestions?: string[];
};

type ConversationItem =
  | { id: string; role: "user"; content: string }
  | { id: string; role: "assistant"; answer: AssistantAnswer };

function makeId(): string {
  return "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export default function AsistentePage() {
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [welcome, setWelcome] = useState<AssistantAnswer | null>(null);
  const [conversation, setConversation] = useState<ConversationItem[]>([]);
  const [unauth, setUnauth] = useState(false);
  const [error, setError] = useState("");
  const logRef = useRef<HTMLDivElement | null>(null);

  // Carga inicial: bienvenida + chips desde el API (pasa prompt vacío).
  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const response = await fetch("/api/runtime/assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: "" }),
        });

        if (response.status === 401) {
          if (!cancelled) setUnauth(true);
          return;
        }

        const data = (await response.json()) as AssistantApiResponse;
        if (!cancelled && data.ok) {
          setWelcome(data.answer || null);
          setSuggestions(data.suggestions || []);
        }
      } catch {
        // Silencioso: la pantalla sigue siendo usable.
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  // Scroll al final del log cuando se añade una respuesta.
  useEffect(() => {
    if (!logRef.current) return;
    logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [conversation.length]);

  async function ask(value: string) {
    const text = value.trim();
    if (!text || busy) return;

    setError("");
    setBusy(true);

    const userItem: ConversationItem = {
      id: makeId(),
      role: "user",
      content: text,
    };
    setConversation((prev) => [...prev, userItem]);
    setPrompt("");

    try {
      const response = await fetch("/api/runtime/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text }),
      });

      if (response.status === 401) {
        setUnauth(true);
        return;
      }

      const data = (await response.json()) as AssistantApiResponse;

      if (!data.ok || !data.answer) {
        setError(data.error || "No hemos podido obtener una respuesta.");
        return;
      }

      const assistantItem: ConversationItem = {
        id: makeId(),
        role: "assistant",
        answer: data.answer,
      };
      setConversation((prev) => [...prev, assistantItem]);

      if (data.suggestions && data.suggestions.length > 0) {
        setSuggestions(data.suggestions);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de red.");
    } finally {
      setBusy(false);
    }
  }

  const showWelcome = useMemo(
    () => welcome !== null && conversation.length === 0,
    [welcome, conversation.length]
  );

  if (unauth) {
    return (
      <main
        style={{
          padding: 48,
          fontFamily: "Arial, sans-serif",
          background: "#f5f7fb",
          minHeight: "100vh",
        }}
      >
        <div
          style={{
            maxWidth: 640,
            margin: "40px auto",
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: 16,
            padding: 32,
          }}
        >
          <h1 style={{ marginTop: 0 }}>Asistente</h1>
          <p style={{ color: "#4b5563" }}>
            Inicia sesión para usar el asistente conversacional.
          </p>
          <a
            href="/acceso"
            style={{
              display: "inline-block",
              background: "#111827",
              color: "#ffffff",
              padding: "10px 16px",
              borderRadius: 10,
              textDecoration: "none",
              fontWeight: 700,
            }}
          >
            Iniciar sesión
          </a>
        </div>
      </main>
    );
  }

  return (
    <main
      style={{
        padding: 24,
        display: "grid",
        gap: 20,
        fontFamily: "Arial, sans-serif",
        background: "#f8fafc",
        minHeight: "100vh",
      }}
    >
      <section
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 16,
          background: "#ffffff",
          padding: 20,
          display: "grid",
          gap: 10,
        }}
      >
        <div style={{ fontSize: 12, color: "#6b7280" }}>Asistente</div>
        <h1 style={{ margin: 0, fontSize: 28 }}>Ayuda rápida para el día a día</h1>
        <p style={{ margin: 0, color: "#4b5563" }}>
          Pregunta por tus clientes, facturas, propuestas o pide un resumen.
          La respuesta se apoya en los datos reales de tu entorno.
        </p>
      </section>

      {/* Conversación */}
      <section
        ref={logRef}
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 16,
          background: "#ffffff",
          padding: 20,
          display: "grid",
          gap: 14,
          minHeight: 260,
          maxHeight: 520,
          overflowY: "auto",
        }}
      >
        {showWelcome && welcome ? <AnswerBlock answer={welcome} /> : null}

        {conversation.map((item) => (
          <div key={item.id}>
            {item.role === "user" ? (
              <UserBubble text={item.content} />
            ) : (
              <AnswerBlock answer={item.answer} />
            )}
          </div>
        ))}

        {busy ? (
          <div style={{ color: "#6b7280", fontStyle: "italic" }}>Pensando…</div>
        ) : null}

        {error ? (
          <div
            role="alert"
            style={{
              border: "1px solid #fecaca",
              background: "#fef2f2",
              color: "#b91c1c",
              borderRadius: 10,
              padding: 10,
              fontSize: 14,
            }}
          >
            {error}
          </div>
        ) : null}
      </section>

      {/* Chips de sugerencias */}
      {suggestions.length > 0 ? (
        <section style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {suggestions.map((text) => (
            <button
              key={text}
              type="button"
              onClick={() => ask(text)}
              disabled={busy}
              style={{
                border: "1px solid #d1d5db",
                background: "#ffffff",
                borderRadius: 999,
                padding: "8px 14px",
                cursor: busy ? "not-allowed" : "pointer",
                fontSize: 13,
                color: "#1f2937",
              }}
            >
              {text}
            </button>
          ))}
        </section>
      ) : null}

      {/* Composer */}
      <section
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 16,
          background: "#ffffff",
          padding: 16,
          display: "grid",
          gap: 12,
        }}
      >
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              ask(prompt);
            }
          }}
          rows={3}
          placeholder="Ejemplo: enséñame las facturas pendientes"
          style={{
            width: "100%",
            padding: "12px 14px",
            border: "1px solid #d1d5db",
            borderRadius: 12,
            fontSize: 14,
            resize: "vertical",
            fontFamily: "inherit",
            boxSizing: "border-box",
          }}
        />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontSize: 12, color: "#6b7280" }}>
            Ctrl + Enter para enviar
          </div>
          <button
            type="button"
            onClick={() => ask(prompt)}
            disabled={busy || prompt.trim() === ""}
            style={{
              border: "none",
              borderRadius: 10,
              background: busy || prompt.trim() === "" ? "#6b7280" : "#111827",
              color: "#ffffff",
              padding: "10px 16px",
              cursor: busy || prompt.trim() === "" ? "not-allowed" : "pointer",
              fontWeight: 700,
            }}
          >
            {busy ? "Consultando…" : "Consultar"}
          </button>
        </div>
      </section>
    </main>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end" }}>
      <div
        style={{
          background: "#111827",
          color: "#ffffff",
          borderRadius: "16px 16px 4px 16px",
          padding: "10px 14px",
          maxWidth: "80%",
          fontSize: 14,
          lineHeight: 1.5,
          whiteSpace: "pre-wrap",
        }}
      >
        {text}
      </div>
    </div>
  );
}

function AnswerBlock({ answer }: { answer: AssistantAnswer }) {
  return (
    <div
      style={{
        background: "#f9fafb",
        border: "1px solid #e5e7eb",
        borderRadius: "16px 16px 16px 4px",
        padding: 14,
        display: "grid",
        gap: 8,
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 16, color: "#111827" }}>{answer.title}</div>
      {answer.summary ? (
        <div style={{ color: "#4b5563", fontSize: 14, lineHeight: 1.5 }}>{answer.summary}</div>
      ) : null}
      {answer.bullets.length > 0 ? (
        <ul style={{ margin: 0, paddingLeft: 18, color: "#374151", fontSize: 14, lineHeight: 1.6 }}>
          {answer.bullets.map((item, idx) => (
            <li key={idx} style={{ marginBottom: 4 }}>
              {item}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
