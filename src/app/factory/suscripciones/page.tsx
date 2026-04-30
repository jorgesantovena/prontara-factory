"use client";

import { useEffect, useMemo, useState } from "react";

type Limit = {
  key: string;
  label: string;
  value: string;
};

type Change = {
  id: string;
  type: "upgrade" | "downgrade";
  fromPlan: string;
  toPlan: string;
  createdAt: string;
  detail: string;
};

type Issue = {
  id: string;
  title: string;
  detail: string;
  createdAt: string;
  severity: "warn" | "danger";
};

type Row = {
  clientId: string;
  tenantId: string;
  slug: string;
  displayName: string;
  plan: string;
  status: "active" | "trial" | "cancelled" | "pending";
  billingState: "ok" | "warning" | "failed" | "missing";
  monetizationClosed: boolean;
  limits: Limit[];
  changes: Change[];
  issues: Issue[];
  amount: string;
  currency: string;
  updatedAt: string | null;
};

type Snapshot = {
  generatedAt: string;
  summary: {
    total: number;
    active: number;
    trial: number;
    cancelled: number;
    pending: number;
    withUpgrade: number;
    withDowngrade: number;
    withPaymentIssues: number;
    withoutMonetizationClosed: number;
  };
  rows: Row[];
};

function formatDate(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "-";
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return raw;
  }
  return date.toLocaleString("es-ES");
}

function toneStyle(tone: "ok" | "warn" | "danger" | "info") {
  if (tone === "ok") return { bg: "#dcfce7", color: "#166534", border: "#bbf7d0" };
  if (tone === "warn") return { bg: "#fef3c7", color: "#92400e", border: "#fde68a" };
  if (tone === "danger") return { bg: "#fee2e2", color: "#991b1b", border: "#fecaca" };
  return { bg: "#dbeafe", color: "#1d4ed8", border: "#bfdbfe" };
}

function Badge({ text, tone }: { text: string; tone: "ok" | "warn" | "danger" | "info" }) {
  const style = toneStyle(tone);
  return (
    <span
      style={{
        background: style.bg,
        color: style.color,
        border: "1px solid " + style.border,
        borderRadius: 999,
        padding: "4px 8px",
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      {text}
    </span>
  );
}

function statusTone(status: Row["status"]): "ok" | "warn" | "danger" | "info" {
  if (status === "active") return "ok";
  if (status === "trial" || status === "pending") return "warn";
  return "danger";
}

function billingTone(state: Row["billingState"]): "ok" | "warn" | "danger" | "info" {
  if (state === "ok") return "ok";
  if (state === "warning") return "warn";
  if (state === "failed") return "danger";
  return "info";
}

export default function FactorySubscriptionsPage() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [planFilter, setPlanFilter] = useState("all");
  const [monetizationFilter, setMonetizationFilter] = useState("all");

  async function load() {
    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/factory/suscripciones", { cache: "no-store" });
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "No se pudo cargar el panel de suscripciones SaaS.");
      }

      setSnapshot(data.snapshot || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el panel de suscripciones SaaS.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const planOptions = useMemo(() => {
    return Array.from(new Set((snapshot?.rows || []).map((row) => row.plan))).sort();
  }, [snapshot]);

  const filteredRows = useMemo(() => {
    const rows = snapshot?.rows || [];
    const q = query.trim().toLowerCase();

    return rows.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) {
        return false;
      }

      if (planFilter !== "all" && row.plan !== planFilter) {
        return false;
      }

      if (monetizationFilter === "closed" && !row.monetizationClosed) {
        return false;
      }

      if (monetizationFilter === "open" && row.monetizationClosed) {
        return false;
      }

      if (!q) {
        return true;
      }

      const haystack = [
        row.clientId,
        row.tenantId,
        row.slug,
        row.displayName,
        row.plan,
        row.status,
        row.billingState,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [snapshot, query, statusFilter, planFilter, monetizationFilter]);

  return (
    <main
      style={{
        padding: 24,
        display: "grid",
        gap: 24,
        fontFamily: "Arial, sans-serif",
        background: "#f8fafc",
      }}
    >
      <section
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 18,
          background: "#ffffff",
          padding: 24,
          display: "grid",
          gap: 12,
        }}
      >
        <a
          href="/factory"
          style={{
            textDecoration: "none",
            color: "#4b5563",
            fontSize: 14,
            width: "fit-content",
          }}
        >
          ← Volver a Factory
        </a>

        <div style={{ fontSize: 12, color: "#6b7280" }}>Suscripciones SaaS</div>
        <h1 style={{ margin: 0, fontSize: 34 }}>Panel interno de suscripciones SaaS</h1>
        <p style={{ margin: 0, color: "#4b5563", maxWidth: 980 }}>
          Revisión interna de plan actual, trial/activa/cancelada, upgrade/downgrade, límites,
          incidencias de cobro y clientes sin monetización cerrada.
        </p>

        {snapshot ? (
          <div style={{ fontSize: 12, color: "#6b7280" }}>
            Última generación del panel: {formatDate(snapshot.generatedAt)}
          </div>
        ) : null}
      </section>

      {busy ? (
        <section
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 18,
            background: "#ffffff",
            padding: 24,
          }}
        >
          Cargando panel de suscripciones...
        </section>
      ) : null}

      {snapshot ? (
        <>
          <section
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 16,
            }}
          >
            <article style={{ border: "1px solid #e5e7eb", borderRadius: 16, background: "#ffffff", padding: 18 }}>
              <div style={{ fontSize: 13, color: "#6b7280" }}>Total clientes</div>
              <div style={{ fontSize: 34, fontWeight: 700 }}>{snapshot.summary.total}</div>
            </article>
            <article style={{ border: "1px solid #e5e7eb", borderRadius: 16, background: "#ffffff", padding: 18 }}>
              <div style={{ fontSize: 13, color: "#6b7280" }}>Activas</div>
              <div style={{ fontSize: 34, fontWeight: 700 }}>{snapshot.summary.active}</div>
            </article>
            <article style={{ border: "1px solid #e5e7eb", borderRadius: 16, background: "#ffffff", padding: 18 }}>
              <div style={{ fontSize: 13, color: "#6b7280" }}>Trial</div>
              <div style={{ fontSize: 34, fontWeight: 700 }}>{snapshot.summary.trial}</div>
            </article>
            <article style={{ border: "1px solid #e5e7eb", borderRadius: 16, background: "#ffffff", padding: 18 }}>
              <div style={{ fontSize: 13, color: "#6b7280" }}>Canceladas</div>
              <div style={{ fontSize: 34, fontWeight: 700 }}>{snapshot.summary.cancelled}</div>
            </article>
            <article style={{ border: "1px solid #e5e7eb", borderRadius: 16, background: "#ffffff", padding: 18 }}>
              <div style={{ fontSize: 13, color: "#6b7280" }}>Upgrade</div>
              <div style={{ fontSize: 34, fontWeight: 700 }}>{snapshot.summary.withUpgrade}</div>
            </article>
            <article style={{ border: "1px solid #e5e7eb", borderRadius: 16, background: "#ffffff", padding: 18 }}>
              <div style={{ fontSize: 13, color: "#6b7280" }}>Downgrade</div>
              <div style={{ fontSize: 34, fontWeight: 700 }}>{snapshot.summary.withDowngrade}</div>
            </article>
          </section>

          <section
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 16,
            }}
          >
            <article style={{ border: "1px solid #e5e7eb", borderRadius: 16, background: "#ffffff", padding: 18 }}>
              <div style={{ fontSize: 13, color: "#6b7280" }}>Incidencias de cobro</div>
              <div style={{ fontSize: 34, fontWeight: 700 }}>{snapshot.summary.withPaymentIssues}</div>
            </article>
            <article style={{ border: "1px solid #e5e7eb", borderRadius: 16, background: "#ffffff", padding: 18 }}>
              <div style={{ fontSize: 13, color: "#6b7280" }}>Sin monetización cerrada</div>
              <div style={{ fontSize: 34, fontWeight: 700 }}>{snapshot.summary.withoutMonetizationClosed}</div>
            </article>
          </section>

          <section
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 18,
              background: "#ffffff",
              padding: 22,
              display: "grid",
              gap: 16,
            }}
          >
            <div style={{ display: "grid", gap: 6 }}>
              <h2 style={{ margin: 0 }}>Listado de suscripciones</h2>
              <p style={{ margin: 0, color: "#4b5563" }}>
                Filtra por estado, plan y monetización para ver rápidamente quién está bien y quién necesita intervención.
              </p>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(260px, 1fr) minmax(180px, 0.6fr) minmax(180px, 0.6fr) minmax(220px, 0.8fr)",
                gap: 12,
              }}
            >
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por cliente, tenant, slug o plan"
                style={{
                  padding: "10px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: 10,
                }}
              />

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                style={{
                  padding: "10px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: 10,
                }}
              >
                <option value="all">Todos los estados</option>
                <option value="active">Activa</option>
                <option value="trial">Trial</option>
                <option value="cancelled">Cancelada</option>
                <option value="pending">Pending</option>
              </select>

              <select
                value={planFilter}
                onChange={(event) => setPlanFilter(event.target.value)}
                style={{
                  padding: "10px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: 10,
                }}
              >
                <option value="all">Todos los planes</option>
                {planOptions.map((plan) => (
                  <option key={plan} value={plan}>{plan}</option>
                ))}
              </select>

              <select
                value={monetizationFilter}
                onChange={(event) => setMonetizationFilter(event.target.value)}
                style={{
                  padding: "10px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: 10,
                }}
              >
                <option value="all">Toda la monetización</option>
                <option value="closed">Monetización cerrada</option>
                <option value="open">Monetización no cerrada</option>
              </select>
            </div>

            <div style={{ color: "#6b7280", fontSize: 13 }}>
              Mostrando {filteredRows.length} de {snapshot.rows.length} suscripciones.
            </div>

            {filteredRows.length === 0 ? (
              <div style={{ color: "#6b7280" }}>No hay clientes que coincidan con el filtro.</div>
            ) : (
              <div style={{ display: "grid", gap: 14 }}>
                {filteredRows.map((row) => (
                  <article
                    key={row.clientId}
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 16,
                      background: "#fafafa",
                      padding: 16,
                      display: "grid",
                      gap: 14,
                    }}
                  >
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "minmax(240px, 1fr) minmax(260px, 1fr) minmax(320px, 1fr)",
                        gap: 16,
                        alignItems: "start",
                      }}
                    >
                      <div style={{ display: "grid", gap: 6 }}>
                        <strong style={{ fontSize: 18 }}>{row.displayName}</strong>
                        <div style={{ color: "#4b5563", fontSize: 14 }}>Client ID: {row.clientId}</div>
                        <div style={{ color: "#4b5563", fontSize: 14 }}>Tenant: {row.tenantId}</div>
                        <div style={{ color: "#4b5563", fontSize: 14 }}>Slug: {row.slug}</div>
                        <div style={{ color: "#4b5563", fontSize: 14 }}>Plan actual: <strong>{row.plan}</strong></div>
                        <div style={{ color: "#4b5563", fontSize: 14 }}>
                          Importe: {row.amount || "-"} {row.currency || ""}
                        </div>
                        <div style={{ color: "#6b7280", fontSize: 12 }}>Actualizado: {formatDate(row.updatedAt)}</div>
                      </div>

                      <div style={{ display: "grid", gap: 10 }}>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <Badge text={"Estado: " + row.status} tone={statusTone(row.status)} />
                          <Badge text={"Billing: " + row.billingState} tone={billingTone(row.billingState)} />
                          <Badge
                            text={row.monetizationClosed ? "Monetización cerrada" : "Monetización abierta"}
                            tone={row.monetizationClosed ? "ok" : "warn"}
                          />
                        </div>

                        <div
                          style={{
                            border: "1px solid #eef2f7",
                            borderRadius: 12,
                            background: "#ffffff",
                            padding: 12,
                            display: "grid",
                            gap: 8,
                          }}
                        >
                          <strong>Límites</strong>
                          <div style={{ display: "grid", gap: 6 }}>
                            {row.limits.map((limit) => (
                              <div key={limit.key} style={{ color: "#4b5563", fontSize: 14 }}>
                                {limit.label}: <strong>{limit.value}</strong>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "grid", gap: 10 }}>
                        <div
                          style={{
                            border: "1px solid #eef2f7",
                            borderRadius: 12,
                            background: "#ffffff",
                            padding: 12,
                            display: "grid",
                            gap: 8,
                          }}
                        >
                          <strong>Upgrade / downgrade</strong>
                          {row.changes.length === 0 ? (
                            <div style={{ color: "#6b7280", fontSize: 13 }}>Sin cambios registrados.</div>
                          ) : (
                            <div style={{ display: "grid", gap: 8 }}>
                              {row.changes.slice(0, 4).map((change) => (
                                <article
                                  key={change.id}
                                  style={{
                                    border: "1px solid #eef2f7",
                                    borderRadius: 10,
                                    background: change.type === "upgrade" ? "#eff6ff" : "#fff7ed",
                                    padding: 10,
                                    display: "grid",
                                    gap: 4,
                                  }}
                                >
                                  <strong style={{ color: change.type === "upgrade" ? "#1d4ed8" : "#9a3412" }}>
                                    {change.type === "upgrade" ? "Upgrade" : "Downgrade"}
                                  </strong>
                                  <div style={{ fontSize: 13 }}>
                                    {change.fromPlan || "-"} → {change.toPlan}
                                  </div>
                                  <div style={{ fontSize: 12, color: "#4b5563" }}>{change.detail || "-"}</div>
                                  <div style={{ fontSize: 12, color: "#6b7280" }}>{formatDate(change.createdAt)}</div>
                                </article>
                              ))}
                            </div>
                          )}
                        </div>

                        <div
                          style={{
                            border: "1px solid #eef2f7",
                            borderRadius: 12,
                            background: "#ffffff",
                            padding: 12,
                            display: "grid",
                            gap: 8,
                          }}
                        >
                          <strong>Incidencias de cobro</strong>
                          {row.issues.length === 0 ? (
                            <div style={{ color: "#166534", fontSize: 13 }}>Sin incidencias activas.</div>
                          ) : (
                            <div style={{ display: "grid", gap: 8 }}>
                              {row.issues.slice(0, 4).map((issue) => {
                                const tone = issue.severity === "danger" ? "danger" : "warn";
                                const style = toneStyle(tone);
                                return (
                                  <article
                                    key={issue.id}
                                    style={{
                                      border: "1px solid " + style.border,
                                      borderRadius: 10,
                                      background: style.bg,
                                      color: style.color,
                                      padding: 10,
                                      display: "grid",
                                      gap: 4,
                                    }}
                                  >
                                    <strong>{issue.title}</strong>
                                    <div style={{ fontSize: 13 }}>{issue.detail}</div>
                                    <div style={{ fontSize: 12 }}>{formatDate(issue.createdAt)}</div>
                                  </article>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                          <a
                            href={"/factory/client/" + encodeURIComponent(row.clientId)}
                            style={{
                              textDecoration: "none",
                              borderRadius: 10,
                              padding: "10px 12px",
                              background: "#111827",
                              color: "#ffffff",
                              fontWeight: 700,
                            }}
                          >
                            Ver ficha
                          </a>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}

      {error ? (
        <section
          style={{
            border: "1px solid #fecaca",
            borderRadius: 12,
            background: "#fef2f2",
            color: "#991b1b",
            padding: 12,
          }}
        >
          {error}
        </section>
      ) : null}
    </main>
  );
}