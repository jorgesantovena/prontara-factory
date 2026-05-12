"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import TenantShell from "@/components/erp/tenant-shell";
import { useCurrentVertical } from "@/lib/saas/use-current-vertical";

/**
 * Página de listado del CAU (H15-B) — específica para Software Factory.
 *
 * Diferencias con el genérico:
 *   - KPIs SLA arriba: abiertos / vencidos SLA / MTR / SLA compliance %
 *   - Vistas guardadas: "Mis tickets", "Sin asignar", "Vencidos SLA",
 *     "Esperando cliente"
 *   - Indicador SLA por fila (bullet verde/amarillo/rojo)
 *   - Click en fila → /cau/[id] (ficha con timeline)
 */

type Ticket = Record<string, string> & {
  id: string;
  slaStatus?: "ok" | "warning" | "breached" | "resolved";
  slaBreached?: boolean;
};

type Metrics = {
  totalTickets: number;
  resolvedCount: number;
  openCount: number;
  mtrHours: number | null;
  slaCompliancePct: number | null;
  breachedOpenCount: number;
};

type View = { key: string; label: string; filter: (t: Ticket, currentEmail: string) => boolean };

const VIEWS: View[] = [
  { key: "all", label: "Todos", filter: () => true },
  { key: "open", label: "Abiertos", filter: (t) => !["resuelto", "cerrado"].includes(String(t.estado || "").toLowerCase()) },
  { key: "mine", label: "Mis tickets", filter: (t, email) => String(t.asignado || "").toLowerCase() === email.toLowerCase() },
  { key: "unassigned", label: "Sin asignar", filter: (t) => !String(t.asignado || "").trim() },
  { key: "sla-breached", label: "Vencidos SLA", filter: (t) => t.slaStatus === "breached" },
  { key: "waiting", label: "Esperando cliente", filter: (t) => String(t.estado || "").toLowerCase() === "esperando" },
];

const SLA_COLOR: Record<string, string> = {
  ok: "#22c55e",
  warning: "#eab308",
  breached: "#dc2626",
  resolved: "#94a3b8",
};

export default function CauListPage() {
  const { link } = useCurrentVertical();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [view, setView] = useState<string>("open");
  const [search, setSearch] = useState("");
  const [currentEmail, setCurrentEmail] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/runtime/session", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
      fetch("/api/runtime/cau/metrics", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
    ]).then(([s, m]) => {
      if (s?.ok && s.session?.email) setCurrentEmail(String(s.session.email));
      if (m?.ok) {
        setTickets(m.tickets || []);
        setMetrics(m.metrics || null);
      }
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => {
    const f = VIEWS.find((v) => v.key === view)?.filter || (() => true);
    const q = search.trim().toLowerCase();
    return tickets.filter((t) => {
      if (!f(t, currentEmail)) return false;
      if (q && !Object.values(t).join(" ").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [tickets, view, search, currentEmail]);

  return (
    <TenantShell>
      <div style={{ maxWidth: 1320, margin: "0 auto", fontFamily: "system-ui, -apple-system, sans-serif", color: "#0f172a" }}>
        {/* Breadcrumb */}
        <div style={{ fontSize: 13, color: "#64748b", marginBottom: 6 }}>
          <Link href={link("")} style={{ color: "#64748b", textDecoration: "none" }}>Inicio</Link>
          <span style={{ margin: "0 6px" }}>/</span>
          <span style={{ color: "#0f172a", fontWeight: 600 }}>CAU</span>
        </div>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 18, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: "0 0 4px 0", fontSize: 28, fontWeight: 800, letterSpacing: -0.4 }}>CAU — Centro de Atención al Usuario</h1>
            <div style={{ fontSize: 13, color: "#64748b" }}>
              Tickets de soporte de tus clientes sobre las aplicaciones que mantienes.
            </div>
          </div>
          <Link href={link("kb")} style={btnSec}>📚 Base de conocimiento</Link>
        </div>

        {/* KPIs SLA */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 18 }}>
          <KpiCard label="Tickets abiertos" value={String(metrics?.openCount ?? "—")} tone="neutral" icon="🎫" />
          <KpiCard
            label="Vencidos SLA"
            value={String(metrics?.breachedOpenCount ?? "—")}
            tone={(metrics?.breachedOpenCount || 0) > 0 ? "bad" : "good"}
            icon="⚠️"
          />
          <KpiCard
            label="MTR (horas)"
            value={metrics?.mtrHours != null ? metrics.mtrHours.toFixed(1) + " h" : "—"}
            tone="neutral" icon="⏱️"
          />
          <KpiCard
            label="SLA compliance"
            value={metrics?.slaCompliancePct != null ? metrics.slaCompliancePct.toFixed(0) + "%" : "—"}
            tone={
              metrics?.slaCompliancePct == null ? "neutral"
                : metrics.slaCompliancePct >= 90 ? "good"
                : metrics.slaCompliancePct >= 70 ? "warn"
                : "bad"
            }
            icon="🎯"
          />
        </div>

        {/* Vistas + buscador */}
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
          <div style={{ display: "flex", gap: 4, padding: 4, background: "#f1f5f9", borderRadius: 10 }}>
            {VIEWS.map((v) => (
              <button key={v.key} type="button" onClick={() => setView(v.key)}
                style={{
                  padding: "6px 14px", border: "none", borderRadius: 6, cursor: "pointer",
                  background: view === v.key ? "#ffffff" : "transparent",
                  color: view === v.key ? "#1d4ed8" : "#475569",
                  fontWeight: view === v.key ? 700 : 600,
                  fontSize: 12, boxShadow: view === v.key ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                }}>
                {v.label} <span style={{ color: "#94a3b8", marginLeft: 4 }}>{tickets.filter((t) => v.filter(t, currentEmail)).length}</span>
              </button>
            ))}
          </div>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar asunto, cliente, aplicación…"
            style={{
              flex: 1, minWidth: 200, padding: "8px 12px", border: "1px solid #e2e8f0",
              borderRadius: 8, fontSize: 13, outline: "none",
            }} />
        </div>

        {/* Tabla */}
        <section style={{ border: "1px solid #e5e7eb", borderRadius: 12, background: "#ffffff", overflow: "hidden" }}>
          {loading ? (
            <div style={{ padding: 60, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>Cargando…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 60, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
              Ningún ticket en esta vista.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e5e7eb" }}>
                    <th style={th}>SLA</th>
                    <th style={th}>Asunto</th>
                    <th style={th}>Cliente</th>
                    <th style={th}>Aplicación</th>
                    <th style={th}>Severidad</th>
                    <th style={th}>Urgencia</th>
                    <th style={th}>Asignado</th>
                    <th style={th}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t) => (
                    <tr key={t.id} style={{ borderBottom: "1px solid #f1f5f9", cursor: "pointer" }}
                      onClick={() => { window.location.href = link("cau/" + t.id); }}>
                      <td style={{ ...td, width: 36 }}>
                        <span title={t.slaStatus || "—"} style={{ display: "inline-block", width: 10, height: 10, borderRadius: 999, background: SLA_COLOR[t.slaStatus || "ok"] }} />
                      </td>
                      <td style={{ ...td, fontWeight: 600 }}>{t.asunto || "—"}</td>
                      <td style={td}>{t.cliente || "—"}</td>
                      <td style={td}>{t.aplicacion || "—"}</td>
                      <td style={td}><Pill value={t.severidad || ""} /></td>
                      <td style={td}><Pill value={t.urgencia || ""} /></td>
                      <td style={td}>{t.asignado || <span style={{ color: "#94a3b8" }}>—</span>}</td>
                      <td style={td}><Pill value={t.estado || ""} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </TenantShell>
  );
}

function KpiCard({ label, value, tone, icon }: { label: string; value: string; tone: "neutral" | "good" | "warn" | "bad"; icon: string }) {
  const tints = {
    neutral: { bg: "#dbeafe", fg: "#1d4ed8" },
    good: { bg: "#dcfce7", fg: "#15803d" },
    warn: { bg: "#fef3c7", fg: "#a16207" },
    bad: { bg: "#fee2e2", fg: "#dc2626" },
  }[tone];
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", padding: 16, background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 12 }}>
      <div style={{ width: 44, height: 44, borderRadius: 10, background: tints.bg, color: tints.fg, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{icon}</div>
      <div>
        <div style={{ fontSize: 12, color: "#64748b" }}>{label}</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", lineHeight: 1.1 }}>{value}</div>
      </div>
    </div>
  );
}

function Pill({ value }: { value: string }) {
  if (!value) return <span style={{ color: "#94a3b8" }}>—</span>;
  const k = value.toLowerCase();
  let bg = "#f1f5f9", fg = "#475569";
  if (["critica", "crítica", "urgente"].includes(k)) { bg = "#fee2e2"; fg = "#b91c1c"; }
  else if (["alta"].includes(k)) { bg = "#fef3c7"; fg = "#a16207"; }
  else if (["nuevo", "en_curso", "esperando"].includes(k)) { bg = "#dbeafe"; fg = "#1e40af"; }
  else if (["resuelto", "cerrado"].includes(k)) { bg = "#dcfce7"; fg = "#15803d"; }
  return <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 999, background: bg, color: fg, fontSize: 11, fontWeight: 700 }}>{value}</span>;
}

const th: React.CSSProperties = { textAlign: "left", padding: "12px 14px", fontWeight: 600, fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.4, whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: "10px 14px", verticalAlign: "middle" };
const btnSec: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6,
  padding: "9px 14px", border: "1px solid #e2e8f0", borderRadius: 10,
  background: "#ffffff", color: "#334155", fontSize: 13, fontWeight: 600,
  textDecoration: "none", cursor: "pointer", whiteSpace: "nowrap",
};
