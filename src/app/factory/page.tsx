"use client";

import { useEffect, useMemo, useState } from "react";
import UserMenu from "@/components/user-menu";
import FactoryShell from "@/components/factory/factory-shell";

type Metric = {
  key: string;
  label: string;
  value: string;
  helper: string;
};

type StatusCard = {
  key: string;
  title: string;
  detail: string;
  tone: "ok" | "warn" | "danger" | "info";
};

type ActivityItem = {
  id: string;
  title: string;
  subtitle: string;
  detail: string;
  createdAt: string;
  area: "business" | "provisioning" | "runtime" | "billing" | "evolution" | "health";
};

type QuickAction = {
  href: string;
  label: string;
  helper: string;
};

type VerticalItem = {
  key: string;
  label: string;
  count: number;
};

type ClientRow = {
  clientId: string;
  tenantId: string;
  slug: string;
  displayName: string;
  vertical: string;
  plan: string;
  subscriptionState: "active" | "trial" | "cancelled";
  runtimeReady: boolean;
  evolutionReady: boolean;
  provisioningState: "ready" | "pending" | "error";
  healthState: "healthy" | "partial" | "corrupt";
  billingState: "ok" | "trial" | "cancelled" | "warning";
  brandingDisplayName: string;
  brandingAccentColor: string;
  brandingTone: string;
  accessUrl: string;
  deliveryUrl: string;
  openUrl: string;
  updatedAt: string | null;
};

type Snapshot = {
  generatedAt: string;
  summary: {
    totalClients: number;
    totalTenants: number;
    activeCount: number;
    trialCount: number;
    cancelledCount: number;
    activeSubscriptions: number;
    provisioningRecent: number;
    recentErrors: number;
    healthyTenants: number;
    partialTenants: number;
    corruptTenants: number;
  };
  areas: {
    business: {
      activeSubscriptions: number;
      trialSubscriptions: number;
      cancelledSubscriptions: number;
      activeVerticals: number;
    };
    provisioning: {
      ready: number;
      pending: number;
      error: number;
      recentEvents: number;
    };
    runtime: {
      ready: number;
      notReady: number;
    };
    billing: {
      ok: number;
      trial: number;
      cancelled: number;
      warning: number;
    };
    evolution: {
      ready: number;
      pending: number;
      recentEvents: number;
    };
    health: {
      healthy: number;
      partial: number;
      corrupt: number;
      recentErrors: number;
    };
  };
  metrics: Metric[];
  statusCards: StatusCard[];
  provisioningRecent: ActivityItem[];
  recentErrors: ActivityItem[];
  operationalFeed: ActivityItem[];
  verticals: VerticalItem[];
  quickActions: QuickAction[];
  clients: ClientRow[];
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

function subscriptionBadge(state: "active" | "trial" | "cancelled") {
  if (state === "active") {
    return { text: "Activa", bg: "#dcfce7", color: "#166534" };
  }
  if (state === "trial") {
    return { text: "Trial", bg: "#fef3c7", color: "#92400e" };
  }
  return { text: "Cancelada", bg: "#fee2e2", color: "#991b1b" };
}

function tinyBadge(text: string, tone: "ok" | "warn" | "danger" | "info") {
  const style = toneStyle(tone);
  return (
    <span
      style={{
        background: style.bg,
        color: style.color,
        borderRadius: 999,
        padding: "4px 8px",
        fontSize: 12,
        fontWeight: 700,
        border: "1px solid " + style.border,
      }}
    >
      {text}
    </span>
  );
}

function areaLabel(area: ActivityItem["area"]) {
  if (area === "business") return "Negocio";
  if (area === "provisioning") return "Provisioning";
  if (area === "runtime") return "Runtime";
  if (area === "billing") return "Billing";
  if (area === "evolution") return "Evolución";
  return "Salud";
}

function areaTone(area: ActivityItem["area"]): "ok" | "warn" | "danger" | "info" {
  if (area === "health") return "danger";
  if (area === "billing") return "warn";
  if (area === "provisioning") return "info";
  if (area === "runtime") return "info";
  if (area === "evolution") return "ok";
  return "ok";
}

function clientProvisioningTone(state: ClientRow["provisioningState"]): "ok" | "warn" | "danger" {
  if (state === "ready") return "ok";
  if (state === "pending") return "warn";
  return "danger";
}

function clientHealthTone(state: ClientRow["healthState"]): "ok" | "warn" | "danger" {
  if (state === "healthy") return "ok";
  if (state === "partial") return "warn";
  return "danger";
}

function clientBillingTone(state: ClientRow["billingState"]): "ok" | "warn" | "danger" | "info" {
  if (state === "ok") return "ok";
  if (state === "trial") return "info";
  if (state === "warning") return "warn";
  return "danger";
}

export default function FactoryPage() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [verticalFilter, setVerticalFilter] = useState("all");
  const [planFilter, setPlanFilter] = useState("all");
  const [stateFilter, setStateFilter] = useState("all");

  async function load() {
    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/factory/dashboard", { cache: "no-store" });
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "No se pudo cargar el dashboard de Factory.");
      }

      setSnapshot(data.snapshot || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el dashboard de Factory.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filteredClients = useMemo(() => {
    const rows = snapshot?.clients || [];
    const q = query.trim().toLowerCase();

    return rows.filter((client) => {
      if (verticalFilter !== "all" && client.vertical !== verticalFilter) {
        return false;
      }

      if (planFilter !== "all" && client.plan !== planFilter) {
        return false;
      }

      if (stateFilter !== "all" && client.subscriptionState !== stateFilter) {
        return false;
      }

      if (!q) {
        return true;
      }

      const text = [
        client.displayName,
        client.slug,
        client.clientId,
        client.tenantId,
        client.vertical,
        client.plan,
        client.brandingDisplayName,
      ]
        .join(" ")
        .toLowerCase();

      return text.includes(q);
    });
  }, [snapshot, query, verticalFilter, planFilter, stateFilter]);

  const verticalOptions = useMemo(() => {
    return Array.from(new Set((snapshot?.clients || []).map((item) => item.vertical))).sort();
  }, [snapshot]);

  const planOptions = useMemo(() => {
    return Array.from(new Set((snapshot?.clients || []).map((item) => item.plan))).sort();
  }, [snapshot]);

  return (
    <FactoryShell>
      <div style={{ display: "grid", gap: 24, fontFamily: "Arial, sans-serif" }}>
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 16, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 28, color: "#0f172a" }}>Dashboard del operador</h1>
            <p style={{ margin: 0, color: "#4b5563", maxWidth: 960, marginTop: 6, fontSize: 14 }}>
              Centro de control unificado: negocio, provisioning, runtime, facturación, evolución,
              salud técnica y gestión de clientes.
            </p>
          </div>
          <UserMenu variant="factory" />
        </div>

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
          Cargando dashboard de Factory...
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
            {snapshot.metrics.map((metric) => (
              <article
                key={metric.key}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 16,
                  background: "#ffffff",
                  padding: 18,
                  display: "grid",
                  gap: 8,
                }}
              >
                <div style={{ fontSize: 13, color: "#6b7280" }}>{metric.label}</div>
                <div style={{ fontSize: 34, fontWeight: 700 }}>{metric.value}</div>
                <div style={{ fontSize: 13, color: "#4b5563" }}>{metric.helper}</div>
              </article>
            ))}
          </section>

          <section
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 16,
            }}
          >
            {snapshot.statusCards.map((card) => {
              const style = toneStyle(card.tone);
              return (
                <article
                  key={card.key}
                  style={{
                    border: "1px solid " + style.border,
                    borderRadius: 16,
                    background: style.bg,
                    color: style.color,
                    padding: 18,
                    display: "grid",
                    gap: 8,
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 18 }}>{card.title}</div>
                  <div style={{ fontSize: 14 }}>{card.detail}</div>
                </article>
              );
            })}
          </section>

          <section
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 16,
            }}
          >
            <article style={{ border: "1px solid #e5e7eb", borderRadius: 16, background: "#ffffff", padding: 18, display: "grid", gap: 6 }}>
              <strong>Negocio</strong>
              <div>Activos: {snapshot.areas.business.activeSubscriptions}</div>
              <div>Trials: {snapshot.areas.business.trialSubscriptions}</div>
              <div>Cancelados: {snapshot.areas.business.cancelledSubscriptions}</div>
              <div>Verticales: {snapshot.areas.business.activeVerticals}</div>
            </article>

            <article style={{ border: "1px solid #e5e7eb", borderRadius: 16, background: "#ffffff", padding: 18, display: "grid", gap: 6 }}>
              <strong>Provisioning</strong>
              <div>Ready: {snapshot.areas.provisioning.ready}</div>
              <div>Pendientes: {snapshot.areas.provisioning.pending}</div>
              <div>Error: {snapshot.areas.provisioning.error}</div>
              <div>Eventos: {snapshot.areas.provisioning.recentEvents}</div>
            </article>

            <article style={{ border: "1px solid #e5e7eb", borderRadius: 16, background: "#ffffff", padding: 18, display: "grid", gap: 6 }}>
              <strong>Runtime</strong>
              <div>Ready: {snapshot.areas.runtime.ready}</div>
              <div>No ready: {snapshot.areas.runtime.notReady}</div>
            </article>

            <article style={{ border: "1px solid #e5e7eb", borderRadius: 16, background: "#ffffff", padding: 18, display: "grid", gap: 6 }}>
              <strong>Billing SaaS</strong>
              <div>OK: {snapshot.areas.billing.ok}</div>
              <div>Trial: {snapshot.areas.billing.trial}</div>
              <div>Cancelado: {snapshot.areas.billing.cancelled}</div>
              <div>Warning: {snapshot.areas.billing.warning}</div>
            </article>

            <article style={{ border: "1px solid #e5e7eb", borderRadius: 16, background: "#ffffff", padding: 18, display: "grid", gap: 6 }}>
              <strong>Evolución</strong>
              <div>Ready: {snapshot.areas.evolution.ready}</div>
              <div>Pendiente: {snapshot.areas.evolution.pending}</div>
              <div>Eventos: {snapshot.areas.evolution.recentEvents}</div>
            </article>

            <article style={{ border: "1px solid #e5e7eb", borderRadius: 16, background: "#ffffff", padding: 18, display: "grid", gap: 6 }}>
              <strong>Salud técnica</strong>
              <div>Healthy: {snapshot.areas.health.healthy}</div>
              <div>Partial: {snapshot.areas.health.partial}</div>
              <div>Corrupt: {snapshot.areas.health.corrupt}</div>
              <div>Errores: {snapshot.areas.health.recentErrors}</div>
            </article>
          </section>

          <section
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(340px, 1fr) minmax(340px, 1fr)",
              gap: 24,
              alignItems: "start",
            }}
          >
            <article
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 18,
                background: "#ffffff",
                padding: 22,
                display: "grid",
                gap: 14,
              }}
            >
              <h2 style={{ marginTop: 0 }}>Feed operativo unificado</h2>

              {snapshot.operationalFeed.length === 0 ? (
                <div style={{ color: "#6b7280" }}>No hay actividad reciente.</div>
              ) : (
                <div style={{ display: "grid", gap: 12 }}>
                  {snapshot.operationalFeed.map((item) => (
                    <article
                      key={item.id}
                      style={{
                        border: "1px solid #eef2f7",
                        borderRadius: 12,
                        background: "#fafafa",
                        padding: 14,
                        display: "grid",
                        gap: 6,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                        <strong>{item.title}</strong>
                        {tinyBadge(areaLabel(item.area), areaTone(item.area))}
                      </div>
                      <div style={{ color: "#4b5563", fontSize: 14 }}>{item.subtitle || "-"}</div>
                      <div style={{ color: "#6b7280", fontSize: 13 }}>{item.detail}</div>
                      <div style={{ color: "#6b7280", fontSize: 12 }}>{formatDate(item.createdAt)}</div>
                    </article>
                  ))}
                </div>
              )}
            </article>

            <article
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 18,
                background: "#ffffff",
                padding: 22,
                display: "grid",
                gap: 14,
              }}
            >
              <h2 style={{ marginTop: 0 }}>Accesos rápidos y verticales</h2>

              <div style={{ display: "grid", gap: 10 }}>
                <a
                    href="/factory/salud"
                    style={{
                      textDecoration: "none",
                      color: "inherit",
                      border: "1px solid #e5e7eb",
                      borderRadius: 12,
                      background: "#fafafa",
                      padding: 12,
                      display: "grid",
                      gap: 4,
                    }}
                  >
                    <strong>Salud técnica</strong>
                    <span style={{ color: "#4b5563", fontSize: 13 }}>Monitorizar disco, runtime, evolution, billing y delivery.</span>
                  </a>

                  <a
                    href="/factory/suscripciones"
                    style={{
                      textDecoration: "none",
                      color: "inherit",
                      border: "1px solid #e5e7eb",
                      borderRadius: 12,
                      background: "#fafafa",
                      padding: 12,
                      display: "grid",
                      gap: 4,
                    }}
                  >
                    <strong>Suscripciones SaaS</strong>
                    <span style={{ color: "#4b5563", fontSize: 13 }}>Ver planes, cambios, límites, cobro y monetización.</span>
                  </a>

                  <a
                    href="/factory/entregas"
                    style={{
                      textDecoration: "none",
                      color: "inherit",
                      border: "1px solid #e5e7eb",
                      borderRadius: 12,
                      background: "#fafafa",
                      padding: 12,
                      display: "grid",
                      gap: 4,
                    }}
                  >
                    <strong>Entregas</strong>
                    <span style={{ color: "#4b5563", fontSize: 13 }}>Ver acceso, onboarding, wrapper, branding, demo y estado final.</span>
                  </a>

                  <a
                    href="/factory/verticales"
                    style={{
                      textDecoration: "none",
                      color: "inherit",
                      border: "1px solid #e5e7eb",
                      borderRadius: 12,
                      background: "#fafafa",
                      padding: 12,
                      display: "grid",
                      gap: 4,
                    }}
                  >
                    <strong>Verticales</strong>
                    <span style={{ color: "#4b5563", fontSize: 13 }}>Editar branding, textos y etiquetas de los sector packs sin tocar código.</span>
                  </a>

                  <a
                    href="/factory/operaciones"
                    style={{
                      textDecoration: "none",
                      color: "inherit",
                      border: "1px solid #e5e7eb",
                      borderRadius: 12,
                      background: "#fafafa",
                      padding: 12,
                      display: "grid",
                      gap: 4,
                    }}
                  >
                    <strong>Operaciones</strong>
                    <span style={{ color: "#4b5563", fontSize: 13 }}>Trials vencidos, incidencias de provisioning, salud técnica y actividad del chat.</span>
                  </a>

                  <a
                    href="/factory/analiticas"
                    style={{
                      textDecoration: "none",
                      color: "inherit",
                      border: "1px solid #e5e7eb",
                      borderRadius: 12,
                      background: "#fafafa",
                      padding: 12,
                      display: "grid",
                      gap: 4,
                    }}
                  >
                    <strong>Analíticas</strong>
                    <span style={{ color: "#4b5563", fontSize: 13 }}>MRR, ARR, churn 30d, LTV medio, tendencia 6 meses y top tenants por ingreso.</span>
                  </a>

                  <a
                    href="/factory/lifecycle"
                    style={{
                      textDecoration: "none",
                      color: "inherit",
                      border: "1px solid #e5e7eb",
                      borderRadius: 12,
                      background: "#fafafa",
                      padding: 12,
                      display: "grid",
                      gap: 4,
                    }}
                  >
                    <strong>Lifecycle</strong>
                    <span style={{ color: "#4b5563", fontSize: 13 }}>Recordatorios de trial, confirmaciones de suscripción, cancelaciones y reactivaciones.</span>
                  </a>

                  <a
                    href="/factory/retencion"
                    style={{
                      textDecoration: "none",
                      color: "inherit",
                      border: "1px solid #e5e7eb",
                      borderRadius: 12,
                      background: "#fafafa",
                      padding: 12,
                      display: "grid",
                      gap: 4,
                    }}
                  >
                    <strong>Retención</strong>
                    <span style={{ color: "#4b5563", fontSize: 13 }}>Limpiar snapshots, outbox y adjuntos antiguos según política.</span>
                  </a>

                  <a
                    href="/factory/auditoria"
                    style={{
                      textDecoration: "none",
                      color: "inherit",
                      border: "1px solid #e5e7eb",
                      borderRadius: 12,
                      background: "#fafafa",
                      padding: 12,
                      display: "grid",
                      gap: 4,
                    }}
                  >
                    <strong>Auditoría</strong>
                    <span style={{ color: "#4b5563", fontSize: 13 }}>Log de mutaciones del chat con filtros y revertir en un click.</span>
                  </a>

                  <a
                    href="/factory/leads"
                    style={{
                      textDecoration: "none",
                      color: "inherit",
                      border: "1px solid #e5e7eb",
                      borderRadius: 12,
                      background: "#fafafa",
                      padding: 12,
                      display: "grid",
                      gap: 4,
                    }}
                  >
                    <strong>Leads</strong>
                    <span style={{ color: "#4b5563", fontSize: 13 }}>Formularios de contacto capturados desde la landing pública.</span>
                  </a>

                  <a
                    href="/factory/notificaciones"
                    style={{
                      textDecoration: "none",
                      color: "inherit",
                      border: "1px solid #e5e7eb",
                      borderRadius: 12,
                      background: "#fafafa",
                      padding: 12,
                      display: "grid",
                      gap: 4,
                    }}
                  >
                    <strong>Notificaciones</strong>
                    <span style={{ color: "#4b5563", fontSize: 13 }}>Altas, pagos, fallos y cancelaciones del SaaS en tiempo real.</span>
                  </a>

                  <a
                    href="/factory/chat"
                    style={{
                      textDecoration: "none",
                      color: "inherit",
                      border: "1px solid #e5e7eb",
                      borderRadius: 12,
                      background: "#fafafa",
                      padding: 12,
                      display: "grid",
                      gap: 4,
                    }}
                  >
                    <strong>Chat</strong>
                    <span style={{ color: "#4b5563", fontSize: 13 }}>Asistente interno con lectura y escritura auditada del repo.</span>
                  </a>

                  {snapshot.quickActions.map((action) => (
                  <a
                    key={action.href}
                    href={action.href}
                    style={{
                      textDecoration: "none",
                      color: "inherit",
                      border: "1px solid #e5e7eb",
                      borderRadius: 12,
                      background: "#fafafa",
                      padding: 12,
                      display: "grid",
                      gap: 4,
                    }}
                  >
                    <strong>{action.label}</strong>
                    <span style={{ color: "#4b5563", fontSize: 13 }}>{action.helper}</span>
                  </a>
                ))}
              </div>

              <h3 style={{ marginBottom: 0 }}>Verticales activos</h3>

              {snapshot.verticals.length === 0 ? (
                <div style={{ color: "#6b7280" }}>No hay verticales activos aún.</div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {snapshot.verticals.map((item) => (
                    <div
                      key={item.key}
                      style={{
                        border: "1px solid #eef2f7",
                        borderRadius: 12,
                        background: "#fafafa",
                        padding: 12,
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                      }}
                    >
                      <strong>{item.label}</strong>
                      <span>{item.count}</span>
                    </div>
                  ))}
                </div>
              )}
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
              <h2 style={{ margin: 0 }}>Panel serio de clientes</h2>
              <p style={{ margin: 0, color: "#4b5563" }}>
                Lista operativa para abrir cliente, ver ficha interna, tenant, vertical, plan,
                provisioning, branding, evolución, acceso y entrega.
              </p>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(220px, 1.4fr) repeat(3, minmax(160px, 0.6fr))",
                gap: 12,
              }}
            >
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por cliente, tenant, vertical o plan"
                style={{
                  padding: "10px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: 10,
                }}
              />

              <select
                value={verticalFilter}
                onChange={(event) => setVerticalFilter(event.target.value)}
                style={{
                  padding: "10px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: 10,
                }}
              >
                <option value="all">Todos los verticales</option>
                {verticalOptions.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
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
                {planOptions.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>

              <select
                value={stateFilter}
                onChange={(event) => setStateFilter(event.target.value)}
                style={{
                  padding: "10px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: 10,
                }}
              >
                <option value="all">Todos los estados</option>
                <option value="active">Activos</option>
                <option value="trial">Trial</option>
                <option value="cancelled">Cancelados</option>
              </select>
            </div>

            <div style={{ color: "#6b7280", fontSize: 13 }}>
              Mostrando {filteredClients.length} de {snapshot.clients.length} clientes.
            </div>

            {filteredClients.length === 0 ? (
              <div style={{ color: "#6b7280" }}>No hay clientes que coincidan con el filtro.</div>
            ) : (
              <div style={{ display: "grid", gap: 14 }}>
                {filteredClients.map((client) => {
                  const subscription = subscriptionBadge(client.subscriptionState);

                  return (
                    <article
                      key={client.clientId}
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: 16,
                        background: "#fafafa",
                        padding: 16,
                        display: "grid",
                        gap: 12,
                      }}
                    >
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "minmax(220px, 1fr) minmax(220px, 1fr) minmax(320px, 1fr)",
                          gap: 16,
                          alignItems: "start",
                        }}
                      >
                        <div style={{ display: "grid", gap: 6 }}>
                          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                            <strong style={{ fontSize: 18 }}>{client.displayName}</strong>
                            <span
                              style={{
                                background: subscription.bg,
                                color: subscription.color,
                                borderRadius: 999,
                                padding: "4px 8px",
                                fontSize: 12,
                                fontWeight: 700,
                              }}
                            >
                              {subscription.text}
                            </span>
                          </div>

                          <div style={{ color: "#4b5563", fontSize: 14 }}>
                            Client ID: {client.clientId}
                          </div>
                          <div style={{ color: "#4b5563", fontSize: 14 }}>
                            Tenant: {client.tenantId}
                          </div>
                          <div style={{ color: "#4b5563", fontSize: 14 }}>
                            Slug: {client.slug}
                          </div>
                          <div style={{ color: "#6b7280", fontSize: 12 }}>
                            Última actualización: {formatDate(client.updatedAt)}
                          </div>
                        </div>

                        <div style={{ display: "grid", gap: 6 }}>
                          <div><strong>Vertical:</strong> {client.vertical}</div>
                          <div><strong>Plan:</strong> {client.plan}</div>
                          <div><strong>Branding visible:</strong> {client.brandingDisplayName}</div>
                          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                            <strong>Color:</strong>
                            <span
                              style={{
                                width: 14,
                                height: 14,
                                borderRadius: 999,
                                background: client.brandingAccentColor,
                                display: "inline-block",
                                border: "1px solid #d1d5db",
                              }}
                            />
                            <span>{client.brandingAccentColor}</span>
                          </div>
                          <div><strong>Tono:</strong> {client.brandingTone}</div>
                        </div>

                        <div style={{ display: "grid", gap: 8 }}>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {tinyBadge("Provisioning: " + client.provisioningState, clientProvisioningTone(client.provisioningState))}
                            {tinyBadge("Runtime: " + (client.runtimeReady ? "ready" : "pendiente"), client.runtimeReady ? "ok" : "warn")}
                            {tinyBadge("Billing: " + client.billingState, clientBillingTone(client.billingState))}
                            {tinyBadge("Evolución: " + (client.evolutionReady ? "ready" : "pendiente"), client.evolutionReady ? "ok" : "warn")}
                            {tinyBadge("Salud: " + client.healthState, clientHealthTone(client.healthState))}
                          </div>

                          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                            <a
                              href={"/factory/client/" + encodeURIComponent(client.clientId)}
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
                              href={client.openUrl}
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
                              Abrir cliente
                            </a>

                            <a
                              href={client.accessUrl}
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
                              Ver acceso
                            </a>

                            <a
                              href={client.deliveryUrl}
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
                              Ver entrega
                            </a>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
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
      </div>
    </FactoryShell>
  );
}