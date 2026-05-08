"use client";

import { useEffect, useState } from "react";

/**
 * Página /factory/metricas (H2-METRICS).
 *
 * Snapshot operativo del SaaS para el operador: total tenants, MRR,
 * conversión, churn, distribución por vertical.
 */
type Metrics = {
  totalTenants: number;
  tenantsByStatus: Record<string, number>;
  trialActivos: number;
  mrrEstimadoEur: number;
  nuevosUltimos30Dias: number;
  cancelados30Dias: number;
  churnRate30Dias: number;
  tenantsByVertical: Record<string, number>;
  generatedAt: string;
};

export default function MetricasPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/factory/metrics", { cache: "no-store" });
      const data = await r.json();
      if (r.ok && data.ok) setMetrics(data as Metrics);
      else setError(data.error || "Error.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: 24, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, color: "#0f172a", margin: "0 0 4px 0" }}>
        Métricas SaaS
      </h1>
      <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 24 }}>
        {metrics ? "Actualizadas " + new Date(metrics.generatedAt).toLocaleString("es-ES") : "Cargando…"}
      </p>

      {error ? (
        <div style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 13 }}>
          {error}
        </div>
      ) : null}
      {loading ? <p>Cargando métricas…</p> : null}

      {metrics ? (
        <>
          <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 24 }}>
            <Kpi label="Total tenants" value={String(metrics.totalTenants)} accent="#1d4ed8" />
            <Kpi label="MRR estimado" value={metrics.mrrEstimadoEur.toFixed(2) + " €"} accent="#16a34a" />
            <Kpi label="Trials activos" value={String(metrics.trialActivos)} accent="#7c3aed" />
            <Kpi label="Nuevos 30d" value={String(metrics.nuevosUltimos30Dias)} accent="#0891b2" />
            <Kpi label="Cancelados 30d" value={String(metrics.cancelados30Dias)} accent="#dc2626" />
            <Kpi label="Churn 30d" value={metrics.churnRate30Dias + "%"} accent={metrics.churnRate30Dias > 5 ? "#dc2626" : "#16a34a"} />
          </section>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <Card title="Tenants por estado">
              {Object.entries(metrics.tenantsByStatus).map(([k, v]) => (
                <Row key={k} label={k} value={String(v)} />
              ))}
            </Card>
            <Card title="Tenants por vertical">
              {Object.entries(metrics.tenantsByVertical)
                .sort((a, b) => b[1] - a[1])
                .map(([k, v]) => (
                  <Row key={k} label={k} value={String(v)} />
                ))}
            </Card>
          </div>
        </>
      ) : null}
    </main>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 14, background: "#ffffff" }}>
      <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: accent, marginTop: 4 }}>{value}</div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 18, background: "#ffffff" }}>
      <h2 style={{ fontSize: 13, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 10px 0" }}>{title}</h2>
      <div style={{ display: "grid", gap: 6 }}>{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f3f4f6", fontSize: 14 }}>
      <span style={{ color: "#475569" }}>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
