"use client";

import { useEffect, useMemo, useState } from "react";

type ProvisioningStep = {
  key:
    | "signup_created"
    | "account_created"
    | "tenant_created"
    | "runtime_ready"
    | "email_ready"
    | "email_sent"
    | "access_ready";
  label: string;
  state: "done" | "pending" | "error";
  detail: string;
};

type ErrorItem = {
  id: string;
  title: string;
  detail: string;
  createdAt: string;
};

type RetryItem = {
  id: string;
  title: string;
  detail: string;
  createdAt: string;
};

type ProvisioningRow = {
  clientId: string;
  tenantId: string;
  slug: string;
  displayName: string;
  plan: string;
  status: "ready" | "pending" | "error";
  updatedAt: string | null;
  steps: ProvisioningStep[];
  errors: ErrorItem[];
  retries: RetryItem[];
};

type Snapshot = {
  generatedAt: string;
  summary: {
    total: number;
    ready: number;
    pending: number;
    error: number;
    signupCreated: number;
    accountCreated: number;
    tenantCreated: number;
    runtimeReady: number;
    emailReady: number;
    emailSent: number;
    accessReady: number;
    totalErrors: number;
    totalRetries: number;
  };
  rows: ProvisioningRow[];
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
  if (tone === "ok") {
    return { bg: "#dcfce7", color: "#166534", border: "#bbf7d0" };
  }
  if (tone === "warn") {
    return { bg: "#fef3c7", color: "#92400e", border: "#fde68a" };
  }
  if (tone === "danger") {
    return { bg: "#fee2e2", color: "#991b1b", border: "#fecaca" };
  }
  return { bg: "#dbeafe", color: "#1d4ed8", border: "#bfdbfe" };
}

function stateTone(value: "done" | "pending" | "error" | "ready") {
  if (value === "done" || value === "ready") {
    return "ok" as const;
  }
  if (value === "pending") {
    return "warn" as const;
  }
  return "danger" as const;
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

export default function FactoryProvisioningPage() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  async function load() {
    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/factory/provisioning", { cache: "no-store" });
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "No se pudo cargar el panel interno de provisioning.");
      }

      setSnapshot(data.snapshot || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el panel interno de provisioning.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filteredRows = useMemo(() => {
    const rows = snapshot?.rows || [];
    const q = query.trim().toLowerCase();

    return rows.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) {
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
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [snapshot, query, statusFilter]);

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

        <div style={{ fontSize: 12, color: "#6b7280" }}>Provisioning interno</div>
        <h1 style={{ margin: 0, fontSize: 34 }}>Panel interno de provisioning</h1>
        <p style={{ margin: 0, color: "#4b5563", maxWidth: 980 }}>
          Vista clara del estado real de alta, cuenta, tenant, runtime, email, acceso, errores y reintentos
          para cada cliente gestionado por Factory.
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
          Cargando panel de provisioning...
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
              <div style={{ fontSize: 13, color: "#6b7280" }}>Clientes</div>
              <div style={{ fontSize: 34, fontWeight: 700 }}>{snapshot.summary.total}</div>
            </article>
            <article style={{ border: "1px solid #e5e7eb", borderRadius: 16, background: "#ffffff", padding: 18 }}>
              <div style={{ fontSize: 13, color: "#6b7280" }}>Ready</div>
              <div style={{ fontSize: 34, fontWeight: 700 }}>{snapshot.summary.ready}</div>
            </article>
            <article style={{ border: "1px solid #e5e7eb", borderRadius: 16, background: "#ffffff", padding: 18 }}>
              <div style={{ fontSize: 13, color: "#6b7280" }}>Pending</div>
              <div style={{ fontSize: 34, fontWeight: 700 }}>{snapshot.summary.pending}</div>
            </article>
            <article style={{ border: "1px solid #e5e7eb", borderRadius: 16, background: "#ffffff", padding: 18 }}>
              <div style={{ fontSize: 13, color: "#6b7280" }}>Error</div>
              <div style={{ fontSize: 34, fontWeight: 700 }}>{snapshot.summary.error}</div>
            </article>
            <article style={{ border: "1px solid #e5e7eb", borderRadius: 16, background: "#ffffff", padding: 18 }}>
              <div style={{ fontSize: 13, color: "#6b7280" }}>Emails enviados</div>
              <div style={{ fontSize: 34, fontWeight: 700 }}>{snapshot.summary.emailSent}</div>
            </article>
            <article style={{ border: "1px solid #e5e7eb", borderRadius: 16, background: "#ffffff", padding: 18 }}>
              <div style={{ fontSize: 13, color: "#6b7280" }}>Accesos operativos</div>
              <div style={{ fontSize: 34, fontWeight: 700 }}>{snapshot.summary.accessReady}</div>
            </article>
          </section>

          <section
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 16,
            }}
          >
            <article style={{ border: "1px solid #e5e7eb", borderRadius: 16, background: "#ffffff", padding: 18, display: "grid", gap: 6 }}>
              <strong>Alta creada</strong>
              <div>{snapshot.summary.signupCreated}</div>
            </article>
            <article style={{ border: "1px solid #e5e7eb", borderRadius: 16, background: "#ffffff", padding: 18, display: "grid", gap: 6 }}>
              <strong>Cuenta creada</strong>
              <div>{snapshot.summary.accountCreated}</div>
            </article>
            <article style={{ border: "1px solid #e5e7eb", borderRadius: 16, background: "#ffffff", padding: 18, display: "grid", gap: 6 }}>
              <strong>Tenant creado</strong>
              <div>{snapshot.summary.tenantCreated}</div>
            </article>
            <article style={{ border: "1px solid #e5e7eb", borderRadius: 16, background: "#ffffff", padding: 18, display: "grid", gap: 6 }}>
              <strong>Runtime listo</strong>
              <div>{snapshot.summary.runtimeReady}</div>
            </article>
            <article style={{ border: "1px solid #e5e7eb", borderRadius: 16, background: "#ffffff", padding: 18, display: "grid", gap: 6 }}>
              <strong>Email preparado</strong>
              <div>{snapshot.summary.emailReady}</div>
            </article>
            <article style={{ border: "1px solid #e5e7eb", borderRadius: 16, background: "#ffffff", padding: 18, display: "grid", gap: 6 }}>
              <strong>Errores / Reintentos</strong>
              <div>{snapshot.summary.totalErrors} / {snapshot.summary.totalRetries}</div>
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
              <h2 style={{ margin: 0 }}>Listado operativo de provisioning</h2>
              <p style={{ margin: 0, color: "#4b5563" }}>
                Aquí puedes revisar de forma inmediata qué clientes están listos, cuáles fallan y dónde están atascados.
              </p>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(260px, 1fr) minmax(180px, 0.5fr)",
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
                <option value="ready">Ready</option>
                <option value="pending">Pending</option>
                <option value="error">Error</option>
              </select>
            </div>

            <div style={{ color: "#6b7280", fontSize: 13 }}>
              Mostrando {filteredRows.length} de {snapshot.rows.length} clientes.
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
                        gridTemplateColumns: "minmax(240px, 1fr) minmax(220px, 1fr) minmax(280px, 1fr)",
                        gap: 16,
                        alignItems: "start",
                      }}
                    >
                      <div style={{ display: "grid", gap: 6 }}>
                        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                          <strong style={{ fontSize: 18 }}>{row.displayName}</strong>
                          <Badge text={row.status} tone={stateTone(row.status)} />
                        </div>
                        <div style={{ color: "#4b5563", fontSize: 14 }}>Client ID: {row.clientId}</div>
                        <div style={{ color: "#4b5563", fontSize: 14 }}>Tenant: {row.tenantId}</div>
                        <div style={{ color: "#4b5563", fontSize: 14 }}>Slug: {row.slug}</div>
                        <div style={{ color: "#4b5563", fontSize: 14 }}>Plan: {row.plan}</div>
                        <div style={{ color: "#6b7280", fontSize: 12 }}>Actualizado: {formatDate(row.updatedAt)}</div>
                      </div>

                      <div style={{ display: "grid", gap: 8 }}>
                        {row.steps.map((step) => (
                          <div
                            key={step.key}
                            style={{
                              border: "1px solid #eef2f7",
                              borderRadius: 12,
                              background: "#ffffff",
                              padding: 10,
                              display: "grid",
                              gap: 4,
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                              <strong>{step.label}</strong>
                              <Badge text={step.state} tone={stateTone(step.state)} />
                            </div>
                            <div style={{ color: "#4b5563", fontSize: 13 }}>{step.detail}</div>
                          </div>
                        ))}
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
                          <strong>Errores</strong>
                          {row.errors.length === 0 ? (
                            <div style={{ color: "#166534", fontSize: 13 }}>Sin errores registrados.</div>
                          ) : (
                            <div style={{ display: "grid", gap: 8 }}>
                              {row.errors.slice(0, 4).map((item) => (
                                <article
                                  key={item.id}
                                  style={{
                                    border: "1px solid #fecaca",
                                    borderRadius: 10,
                                    background: "#fef2f2",
                                    padding: 10,
                                    display: "grid",
                                    gap: 4,
                                  }}
                                >
                                  <strong style={{ color: "#991b1b" }}>{item.title}</strong>
                                  <div style={{ color: "#7f1d1d", fontSize: 13 }}>{item.detail}</div>
                                  <div style={{ color: "#7f1d1d", fontSize: 12 }}>{formatDate(item.createdAt)}</div>
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
                          <strong>Reintentos</strong>
                          {row.retries.length === 0 ? (
                            <div style={{ color: "#6b7280", fontSize: 13 }}>Sin reintentos registrados.</div>
                          ) : (
                            <div style={{ display: "grid", gap: 8 }}>
                              {row.retries.slice(0, 4).map((item) => (
                                <article
                                  key={item.id}
                                  style={{
                                    border: "1px solid #dbeafe",
                                    borderRadius: 10,
                                    background: "#eff6ff",
                                    padding: 10,
                                    display: "grid",
                                    gap: 4,
                                  }}
                                >
                                  <strong style={{ color: "#1d4ed8" }}>{item.title}</strong>
                                  <div style={{ color: "#1e40af", fontSize: 13 }}>{item.detail}</div>
                                  <div style={{ color: "#1e40af", fontSize: 12 }}>{formatDate(item.createdAt)}</div>
                                </article>
                              ))}
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

                          <a
                            href={"/acceso?tenant=" + encodeURIComponent(row.slug)}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              textDecoration: "none",
                              borderRadius: 10,
                              padding: "10px 12px",
                              border: "1px solid #d1d5db",
                              background: "#ffffff",
                              color: "#111827",
                              fontWeight: 700,
                            }}
                          >
                            Probar acceso
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