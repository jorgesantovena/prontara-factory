"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import FactoryShell from "@/components/factory/factory-shell";

type ConversationMeta = {
  id: string;
  accountId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
};

type AttachmentRef = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  isImage?: boolean;
};

const IMAGE_MIME_RE = /^image\/(png|jpe?g|gif|webp)$/i;

function isImageAttachment(a: AttachmentRef): boolean {
  if (a.isImage) return true;
  return IMAGE_MIME_RE.test(String(a.mimeType || ""));
}

type StoredMessage = {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  toolName?: string;
  attachments?: AttachmentRef[];
  createdAt: string;
};

type ActiveMessage =
  | { kind: "stored"; message: StoredMessage }
  | { kind: "streaming"; id: string; text: string; tools: Array<{ name: string; status: "running" | "done" }> };

const ACCENT = "#1d4ed8";

// Next requiere que el árbol que use useSearchParams esté envuelto en
// <Suspense>; si no, prerendering del build estático falla con
// "useSearchParams() should be wrapped in a suspense boundary".
// Patrón: el componente real va dentro, el wrapper exportado como default
// monta el Suspense.
export default function FactoryChatPage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: "2rem", color: "#64748b" }}>
          Cargando chat de Factory…
        </div>
      }
    >
      <FactoryChatPageInner />
    </Suspense>
  );
}

function FactoryChatPageInner() {
  const searchParams = useSearchParams();
  const [conversations, setConversations] = useState<ConversationMeta[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Sincronizar conversación activa con el query param ?id=X que pone el
  // FactoryShell desde su sidebar.
  useEffect(() => {
    const idFromUrl = searchParams?.get("id");
    if (idFromUrl) setActiveId(idFromUrl);
  }, [searchParams]);
  const [messages, setMessages] = useState<ActiveMessage[]>([]);
  const [prompt, setPrompt] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<AttachmentRef[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [unauth, setUnauth] = useState(false);
  const [missingApiKey, setMissingApiKey] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const logRef = useRef<HTMLDivElement | null>(null);

  // ---- Carga inicial de conversaciones ---------------------------------
  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/factory/chat/conversations", { cache: "no-store" });
      if (res.status === 401) {
        setUnauth(true);
        return;
      }
      const data = await res.json();
      if (data.ok) setConversations(data.conversations || []);
    } catch {
      // Silencioso.
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // ---- Carga de una conversación concreta ------------------------------
  const loadConversation = useCallback(async (id: string) => {
    try {
      const res = await fetch("/api/factory/chat/conversations/" + encodeURIComponent(id), { cache: "no-store" });
      if (res.status === 401) {
        setUnauth(true);
        return;
      }
      const data = await res.json();
      if (data.ok && data.conversation) {
        const stored: ActiveMessage[] = (data.conversation.messages || []).map((m: StoredMessage) => ({
          kind: "stored" as const,
          message: m,
        }));
        setMessages(stored);
      }
    } catch {
      // Silencioso.
    }
  }, []);

  useEffect(() => {
    if (activeId) loadConversation(activeId);
  }, [activeId, loadConversation]);

  // Auto-scroll al final cuando cambian mensajes.
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages.length, messages[messages.length - 1]]);

  // ---- Nueva conversación ----------------------------------------------
  async function createNewConversation() {
    try {
      const res = await fetch("/api/factory/chat/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.ok && data.meta) {
        setConversations((prev) => [data.meta, ...prev]);
        setActiveId(data.meta.id);
        setMessages([]);
      }
    } catch {
      // Silencioso.
    }
  }

  async function deleteConversation(id: string) {
    if (!confirm("¿Eliminar esta conversación? No se puede deshacer.")) return;
    try {
      await fetch("/api/factory/chat/conversations/" + encodeURIComponent(id), { method: "DELETE" });
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeId === id) {
        setActiveId(null);
        setMessages([]);
      }
    } catch {
      // Silencioso.
    }
  }

  // ---- Subida de adjuntos ---------------------------------------------
  async function onFilesSelected(files: FileList) {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fd = new FormData();
      fd.append("file", file);
      try {
        const res = await fetch("/api/factory/chat/upload", { method: "POST", body: fd });
        const data = await res.json();
        if (data.ok && data.meta) {
          setPendingAttachments((prev) => [...prev, data.meta]);
        } else {
          setError(data.error || "No se pudo subir el archivo.");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error subiendo el archivo.");
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeAttachment(id: string) {
    setPendingAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  /**
   * Captura imágenes pegadas con Ctrl+V en el textarea (típicamente
   * capturas de pantalla del portapapeles del SO). Cuando hay imágenes
   * las subimos al endpoint de uploads igual que el botón del clip y
   * cancelamos el paste por defecto para que no se inserte texto basura
   * tipo "[object File]". Si solo hay texto, dejamos el paste nativo.
   */
  async function onPasteEvent(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === "file" && item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          // Las imágenes pegadas suelen llamarse "image.png" sin nombre
          // útil. Renombramos con un timestamp para que el chat las
          // muestre identificables en el listado de adjuntos.
          const ext = file.type.split("/")[1] || "png";
          const renamed = new File(
            [file],
            "captura-" + new Date().toISOString().replace(/[:.]/g, "-") + "." + ext,
            { type: file.type },
          );
          imageFiles.push(renamed);
        }
      }
    }
    if (imageFiles.length === 0) return;
    e.preventDefault();
    const dt = new DataTransfer();
    for (const f of imageFiles) dt.items.add(f);
    await onFilesSelected(dt.files);
  }

  // ---- Envío del mensaje con streaming SSE ------------------------------
  async function sendMessage() {
    if (busy) return;
    const content = prompt.trim();
    if (!content && pendingAttachments.length === 0) return;

    // Asegurar que hay conversación activa.
    let convId = activeId;
    if (!convId) {
      try {
        const res = await fetch("/api/factory/chat/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const data = await res.json();
        if (!data.ok) {
          setError(data.error || "No se pudo crear la conversación.");
          return;
        }
        convId = data.meta.id as string;
        setConversations((prev) => [data.meta, ...prev]);
        setActiveId(convId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error creando conversación.");
        return;
      }
    }

    setError("");
    setBusy(true);

    // Añadimos optimistamente el mensaje del usuario a la UI.
    const userMsg: StoredMessage = {
      id: "m-local-" + Date.now(),
      role: "user",
      content,
      attachments: pendingAttachments,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, { kind: "stored", message: userMsg }]);

    const streamingId = "m-stream-" + Date.now();
    setMessages((prev) => [...prev, { kind: "streaming", id: streamingId, text: "", tools: [] }]);

    const attachmentIds = pendingAttachments.map((a) => a.id);
    setPrompt("");
    setPendingAttachments([]);

    try {
      const res = await fetch("/api/factory/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: convId, content, attachmentIds }),
      });

      if (res.status === 401) {
        setUnauth(true);
        return;
      }
      if (res.status === 503) {
        const errData = await res.json().catch(() => ({}));
        setMissingApiKey(true);
        setError(errData.error || "Falta ANTHROPIC_API_KEY.");
        return;
      }
      if (!res.ok || !res.body) {
        const errData = await res.json().catch(() => ({}));
        setError(errData.error || "Error enviando el mensaje.");
        return;
      }

      // Leemos el stream SSE.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buffer.indexOf("\n\n")) !== -1) {
          const block = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          if (!block.trim()) continue;

          let eventName = "";
          let dataPayload = "";
          for (const line of block.split("\n")) {
            if (line.startsWith("event:")) eventName = line.slice(6).trim();
            else if (line.startsWith("data:")) dataPayload += line.slice(5).trim();
          }
          if (!eventName || !dataPayload) continue;

          let parsed: { type?: string; text?: string; name?: string; message?: string; resultPreview?: string };
          try {
            parsed = JSON.parse(dataPayload);
          } catch {
            continue;
          }

          if (eventName === "text" && parsed.text) {
            const addition = parsed.text;
            setMessages((prev) =>
              prev.map((m) =>
                m.kind === "streaming" && m.id === streamingId
                  ? { ...m, text: m.text + addition }
                  : m,
              ),
            );
          } else if (eventName === "tool_use_start" && parsed.name) {
            const toolName = parsed.name;
            setMessages((prev) =>
              prev.map((m) =>
                m.kind === "streaming" && m.id === streamingId
                  ? { ...m, tools: [...m.tools, { name: toolName, status: "running" as const }] }
                  : m,
              ),
            );
          } else if (eventName === "tool_use_result" && parsed.name) {
            const toolName = parsed.name;
            setMessages((prev) =>
              prev.map((m) => {
                if (m.kind !== "streaming" || m.id !== streamingId) return m;
                const tools = [...m.tools];
                for (let i = tools.length - 1; i >= 0; i--) {
                  if (tools[i].name === toolName && tools[i].status === "running") {
                    tools[i] = { ...tools[i], status: "done" };
                    break;
                  }
                }
                return { ...m, tools };
              }),
            );
          } else if (eventName === "error" && parsed.message) {
            setError(parsed.message);
          }
          // event "done" no cambia la UI; sirve de fin del stream.
        }
      }

      // Stream terminado: recargamos la conversación completa desde el server
      // para tener los IDs/timestamps definitivos.
      if (convId) {
        await loadConversation(convId);
        await loadConversations();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de red.");
    } finally {
      setBusy(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  if (unauth) {
    return (
      <main style={{ padding: 48, fontFamily: "Arial, sans-serif", background: "#f5f7fb", minHeight: "100vh" }}>
        <div style={{ maxWidth: 640, margin: "40px auto", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 32 }}>
          <h1 style={{ marginTop: 0 }}>Acceso restringido</h1>
          <p style={{ color: "#4b5563" }}>El chat de Factory solo está disponible para cuentas con rol admin u owner.</p>
          <Link
            href="/acceso"
            style={{ display: "inline-block", background: ACCENT, color: "#fff", padding: "10px 16px", borderRadius: 10, textDecoration: "none", fontWeight: 700 }}
          >
            Iniciar sesión
          </Link>
        </div>
      </main>
    );
  }

  return (
    <FactoryShell contentBackground="#f5f7fb" contentPadding={0}>
      <section style={{ display: "grid", gridTemplateRows: "1fr auto", height: "100%", overflow: "hidden" }}>
        {/* Log */}
        <div ref={logRef} style={{ overflowY: "auto", padding: 24, display: "grid", gap: 16, alignContent: "start" }}>
          {missingApiKey ? (
            <SetupBanner />
          ) : null}

          {messages.length === 0 && !missingApiKey ? (
            <EmptyState onExample={(text) => setPrompt(text)} />
          ) : null}

          {messages.map((m, idx) => {
            if (m.kind === "stored") {
              return <MessageBubble key={m.message.id + "-" + idx} message={m.message} />;
            }
            return (
              <StreamingBubble
                key={m.id}
                text={m.text}
                tools={m.tools}
              />
            );
          })}

          {error ? (
            <div role="alert" style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", padding: 12, borderRadius: 10 }}>
              {error}
            </div>
          ) : null}
        </div>

        {/* Composer */}
        <div style={{ borderTop: "1px solid #e5e7eb", background: "#fff", padding: 16, display: "grid", gap: 10 }}>
          {pendingAttachments.length > 0 ? (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {pendingAttachments.map((a) => {
                const isImage = isImageAttachment(a);
                if (isImage) {
                  return (
                    <div
                      key={a.id}
                      style={{
                        position: "relative",
                        border: "1px solid #bfdbfe",
                        borderRadius: 12,
                        padding: 4,
                        background: "#eff6ff",
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={"/api/factory/chat/uploads/" + encodeURIComponent(a.id) + "/binary"}
                        alt={a.name}
                        style={{ display: "block", maxHeight: 84, maxWidth: 140, borderRadius: 8 }}
                      />
                      <button
                        type="button"
                        onClick={() => removeAttachment(a.id)}
                        style={{
                          position: "absolute",
                          top: -8,
                          right: -8,
                          width: 22,
                          height: 22,
                          borderRadius: 999,
                          border: "1px solid #fecaca",
                          background: "#fff",
                          color: "#991b1b",
                          cursor: "pointer",
                          fontWeight: 700,
                          fontSize: 12,
                          lineHeight: "20px",
                        }}
                        title="Quitar"
                      >
                        ×
                      </button>
                    </div>
                  );
                }
                return (
                  <div
                    key={a.id}
                    style={{ background: "#eff6ff", color: "#1d4ed8", padding: "6px 10px", borderRadius: 999, fontSize: 12, display: "inline-flex", gap: 6, alignItems: "center" }}
                  >
                    <span>{a.name}</span>
                    <button type="button" onClick={() => removeAttachment(a.id)} style={{ border: "none", background: "transparent", color: "#1d4ed8", cursor: "pointer", fontWeight: 700 }}>
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          ) : null}

          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 10, alignItems: "end" }}>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{ padding: "10px 14px", border: "1px solid #d1d5db", background: "#fff", borderRadius: 10, cursor: "pointer", fontSize: 14 }}
              title="Adjuntar archivo"
            >
              📎
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              style={{ display: "none" }}
              onChange={(e) => e.target.files && onFilesSelected(e.target.files)}
            />

            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={onKeyDown}
              onPaste={onPasteEvent}
              placeholder="Escribe lo que necesitas. Enter para enviar, Shift+Enter para salto de línea. Pega capturas con Ctrl+V."
              rows={2}
              style={{
                width: "100%",
                padding: "10px 14px",
                border: "1px solid #d1d5db",
                borderRadius: 12,
                fontSize: 14,
                fontFamily: "inherit",
                resize: "vertical",
                boxSizing: "border-box",
              }}
              disabled={busy}
            />

            <button
              type="button"
              onClick={sendMessage}
              disabled={busy || (prompt.trim() === "" && pendingAttachments.length === 0)}
              style={{
                border: "none",
                background: busy || (prompt.trim() === "" && pendingAttachments.length === 0) ? "#94a3b8" : ACCENT,
                color: "#fff",
                padding: "12px 18px",
                borderRadius: 12,
                fontWeight: 700,
                cursor: busy ? "not-allowed" : "pointer",
                fontSize: 14,
              }}
            >
              {busy ? "…" : "Enviar"}
            </button>
          </div>
        </div>
      </section>
    </FactoryShell>
  );
}

function MessageBubble({ message }: { message: StoredMessage; key?: string | number }) {
  if (message.role === "user") {
    const images = (message.attachments || []).filter((a) => isImageAttachment(a));
    const nonImages = (message.attachments || []).filter((a) => !isImageAttachment(a));
    return (
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div style={{ background: "#1d4ed8", color: "#fff", padding: "12px 16px", borderRadius: "16px 16px 4px 16px", maxWidth: "78%", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
          {message.content}
          {images.length > 0 ? (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
              {images.map((a) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={a.id}
                  src={"/api/factory/chat/uploads/" + encodeURIComponent(a.id) + "/binary"}
                  alt={a.name}
                  style={{ maxHeight: 120, maxWidth: 220, borderRadius: 8, border: "1px solid rgba(255,255,255,0.35)" }}
                />
              ))}
            </div>
          ) : null}
          {nonImages.length > 0 ? (
            <div style={{ marginTop: 8, fontSize: 12, opacity: 0.85 }}>
              Adjuntos: {nonImages.map((a) => a.name).join(", ")}
            </div>
          ) : null}
        </div>
      </div>
    );
  }
  return (
    <div style={{ background: "#ffffff", border: "1px solid #e5e7eb", padding: "14px 18px", borderRadius: "16px 16px 16px 4px", maxWidth: "90%" }}>
      <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.55, color: "#111827" }}>{message.content}</div>
      {message.toolName ? (
        <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280" }}>Tools usadas: {message.toolName}</div>
      ) : null}
    </div>
  );
}

const WRITE_TOOL_NAMES_UI = new Set<string>([
  "write_repo_file",
  "patch_repo_file",
  "run_tsc_check",
  "run_lint_check",
  "restore_backup_snapshot",
  "regenerate_tenant",
  "invalidate_factory_cache",
  "seed_demo_data",
  "hard_reprovision_tenant",
]);

function toolChipColors(name: string, status: "running" | "done") {
  const isWrite = WRITE_TOOL_NAMES_UI.has(name);
  if (status === "running") {
    return isWrite
      ? { bg: "#fee2e2", fg: "#991b1b" } // rojo claro: mutación en marcha
      : { bg: "#fef3c7", fg: "#92400e" }; // amarillo: lectura en marcha
  }
  return isWrite
    ? { bg: "#fed7aa", fg: "#9a3412" } // naranja: mutación completada
    : { bg: "#dcfce7", fg: "#166534" }; // verde: lectura completada
}

function StreamingBubble({ text, tools }: { text: string; tools: Array<{ name: string; status: "running" | "done" }>; key?: string | number }) {
  return (
    <div style={{ background: "#ffffff", border: "1px solid #bfdbfe", padding: "14px 18px", borderRadius: "16px 16px 16px 4px", maxWidth: "90%" }}>
      {tools.length > 0 ? (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
          {tools.map((t, i) => {
            const colors = toolChipColors(t.name, t.status);
            const isWrite = WRITE_TOOL_NAMES_UI.has(t.name);
            return (
              <span
                key={t.name + i}
                title={isWrite ? "Tool de escritura (auditada)" : "Tool de lectura"}
                style={{
                  background: colors.bg,
                  color: colors.fg,
                  padding: "3px 10px",
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                {t.status === "running" ? "⟳" : isWrite ? "✎" : "✓"} {t.name}
              </span>
            );
          })}
        </div>
      ) : null}
      <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.55, color: "#111827" }}>
        {text || <span style={{ color: "#94a3b8", fontStyle: "italic" }}>Pensando…</span>}
      </div>
    </div>
  );
}

function EmptyState({ onExample }: { onExample: (text: string) => void }) {
  const examples = [
    "Lista mis tenants y dime cuántos hay activos",
    "Enséñame el vertical software-factory",
    "Muéstrame los archivos dentro de src/lib/verticals",
    "Lee docs/vertical-pattern.md y dame un resumen",
  ];
  return (
    <div style={{ background: "#ffffff", border: "1px dashed #cbd5e1", borderRadius: 14, padding: 28, display: "grid", gap: 12 }}>
      <div style={{ fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase", color: "#64748b", fontWeight: 700 }}>
        Chat Factory
      </div>
      <h2 style={{ margin: 0, fontSize: 24 }}>Pregunta lo que necesites sobre tu Factory.</h2>
      <p style={{ margin: 0, color: "#4b5563" }}>
        El asistente puede leer tenants, verticales, salud, archivos del repositorio y documentos que adjuntes.
        En fase 1 solo lee; la ejecución de acciones llega en la próxima fase.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {examples.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => onExample(ex)}
            style={{ border: "1px solid #d1d5db", background: "#fff", borderRadius: 999, padding: "8px 14px", fontSize: 13, cursor: "pointer" }}
          >
            {ex}
          </button>
        ))}
      </div>
    </div>
  );
}

function SetupBanner() {
  return (
    <div style={{ background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e", padding: 20, borderRadius: 14, display: "grid", gap: 8 }}>
      <div style={{ fontWeight: 700, fontSize: 16 }}>Configuración pendiente</div>
      <p style={{ margin: 0, fontSize: 14 }}>
        El chat necesita una clave de Anthropic para funcionar. En el repo encontrarás los pasos en
        <code style={{ background: "#fef3c7", padding: "2px 6px", borderRadius: 4, margin: "0 4px" }}>docs/factory-chat-setup.md</code>.
      </p>
      <p style={{ margin: 0, fontSize: 13, opacity: 0.85 }}>
        Resumen: crea cuenta en console.anthropic.com, añade crédito, genera API key, ponla en <code>.env</code> como
        <code style={{ background: "#fef3c7", padding: "2px 6px", borderRadius: 4, margin: "0 4px" }}>ANTHROPIC_API_KEY=sk-ant-...</code>
        y reinicia <code>pnpm dev</code>.
      </p>
    </div>
  );
}
