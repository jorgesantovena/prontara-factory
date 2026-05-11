"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * Home Dashboard rediseñado (H12-D — según mockup limpio).
 *
 * Layout:
 *   1. Header: "Inicio" + saludo grande + fecha a la derecha
 *   2. 4 KPI cards en fila con icono pastel + número grande + delta
 *   3. Fila 3 columnas: Accesos rápidos | Pendientes | Notificaciones
 *   4. Fila 2 columnas: Actividad reciente (tabla) | Agenda de hoy
 *
 * Datos: /api/runtime/dashboard-sectorial (kpis, quickActions, alerts,
 * pending, agenda, recentActivity por vertical) + /api/factory/notifications
 * y /api/runtime/session.
 */

type Kpi = { key: string; label: string; value: string; helper: string; tone?: "neutral" | "good" | "warn" | "bad"; href?: string };
type QuickAction = { href: string; label: string; icon: string };
type Alert = { severity: "info" | "warn" | "danger"; title: string; href: string };
type PendingItem = { key: string; label: string; count: number; tone: "neutral" | "good" | "warn" | "bad"; href: string };
type AgendaItem = { time: string; title: string; subtitle: string; kind: "meeting" | "call" | "video" | "task" | "event"; href?: string };
type RecentItem = { moduleKey: string; titulo: string; updatedAt: string; userEmail?: string };
type Notification = { id: string; type: string; severity: string; title: string; message: string; readAt: string | null; createdAt: string };

type Snapshot = {
  ok: boolean;
  vertical: string;
  tenantName: string;
  kpis: Kpi[];
  quickActions: QuickAction[];
  alerts: Alert[];
  pending: PendingItem[];
  agenda: AgendaItem[];
  recentActivity: RecentItem[];
};

function saludoPorHora(now: Date): string {
  const h = now.getHours();
  if (h < 6) return "Buenas noches";
  if (h < 13) return "Buenos días";
  if (h < 21) return "Buenas tardes";
  return "Buenas noches";
}

// Colores pastel para los iconos de KPI (siguiendo orden del mockup)
const KPI_TINTS = [
  { bg: "#dbeafe", fg: "#1d4ed8" }, // azul
  { bg: "#dcfce7", fg: "#15803d" }, // verde
  { bg: "#ede9fe", fg: "#6d28d9" }, // morado
  { bg: "#ffedd5", fg: "#c2410c" }, // naranja
];

const KPI_ICONS = ["📈", "✅", "👥", "⚠️"];

// Colores para los iconos de Accesos rápidos
const QA_TINTS = [
  { bg: "#dcfce7", fg: "#15803d" },
  { bg: "#ffedd5", fg: "#c2410c" },
  { bg: "#ede9fe", fg: "#6d28d9" },
  { bg: "#fef3c7", fg: "#a16207" },
];

const PENDING_DOT: Record<PendingItem["tone"], string> = {
  good: "#22c55e",
  neutral: "#3b82f6",
  warn: "#eab308",
  bad: "#ef4444",
};

const AGENDA_DOT: Record<AgendaItem["kind"], string> = {
  meeting: "#3b82f6",
  call: "#22c55e",
  video: "#8b5cf6",
  task: "#f97316",
  event: "#06b6d4",
};

const AGENDA_ICON: Record<AgendaItem["kind"], string> = {
  meeting: "👥",
  call: "📞",
  video: "📹",
  task: "✓",
  event: "📦",
};

const MODULE_ACTION_LABEL: Record<string, string> = {
  clientes: "Cliente actualizado",
  proyectos: "Proyecto actualizado",
  facturacion: "Factura actualizada",
  presupuestos: "Propuesta actualizada",
  actividades: "Horas imputadas",
  citas: "Cita agendada",
  tareas: "Tarea actualizada",
};

function relativeTime(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso).getTime();
  if (isNaN(d)) return "";
  const diff = (Date.now() - d) / 1000;
  if (diff < 60) return "Hace " + Math.max(1, Math.floor(diff)) + "s";
  if (diff < 3600) return "Hace " + Math.floor(diff / 60) + " min";
  if (diff < 86400) return "Hace " + Math.floor(diff / 3600) + " h";
  return "Hace " + Math.floor(diff / 86400) + " d";
}

function fmtFecha(d: Date): string {
  return d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export default function HomeDashboard({ accent = "#1d4ed8" }: { accent?: string }) {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [user, setUser] = useState<{ fullName?: string; email?: string } | null>(null);
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [today] = useState(() => new Date());

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/runtime/session", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
      fetch("/api/runtime/dashboard-sectorial", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
      fetch("/api/factory/notifications?unreadOnly=false", { cache: "no-store" }).then((r) => r.ok ? r.json() : null).catch(() => null),
    ]).then(([s, d, n]) => {
      if (cancelled) return;
      if (s?.ok && s.session) setUser({ fullName: s.session.fullName, email: s.session.email });
      if (d?.ok) setSnap(d as Snapshot);
      if (n?.notifications) setNotifs(n.notifications.slice(0, 5));
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const firstName = user?.fullName?.split(/\s+/)[0] || (user?.email?.split("@")[0] || "");
  const kpis = (snap?.kpis || []).slice(0, 4);
  const quickActions = (snap?.quickActions || []).slice(0, 4);
  const pending = snap?.pending || [];
  const agenda = snap?.agenda || [];
  const recentActivity = snap?.recentActivity || [];

  return (
    <div style={{ fontFamily: "system-ui, -apple-system, sans-serif", color: "#0f172a" }}>
      {/* Breadcrumb mini "Inicio" */}
      <div style={{ fontSize: 13, color: "#64748b", marginBottom: 4 }}>Inicio</div>

      {/* Header saludo */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: "0 0 6px 0", fontSize: 28, fontWeight: 800, letterSpacing: -0.4, color: "#0f172a" }}>
            {saludoPorHora(today)}, {firstName || "tú"} <span style={{ display: "inline-block", transform: "rotate(-15deg)" }}>👋</span>
          </h1>
          <div style={{ fontSize: 14, color: "#64748b" }}>
            Esto es lo más importante de hoy.
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#64748b", fontSize: 13, paddingTop: 4, textTransform: "capitalize" }}>
          <span>📅</span>
          <span>{fmtFecha(today)}</span>
        </div>
      </div>

      {/* KPI cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginBottom: 18 }}>
        {loading && kpis.length === 0
          ? Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)
          : kpis.map((k, i) => <KpiCard key={k.key} kpi={k} index={i} accent={accent} />)}
      </div>

      {/* Fila 3 columnas: Accesos rápidos | Pendientes | Notificaciones */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1.2fr) minmax(0, 1.2fr)", gap: 14, marginBottom: 18 }} className="prontara-home-3col">
        <Card title="Accesos rápidos">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12 }}>
            {quickActions.length === 0 && loading
              ? Array.from({ length: 4 }).map((_, i) => <QaSkeleton key={i} />)
              : quickActions.map((qa, i) => <QuickActionTile key={qa.href + i} qa={qa} index={i} />)}
          </div>
        </Card>

        <Card title="Pendientes">
          {pending.length === 0 ? (
            <EmptyHint text={loading ? "Cargando…" : "Nada pendiente. ¡Bien hecho!"} />
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {pending.map((p) => (
                <Link key={p.key} href={p.href} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", textDecoration: "none", color: "#0f172a", padding: "4px 2px", fontSize: 13 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 999, background: PENDING_DOT[p.tone], flexShrink: 0 }} />
                    <span>{p.label}</span>
                  </span>
                  <span style={{ background: "#f1f5f9", color: "#475569", borderRadius: 999, padding: "2px 10px", fontSize: 11, fontWeight: 700, minWidth: 26, textAlign: "center" }}>{p.count}</span>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card title="Notificaciones" linkLabel="Ver todas" linkHref="/notificaciones" accent={accent}>
          {notifs.length === 0 ? (
            <EmptyHint text={loading ? "Cargando…" : "Sin notificaciones."} />
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {notifs.map((n) => (
                <div key={n.id} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <NotifIcon severity={n.severity} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12 }}>
                      <strong style={{ color: "#0f172a", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.title}</strong>
                      <span style={{ color: "#94a3b8", fontSize: 10, flexShrink: 0 }}>{relativeTime(n.createdAt)}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.message}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Fila 2 columnas: Actividad reciente | Agenda de hoy */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)", gap: 14 }} className="prontara-home-2col">
        <Card title="Actividad reciente" linkLabel="Ver toda la actividad" linkHref="/auditoria" accent={accent}>
          {recentActivity.length === 0 ? (
            <EmptyHint text={loading ? "Cargando…" : "Sin actividad reciente."} />
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ color: "#64748b", textAlign: "left", fontWeight: 600 }}>
                    <th style={th}>Fecha</th>
                    <th style={th}>Usuario</th>
                    <th style={th}>Acción</th>
                    <th style={th}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {recentActivity.slice(0, 5).map((r, i) => {
                    const fechaStr = r.updatedAt ? new Date(r.updatedAt).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
                    const accion = (MODULE_ACTION_LABEL[r.moduleKey] || "Actualizado") + (r.titulo ? ': "' + r.titulo + '"' : "");
                    const userLabel = r.userEmail || "Sistema";
                    return (
                      <tr key={i} style={{ borderTop: "1px solid #f1f5f9" }}>
                        <td style={td}>{fechaStr}</td>
                        <td style={td}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                            <span style={{ width: 24, height: 24, borderRadius: 999, background: "#dbeafe", color: "#1d4ed8", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700 }}>
                              {(userLabel.charAt(0) || "?").toUpperCase()}
                            </span>
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 140 }}>{userLabel}</span>
                          </span>
                        </td>
                        <td style={td}>{accion}</td>
                        <td style={td}>
                          <span style={{
                            display: "inline-block", padding: "2px 10px", borderRadius: 999,
                            background: "#dcfce7", color: "#15803d",
                            fontSize: 10, fontWeight: 700,
                          }}>Completado</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Agenda de hoy" linkLabel="Ver agenda completa" linkHref="/calendario" accent={accent}>
          {agenda.length === 0 ? (
            <EmptyHint text={loading ? "Cargando…" : "Sin eventos hoy."} />
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {agenda.map((a, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "44px 1fr 24px", alignItems: "center", gap: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>{a.time || "—"}</div>
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-start", minWidth: 0 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 999, background: AGENDA_DOT[a.kind], flexShrink: 0, marginTop: 6 }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.title}</div>
                      {a.subtitle ? <div style={{ fontSize: 11, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.subtitle}</div> : null}
                    </div>
                  </div>
                  <div style={{ color: "#94a3b8", fontSize: 14, textAlign: "right" }}>{AGENDA_ICON[a.kind]}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <style>{`
        @media (max-width: 1100px) {
          .prontara-home-3col { grid-template-columns: 1fr 1fr !important; }
          .prontara-home-2col { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 720px) {
          .prontara-home-3col { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

// === Subcomponentes ===

function Card({ title, children, linkLabel, linkHref, accent = "#1d4ed8" }: { title: string; children: React.ReactNode; linkLabel?: string; linkHref?: string; accent?: string }) {
  return (
    <section style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 14, padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{title}</h3>
        {linkLabel && linkHref ? (
          <Link href={linkHref} style={{ color: accent, fontSize: 12, fontWeight: 600, textDecoration: "none" }}>{linkLabel}</Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function KpiCard({ kpi, index, accent }: { kpi: Kpi; index: number; accent: string }) {
  const tint = KPI_TINTS[index % KPI_TINTS.length];
  const icon = KPI_ICONS[index % KPI_ICONS.length];
  const inner = (
    <div style={{
      display: "flex",
      gap: 14,
      alignItems: "flex-start",
      padding: 18,
      background: "#ffffff",
      border: "1px solid #e5e7eb",
      borderRadius: 14,
      height: "100%",
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 10,
        background: tint.bg, color: tint.fg,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        fontSize: 18, flexShrink: 0,
      }}>{icon}</div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>{kpi.label}</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", lineHeight: 1.1, marginBottom: 4 }}>{kpi.value}</div>
        <div style={{ fontSize: 11, color: kpi.tone === "bad" ? "#dc2626" : kpi.tone === "warn" ? "#a16207" : kpi.tone === "good" ? "#15803d" : "#64748b" }}>
          {kpi.helper}
        </div>
      </div>
    </div>
  );
  if (kpi.href) return <Link href={kpi.href} style={{ textDecoration: "none", color: "inherit" }} title={kpi.label}>{inner}</Link>;
  return inner;
}

function KpiSkeleton() {
  return (
    <div style={{ padding: 18, background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 14, height: 96, opacity: 0.5 }}>
      <div style={{ width: 44, height: 44, borderRadius: 10, background: "#f1f5f9" }} />
    </div>
  );
}

function QuickActionTile({ qa, index }: { qa: QuickAction; index: number }) {
  const tint = QA_TINTS[index % QA_TINTS.length];
  return (
    <Link href={qa.href} style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      padding: "20px 12px",
      border: "1px solid #e5e7eb",
      borderRadius: 12,
      background: "#ffffff",
      textDecoration: "none",
      color: "#0f172a",
      textAlign: "center",
    }}>
      <span style={{
        width: 44, height: 44, borderRadius: 12,
        background: tint.bg, color: tint.fg,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        fontSize: 20,
      }}>{qa.icon}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>{qa.label}</span>
    </Link>
  );
}

function QaSkeleton() {
  return <div style={{ padding: 20, border: "1px solid #e5e7eb", borderRadius: 12, background: "#f8fafc", height: 96 }} />;
}

function NotifIcon({ severity }: { severity: string }) {
  let bg = "#dbeafe";
  let fg = "#1d4ed8";
  let icon = "📄";
  if (severity === "warn" || severity === "warning") { bg = "#fef3c7"; fg = "#a16207"; icon = "⚠️"; }
  else if (severity === "danger" || severity === "error") { bg = "#fee2e2"; fg = "#dc2626"; icon = "🛑"; }
  else if (severity === "success" || severity === "ok") { bg = "#dcfce7"; fg = "#15803d"; icon = "✓"; }
  return (
    <span style={{
      width: 28, height: 28, borderRadius: 8, background: bg, color: fg,
      display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0,
    }}>{icon}</span>
  );
}

function EmptyHint({ text }: { text: string }) {
  return <div style={{ color: "#94a3b8", fontSize: 12, textAlign: "center", padding: "16px 8px" }}>{text}</div>;
}

const th: React.CSSProperties = { padding: "8px 10px", fontSize: 11, fontWeight: 700, color: "#64748b", borderBottom: "1px solid #f1f5f9", textTransform: "uppercase", letterSpacing: 0.4 };
const td: React.CSSProperties = { padding: "10px", color: "#334155", verticalAlign: "middle" };
