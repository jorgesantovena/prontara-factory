"use client";

import { useEffect, useState } from "react";
import FactoryShell from "@/components/factory/factory-shell";

type VerticalSummary = {
  key: string;
  label: string;
  sector: string;
  businessType: string;
  description: string;
  accentColor: string;
  displayName: string;
  moduleCount: number;
  entityCount: number;
  fieldCount: number;
  hasOverride: boolean;
  overrideUpdatedAt: string | null;
  overrideUpdatedBy: string | null;
  baseLabel: string;
};

export default function FactoryVerticalesPage() {
  const [items, setItems] = useState<VerticalSummary[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadVerticales();
  }, []);

  async function loadVerticales() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/factory/verticales");
      if (res.status === 401) {
        setError("Se requiere sesión con rol admin/owner en la Factory.");
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Error cargando verticales.");
      }
      const data = await res.json();
      setItems(data.verticals || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error cargando verticales.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <FactoryShell>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ margin: 0, fontSize: 28, color: "#111827" }}>
            Verticales (sector packs)
          </h1>
          <p style={{ marginTop: 6, color: "#4b5563", fontSize: 14 }}>
            Cada vertical es un ERP sectorial. Pulsa una tarjeta para ver los clientes que lo tienen contratado y su estado de suscripción.
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

        {busy ? (
          <div style={{ color: "#6b7280", fontSize: 14 }}>Cargando…</div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: 16,
            }}
          >
            {items.map((v) => (
              <VerticalCard key={v.key} vertical={v} />
            ))}
          </div>
        )}
      </div>
    </FactoryShell>
  );
}

function VerticalCard({ vertical }: { vertical: VerticalSummary; key?: string | number }) {
  return (
    <a
      href={"/factory/verticales/" + encodeURIComponent(vertical.key)}
      style={{
        display: "block",
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: 16,
        padding: 18,
        textDecoration: "none",
        color: "inherit",
        boxShadow: "0 1px 0 rgba(17,24,39,0.04)",
      }}
    >
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: vertical.accentColor || "#1d4ed8",
            flexShrink: 0,
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5 }}>
            {vertical.sector} · {vertical.businessType}
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#111827", marginTop: 2 }}>
            {vertical.label}
          </div>
          <div style={{ fontSize: 13, color: "#4b5563", marginTop: 4, lineHeight: 1.4 }}>
            {vertical.description}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 14, marginTop: 14, fontSize: 12, color: "#6b7280" }}>
        <Stat label="Módulos" value={vertical.moduleCount} />
        <Stat label="Entidades" value={vertical.entityCount} />
        <Stat label="Campos" value={vertical.fieldCount} />
      </div>

      {vertical.hasOverride ? (
        <div
          style={{
            marginTop: 12,
            fontSize: 11,
            color: "#9a3412",
            background: "#fed7aa",
            padding: "4px 10px",
            borderRadius: 999,
            display: "inline-block",
            fontWeight: 700,
          }}
          title={
            vertical.overrideUpdatedAt
              ? "Editado el " +
                new Date(vertical.overrideUpdatedAt).toLocaleString("es") +
                (vertical.overrideUpdatedBy ? " por " + vertical.overrideUpdatedBy : "")
              : undefined
          }
        >
          ✎ con override
        </div>
      ) : (
        <div
          style={{
            marginTop: 12,
            fontSize: 11,
            color: "#6b7280",
            padding: "4px 10px",
            borderRadius: 999,
            display: "inline-block",
            fontWeight: 500,
          }}
        >
          definición base
        </div>
      )}
    </a>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 15, color: "#111827", fontWeight: 700 }}>{value}</div>
    </div>
  );
}
