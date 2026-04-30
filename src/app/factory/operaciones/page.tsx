"use client";

import { useEffect, useState } from "react";

type TrialEndingSoonItem = {
  clientId: string;
  slug: string;
  displayName: string;
  daysRemaining: number;
  expiresAt: string;
  status: "active" | "expired";
};

type ProvisioningIncidentItem = {
  clientId: string;
  displayName: string;
  slug: string;
  state: string;
  lastTransitionAt: string;
  failureMessage: string | null;
};

type HealthIncidentItem = {
  clientId: string;
  displayName: string;
  slug: string;
  issueCount: number;
  worstSeverity: "ok" | "info" | "warn" | "danger";
  topIssues: Array<{ label: string; severity: string; detail: string }>;
};

type ChatActivityItem = {
  at: string;
  actorEmail: string;
  tool: string;
  outcome: "success" | "error" | "skipped";
  durationMs: number;
  touchedPaths?: string[];
  error?: string;
};

type OperationsSnapshot = {
  generatedAt: string;
  summary: {
    totalTenants: number;
    healthyTenants: number;
    partialTenants: number;
    corruptTenants: number;
    trialsEndingSoon: number;
    provisioningIncidents: number;
    chatErrors24h: number;
  };
  trialsEndingSoon: TrialEndingSoonItem[];
  provisioningIncidents: ProvisioningIncidentItem[];
  healthIncidents: HealthIncidentItem[];
  chatActivity: ChatActivityItem[];
};

export default function OperacionesPage() {
  const [snapshot, setSnapshot] = useState<OperationsSnapshot | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/factory/operaciones");
      if (res.status === 401) {
        setError("Se requiere sesión con rol admin/owner en la Factory.");
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Error cargando snapshot.");
      }
      const data = await res.json();
      setSnapshot(data.snapshot);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error cargando snapshot.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(interval);
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
          <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
            <h1 style={{ margin: 0, fontSize: 28, color: "#111827" }}>Operaciones</h1>
            <button
              type="button"
              onClick={load}
              disabled={busy}
              style={{
                border: "1px solid #e5e7eb",
                background: "#fff",
                color: "#374151",
                borderRadius: 10,
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 600,
                cursor: busy ? "not-allowed" : "pointer",
              }}
            >
              {busy ? "Cargando…" : "Refrescar"}
            </button>
            {snapshot ? (
              <span style={{ fontSize: 12, color: "#6b7280" }}>
                Actualizado hace {humanRelative(snapshot.generatedAt)} · se refresca cada minuto
              </span>
            ) : null}
          </div>
          <p style={{ marginTop: 6, color: "#4b5563", fontSize: 14 }}>
            Panel en tiempo casi real con trials vencidos, incidencias de provisioning, salud técnica y actividad reciente del chat.
          </p>
        </div>

        {error ? (
          <div
            style={{
              border: "1px solid #fecaca",
              background: "#fef2f2",
              color: "#991b1b",
              padding: "12px 16px",
              borderRadius: 12,
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        ) : null}

        {!snapshot ? (
          busy ? <div style={{ color: "#6b7280" }}>Cargando…</div> : null
        ) : (
          <>
            <SummaryCards summary={snapshot.summary} />

            <Section
              title="Trials vencidos o por vencer (≤ 3 días)"
              emptyText="Ningún tenant tiene el trial a menos de 3 días."
              count={snapshot.trialsEndingSoon.length}
            >
              {snapshot.trialsEndingSoon.length > 0 && (
                <Table>
                  <thead>
                    <tr>
                      <Th>Tenant</Th>
                      <Th>Estado</Th>
                      <Th align="right">Días restantes</Th>
                      <Th>Expira</Th>
                      <Th />
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.trialsEndingSoon.map((t) => (
                      <tr key={t.clientId} style={trStyle()}>
                        <Td>
                          <div style={{ fontWeight: 700 }}>{t.displayName}</div>
                          <div style={{ fontSize: 11, color: "#6b7280" }}>
                            <code>{t.slug}</code>
                          </div>
                        </Td>
                        <Td>
                          <Badge
                            tone={t.status === "expired" ? "danger" : "warn"}
                            text={t.status === "expired" ? "Vencido" : "Activo"}
                          />
                        </Td>
                        <Td align="right">
                          <span
                            style={{
                              fontWeight: 700,
                              color:
                                t.daysRemaining <= 0
                                  ? "#991b1b"
                                  : t.daysRemaining <= 1
                                    ? "#9a3412"
                                    : "#92400e",
                            }}
                          >
                            {t.daysRemaining}
                          </span>
                        </Td>
                        <Td>
                          <span style={{ fontSize: 12, color: "#6b7280" }}>
                            {formatDate(t.expiresAt)}
                          </span>
                        </Td>
                        <Td>
                          <TenantLink clientId={t.clientId} />
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Section>

            <Section
              title="Incidencias de provisioning"
              emptyText="Todos los tenants están en estado access_ready."
              count={snapshot.provisioningIncidents.length}
            >
              {snapshot.provisioningIncidents.length > 0 && (
                <Table>
                  <thead>
                    <tr>
                      <Th>Tenant</Th>
                      <Th>Estado</Th>
                      <Th>Última transición</Th>
                      <Th>Motivo</Th>
                      <Th />
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.provisioningIncidents.map((i) => (
                      <tr key={i.clientId} style={trStyle()}>
                        <Td>
                          <div style={{ fontWeight: 700 }}>{i.displayName}</div>
                          <div style={{ fontSize: 11, color: "#6b7280" }}>
                            <code>{i.slug}</code>
                          </div>
                        </Td>
                        <Td>
                          <Badge
                            tone={i.state === "failed" ? "danger" : "warn"}
                            text={i.state}
                          />
                        </Td>
                        <Td>
                          <span style={{ fontSize: 12, color: "#6b7280" }}>
                            {formatDate(i.lastTransitionAt)}
                          </span>
                        </Td>
                        <Td>
                          <span style={{ fontSize: 12, color: "#4b5563" }}>
                            {i.failureMessage || "—"}
                          </span>
                        </Td>
                        <Td>
                          <TenantLink clientId={i.clientId} />
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Section>

            <Section
              title="Tenants con issues de salud"
              emptyText="Sin issues detectadas."
              count={snapshot.healthIncidents.length}
            >
              {snapshot.healthIncidents.length > 0 && (
                <div style={{ display: "grid", gap: 10 }}>
                  {snapshot.healthIncidents.map((h) => (
                    <div
                      key={h.clientId}
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: 12,
                        padding: 14,
                        background: "#fff",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                        <Badge
                          tone={
                            h.worstSeverity === "danger"
                              ? "danger"
                              : h.worstSeverity === "warn"
                                ? "warn"
                                : "info"
                          }
                          text={h.worstSeverity}
                        />
                        <div style={{ fontWeight: 700 }}>{h.displayName}</div>
                        <div style={{ fontSize: 11, color: "#6b7280" }}>
                          <code>{h.slug}</code>
                        </div>
                        <div style={{ fontSize: 11, color: "#6b7280" }}>
                          {h.issueCount} issue{h.issueCount > 1 ? "s" : ""}
                        </div>
                        <div style={{ flex: 1 }} />
                        <TenantLink clientId={h.clientId} />
                      </div>
                      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "#374151" }}>
                        {h.topIssues.map((i, idx) => (
                          <li key={idx} style={{ marginBottom: 3 }}>
                            <strong>{i.label}</strong>
                            {i.detail ? " — " + i.detail : ""}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            <Section
              title="Actividad reciente del chat"
              emptyText="Sin actividad de escritura en las últimas 48 horas."
              count={snapshot.chatActivity.length}
            >
              {snapshot.chatActivity.length > 0 && (
                <Table>
                  <thead>
                    <tr>
                      <Th>Hora</Th>
                      <Th>Actor</Th>
                      <Th>Tool</Th>
                      <Th>Resultado</Th>
                      <Th>Paths</Th>
                      <Th align="right">Dur.</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.chatActivity.map((a, i) => (
                      <tr key={a.at + i} style={trStyle()}>
                        <Td>
                          <span style={{ fontSize: 12, color: "#6b7280" }}>
                            {formatDate(a.at)}
                          </span>
                        </Td>
                        <Td>
                          <span style={{ fontSize: 12 }}>{a.actorEmail}</span>
                        </Td>
                        <Td>
                          <code style={{ fontSize: 11 }}>{a.tool}</code>
                        </Td>
                        <Td>
                          <Badge
                            tone={
                              a.outcome === "success"
                                ? "ok"
                                : a.outcome === "error"
                                  ? "danger"
                                  : "info"
                            }
                            text={a.outcome}
                          />
                          {a.error ? (
                            <div
                              style={{
                                fontSize: 11,
                                color: "#991b1b",
                                marginTop: 4,
                                maxWidth: 400,
                              }}
                            >
                              {a.error}
                            </div>
                          ) : null}
                        </Td>
                        <Td>
                          <div
                            style={{
                              fontSize: 11,
                              color: "#6b7280",
                              maxWidth: 260,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {(a.touchedPaths || []).join(", ") || "—"}
                          </div>
                        </Td>
                        <Td align="right">
                          <span style={{ fontSize: 11, color: "#6b7280" }}>{a.durationMs} ms</span>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Section>
          </>
        )}
      </div>
    </main>
  );
}

function SummaryCards({ summary }: { summary: OperationsSnapshot["summary"] }) {
  const cards: Array<{
    label: string;
    value: number;
    tone: "neutral" | "ok" | "warn" | "danger";
    hint?: string;
  }> = [
    { label: "Tenants totales", value: summary.totalTenants, tone: "neutral" },
    { label: "Sanos", value: summary.healthyTenants, tone: "ok" },
    { label: "Parciales", value: summary.partialTenants, tone: "warn" },
    { label: "Corruptos", value: summary.corruptTenants, tone: "danger" },
    {
      label: "Trials ≤ 3 días",
      value: summary.trialsEndingSoon,
      tone: summary.trialsEndingSoon > 0 ? "warn" : "neutral",
    },
    {
      label: "Provisioning pendiente",
      value: summary.provisioningIncidents,
      tone: summary.provisioningIncidents > 0 ? "warn" : "neutral",
    },
    {
      label: "Errores chat 24h",
      value: summary.chatErrors24h,
      tone: summary.chatErrors24h > 0 ? "danger" : "neutral",
    },
  ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        gap: 10,
        marginBottom: 20,
      }}
    >
      {cards.map((c) => (
        <div
          key={c.label}
          style={{
            background: "#fff",
            border: "1px solid " + toneBorder(c.tone),
            borderLeft: "4px solid " + toneColor(c.tone),
            borderRadius: 12,
            padding: 12,
          }}
        >
          <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 500 }}>{c.label}</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: toneColor(c.tone) }}>{c.value}</div>
          {c.hint ? <div style={{ fontSize: 11, color: "#6b7280" }}>{c.hint}</div> : null}
        </div>
      ))}
    </div>
  );
}

function Section({
  title,
  count,
  emptyText,
  children,
}: {
  title: string;
  count: number;
  emptyText: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: 24 }}>
      <h2 style={{ fontSize: 16, color: "#111827", margin: "0 0 10px 0" }}>
        {title}{" "}
        <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 500 }}>({count})</span>
      </h2>
      {count === 0 ? (
        <div
          style={{
            fontSize: 13,
            color: "#6b7280",
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            padding: 12,
          }}
        >
          {emptyText}
        </div>
      ) : (
        children
      )}
    </section>
  );
}

function Table({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>{children}</table>
    </div>
  );
}

function Th({
  children,
  align,
}: {
  children?: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      style={{
        textAlign: align || "left",
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

function Td({
  children,
  align,
}: {
  children?: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <td
      style={{
        textAlign: align || "left",
        padding: "10px 12px",
        color: "#111827",
        verticalAlign: "top",
      }}
    >
      {children}
    </td>
  );
}

function trStyle(): React.CSSProperties {
  return { borderBottom: "1px solid #f3f4f6" };
}

function Badge({
  tone,
  text,
}: {
  tone: "ok" | "warn" | "danger" | "info";
  text: string;
}) {
  const palette = {
    ok: { bg: "#dcfce7", fg: "#166534" },
    warn: { bg: "#fef3c7", fg: "#92400e" },
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
        fontSize: 11,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: 0.3,
      }}
    >
      {text}
    </span>
  );
}

function TenantLink({ clientId }: { clientId: string }) {
  return (
    <a
      href={"/factory/client/" + encodeURIComponent(clientId)}
      style={{
        fontSize: 12,
        color: "#1d4ed8",
        textDecoration: "none",
        padding: "4px 10px",
        border: "1px solid #bfdbfe",
        borderRadius: 8,
      }}
    >
      Abrir ficha
    </a>
  );
}

function toneColor(tone: "neutral" | "ok" | "warn" | "danger"): string {
  return {
    neutral: "#111827",
    ok: "#166534",
    warn: "#92400e",
    danger: "#991b1b",
  }[tone];
}

function toneBorder(tone: "neutral" | "ok" | "warn" | "danger"): string {
  return {
    neutral: "#e5e7eb",
    ok: "#bbf7d0",
    warn: "#fde68a",
    danger: "#fecaca",
  }[tone];
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("es", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function humanRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, Math.floor((now - then) / 1000));
  if (diff < 60) return diff + " s";
  if (diff < 3600) return Math.floor(diff / 60) + " min";
  if (diff < 86400) return Math.floor(diff / 3600) + " h";
  return Math.floor(diff / 86400) + " d";
}
