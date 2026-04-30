"use client";

import { useEffect, useState } from "react";

type PackPreview = {
  key: string;
  label: string;
  businessType: string;
  sector: string;
  description: string;
};

type RuntimePreview = {
  displayName: string;
  sector: string;
  businessType: string;
  labels: Record<string, string>;
  branding: {
    displayName: string;
    accentColor: string;
    logoHint: string;
    tone: string;
  };
  landing: {
    headline: string;
    subheadline: string;
    bullets: string[];
    cta: string;
  } | null;
  assistantCopy: {
    welcome: string;
    suggestion: string;
  } | null;
  entities: Array<{
    key: string;
    label: string;
    moduleKey: string;
  }>;
};

export default function VerticalesPage() {
  const [packs, setPacks] = useState<PackPreview[]>([]);
  const [selectedPack, setSelectedPack] = useState("software-factory");
  const [runtimePreview, setRuntimePreview] = useState<RuntimePreview | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadAll() {
      setBusy(true);
      setError("");

      try {
        const packResponse = await fetch("/api/factory/sector-pack", { cache: "no-store" });
        const packData = await packResponse.json();

        if (!packResponse.ok || !packData.ok) {
          throw new Error(packData.error || "No se pudieron cargar los packs.");
        }

        const nextPacks = Array.isArray(packData.preview?.availablePacks)
          ? packData.preview.availablePacks
          : [];

        if (!cancelled) {
          setPacks(nextPacks);
          if (!selectedPack && nextPacks[0]) {
            setSelectedPack(String(nextPacks[0].key || ""));
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "No se pudieron cargar los packs.");
        }
      } finally {
        if (!cancelled) {
          setBusy(false);
        }
      }
    }

    loadAll();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadPreview() {
      if (!selectedPack) {
        return;
      }

      try {
        const response = await fetch(
          "/api/runtime/sector-preview?sectorPack=" + encodeURIComponent(selectedPack),
          { cache: "no-store" }
        );
        const data = await response.json();

        if (!cancelled && response.ok && data.ok) {
          setRuntimePreview(data.preview || null);
        }
      } catch {
      }
    }

    loadPreview();

    return () => {
      cancelled = true;
    };
  }, [selectedPack]);

  return (
    <main
      style={{
        padding: 24,
        display: "grid",
        gap: 24,
        fontFamily: "Arial, sans-serif",
        background: "#f8fafc",
      }}
    >
      <section
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 16,
          background: "#ffffff",
          padding: 20,
        }}
      >
        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>
          Fase 10
        </div>
        <h1 style={{ marginTop: 0, marginBottom: 10, fontSize: 30 }}>
          Verticales conectados al runtime real
        </h1>
        <p style={{ margin: 0, color: "#4b5563", maxWidth: 940 }}>
          Aquí ya puedes revisar cómo cada pack sectorial impacta en labels, renameMap,
          entidades, formularios, tablas, dashboard, demo data, landing, branding y copy del asistente.
        </p>
      </section>

      {busy ? (
        <section
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 16,
            background: "#ffffff",
            padding: 20,
          }}
        >
          Cargando verticales...
        </section>
      ) : (
        <>
          <section
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 16,
              background: "#ffffff",
              padding: 20,
              display: "grid",
              gap: 12,
            }}
          >
            <h2 style={{ marginTop: 0 }}>Selecciona vertical</h2>

            <select
              value={selectedPack}
              onChange={(event) => setSelectedPack(event.target.value)}
              style={{
                maxWidth: 360,
                padding: "10px 12px",
                border: "1px solid #d1d5db",
                borderRadius: 10,
              }}
            >
              {packs.map((pack) => (
                <option key={pack.key} value={pack.key}>
                  {pack.label}
                </option>
              ))}
            </select>
          </section>

          {runtimePreview ? (
            <>
              <section
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 16,
                }}
              >
                <article style={{ border: "1px solid #e5e7eb", borderRadius: 16, background: "#ffffff", padding: 16 }}>
                  <strong>Display name</strong>
                  <div>{runtimePreview.displayName}</div>
                </article>
                <article style={{ border: "1px solid #e5e7eb", borderRadius: 16, background: "#ffffff", padding: 16 }}>
                  <strong>Sector</strong>
                  <div>{runtimePreview.sector}</div>
                </article>
                <article style={{ border: "1px solid #e5e7eb", borderRadius: 16, background: "#ffffff", padding: 16 }}>
                  <strong>Business type</strong>
                  <div>{runtimePreview.businessType}</div>
                </article>
                <article style={{ border: "1px solid #e5e7eb", borderRadius: 16, background: "#ffffff", padding: 16 }}>
                  <strong>Tono</strong>
                  <div>{runtimePreview.branding.tone}</div>
                </article>
              </section>

              <section
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(320px, 1fr) minmax(320px, 1fr)",
                  gap: 24,
                  alignItems: "start",
                }}
              >
                <article style={{ border: "1px solid #e5e7eb", borderRadius: 16, background: "#ffffff", padding: 20, display: "grid", gap: 10 }}>
                  <h2 style={{ marginTop: 0 }}>Labels aplicados</h2>
                  {Object.entries(runtimePreview.labels || {}).map(([key, value]) => (
                    <div
                      key={key}
                      style={{
                        border: "1px solid #eef2f7",
                        borderRadius: 12,
                        background: "#fafafa",
                        padding: 12,
                      }}
                    >
                      <strong>{key}</strong>: {value}
                    </div>
                  ))}
                </article>

                <article style={{ border: "1px solid #e5e7eb", borderRadius: 16, background: "#ffffff", padding: 20, display: "grid", gap: 10 }}>
                  <h2 style={{ marginTop: 0 }}>Branding y asistente</h2>
                  <div><strong>Color:</strong> {runtimePreview.branding.accentColor}</div>
                  <div><strong>Logo hint:</strong> {runtimePreview.branding.logoHint}</div>
                  <div><strong>Welcome:</strong> {runtimePreview.assistantCopy?.welcome || "-"}</div>
                  <div><strong>Suggestion:</strong> {runtimePreview.assistantCopy?.suggestion || "-"}</div>
                </article>
              </section>

              <section
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(320px, 1fr) minmax(320px, 1fr)",
                  gap: 24,
                  alignItems: "start",
                }}
              >
                <article style={{ border: "1px solid #e5e7eb", borderRadius: 16, background: "#ffffff", padding: 20, display: "grid", gap: 10 }}>
                  <h2 style={{ marginTop: 0 }}>Landing sectorial</h2>
                  {runtimePreview.landing ? (
                    <>
                      <div><strong>Headline:</strong> {runtimePreview.landing.headline}</div>
                      <div><strong>Subheadline:</strong> {runtimePreview.landing.subheadline}</div>
                      <div><strong>CTA:</strong> {runtimePreview.landing.cta}</div>
                      <ul style={{ margin: 0, paddingLeft: 18 }}>
                        {runtimePreview.landing.bullets.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <div style={{ color: "#6b7280" }}>No hay landing sectorial aplicada.</div>
                  )}
                </article>

                <article style={{ border: "1px solid #e5e7eb", borderRadius: 16, background: "#ffffff", padding: 20, display: "grid", gap: 10 }}>
                  <h2 style={{ marginTop: 0 }}>Entidades propias</h2>
                  {runtimePreview.entities.map((entity) => (
                    <div
                      key={entity.key}
                      style={{
                        border: "1px solid #eef2f7",
                        borderRadius: 12,
                        background: "#fafafa",
                        padding: 12,
                      }}
                    >
                      <strong>{entity.label}</strong> · {entity.moduleKey}
                    </div>
                  ))}
                </article>
              </section>
            </>
          ) : null}
        </>
      )}

      {error ? (
        <section
          style={{
            border: "1px solid #fecaca",
            background: "#fef2f2",
            color: "#991b1b",
            borderRadius: 12,
            padding: 12,
          }}
        >
          {error}
        </section>
      ) : null}
    </main>
  );
}