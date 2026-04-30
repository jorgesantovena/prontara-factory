"use client";

import { useEffect, useMemo, useState } from "react";

type AuditEntry = {
  at: string;
  actor: { accountId: string; email: string };
  conversationId: string;
  tool: string;
  input: Record<string, unknown>;
  result: Record<string, unknown>;
  outcome: "success" | "error" | "skipped";
  durationMs: number;
  error?: string;
  touchedPaths?: string[];
  backupRef?: string;
};

export default function AuditoriaPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toolFilter, setToolFilter] = useState("");
  const [conversationFilter, setConversationFilter] = useState("");
  const [restoringRef, setRestoringRef] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    setBusy(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      qs.set("limit", "200");
      qs.set("lookbackDays", "14");
      if (toolFilter) qs.set("tool", toolFilter);
      if (conversationFilter) qs.set("conversationId", conversationFilter);
      const res = await fetch("/api/factory/auditoria?" + qs.toString());
      if (res.status === 401) {
        setError("Se requiere sesión con rol admin/owner.");
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Error cargando.");
      }
      const data = await res.json();
      setEntries(data.entries || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error cargando.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolFilter, conversationFilter]);

  async function restoreSnapshot(backupRef: string) {
    if (!confirm("¿Restaurar snapshot " + backupRef + "? Sobreescribe los ficheros actuales con los del snapshot.")) {
      return;
    }
    setRestoringRef(backupRef);
    setMessage(null);
    try {
      // Reutilizamos el endpoint del chat que restaura por backupRef — pasa
      // por withAudit así que dejamos rastro.
      const res = await fetch("/api/factory/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Usamos la tool directamente vía chat no sería idempotente aquí.
          // En vez de eso, llamamos a una ruta dedicada.
          // (La construimos más abajo en este mismo commit.)
        }),
      }).catch(() => null);
      // Fallback: endpoint dedicado.
      const res2 = await fetch("/api/factory/auditoria/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ backupRef }),
      });
      const data = await res2.json();
      if (!res2.ok || !data.ok) {
        throw new Error(data.error || "No se pudo restaurar.");
      }
      setMessage(
        "Restaurado: " + data.restoredFiles.length + " ficheros devueltos a la versión del snapshot.",
      );
      // recarga datos por si el restore generó una entrada nueva de audit
      void load();
      // evita warning de variable no usada
      void res;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error restaurando.");
    } finally {
      setRestoringRef(null);
    }
  }

  const uniqueTools = useMemo(() => {
    const set = new Set(entries.map((e) => e.tool));
    return Array.from(set).sort();
  }, [entries]);
  const uniqueConversations = useMemo(() => {
    const set = new Set(entries.map((e) => e.conversationId));
    return Array.from(set).sort();
  }, [entries]);

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "32px 40px",
        background: "#f8fafc",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>
            <a href="/factory" style={{ color: "#6b7280", textDecoration: "none" }}>
              ← Factory
            </a>
          </div>
          <h1 style={{ margin: 0, fontSize: 28, color: "#111827" }}>Log de auditoría</h1>
          <p style={{ marginTop: 6, color: "#4b5563", fontSize: 14 }}>
            Cada escritura del chat (write, patch, seed, reprovision, restore) queda registrada
            con actor, conversación, tool, resultado y paths tocados. Filtrable por tool o conversación.
            Los que tienen <code style={{ fontSize: 12 }}>backupRef</code> se pueden revertir en un click.
          </p>
        </div>

        {error ? (
          <div
            style={{
              border: "1px solid #fecaca",
              background: "#fef2f2",
              color: "#991b1b",
              padding: "10px 14px",
              borderRadius: 12,
              marginBottom: 14,
              fontSize: 13,
            }}
          >
            {error}
          </div>
        ) : null}
        {message ? (
          <div
            style={{
              border: "1px solid #bbf7d0",
              background: "#f0fdf4",
              color: "#166534",
              padding: "10px 14px",
              borderRadius: 12,
              marginBottom: 14,
              fontSize: 13,
            }}
          >
            {message}
          </div>
        ) : null}

        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "end",
            marginBottom: 16,
            flexWrap: "wrap",
          }}
        >
          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: 12, color: "#374151", fontWeight: 600 }}>Tool</span>
            <select
              value={toolFilter}
              onChange={(e) => setToolFilter(e.target.value)}
              style={selectStyle()}
            >
              <option value="">todas</option>
              {uniqueTools.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: 12, color: "#374151", fontWeight: 600 }}>Conversación</span>
            <select
              value={conversationFilter}
              onChange={(e) => setConversationFilter(e.target.value)}
              style={selectStyle()}
            >
              <option value="">todas</option>
              {uniqueConversations.map((c) => (
                <option key={c} value={c}>
                  {c.slice(0, 20)}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => {
              setToolFilter("");
              setConversationFilter("");
            }}
            style={{
              border: "1px solid #e5e7eb",
              background: "#fff",
              color: "#374151",
              padding: "10px 14px",
              borderRadius: 10,
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            Limpiar filtros
          </button>
          <button
            type="button"
            onClick={load}
            disabled={busy}
            style={{
              border: "1px solid #e5e7eb",
              background: "#fff",
              color: "#374151",
              padding: "10px 14px",
              borderRadius: 10,
              cursor: busy ? "not-allowed" : "pointer",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {busy ? "Cargando…" : "Refrescar"}
          </button>
          <div style={{ fontSize: 12, color: "#6b7280", alignSelf: "center" }}>
            {entries.length} entradas (últimos 14 días)
          </div>
        </div>

        <div
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          {entries.length === 0 ? (
            <div style={{ padding: 16, color: "#6b7280", fontSize: 13 }}>
              Sin entradas en la ventana actual.
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr>
                  <Th>Hora</Th>
                  <Th>Actor</Th>
                  <Th>Tool</Th>
                  <Th>Outcome</Th>
                  <Th>Paths</Th>
                  <Th>Conversación</Th>
                  <Th>Backup</Th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => (
                  <tr key={e.at + i} style={{ borderTop: "1px solid #f3f4f6" }}>
                    <Td>
                      <span style={{ color: "#6b7280" }}>
                        {new Date(e.at).toLocaleString("es", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </span>
                    </Td>
                    <Td>{e.actor.email}</Td>
                    <Td>
                      <code style={{ fontSize: 11 }}>{e.tool}</code>
                    </Td>
                    <Td>
                      <Badge
                        tone={e.outcome === "success" ? "ok" : e.outcome === "error" ? "danger" : "info"}
                        text={e.outcome}
                      />
                      {e.error ? (
                        <div style={{ color: "#991b1b", fontSize: 11, marginTop: 4, maxWidth: 360 }}>
                          {e.error}
                        </div>
                      ) : null}
                      <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>
                        {e.durationMs} ms
                      </div>
                    </Td>
                    <Td>
                      <div
                        style={{
                          fontSize: 11,
                          color: "#6b7280",
                          maxWidth: 240,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={(e.touchedPaths || []).join("\n")}
                      >
                        {(e.touchedPaths || []).join(", ") || "—"}
                      </div>
                    </Td>
                    <Td>
                      <code style={{ fontSize: 10, color: "#9ca3af" }}>
                        {e.conversationId.slice(0, 16)}
                      </code>
                    </Td>
                    <Td>
                      {e.backupRef ? (
                        <button
                          type="button"
                          onClick={() => restoreSnapshot(e.backupRef!)}
                          disabled={restoringRef !== null}
                          style={{
                            border: "1px solid #fde68a",
                            background: "#fffbeb",
                            color: "#92400e",
                            padding: "4px 8px",
                            borderRadius: 6,
                            cursor: restoringRef ? "not-allowed" : "pointer",
                            fontSize: 10,
                            fontWeight: 700,
                          }}
                          title={"Restaurar " + e.backupRef}
                        >
                          {restoringRef === e.backupRef ? "Restaurando…" : "Revertir"}
                        </button>
                      ) : (
                        <span style={{ color: "#d1d5db", fontSize: 11 }}>—</span>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </main>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        textAlign: "left",
        padding: "8px 12px",
        background: "#f9fafb",
        fontSize: 11,
        fontWeight: 700,
        color: "#374151",
        borderBottom: "1px solid #e5e7eb",
      }}
    >
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td style={{ padding: "8px 12px", color: "#111827", verticalAlign: "top" }}>{children}</td>;
}

function Badge({ tone, text }: { tone: "ok" | "danger" | "info"; text: string }) {
  const palette = {
    ok: { bg: "#dcfce7", fg: "#166534" },
    danger: { bg: "#fee2e2", fg: "#991b1b" },
    info: { bg: "#dbeafe", fg: "#1e40af" },
  }[tone];
  return (
    <span
      style={{
        background: palette.bg,
        color: palette.fg,
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 10,
        fontWeight: 700,
      }}
    >
      {text}
    </span>
  );
}

function selectStyle(): React.CSSProperties {
  return {
    padding: "8px 10px",
    border: "1px solid #d1d5db",
    borderRadius: 8,
    fontSize: 13,
    background: "#fff",
    minWidth: 180,
  };
}
