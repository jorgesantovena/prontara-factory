"use client";

import { useEffect, useMemo, useState } from "react";

type Severity = "ok" | "warn" | "danger" | "info";

type Issue = {
  key: string;
  label: string;
  severity: Severity;
  detail: string;
};

type Row = {
  clientId: string;
  tenantId: string;
  slug: string;
  displayName: string;
  diskState: "healthy" | "partial" | "corrupt";
  runtimeState: "ready" | "missing" | "error";
  diskConsistency: "ok" | "warning" | "error";
  evolutionState: "ready" | "missing" | "warning";
  billingState: "ok" | "trial" | "cancelled" | "warning";
  deliveryState: "ready" | "partial" | "missing";
  issueCount: number;
  updatedAt: string | null;
  issues: Issue[];
};

type Snapshot = {
  generatedAt: string;
  summary: {
    totalTenants: number;
    healthyTenants: number;
    partialTenants: number;
    corruptTenants: number;
    runtimeFailures: number;
    diskWarnings: number;
    evolutionWarnings: number;
    billingWarnings: number;
    deliveryWarnings: number;
    totalIssues: number;
  };
  rows: Row[];
};

function formatDate(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return "-";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleString("es-ES");
}

function toneStyle(tone: Severity) {
  if (tone === "ok") return { bg: "#dcfce7", color: "#166534", border: "#bbf7d0" };
  if (tone === "warn") return { bg: "#fef3c7", color: "#92400e", border: "#fde68a" };
  if (tone === "danger") return { bg: "#fee2e2", color: "#991b1b", border: "#fecaca" };
  return { bg: "#dbeafe", color: "#1d4ed8", border: "#bfdbfe" };
}

function Badge({ text, tone }: { text: string; tone: Severity }) {
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

function stateTone(value: string): Severity {
  const normalized = String(value || "").trim().toLowerCase();
  if (["healthy", "ready", "ok"].includes(normalized)) return "ok";
  if (["partial", "warning", "warn", "trial", "missing"].includes(normalized)) return "warn";
  if (["corrupt", "error", "cancelled", "canceled"].includes(normalized)) return "danger";
  return "info";
}

export default function FactoryHealthPage() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");

  async function load() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/factory/salud", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "No se pudo cargar el panel de salud técnica.");
      }
      setSnapshot(data.snapshot || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el panel de salud técnica.");
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
      if (filter !== "all") {
        if (filter === "healthy" && row.diskState !== "healthy") return false;
        if (filter === "partial" && row.diskState !== "partial") return false;
        if (filter === "corrupt" && row.diskState !== "corrupt") return false;
        if (filter === "runtime" && row.runtimeState === "ready") return false;
        if (filter === "disk" && row.diskConsistency === "ok") return false;
        if (filter === "evolution" && row.evolutionState === "ready") return false;
        if (filter === "billing" && !["warning", "cancelled"].includes(row.billingState)) return false;
        if (filter === "delivery" && row.deliveryState === "ready") return false;
      }

      if (!q) return true;

      const haystack = [
        row.clientId,
        row.tenantId,
        row.slug,
        row.displayName,
        row.diskState,
        row.runtimeState,
        row.billingState,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [snapshot, query, filter]);

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

        <div style={{ fontSize: 12, color: "#6b7280" }}>Salud técnica interna</div>
        <h1 style={{ margin: 0, fontSize: 34 }}>Panel interno de salud técnica</h1>
        <p style={{ margin: 0, color: "#4b5563", maxWidth: 980 }}>
          Monitoriza tenants sanos, parciales y corruptos, fallos runtime, inconsistencias de disco,
          estado evolution, estado billing y estado delivery desde un único panel.
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
          Cargando panel de salud técnica...
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
              <div style={{ fontSize: 13, color: "#6b7280" }}>Tenants</div>
              <div style={{ fontSize: 34, fontWeight: 700 }}>{snapshot.summary.totalTenants}</div>
            </article>
            <article style={{ border: "1px solid #e5e7eb", borderRadius: 16, background: "#ffffff", padding: 18 }}>
              <div style={{ fontSize: 13, color: "#6b7280" }}>Sanos</div>
              <div style={{ fontSize: 34, fontWeight: 700 }}>{snapshot.summary.healthyTenants}</div>
            </article>
            <article style={{ border: "1px solid #e5e7eb", borderRadius: 16, background: "#ffffff", padding: 18 }}>
              <div style={{ fontSize: 13, color: "#6b7280" }}>Parciales</div>
              <div style={{ fontSize: 34, fontWeight: 700 }}>{snapshot.summary.partialTenants}</div>
            </article>
            <article style={{ border: "1px solid #e5e7eb", borderRadius: 16, background: "#ffffff", padding: 18 }}>
              <div style={{ fontSize: 13, color: "#6b7280" }}>Corruptos</div>
              <div style={{ fontSize: 34, fontWeight: 700 }}>{snapshot.summary.corruptTenants}</div>
            </article>
            <article style={{ border: "1px solid #e5e7eb", borderRadius: 16, background: "#ffffff", padding: 18 }}>
              <div style={{ fontSize: 13, color: "#6b7280" }}>Fallos runtime</div>
              <div style={{ fontSize: 34, fontWeight: 700 }}>{snapshot.summary.runtimeFailures}</div>
            </article>
            <article style={{ border: "1px solid #e5e7eb", borderRadius: 16, background: "#ffffff", padding: 18 }}>
              <div style={{ fontSize: 13, color: "#6b7280" }}>Issues totales</div>
              <div style={{ fontSize: 34, fontWeight: 700 }}>{snapshot.summary.totalIssues}</div>
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
              <strong>Inconsistencias de disco</strong>
              <div>{snapshot.summary.diskWarnings}</div>
            </article>
            <article style={{ border: "1px solid #e5e7eb", borderRadius: 16, background: "#ffffff", padding: 18, display: "grid", gap: 6 }}>
              <strong>Evolution con warning</strong>
              <div>{snapshot.summary.evolutionWarnings}</div>
            </article>
            <article style={{ border: "1px solid #e5e7eb", borderRadius: 16, background: "#ffffff", padding: 18, display: "grid", gap: 6 }}>
              <strong>Billing con warning</strong>
              <div>{snapshot.summary.billingWarnings}</div>
            </article>
            <article style={{ border: "1px solid #e5e7eb", borderRadius: 16, background: "#ffffff", padding: 18, display: "grid", gap: 6 }}>
              <strong>Delivery con warning</strong>
              <div>{snapshot.summary.deliveryWarnings}</div>
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
              <h2 style={{ margin: 0 }}>Listado técnico por tenant</h2>
              <p style={{ margin: 0, color: "#4b5563" }}>
                Filtra y revisa en qué parte falla cada cliente: disco, runtime, evolution, billing o delivery.
              </p>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(260px, 1fr) minmax(220px, 0.6fr)",
                gap: 12,
              }}
            >
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por cliente, tenant o slug"
                style={{
                  padding: "10px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: 10,
                }}
              />

              <select
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                style={{
                  padding: "10px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: 10,
                }}
              >
                <option value="all">Todos</option>
                <option value="healthy">Tenants sanos</option>
                <option value="partial">Tenants parciales</option>
                <option value="corrupt">Tenants corruptos</option>
                <option value="runtime">Fallos runtime</option>
                <option value="disk">Inconsistencias de disco</option>
                <option value="evolution">Estado evolution</option>
                <option value="billing">Estado billing</option>
                <option value="delivery">Estado delivery</option>
              </select>
            </div>

            <div style={{ color: "#6b7280", fontSize: 13 }}>
              Mostrando {filteredRows.length} de {snapshot.rows.length} tenants.
            </div>

            {filteredRows.length === 0 ? (
              <div style={{ color: "#6b7280" }}>No hay tenants que coincidan con el filtro.</div>
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
                        gridTemplateColumns: "minmax(240px, 1fr) minmax(260px, 1fr) minmax(300px, 1fr)",
                        gap: 16,
                        alignItems: "start",
                      }}
                    >
                      <div style={{ display: "grid", gap: 6 }}>
                        <strong style={{ fontSize: 18 }}>{row.displayName}</strong>
                        <div style={{ color: "#4b5563", fontSize: 14 }}>Client ID: {row.clientId}</div>
                        <div style={{ color: "#4b5563", fontSize: 14 }}>Tenant: {row.tenantId}</div>
                        <div style={{ color: "#4b5563", fontSize: 14 }}>Slug: {row.slug}</div>
                        <div style={{ color: "#6b7280", fontSize: 12 }}>Actualizado: {formatDate(row.updatedAt)}</div>
                      </div>

                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignContent: "flex-start" }}>
                        <Badge text={"Disco: " + row.diskState} tone={stateTone(row.diskState)} />
                        <Badge text={"Runtime: " + row.runtimeState} tone={stateTone(row.runtimeState)} />
                        <Badge text={"Disco lógico: " + row.diskConsistency} tone={stateTone(row.diskConsistency)} />
                        <Badge text={"Evolution: " + row.evolutionState} tone={stateTone(row.evolutionState)} />
                        <Badge text={"Billing: " + row.billingState} tone={stateTone(row.billingState)} />
                        <Badge text={"Delivery: " + row.deliveryState} tone={stateTone(row.deliveryState)} />
                      </div>

                      <div style={{ display: "grid", gap: 8 }}>
                        <div style={{ color: "#4b5563", fontSize: 14 }}>
                          Issues detectadas: <strong>{row.issueCount}</strong>
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
                      <strong>Issues</strong>
                      {row.issues.length === 0 ? (
                        <div style={{ color: "#166534", fontSize: 13 }}>Sin incidencias críticas ni warnings activos.</div>
                      ) : (
                        <div style={{ display: "grid", gap: 8 }}>
                          {row.issues.map((issue) => {
                            const style = toneStyle(issue.severity);
                            return (
                              <article
                                key={issue.key}
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
                                <strong>{issue.label}</strong>
                                <div style={{ fontSize: 13 }}>{issue.detail}</div>
                              </article>
                            );
                          })}
                        </div>
                      )}
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