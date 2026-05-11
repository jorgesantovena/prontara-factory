"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Row = {
  id: string;
  number: string;
  client: string;
  amount: number;
  amountText: string;
  state: string;
  daysStale: number;
  updatedAt: string;
};

export default function PropuestasEstancadasPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        "/api/software-factory/operational-lists?kind=propuestas-estancadas",
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Error cargando.");
      }
      const data = await res.json();
      setRows(data.rows || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error cargando.");
    } finally {
      setBusy(false);
    }
  }

  const totalAmount = rows.reduce((acc, r) => acc + r.amount, 0);
  const totalAmountText = totalAmount.toLocaleString("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        padding: "32px 40px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>
            <Link href="/software-factory" style={{ color: "#6b7280", textDecoration: "none" }}>
              ← Software Factory
            </Link>
          </div>
          <h1 style={{ margin: 0, fontSize: 26, color: "#111827" }}>Propuestas estancadas</h1>
          <p style={{ marginTop: 6, color: "#4b5563", fontSize: 14 }}>
            Presupuestos abiertos sin movimiento desde hace ≥ 14 días. Cada día que pasa baja las probabilidades de cierre; haz seguimiento esta semana o marca como perdida para limpiar el pipeline.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
          <SummaryCard
            count={rows.length}
            label="propuestas estancadas"
            tone={rows.length > 0 ? "warn" : "ok"}
          />
          <SummaryCard
            count={totalAmountText}
            label="valor en suspenso"
            tone={rows.length > 0 ? "warn" : "ok"}
          />
        </div>

        {error ? <Banner tone="danger" text={error} /> : null}

        {busy ? (
          <Loading />
        ) : rows.length === 0 ? (
          <EmptyBox text="Ninguna propuesta estancada. Buen ritmo comercial." />
        ) : (
          <DataTable
            headers={["Nº", "Cliente", "Importe", "Estado", "Sin mover"]}
            rows={rows.map((r) => [
              <code key="n" style={{ fontSize: 12 }}>{r.number}</code>,
              r.client,
              <strong key="a">{r.amountText}</strong>,
              <Badge tone={r.daysStale > 30 ? "danger" : "warn"} text={r.state} />,
              <span
                key="d"
                style={{
                  fontWeight: 700,
                  color: r.daysStale > 30 ? "#991b1b" : "#92400e",
                }}
              >
                {r.daysStale} d
              </span>,
            ])}
            actionHref="/presupuestos"
            actionLabel="Ir a Presupuestos"
          />
        )}
      </div>
    </main>
  );
}

function SummaryCard({
  count,
  label,
  tone,
}: {
  count: number | string;
  label: string;
  tone: "ok" | "warn" | "danger";
}) {
  const palette = {
    ok: { bg: "#f0fdf4", border: "#bbf7d0", color: "#166534" },
    warn: { bg: "#fffbeb", border: "#fde68a", color: "#92400e" },
    danger: { bg: "#fef2f2", border: "#fecaca", color: "#991b1b" },
  }[tone];
  return (
    <div
      style={{
        border: "1px solid " + palette.border,
        background: palette.bg,
        borderRadius: 12,
        padding: 14,
        display: "flex",
        alignItems: "baseline",
        gap: 10,
      }}
    >
      <div style={{ fontSize: 22, fontWeight: 700, color: palette.color }}>{count}</div>
      <div style={{ fontSize: 13, color: palette.color }}>{label}</div>
    </div>
  );
}

function DataTable({
  headers,
  rows,
  actionHref,
  actionLabel,
}: {
  headers: string[];
  rows: Array<Array<string | React.ReactNode>>;
  actionHref: string;
  actionLabel: string;
}) {
  return (
    <>
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              {headers.map((h) => (
                <th key={h} style={thStyle()}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((cells, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #f3f4f6" }}>
                {cells.map((c, j) => (
                  <td key={j} style={tdStyle()}>
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 12 }}>
        <Link href={actionHref} style={actionLinkStyle()}>
          {actionLabel} →
        </Link>
      </div>
    </>
  );
}

function thStyle(): React.CSSProperties {
  return {
    textAlign: "left",
    padding: "10px 12px",
    background: "#f9fafb",
    fontSize: 11,
    fontWeight: 700,
    color: "#374151",
    borderBottom: "1px solid #e5e7eb",
  };
}

function tdStyle(): React.CSSProperties {
  return { padding: "10px 12px", color: "#111827", verticalAlign: "top" };
}

function actionLinkStyle(): React.CSSProperties {
  return {
    display: "inline-block",
    padding: "10px 14px",
    border: "1px solid #bfdbfe",
    borderRadius: 10,
    background: "#eff6ff",
    color: "#1d4ed8",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 700,
  };
}

function Badge({
  tone,
  text,
}: {
  tone: "ok" | "warn" | "danger" | "info";
  text: string;
}) {
  const palette = {
    ok: { bg: "#dcfce7", fg: "#166534" },
    warn: { bg: "#fef3c7", fg: "#92400e" },
    danger: { bg: "#fee2e2", fg: "#991b1b" },
    info: { bg: "#dbeafe", fg: "#1e40af" },
  }[tone];
  return (
    <span
      style={{
        background: palette.bg,
        color: palette.fg,
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
      }}
    >
      {text}
    </span>
  );
}

function Banner({ tone, text }: { tone: "ok" | "danger" | "info"; text: string }) {
  const palette = {
    ok: { bg: "#f0fdf4", border: "#bbf7d0", color: "#166534" },
    danger: { bg: "#fef2f2", border: "#fecaca", color: "#991b1b" },
    info: { bg: "#eff6ff", border: "#bfdbfe", color: "#1d4ed8" },
  }[tone];
  return (
    <div
      style={{
        border: "1px solid " + palette.border,
        background: palette.bg,
        color: palette.color,
        padding: "10px 14px",
        borderRadius: 12,
        fontSize: 13,
        marginBottom: 14,
      }}
    >
      {text}
    </div>
  );
}

function Loading() {
  return <div style={{ color: "#6b7280", fontSize: 14 }}>Cargando…</div>;
}

function EmptyBox({ text }: { text: string }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 14,
        color: "#6b7280",
        fontSize: 13,
      }}
    >
      {text}
    </div>
  );
}
