"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * Dashboard sectorial (H9-A3 + A4 + A5 + A6).
 *
 * Componente que renderiza la home cuando el usuario está logueado:
 *   - KPIs específicos del vertical (calculados en el endpoint)
 *   - Accesos rápidos contextuales
 *   - Alertas operativas
 *   - Actividad reciente
 *
 * Lo usa /page.tsx cuando state=ready.
 */
type Kpi = { key: string; label: string; value: string; helper: string; tone?: "neutral" | "good" | "warn" | "bad"; href?: string };
type QuickAction = { href: string; label: string; icon: string };
type Alert = { severity: "info" | "warn" | "danger"; title: string; href: string };
type RecentItem = { moduleKey: string; titulo: string; updatedAt: string };

type Data = {
  ok: boolean;
  vertical: string;
  tenantName: string;
  kpis: Kpi[];
  quickActions: QuickAction[];
  alerts: Alert[];
  recentActivity: RecentItem[];
  generatedAt: string;
};

const TONE_COLORS: Record<string, { fg: string; bg: string }> = {
  neutral: { fg: "#1d4ed8", bg: "#eff6ff" },
  good: { fg: "#16a34a", bg: "#f0fdf4" },
  warn: { fg: "#d97706", bg: "#fffbeb" },
  bad: { fg: "#dc2626", bg: "#fef2f2" },
};

const ALERT_COLORS: Record<string, { fg: string; bg: string; border: string }> = {
  info: { fg: "#1d4ed8", bg: "#eff6ff", border: "#bfdbfe" },
  warn: { fg: "#92400e", bg: "#fffbeb", border: "#fde68a" },
  danger: { fg: "#991b1b", bg: "#fef2f2", border: "#fecaca" },
};

function timeAgo(iso: string): string {
  if (!iso) return "";
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return "";
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "ahora mismo";
  if (min < 60) return "hace " + min + " min";
  const h = Math.floor(min / 60);
  if (h < 24) return "hace " + h + " h";
  const d = Math.floor(h / 24);
  if (d < 30) return "hace " + d + " d";
  return new Date(ts).toLocaleDateString("es-ES");
}

const MODULE_ICONS: Record<string, string> = {
  clientes: "👥", proyectos: "🛠️", facturacion: "💶", presupuestos: "📄", actividades: "⏱️",
};

export default function SectorialDashboard({ accent = "#1d4ed8" }: { accent?: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/runtime/dashboard-sectorial", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: Data) => {
        if (d.ok) setData(d);
        else setError("No se pudo cargar el dashboard.");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Error."));
  }, []);

  if (error) {
    return <div style={{ padding: 16, color: "#991b1b", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8 }}>{error}</div>;
  }
  if (!data) {
    return <div style={{ color: "#94a3b8", padding: 16 }}>Cargando dashboard…</div>;
  }

  return (
    <div style={{ display: "grid", gap: 24 }}>
      {/* ALERTAS (si las hay) */}
      {data.alerts.length > 0 ? (
        <section style={{ display: "grid", gap: 8 }}>
          {data.alerts.map((a, i) => {
            const c = ALERT_COLORS[a.severity] || ALERT_COLORS.info;
            return (
              <Link key={i} href={a.href} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 14px",
                background: c.bg, border: "1px solid " + c.border, color: c.fg,
                borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none",
              }}>
                <span style={{ fontSize: 16 }}>{a.severity === "danger" ? "⚠️" : a.severity === "warn" ? "⏰" : "ℹ️"}</span>
                <span>{a.title}</span>
                <span style={{ marginLeft: "auto", fontSize: 11, opacity: 0.7 }}>Ver →</span>
              </Link>
            );
          })}
        </section>
      ) : null}

      {/* KPIs */}
      <section>
        <h2 style={sectionTitle}>Indicadores clave</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
          {data.kpis.map((k) => {
            const tone = TONE_COLORS[k.tone || "neutral"];
            const card = (
              <div key={k.key} style={{
                padding: 16,
                background: "var(--bg-card, #ffffff)",
                border: "1px solid var(--border, #e5e7eb)",
                borderLeft: "4px solid " + tone.fg,
                borderRadius: 10,
                cursor: k.href ? "pointer" : "default",
              }}>
                <div style={{ fontSize: 11, color: "var(--fg-muted, #6b7280)", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700, marginBottom: 6 }}>
                  {k.label}
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, color: tone.fg, marginBottom: 4 }}>{k.value}</div>
                <div style={{ fontSize: 12, color: "var(--fg-muted, #6b7280)" }}>{k.helper}</div>
              </div>
            );
            return k.href ? <Link key={k.key} href={k.href} style={{ textDecoration: "none" }}>{card}</Link> : card;
          })}
        </div>
      </section>

      {/* ACCESOS RÁPIDOS */}
      <section>
        <h2 style={sectionTitle}>Accesos rápidos</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
          {data.quickActions.map((a, i) => (
            <Link key={i} href={a.href} style={{
              display: "flex", flexDirection: "column", gap: 6, padding: "16px 14px",
              background: accent + "0d", border: "1px solid " + accent + "33",
              borderRadius: 10, textDecoration: "none", color: accent,
              transition: "background 0.15s",
            }}>
              <span style={{ fontSize: 24 }}>{a.icon}</span>
              <span style={{ fontWeight: 700, fontSize: 13 }}>{a.label}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* GRID 2 columnas: Actividad + Atajos secundarios */}
      <section style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 20 }}>
        {/* Actividad reciente */}
        <div>
          <h2 style={sectionTitle}>Actividad reciente</h2>
          <div style={{ background: "var(--bg-card, #ffffff)", border: "1px solid var(--border, #e5e7eb)", borderRadius: 10, overflow: "hidden" }}>
            {data.recentActivity.length === 0 ? (
              <div style={{ padding: 20, color: "var(--fg-muted, #94a3b8)", fontSize: 13, textAlign: "center" }}>
                Aún no hay movimientos. Cuando alguien añada datos aparecerán aquí.
              </div>
            ) : (
              data.recentActivity.map((r, i) => (
                <Link key={i} href={"/" + r.moduleKey} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 14px",
                  borderTop: i > 0 ? "1px solid var(--border, #f1f5f9)" : "none",
                  textDecoration: "none", color: "var(--fg, #0f172a)",
                }}>
                  <span style={{ fontSize: 18 }}>{MODULE_ICONS[r.moduleKey] || "📌"}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.titulo}</div>
                    <div style={{ fontSize: 11, color: "var(--fg-muted, #6b7280)", textTransform: "capitalize" }}>{r.moduleKey} · {timeAgo(r.updatedAt)}</div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Módulos destacados */}
        <div>
          <h2 style={sectionTitle}>Atajos útiles</h2>
          <div style={{ display: "grid", gap: 6 }}>
            {[
              { href: "/calendario", icon: "📅", label: "Calendario unificado" },
              { href: "/vista-kanban", icon: "📊", label: "Vista Kanban" },
              { href: "/buscar", icon: "🔍", label: "Buscador global" },
              { href: "/importar", icon: "📥", label: "Importar Excel/CSV" },
              { href: "/integraciones", icon: "🔌", label: "Integraciones" },
              { href: "/reportes", icon: "📈", label: "Reportes" },
              { href: "/workflows", icon: "⚡", label: "Automatizaciones" },
              { href: "/mensajes", icon: "💬", label: "Mensajes internos" },
            ].map((m, i) => (
              <Link key={i} href={m.href} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 12px",
                background: "var(--bg-card, #ffffff)",
                border: "1px solid var(--border, #e5e7eb)",
                borderRadius: 8, textDecoration: "none", color: "var(--fg, #0f172a)",
                fontSize: 13,
              }}>
                <span style={{ fontSize: 16 }}>{m.icon}</span>
                <span style={{ fontWeight: 600 }}>{m.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

const sectionTitle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: "var(--fg-muted, #475569)",
  textTransform: "uppercase",
  letterSpacing: 0.5,
  margin: "0 0 10px 0",
};
