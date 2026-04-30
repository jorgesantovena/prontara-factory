"use client";

import { useEffect, useState } from "react";

type PendingEvent = {
  clientId: string;
  slug: string;
  displayName: string;
  event: string;
  reason: string;
  recipient: { email: string; name: string };
  rendered: { subject: string; text: string };
};

type LifecycleSentRecord = {
  event: string;
  sentAt: string;
  recipient: string;
};

type LifecycleTenantState = {
  clientId: string;
  sent: LifecycleSentRecord[];
  updatedAt: string;
};

type RunResult = {
  dryRun: boolean;
  totalPending: number;
  sent: Array<{
    clientId: string;
    event: string;
    recipient: string;
    provider: string;
    detail: string;
  }>;
  failed: Array<{
    clientId: string;
    event: string;
    recipient: string;
    error: string;
  }>;
};

export default function LifecyclePage() {
  const [pending, setPending] = useState<PendingEvent[]>([]);
  const [history, setHistory] = useState<LifecycleTenantState[]>([]);
  const [busy, setBusy] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<RunResult | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  async function load() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/factory/lifecycle");
      if (res.status === 401) {
        setError("Se requiere sesión con rol admin/owner.");
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Error cargando.");
      }
      const data = await res.json();
      setPending(data.preview?.pending || []);
      setHistory(data.history || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error cargando.");
    } finally {
      setBusy(false);
    }
  }

  async function doRun(dryRun: boolean) {
    if (!dryRun && pending.length > 0) {
      const yes = confirm(
        "Se van a enviar " +
          pending.length +
          " emails. Si Resend no está configurado se guardarán en data/saas/mail-outbox/ y se registrarán como enviados. ¿Continuar?",
      );
      if (!yes) return;
    }

    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/factory/lifecycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Error ejecutando.");
      }
      const data = await res.json();
      setLastRun(data.result);
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error ejecutando.");
    } finally {
      setRunning(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

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
          <h1 style={{ margin: 0, fontSize: 28, color: "#111827" }}>Automatización de lifecycle</h1>
          <p style={{ marginTop: 6, color: "#4b5563", fontSize: 14 }}>
            Envía automáticamente recordatorios de trial, confirmaciones de suscripción, cancelaciones y reactivaciones. Cada evento se
            envía una sola vez por tenant (o dentro de su ventana de tiempo). Se registra idempotencia en{" "}
            <code style={{ fontSize: 12 }}>data/saas/lifecycle/</code>.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center" }}>
          <button
            type="button"
            onClick={load}
            disabled={busy || running}
            style={secondaryButtonStyle(busy || running)}
          >
            {busy ? "Cargando…" : "Refrescar"}
          </button>
          <button
            type="button"
            onClick={() => doRun(true)}
            disabled={busy || running || pending.length === 0}
            style={secondaryButtonStyle(busy || running || pending.length === 0)}
          >
            Dry-run
          </button>
          <button
            type="button"
            onClick={() => doRun(false)}
            disabled={busy || running || pending.length === 0}
            style={primaryButtonStyle(busy || running || pending.length === 0)}
          >
            {running ? "Enviando…" : "Ejecutar envíos reales"}
          </button>
        </div>

        {error ? <Banner tone="danger" text={error} /> : null}

        {lastRun ? (
          <div
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              background: "#fff",
              padding: 14,
              marginBottom: 16,
            }}
          >
            <strong style={{ fontSize: 14 }}>
              {lastRun.dryRun ? "Dry-run ejecutado" : "Ejecución real completada"}
            </strong>
            <div style={{ fontSize: 13, color: "#4b5563", marginTop: 4 }}>
              {lastRun.totalPending} eventos evaluados · {lastRun.sent.length} enviados · {lastRun.failed.length} fallidos.
            </div>
            {lastRun.sent.length > 0 && !lastRun.dryRun ? (
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6 }}>
                Provider usado: {" "}
                {Array.from(new Set(lastRun.sent.map((s) => s.provider))).join(", ")}
              </div>
            ) : null}
            {lastRun.failed.length > 0 ? (
              <ul style={{ marginTop: 6, fontSize: 12, color: "#991b1b" }}>
                {lastRun.failed.map((f, i) => (
                  <li key={i}>
                    {f.event} → {f.recipient}: {f.error}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <section style={{ marginBottom: 24 }}>
          <h2 style={sectionTitle()}>
            Eventos pendientes <span style={{ fontSize: 12, color: "#6b7280" }}>({pending.length})</span>
          </h2>
          {pending.length === 0 ? (
            <EmptyBox text="Ningún tenant tiene emails pendientes ahora mismo." />
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {pending.map((p, i) => {
                const key = p.clientId + "-" + p.event + "-" + i;
                const expanded = expandedKey === key;
                return (
                  <div
                    key={key}
                    style={{
                      background: "#fff",
                      border: "1px solid #e5e7eb",
                      borderRadius: 12,
                      padding: 14,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <EventBadge event={p.event} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>
                          {p.displayName}{" "}
                          <span style={{ fontSize: 11, color: "#6b7280" }}>
                            <code>{p.slug}</code>
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: "#4b5563", marginTop: 2 }}>
                          → {p.recipient.email} · {p.reason}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setExpandedKey(expanded ? null : key)}
                        style={{
                          border: "1px solid #e5e7eb",
                          background: "#fff",
                          color: "#374151",
                          borderRadius: 8,
                          padding: "6px 10px",
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        {expanded ? "Cerrar" : "Ver email"}
                      </button>
                    </div>
                    {expanded ? (
                      <div
                        style={{
                          marginTop: 12,
                          padding: 12,
                          background: "#f9fafb",
                          borderRadius: 10,
                          fontSize: 13,
                          whiteSpace: "pre-wrap",
                          lineHeight: 1.5,
                          color: "#111827",
                          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                        }}
                      >
                        <div style={{ fontWeight: 700, marginBottom: 8 }}>{p.rendered.subject}</div>
                        <div>{p.rendered.text}</div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <h2 style={sectionTitle()}>
            Historial reciente <span style={{ fontSize: 12, color: "#6b7280" }}>({history.length})</span>
          </h2>
          {history.length === 0 ? (
            <EmptyBox text="Ningún tenant tiene historial de lifecycle todavía." />
          ) : (
            <div
              style={{
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                overflow: "hidden",
              }}
            >
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>
                    <Th>Tenant</Th>
                    <Th>Evento</Th>
                    <Th>Destinatario</Th>
                    <Th>Enviado</Th>
                  </tr>
                </thead>
                <tbody>
                  {history.flatMap((h) =>
                    h.sent
                      .slice()
                      .reverse()
                      .map((s, i) => (
                        <tr key={h.clientId + "-" + s.event + "-" + i} style={trStyle()}>
                          <Td>
                            <code style={{ fontSize: 11 }}>{h.clientId}</code>
                          </Td>
                          <Td>
                            <EventBadge event={s.event} />
                          </Td>
                          <Td>
                            <span style={{ fontSize: 12 }}>{s.recipient}</span>
                          </Td>
                          <Td>
                            <span style={{ fontSize: 12, color: "#6b7280" }}>
                              {new Date(s.sentAt).toLocaleString("es")}
                            </span>
                          </Td>
                        </tr>
                      )),
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function sectionTitle(): React.CSSProperties {
  return { margin: "0 0 10px 0", fontSize: 16, color: "#111827" };
}

function primaryButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    border: "none",
    borderRadius: 10,
    background: disabled ? "#94a3b8" : "#1d4ed8",
    color: "#fff",
    padding: "10px 16px",
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
  };
}

function secondaryButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    border: "1px solid #e5e7eb",
    background: "#fff",
    color: "#374151",
    borderRadius: 10,
    padding: "10px 14px",
    fontSize: 13,
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
  };
}

function EventBadge({ event }: { event: string }) {
  const palette: Record<string, { bg: string; fg: string }> = {
    "trial-reminder-7d": { bg: "#fef3c7", fg: "#92400e" },
    "trial-reminder-1d": { bg: "#fed7aa", fg: "#9a3412" },
    "trial-expired": { bg: "#fee2e2", fg: "#991b1b" },
    "subscription-activated": { bg: "#dcfce7", fg: "#166534" },
    "subscription-cancelled": { bg: "#e5e7eb", fg: "#374151" },
    "reactivation-invite": { bg: "#dbeafe", fg: "#1e40af" },
  };
  const colors = palette[event] || { bg: "#f3f4f6", fg: "#374151" };
  return (
    <span
      style={{
        background: colors.bg,
        color: colors.fg,
        padding: "3px 10px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
      }}
    >
      {event}
    </span>
  );
}

function Banner({ tone, text }: { tone: "ok" | "danger" | "info"; text: string }) {
  const palette = {
    ok: { bg: "#f0fdf4", border: "#bbf7d0", color: "#166534" },
    danger: { bg: "#fef2f2", border: "#fecaca", color: "#991b1b" },
    info: { bg: "#eff6ff", border: "#bfdbfe", color: "#1d4ed8" },
  }[tone];
  return (
    <div
      style={{
        border: "1px solid " + palette.border,
        background: palette.bg,
        color: palette.color,
        padding: "10px 14px",
        borderRadius: 12,
        fontSize: 13,
        marginBottom: 14,
      }}
    >
      {text}
    </div>
  );
}

function EmptyBox({ text }: { text: string }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 14,
        color: "#6b7280",
        fontSize: 13,
      }}
    >
      {text}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        textAlign: "left",
        padding: "10px 12px",
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
  return (
    <td style={{ padding: "10px 12px", color: "#111827" }}>{children}</td>
  );
}

function trStyle(): React.CSSProperties {
  return { borderBottom: "1px solid #f3f4f6" };
}
