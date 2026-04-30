"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import EntityBreadcrumb from "@/components/erp/entity-breadcrumb";

type Kpi = {
  key: string;
  label: string;
  value: string;
  helper: string;
  tone: "neutral" | "good" | "warn" | "bad";
};

type PipelineStage = {
  key: string;
  label: string;
  count: number;
  value: number;
};

type Alert = {
  key: string;
  severity: "info" | "warn" | "danger";
  title: string;
  detail: string;
  href: string;
};

type ActivityItem = {
  id: string;
  kind: string;
  title: string;
  subtitle: string;
  status: string;
  href: string;
  updatedAt: string;
};

type OverviewResponse = {
  ok: boolean;
  error?: string;
  clientId?: string;
  displayName?: string;
  businessType?: string;
  kpis?: Kpi[];
  pipelineByStage?: PipelineStage[];
  alerts?: Alert[];
  recentActivity?: ActivityItem[];
  recentDeliverables?: ActivityItem[];
};

type ColorSet = { bg: string; fg: string; border: string };

const TONE_COLORS: Record<Kpi["tone"], ColorSet> = {
  neutral: { bg: "#f9fafb", fg: "#111827", border: "#e5e7eb" },
  good: { bg: "#f0fdf4", fg: "#166534", border: "#bbf7d0" },
  warn: { bg: "#fffbeb", fg: "#92400e", border: "#fde68a" },
  bad: { bg: "#fef2f2", fg: "#991b1b", border: "#fecaca" },
};

const SEVERITY_COLORS: Record<Alert["severity"], ColorSet> = {
  info: { bg: "#eff6ff", fg: "#1d4ed8", border: "#bfdbfe" },
  warn: { bg: "#fffbeb", fg: "#92400e", border: "#fde68a" },
  danger: { bg: "#fef2f2", fg: "#991b1b", border: "#fecaca" },
};

function resolveTone(tone: string): ColorSet {
  if (tone === "good" || tone === "warn" || tone === "bad" || tone === "neutral") {
    return TONE_COLORS[tone];
  }
  return TONE_COLORS.neutral;
}

function resolveSeverity(severity: string): ColorSet {
  if (severity === "warn" || severity === "danger" || severity === "info") {
    return SEVERITY_COLORS[severity];
  }
  return SEVERITY_COLORS.info;
}

function formatMoney(value: number): string {
  return value.toLocaleString("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

function formatRelative(iso: string): string {
  if (!iso) return "";
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts) || ts === 0) return "";
  const diff = Date.now() - ts;
  if (diff < 0) return "Ahora";
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Ahora";
  if (minutes < 60) return "Hace " + minutes + " min";
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return "Hace " + hours + " h";
  const days = Math.floor(hours / 24);
  if (days < 30) return "Hace " + days + " d";
  return new Date(ts).toLocaleDateString("es-ES");
}

export default function SoftwareFactoryDashboardPage() {
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "error"; message: string }
    | { kind: "unauth" }
    | { kind: "ready"; data: OverviewResponse }
  >({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/software-factory/overview", { cache: "no-store" });
        if (res.status === 401) {
          if (!cancelled) setState({ kind: "unauth" });
          return;
        }
        const data = (await res.json()) as OverviewResponse;
        if (!data.ok) {
          if (!cancelled) setState({ kind: "error", message: data.error || "No se pudo cargar el overview." });
          return;
        }
        if (!cancelled) setState({ kind: "ready", data });
      } catch (err) {
        if (!cancelled) {
          setState({ kind: "error", message: err instanceof Error ? err.message : "Error de red." });
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
        Cargando dashboard del vertical…
      </main>
    );
  }

  if (state.kind === "unauth") {
    return (
      <main style={{ padding: 48, fontFamily: "Arial, sans-serif", background: "#f5f7fb", minHeight: "100vh" }}>
        <div style={{ maxWidth: 640, margin: "40px auto", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 32 }}>
          <h1 style={{ marginTop: 0 }}>Dashboard del vertical</h1>
          <p style={{ color: "#4b5563" }}>Inicia sesión para ver el dashboard de tu software factory.</p>
          <Link
            href="/acceso"
            style={{ display: "inline-block", background: "#1d4ed8", color: "#fff", padding: "10px 16px", borderRadius: 10, textDecoration: "none", fontWeight: 700 }}
          >
            Iniciar sesión
          </Link>
        </div>
      </main>
    );
  }

  if (state.kind === "error") {
    return (
      <main style={{ padding: 48, fontFamily: "Arial, sans-serif", background: "#f5f7fb", minHeight: "100vh" }}>
        <div style={{ maxWidth: 640, margin: "40px auto", background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: 16, padding: 24, color: "#9f1239" }}>
          <h2 style={{ marginTop: 0 }}>No hemos podido cargar el overview</h2>
          <p style={{ margin: 0 }}>{state.message}</p>
        </div>
      </main>
    );
  }

  const { data } = state;
  const displayName = data.displayName || "Software Factory";

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f5f7fb",
        color: "#111827",
        fontFamily: "Arial, sans-serif",
        padding: "32px 24px",
      }}
    >
      <div style={{ maxWidth: 1180, margin: "0 auto", display: "grid", gap: 24 }}>
        {/* Cabecera */}
        <section
          style={{
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: 16,
            padding: 28,
            display: "grid",
            gap: 12,
          }}
        >
          <EntityBreadcrumb
            items={[
              { href: "/", label: "Inicio" },
              { href: "/software-factory", label: "Software Factory" },
            ]}
          />
          <div>
            <div style={{ fontSize: 12, color: "#6b7280", letterSpacing: 1, textTransform: "uppercase", fontWeight: 700 }}>
              Dashboard del vertical
            </div>
            <h1 style={{ margin: "6px 0 0 0", fontSize: 30, color: "#1d4ed8" }}>{displayName}</h1>
            <p style={{ margin: "10px 0 0 0", color: "#4b5563", lineHeight: 1.6, maxWidth: 720 }}>
              Vista operativa específica para una software factory pequeña. KPIs de negocio, pipeline por fase,
              proyectos en riesgo y entregables recientes en un solo sitio.
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
              <Link
                href="/software-factory/proyectos-riesgo"
                style={{
                  padding: "8px 14px",
                  border: "1px solid #fecaca",
                  borderRadius: 10,
                  background: "#fef2f2",
                  color: "#991b1b",
                  textDecoration: "none",
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                Proyectos en riesgo
              </Link>
              <Link
                href="/software-factory/propuestas-estancadas"
                style={{
                  padding: "8px 14px",
                  border: "1px solid #fde68a",
                  borderRadius: 10,
                  background: "#fffbeb",
                  color: "#92400e",
                  textDecoration: "none",
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                Propuestas estancadas
              </Link>
              <Link
                href="/software-factory/facturas-vencidas"
                style={{
                  padding: "8px 14px",
                  border: "1px solid #fecaca",
                  borderRadius: 10,
                  background: "#fef2f2",
                  color: "#991b1b",
                  textDecoration: "none",
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                Facturas vencidas
              </Link>
            </div>
          </div>
        </section>

        {/* KPIs del vertical */}
        {data.kpis && data.kpis.length > 0 ? (
          <section>
            <h2 style={{ margin: "0 0 12px 0", fontSize: 18, color: "#374151" }}>Indicadores clave</h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: 12,
              }}
            >
              {data.kpis.map((kpi) => {
                const colors = resolveTone(kpi.tone);
                return (
                  <div
                    key={kpi.key}
                    style={{
                      background: colors.bg,
                      border: "1px solid " + colors.border,
                      borderRadius: 14,
                      padding: 18,
                      display: "grid",
                      gap: 4,
                    }}
                  >
                    <div style={{ fontSize: 12, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.4 }}>
                      {kpi.label}
                    </div>
                    <div style={{ fontSize: 26, fontWeight: 700, color: colors.fg }}>{kpi.value}</div>
                    <div style={{ fontSize: 13, color: "#4b5563" }}>{kpi.helper}</div>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        {/* Pipeline por fase */}
        {data.pipelineByStage && data.pipelineByStage.length > 0 ? (
          <section
            style={{
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: 14,
              padding: 20,
              display: "grid",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
              <h2 style={{ margin: 0, fontSize: 18, color: "#374151" }}>Pipeline por fase</h2>
              <span style={{ fontSize: 12, color: "#6b7280" }}>
                Total abierto:{" "}
                <strong style={{ color: "#111827" }}>
                  {formatMoney(data.pipelineByStage.reduce((a, s) => a + s.value, 0))}
                </strong>
              </span>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                gap: 10,
              }}
            >
              {data.pipelineByStage.map((stage) => (
                <div
                  key={stage.key}
                  style={{
                    background: "#f8fafc",
                    border: "1px solid #e5e7eb",
                    borderRadius: 10,
                    padding: 14,
                    display: "grid",
                    gap: 2,
                  }}
                >
                  <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.4 }}>
                    {stage.label}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#111827" }}>{stage.count}</div>
                  <div style={{ fontSize: 12, color: "#1d4ed8" }}>{formatMoney(stage.value)}</div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

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
            <h2 style={{ margin: 0, fontSize: 18, color: "#374151" }}>Alertas operativas</h2>
            <div style={{ display: "grid", gap: 8 }}>
              {data.alerts.map((alert) => {
                const colors = resolveSeverity(alert.severity);
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
          </section>
        ) : null}

        {/* Layout 2 columnas: actividad + entregables */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.3fr) minmax(0, 1fr)",
            gap: 16,
          }}
        >
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
            {data.recentActivity && data.recentActivity.length > 0 ? (
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 8 }}>
                {data.recentActivity.map((item) => (
                  <li key={item.kind + "/" + item.id}>
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
                      }}
                    >
                      <span
                        style={{
                          background: "#eff6ff",
                          color: "#1d4ed8",
                          padding: "4px 8px",
                          borderRadius: 999,
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: 0.4,
                          alignSelf: "center",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {item.kind}
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
              <p style={{ color: "#6b7280", margin: 0 }}>Sin actividad todavía. Cuando crees tus primeros registros aparecerán aquí.</p>
            )}
          </div>

          {/* Entregables recientes */}
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
            <h2 style={{ margin: 0, fontSize: 18, color: "#374151" }}>Entregables recientes</h2>
            {data.recentDeliverables && data.recentDeliverables.length > 0 ? (
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 8 }}>
                {data.recentDeliverables.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      style={{
                        display: "grid",
                        gap: 4,
                        padding: "10px 12px",
                        border: "1px solid #e5e7eb",
                        borderRadius: 10,
                        textDecoration: "none",
                        color: "#111827",
                      }}
                    >
                      <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {item.title}
                      </div>
                      <div style={{ fontSize: 13, color: "#6b7280" }}>
                        {item.subtitle || "Sin detalle"} · {formatRelative(item.updatedAt) || "fecha desconocida"}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ color: "#6b7280", margin: 0 }}>Todavía no hay entregables registrados.</p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
