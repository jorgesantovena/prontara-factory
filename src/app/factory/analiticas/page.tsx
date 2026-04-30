"use client";

import { useEffect, useState } from "react";

type MrrByPlanRow = {
  planKey: string;
  planLabel: string;
  activeCount: number;
  mrrCents: number;
};

type MrrMonthPoint = {
  label: string;
  month: string;
  mrrCents: number;
  activeCount: number;
};

type TopTenantRow = {
  clientId: string;
  slug: string;
  displayName: string;
  planKey: string;
  status: string;
  totalPaidCents: number;
  invoiceCount: number;
};

type SubscriptionStatusBreakdown = {
  trialing: number;
  active: number;
  scheduledCancel: number;
  cancelled: number;
  pendingCheckout: number;
};

type Snapshot = {
  generatedAt: string;
  currency: "EUR";
  summary: {
    totalTenants: number;
    payingTenants: number;
    mrrCents: number;
    arrCents: number;
    churnRate30d: number;
    ltvAvgCents: number;
  };
  statusBreakdown: SubscriptionStatusBreakdown;
  mrrByPlan: MrrByPlanRow[];
  mrrTrend: MrrMonthPoint[];
  topTenants: TopTenantRow[];
};

export default function AnaliticasPage() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/factory/analiticas");
      if (res.status === 401) {
        setError("Se requiere sesión con rol admin/owner.");
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
          <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
            <h1 style={{ margin: 0, fontSize: 28, color: "#111827" }}>Analíticas</h1>
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
                {new Date(snapshot.generatedAt).toLocaleString("es")}
              </span>
            ) : null}
          </div>
          <p style={{ marginTop: 6, color: "#4b5563", fontSize: 14 }}>
            Indicadores de negocio: MRR actual y tendencia, ARR, churn, LTV medio y top tenants por ingreso acumulado.
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
            <KpiCards snapshot={snapshot} />

            <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1.5fr 1fr", marginBottom: 16 }}>
              <Card title="Tendencia de MRR — últimos 6 meses">
                <MrrTrendChart points={snapshot.mrrTrend} />
                <MrrTrendTable points={snapshot.mrrTrend} />
              </Card>
              <Card title="MRR por plan (mes actual)">
                {snapshot.mrrByPlan.length === 0 ? (
                  <EmptyNote text="Sin planes de pago activos todavía." />
                ) : (
                  <div style={{ display: "grid", gap: 10 }}>
                    {snapshot.mrrByPlan.map((r) => (
                      <div key={r.planKey}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <div>
                            <strong style={{ fontSize: 13 }}>{r.planLabel}</strong>
                            <span style={{ fontSize: 11, color: "#6b7280", marginLeft: 6 }}>
                              {r.activeCount} activos
                            </span>
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 700 }}>
                            {formatEuros(r.mrrCents)} / mes
                          </div>
                        </div>
                        <PlanBar planKey={r.planKey} mrrCents={r.mrrCents} totalCents={snapshot.summary.mrrCents} />
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>

            <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr 1fr", marginBottom: 16 }}>
              <Card title="Top 5 tenants por ingreso acumulado">
                {snapshot.topTenants.length === 0 ? (
                  <EmptyNote text="Sin facturas pagadas todavía." />
                ) : (
                  <TopTenantsTable rows={snapshot.topTenants} />
                )}
              </Card>
              <Card title="Funnel de suscripciones">
                <FunnelRows breakdown={snapshot.statusBreakdown} />
              </Card>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

// ---------- KPI cards ----------
function KpiCards({ snapshot }: { snapshot: Snapshot }) {
  const churnPct = (snapshot.summary.churnRate30d * 100).toFixed(1);
  const cards: Array<{ label: string; value: string; hint?: string; tone: "neutral" | "ok" | "warn" | "danger" }> = [
    {
      label: "MRR actual",
      value: formatEuros(snapshot.summary.mrrCents),
      hint: snapshot.summary.payingTenants + " tenants de pago",
      tone: "ok",
    },
    {
      label: "ARR",
      value: formatEuros(snapshot.summary.arrCents),
      hint: "MRR × 12",
      tone: "neutral",
    },
    {
      label: "LTV medio",
      value: formatEuros(snapshot.summary.ltvAvgCents),
      hint: "Sobre tenants con pago > 0",
      tone: "neutral",
    },
    {
      label: "Churn 30d",
      value: churnPct + " %",
      hint: "Cancelaciones sobre activos al inicio",
      tone:
        snapshot.summary.churnRate30d > 0.1
          ? "danger"
          : snapshot.summary.churnRate30d > 0.05
            ? "warn"
            : "ok",
    },
    {
      label: "Tenants totales",
      value: String(snapshot.summary.totalTenants),
      tone: "neutral",
    },
  ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 12,
        marginBottom: 18,
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
            padding: 14,
          }}
        >
          <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 500 }}>{c.label}</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: toneColor(c.tone), marginTop: 2 }}>
            {c.value}
          </div>
          {c.hint ? <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{c.hint}</div> : null}
        </div>
      ))}
    </div>
  );
}

// ---------- MRR Trend chart ----------
function MrrTrendChart({ points }: { points: MrrMonthPoint[] }) {
  if (points.length === 0) {
    return <EmptyNote text="Sin datos históricos todavía." />;
  }

  const maxCents = Math.max(1, ...points.map((p) => p.mrrCents));
  const width = 620;
  const height = 180;
  const paddingX = 32;
  const paddingY = 24;
  const innerW = width - 2 * paddingX;
  const innerH = height - 2 * paddingY;

  const x = (i: number) =>
    points.length <= 1 ? paddingX + innerW / 2 : paddingX + (i * innerW) / (points.length - 1);
  const y = (cents: number) => paddingY + innerH - (cents / maxCents) * innerH;

  const pathD = points
    .map((p, i) => (i === 0 ? "M" : "L") + x(i).toFixed(1) + " " + y(p.mrrCents).toFixed(1))
    .join(" ");

  const areaD =
    "M " +
    x(0).toFixed(1) +
    " " +
    (paddingY + innerH).toFixed(1) +
    " " +
    points.map((p, i) => "L" + x(i).toFixed(1) + " " + y(p.mrrCents).toFixed(1)).join(" ") +
    " L" +
    x(points.length - 1).toFixed(1) +
    " " +
    (paddingY + innerH).toFixed(1) +
    " Z";

  return (
    <svg width="100%" viewBox={"0 0 " + width + " " + height} style={{ display: "block" }}>
      <defs>
        <linearGradient id="mrrGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1d4ed8" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <line
          key={f}
          x1={paddingX}
          x2={width - paddingX}
          y1={paddingY + innerH * (1 - f)}
          y2={paddingY + innerH * (1 - f)}
          stroke="#e5e7eb"
          strokeDasharray="2 3"
        />
      ))}
      <path d={areaD} fill="url(#mrrGrad)" />
      <path d={pathD} stroke="#1d4ed8" strokeWidth={2} fill="none" />
      {points.map((p, i) => (
        <g key={p.month}>
          <circle cx={x(i)} cy={y(p.mrrCents)} r={3} fill="#1d4ed8" />
          <text
            x={x(i)}
            y={height - 6}
            fontSize={10}
            fill="#6b7280"
            textAnchor="middle"
          >
            {p.label}
          </text>
        </g>
      ))}
      <text x={paddingX} y={paddingY - 6} fontSize={10} fill="#6b7280">
        {formatEuros(maxCents)}
      </text>
    </svg>
  );
}

function MrrTrendTable({ points }: { points: MrrMonthPoint[] }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginTop: 10 }}>
      <thead>
        <tr>
          <th style={thSmall()}>Mes</th>
          <th style={thSmall()} align="right">Activos</th>
          <th style={thSmall()} align="right">MRR</th>
        </tr>
      </thead>
      <tbody>
        {points.map((p) => (
          <tr key={p.month} style={{ borderTop: "1px solid #f3f4f6" }}>
            <td style={tdSmall()}>{p.label}</td>
            <td style={tdSmall()} align="right">{p.activeCount}</td>
            <td style={tdSmall()} align="right">{formatEuros(p.mrrCents)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ---------- Plan bar ----------
function PlanBar({
  planKey,
  mrrCents,
  totalCents,
}: {
  planKey: string;
  mrrCents: number;
  totalCents: number;
}) {
  const pct = totalCents === 0 ? 0 : Math.max(2, (mrrCents / totalCents) * 100);
  const color = planColor(planKey);
  return (
    <div
      style={{
        height: 8,
        background: "#f3f4f6",
        borderRadius: 999,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: "100%",
          width: pct + "%",
          background: color,
        }}
      />
    </div>
  );
}

function planColor(planKey: string): string {
  return (
    { trial: "#9ca3af", starter: "#0ea5e9", growth: "#1d4ed8", pro: "#7c3aed" }[planKey] ||
    "#6b7280"
  );
}

// ---------- Top tenants ----------
function TopTenantsTable({ rows }: { rows: TopTenantRow[] }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
      <thead>
        <tr>
          <th style={thSmall()}>Tenant</th>
          <th style={thSmall()}>Plan</th>
          <th style={thSmall()} align="right">Facturas</th>
          <th style={thSmall()} align="right">Total</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.clientId} style={{ borderTop: "1px solid #f3f4f6" }}>
            <td style={tdSmall()}>
              <a
                href={"/factory/client/" + encodeURIComponent(r.clientId)}
                style={{ color: "#1d4ed8", textDecoration: "none" }}
              >
                <strong>{r.displayName}</strong>
              </a>
              <div style={{ fontSize: 11, color: "#6b7280" }}>
                <code>{r.slug}</code>
              </div>
            </td>
            <td style={tdSmall()}>
              <span
                style={{
                  background: planColor(r.planKey) + "22",
                  color: planColor(r.planKey),
                  padding: "2px 8px",
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                {r.planKey}
              </span>
            </td>
            <td style={tdSmall()} align="right">{r.invoiceCount}</td>
            <td style={tdSmall()} align="right">
              <strong>{formatEuros(r.totalPaidCents)}</strong>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ---------- Funnel ----------
function FunnelRows({ breakdown }: { breakdown: SubscriptionStatusBreakdown }) {
  const rows: Array<{ label: string; count: number; color: string }> = [
    { label: "Trialing", count: breakdown.trialing, color: "#9ca3af" },
    { label: "Active", count: breakdown.active, color: "#1d4ed8" },
    { label: "Scheduled cancel", count: breakdown.scheduledCancel, color: "#d97706" },
    { label: "Cancelled", count: breakdown.cancelled, color: "#991b1b" },
    { label: "Pending checkout", count: breakdown.pendingCheckout, color: "#7c3aed" },
  ];
  const max = Math.max(1, ...rows.map((r) => r.count));

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {rows.map((r) => (
        <div key={r.label}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
            <span style={{ color: "#374151", fontWeight: 600 }}>{r.label}</span>
            <span style={{ color: "#111827", fontWeight: 700 }}>{r.count}</span>
          </div>
          <div style={{ height: 8, background: "#f3f4f6", borderRadius: 999, overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                width: (r.count / max) * 100 + "%",
                background: r.color,
                minWidth: r.count > 0 ? "2%" : 0,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------- Shared primitives ----------
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 16,
        padding: 18,
      }}
    >
      <h2 style={{ margin: 0, marginBottom: 12, fontSize: 15, color: "#111827" }}>{title}</h2>
      {children}
    </section>
  );
}

function EmptyNote({ text }: { text: string }) {
  return <div style={{ fontSize: 13, color: "#6b7280" }}>{text}</div>;
}

function thSmall(): React.CSSProperties {
  return {
    fontSize: 11,
    fontWeight: 700,
    color: "#374151",
    padding: "6px 8px",
    textAlign: "left",
  };
}

function tdSmall(): React.CSSProperties {
  return { padding: "6px 8px", color: "#111827" };
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

function formatEuros(cents: number): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}
