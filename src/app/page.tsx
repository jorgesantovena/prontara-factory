"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import UserMenu from "@/components/user-menu";
import OnboardingStartPanel, {
  type OnboardingSnapshot,
} from "@/components/erp/onboarding-start-panel";
import TenantShell from "@/components/erp/tenant-shell";

type Metric = { key: string; label: string; value: string; helper: string };
type DashboardPriority = {
  key: string;
  label: string;
  description: string;
  order: number;
};
type OperationalAlert = {
  key: string;
  severity: "info" | "warn" | "danger";
  title: string;
  detail: string;
  href: string;
};
type TrialState = {
  plan: "trial";
  status: "active" | "expired";
  trialDays: number;
  daysRemaining: number;
  expiresAt: string;
};
type ActivityItem = {
  id: string;
  title: string;
  subtitle: string;
  moduleKey: string;
  moduleLabel: string;
  href: string;
  updatedAt: string;
};
type QuickAction = { href: string; label: string; helper: string };
type ReadinessCard = { key: string; label: string; value: string; helper: string };

type DashboardResponse = {
  ok: boolean;
  error?: string;
  tenant?: {
    clientId: string;
    slug: string | null;
    displayName: string | null;
    shortName: string | null;
    accentColor: string | null;
  };
  snapshot?: {
    metrics: Metric[];
    activity: ActivityItem[];
    quickActions: QuickAction[];
    summary: {
      totalClientes: number;
      oportunidadesAbiertas: number;
      pipelineAbierto: number;
      proyectosActivos: number;
      presupuestosAbiertos: number;
      facturasPendientes: number;
      totalDocumentos: number;
    };
  };
  dashboardPriorities?: DashboardPriority[];
  alerts?: OperationalAlert[];
  trial?: TrialState | null;
  subscription?: {
    allowed: boolean;
    status: string;
    reason: string | null;
  } | null;
  readiness?: {
    score: number;
    statusLabel: "listo" | "casi-listo" | "arrancando";
    headline: string;
    summary: string;
    cards: ReadinessCard[];
    recommendedToday: string[];
    confidenceBullets: string[];
  };
};

const ACCENT_DEFAULT = "#1d4ed8";

function formatRelative(iso: string): string {
  if (!iso) return "";
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts) || ts === 0) return "";
  const diff = Date.now() - ts;
  if (diff < 0) return "Ahora mismo";
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Ahora mismo";
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `Hace ${days} d`;
  return new Date(ts).toLocaleDateString("es-ES");
}

/**
 * Reordena y relabela los KPIs según las priorities sectoriales del tenant.
 * - Si no hay priorities → retorna metrics tal cual.
 * - Cada priority intenta matchear por key exacta o substring con un KPI.
 *   El match más específico gana. Los KPIs matcheados se ponen primero,
 *   en el orden de `priority.order`. El label del KPI se sobreescribe con
 *   el label sectorial (p. ej. "Oportunidades" → "Pipeline" en
 *   software-factory). El helper se sobreescribe solo si la priority tiene
 *   `description`. Los KPIs no matcheados se mantienen al final.
 */
function applyDashboardPriorities(
  metrics: Metric[],
  priorities: DashboardPriority[] | undefined
): Metric[] {
  if (!priorities || priorities.length === 0) return metrics;

  const ordered = [...priorities].sort((a, b) => a.order - b.order);
  const used = new Set<string>();
  const result: Metric[] = [];

  for (const priority of ordered) {
    const keyLower = priority.key.toLowerCase();
    const match = metrics.find((m) => {
      if (used.has(m.key)) return false;
      const mKey = m.key.toLowerCase();
      return mKey === keyLower || mKey.includes(keyLower) || keyLower.includes(mKey);
    });
    if (!match) continue;
    used.add(match.key);
    result.push({
      ...match,
      label: priority.label || match.label,
      helper: priority.description || match.helper,
    });
  }

  for (const m of metrics) {
    if (!used.has(m.key)) result.push(m);
  }

  return result;
}

function alertTone(severity: "info" | "warn" | "danger"): { bg: string; fg: string; border: string } {
  if (severity === "danger") return { bg: "#fef2f2", fg: "#991b1b", border: "#fecaca" };
  if (severity === "warn") return { bg: "#fffbeb", fg: "#92400e", border: "#fde68a" };
  return { bg: "#eff6ff", fg: "#1d4ed8", border: "#bfdbfe" };
}

function statusBadge(status: "listo" | "casi-listo" | "arrancando"): { text: string; bg: string; fg: string } {
  if (status === "listo") return { text: "Entorno listo", bg: "#dcfce7", fg: "#166534" };
  if (status === "casi-listo") return { text: "Casi listo", bg: "#fef3c7", fg: "#92400e" };
  return { text: "Arrancando", bg: "#e0f2fe", fg: "#075985" };
}

export default function HomePage() {
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "error"; message: string }
    | { kind: "unauth" }
    | { kind: "ready"; data: DashboardResponse }
  >({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/runtime/dashboard", { cache: "no-store" });
        if (res.status === 401) {
          if (!cancelled) setState({ kind: "unauth" });
          return;
        }
        const json = (await res.json()) as DashboardResponse;
        if (!json.ok) {
          if (!cancelled) setState({ kind: "error", message: json.error || "Error cargando dashboard." });
          return;
        }
        if (!cancelled) setState({ kind: "ready", data: json });
      } catch (err) {
        if (!cancelled) {
          setState({
            kind: "error",
            message: err instanceof Error ? err.message : "Error de red.",
          });
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.kind === "loading") {
    return (
      <main style={{ padding: 48, fontFamily: "Arial, sans-serif", color: "#4b5563" }}>
        Cargando tu panel…
      </main>
    );
  }

  if (state.kind === "unauth") {
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
          <h1 style={{ marginTop: 0, fontSize: 28 }}>Accede a tu entorno</h1>
          <p style={{ color: "#4b5563", lineHeight: 1.6 }}>
            Para ver tu panel necesitas iniciar sesión con tu cuenta de Prontara.
          </p>
          <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
            <Link
              href="/acceso"
              style={{
                background: ACCENT_DEFAULT,
                color: "#ffffff",
                padding: "10px 16px",
                borderRadius: 10,
                textDecoration: "none",
                fontWeight: 600,
              }}
            >
              Iniciar sesión
            </Link>
            <Link
              href="/landing"
              style={{
                color: "#1f2937",
                padding: "10px 16px",
                borderRadius: 10,
                textDecoration: "none",
                border: "1px solid #d1d5db",
                fontWeight: 600,
              }}
            >
              Ver Prontara
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (state.kind === "error") {
    return (
      <main style={{ padding: 48, fontFamily: "Arial, sans-serif", background: "#f5f7fb", minHeight: "100vh" }}>
        <div
          style={{
            maxWidth: 640,
            margin: "40px auto",
            background: "#fff1f2",
            border: "1px solid #fecdd3",
            borderRadius: 16,
            padding: 24,
            color: "#9f1239",
          }}
        >
          <h2 style={{ marginTop: 0 }}>No hemos podido cargar tu panel</h2>
          <p style={{ margin: 0 }}>{state.message}</p>
        </div>
      </main>
    );
  }

  const { data } = state;
  const tenant = data.tenant;
  const snapshot = data.snapshot;
  const readiness = data.readiness;
  const accent = tenant?.accentColor || ACCENT_DEFAULT;
  const displayName = tenant?.displayName || "Tu entorno";
  const badge = readiness ? statusBadge(readiness.statusLabel) : null;

  // Snapshot para el onboarding guiado. Reusa los agregados del dashboard
  // sin refetchear: la persistencia de UI state (dismiss / manualDoneMap) la
  // maneja el propio panel contra /api/runtime/onboarding.
  const onboardingSnapshot: OnboardingSnapshot | null =
    snapshot && tenant
      ? {
          activeClientId: tenant.clientId,
          totalClientes: snapshot.summary.totalClientes,
          oportunidadesAbiertas: snapshot.summary.oportunidadesAbiertas,
          presupuestosAbiertos: snapshot.summary.presupuestosAbiertos,
          facturasPendientes: snapshot.summary.facturasPendientes,
          proyectosActivos: snapshot.summary.proyectosActivos,
        }
      : null;

  return (
    <TenantShell>
      <div style={{ maxWidth: 1180, margin: "0 auto", display: "grid", gap: 24, color: "#111827", fontFamily: "Arial, sans-serif" }}>
        {/* Cabecera */}
        <section
          style={{
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: 16,
            padding: 28,
            display: "grid",
            gap: 16,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6, flexWrap: "wrap" }}>
                <div style={{ fontSize: 13, color: "#6b7280" }}>Panel de {displayName}</div>
                <UserMenu variant="runtime" />
              </div>
              <h1 style={{ margin: 0, fontSize: 30, color: accent }}>
                {readiness?.headline || "Lo importante para hoy"}
              </h1>
              {readiness ? (
                <p style={{ margin: "10px 0 0 0", color: "#4b5563", lineHeight: 1.6, maxWidth: 720 }}>
                  {readiness.summary}
                </p>
              ) : null}
            </div>
            {badge && readiness ? (
              <div style={{ textAlign: "right" }}>
                <span
                  style={{
                    display: "inline-block",
                    background: badge.bg,
                    color: badge.fg,
                    padding: "6px 12px",
                    borderRadius: 999,
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  {badge.text}
                </span>
                <div style={{ fontSize: 32, fontWeight: 700, marginTop: 8, color: "#111827" }}>
                  {readiness.score}
                  <span style={{ fontSize: 14, color: "#6b7280", marginLeft: 6 }}>/100</span>
                </div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>Preparación del entorno</div>
              </div>
            ) : null}
          </div>
        </section>

        {/* Banner bloqueante de suscripción no activa */}
        {data.subscription && !data.subscription.allowed ? (
          <section
            role="alert"
            style={{
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: 14,
              padding: "20px 24px",
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: 16,
              alignItems: "center",
            }}
          >
            <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 17, color: "#991b1b" }}>
                Acceso limitado: suscripción {data.subscription.status}
              </div>
              <div style={{ color: "#991b1b", fontSize: 13 }}>
                {data.subscription.reason ||
                  "Tu suscripción no permite operar el ERP ahora mismo. Revisa /suscripcion."}
              </div>
              <div style={{ color: "#991b1b", fontSize: 12, opacity: 0.85 }}>
                Puedes consultar tus datos, pero no crear, editar ni borrar registros hasta que la suscripción esté activa.
              </div>
            </div>
            <Link
              href="/suscripcion"
              style={{
                background: "#991b1b",
                color: "#ffffff",
                padding: "12px 18px",
                borderRadius: 999,
                textDecoration: "none",
                fontWeight: 700,
                whiteSpace: "nowrap",
              }}
            >
              Reactivar suscripción
            </Link>
          </section>
        ) : null}

        {/* Banner de trial */}
        {data.trial && data.trial.plan === "trial" ? (() => {
          const days = Math.max(0, data.trial.daysRemaining);
          const expired = data.trial.status === "expired" || days <= 0;
          const tone = expired || days <= 3 ? "danger" : days <= 7 ? "warn" : "info";
          const colors = alertTone(tone);
          const headline = expired
            ? "Tu periodo de prueba ha terminado"
            : days === 0
              ? "Tu periodo de prueba termina hoy"
              : days === 1
                ? "Te queda 1 día de prueba"
                : "Te quedan " + days + " días de prueba";
          const detail = expired
            ? "Activa una suscripción para seguir usando Prontara sin interrupciones."
            : "Activa tu suscripción antes de que termine para no perder acceso al ERP.";
          return (
            <Link
              href="/suscripcion"
              style={{
                background: colors.bg,
                border: "1px solid " + colors.border,
                borderRadius: 14,
                padding: "16px 20px",
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: 12,
                alignItems: "center",
                textDecoration: "none",
                color: colors.fg,
              }}
            >
              <div style={{ display: "grid", gap: 2 }}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{headline}</div>
                <div style={{ fontSize: 13 }}>{detail}</div>
              </div>
              <div
                style={{
                  background: colors.fg,
                  color: "#ffffff",
                  padding: "10px 14px",
                  borderRadius: 999,
                  fontSize: 13,
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                }}
              >
                Activar suscripción
              </div>
            </Link>
          );
        })() : null}

        {/* Onboarding guiado — Fase 9.1 */}
        {onboardingSnapshot ? <OnboardingStartPanel snapshot={onboardingSnapshot} /> : null}

        {/* Alertas operativas */}
        {data.alerts && data.alerts.length > 0 ? (
          <section
            style={{
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: 14,
              padding: 20,
              display: "grid",
              gap: 10,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
              <h2 style={{ margin: 0, fontSize: 18, color: "#374151" }}>Lo que necesita tu atención</h2>
              <span style={{ fontSize: 12, color: "#6b7280" }}>
                {data.alerts.length} {data.alerts.length === 1 ? "aviso" : "avisos"}
              </span>
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {data.alerts.slice(0, 8).map((alert) => {
                const colors = alertTone(alert.severity);
                return (
                  <Link
                    key={alert.key}
                    href={alert.href}
                    style={{
                      background: colors.bg,
                      border: "1px solid " + colors.border,
                      borderRadius: 10,
                      padding: 12,
                      display: "grid",
                      gap: 4,
                      textDecoration: "none",
                      color: colors.fg,
                    }}
                  >
                    <div style={{ fontWeight: 700 }}>{alert.title}</div>
                    <div style={{ fontSize: 13 }}>{alert.detail}</div>
                  </Link>
                );
              })}
            </div>
            {data.alerts.length > 8 ? (
              <div style={{ fontSize: 12, color: "#6b7280" }}>
                Y {data.alerts.length - 8} aviso(s) más. Abre el módulo implicado para revisarlos.
              </div>
            ) : null}
          </section>
        ) : null}

        {/* KPIs */}
        {snapshot && snapshot.metrics.length > 0 ? (
          <section>
            <h2 style={{ margin: "0 0 12px 0", fontSize: 18, color: "#374151" }}>Indicadores</h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: 12,
              }}
            >
              {applyDashboardPriorities(snapshot.metrics, data.dashboardPriorities).map((m) => (
                <div
                  key={m.key}
                  style={{
                    background: "#ffffff",
                    border: "1px solid #e5e7eb",
                    borderRadius: 14,
                    padding: 18,
                    display: "grid",
                    gap: 4,
                  }}
                >
                  <div style={{ fontSize: 12, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.4 }}>
                    {m.label}
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: "#111827" }}>{m.value}</div>
                  <div style={{ fontSize: 13, color: "#4b5563" }}>{m.helper}</div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* Layout de 2 columnas: acciones + actividad */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.3fr)",
            gap: 16,
          }}
        >
          {/* Acciones rápidas */}
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: 14,
              padding: 20,
              display: "grid",
              gap: 12,
              alignContent: "start",
            }}
          >
            <h2 style={{ margin: 0, fontSize: 18, color: "#374151" }}>Qué puedes hacer ahora</h2>
            {snapshot && snapshot.quickActions.length > 0 ? (
              snapshot.quickActions.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  style={{
                    display: "grid",
                    gap: 4,
                    padding: 14,
                    border: "1px solid #e5e7eb",
                    borderRadius: 12,
                    textDecoration: "none",
                    color: "#111827",
                    background: "#f9fafb",
                  }}
                >
                  <div style={{ fontWeight: 700, color: accent }}>{action.label}</div>
                  <div style={{ fontSize: 13, color: "#4b5563" }}>{action.helper}</div>
                </Link>
              ))
            ) : (
              <p style={{ color: "#6b7280", margin: 0 }}>No hay acciones sugeridas ahora mismo.</p>
            )}
            {readiness && readiness.recommendedToday.length > 0 ? (
              <div
                style={{
                  background: "#f3f4f6",
                  border: "1px dashed #d1d5db",
                  borderRadius: 12,
                  padding: 14,
                  marginTop: 4,
                }}
              >
                <div style={{ fontSize: 12, color: "#374151", fontWeight: 700, marginBottom: 6 }}>Sugerencias para hoy</div>
                <ul style={{ margin: 0, paddingLeft: 18, color: "#4b5563", lineHeight: 1.6 }}>
                  {readiness.recommendedToday.map((text, idx) => (
                    <li key={idx}>{text}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          {/* Actividad reciente */}
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: 14,
              padding: 20,
              display: "grid",
              gap: 10,
              alignContent: "start",
            }}
          >
            <h2 style={{ margin: 0, fontSize: 18, color: "#374151" }}>Actividad reciente</h2>
            {snapshot && snapshot.activity.length > 0 ? (
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 8 }}>
                {snapshot.activity.map((item) => (
                  <li key={item.moduleKey + "/" + item.id}>
                    <Link
                      href={item.href}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "auto 1fr auto",
                        gap: 12,
                        padding: "10px 12px",
                        border: "1px solid #e5e7eb",
                        borderRadius: 10,
                        textDecoration: "none",
                        color: "#111827",
                        background: "#ffffff",
                      }}
                    >
                      <span
                        style={{
                          background: "#e0f2fe",
                          color: "#075985",
                          padding: "4px 8px",
                          borderRadius: 999,
                          fontSize: 12,
                          fontWeight: 700,
                          alignSelf: "center",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {item.moduleLabel}
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {item.title}
                        </div>
                        {item.subtitle ? (
                          <div style={{ fontSize: 13, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {item.subtitle}
                          </div>
                        ) : null}
                      </div>
                      <div style={{ fontSize: 12, color: "#6b7280", alignSelf: "center", whiteSpace: "nowrap" }}>
                        {formatRelative(item.updatedAt)}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ color: "#6b7280", margin: 0 }}>Todavía no hay actividad. Cuando crees tus primeros registros aparecerán aquí.</p>
            )}
          </div>
        </section>

        {/* Preparación del entorno (cards) */}
        {readiness && readiness.cards.length > 0 ? (
          <section>
            <h2 style={{ margin: "0 0 12px 0", fontSize: 18, color: "#374151" }}>Preparación del entorno</h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 12,
              }}
            >
              {readiness.cards.map((card) => (
                <div
                  key={card.key}
                  style={{
                    background: "#ffffff",
                    border: "1px solid #e5e7eb",
                    borderRadius: 14,
                    padding: 16,
                    display: "grid",
                    gap: 4,
                  }}
                >
                  <div style={{ fontSize: 12, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.4 }}>
                    {card.label}
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: "#111827" }}>{card.value}</div>
                  <div style={{ fontSize: 13, color: "#4b5563" }}>{card.helper}</div>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </TenantShell>
  );
}
