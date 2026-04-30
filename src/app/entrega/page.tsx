"use client";

import { useEffect, useState } from "react";

type DeliveryPreview = {
  delivery: {
    slug: string;
    displayName: string;
    branding: {
      displayName: string;
      shortName: string;
      accentColor: string;
      logoHint: string;
      tone: string;
    };
    wrapper: {
      appName: string;
      installableName: string;
      executableName: string;
      desktopCaption: string;
      iconHint: string;
      windowTitle: string;
      accentColor: string;
      deliveryMode: string;
    };
    access: {
      accessUrl: string;
      loginUrl: string;
      firstUseUrl: string;
      deliveryUrl: string;
    };
    commercial: {
      headline: string;
      subheadline: string;
      cta: string;
      trustPoints: string[];
    };
  };
  cards: Array<{
    key: string;
    title: string;
    detail: string;
  }>;
};

function readTenant() {
  if (typeof window === "undefined") return "";
  return String(new URLSearchParams(window.location.search).get("tenant") || "").trim();
}

function readSectorPack() {
  if (typeof window === "undefined") return "";
  return String(new URLSearchParams(window.location.search).get("sectorPack") || "").trim();
}

export default function EntregaPage() {
  const [preview, setPreview] = useState<DeliveryPreview | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setBusy(true);
      setError("");

      try {
        const tenant = readTenant();
        const sectorPack = readSectorPack();
        const url =
          "/api/runtime/delivery-preview" +
          (tenant || sectorPack
            ? "?" +
              [
                tenant ? "tenant=" + encodeURIComponent(tenant) : "",
                sectorPack ? "sectorPack=" + encodeURIComponent(sectorPack) : "",
              ]
                .filter(Boolean)
                .join("&")
            : "");

        const response = await fetch(url, { cache: "no-store" });
        const data = await response.json();

        if (!response.ok || !data.ok) {
          throw new Error(data.error || "No se pudo cargar la entrega.");
        }

        if (!cancelled) {
          setPreview(data.preview || null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "No se pudo cargar la entrega.");
        }
      } finally {
        if (!cancelled) {
          setBusy(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const accent = preview?.delivery.branding.accentColor || "#111827";

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        fontFamily: "Arial, sans-serif",
        padding: 24,
        display: "grid",
        gap: 24,
      }}
    >
      <section
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 18,
          background: "#ffffff",
          padding: 24,
          display: "grid",
          gap: 12,
        }}
      >
        <div style={{ fontSize: 12, color: "#6b7280" }}>Entrega comercial</div>
        <h1 style={{ marginTop: 0, marginBottom: 8, fontSize: 32 }}>
          Entorno listo para entregar
        </h1>
        <p style={{ margin: 0, color: "#4b5563" }}>
          Esta pantalla resume la experiencia final que recibe el cliente.
        </p>
      </section>

      {busy ? (
        <section
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 18,
            background: "#ffffff",
            padding: 24,
          }}
        >
          Cargando entrega...
        </section>
      ) : null}

      {preview ? (
        <>
          <section
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(320px, 1fr) minmax(320px, 1fr)",
              gap: 24,
              alignItems: "start",
            }}
          >
            <article
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 18,
                background: "#ffffff",
                padding: 22,
                display: "grid",
                gap: 10,
              }}
            >
              <h2 style={{ marginTop: 0 }}>Branding final</h2>
              <div><strong>Display name:</strong> {preview.delivery.branding.displayName}</div>
              <div><strong>Short name:</strong> {preview.delivery.branding.shortName}</div>
              <div><strong>Accent color:</strong> {preview.delivery.branding.accentColor}</div>
              <div><strong>Logo hint:</strong> {preview.delivery.branding.logoHint}</div>
              <div><strong>Tono:</strong> {preview.delivery.branding.tone}</div>

              <div
                style={{
                  marginTop: 8,
                  borderRadius: 14,
                  padding: 16,
                  background: accent + "15",
                  color: accent,
                  fontWeight: 700,
                }}
              >
                Vista comercial: {preview.delivery.branding.displayName}
              </div>
            </article>

            <article
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 18,
                background: "#ffffff",
                padding: 22,
                display: "grid",
                gap: 10,
              }}
            >
              <h2 style={{ marginTop: 0 }}>Wrapper e instalable</h2>
              <div><strong>App:</strong> {preview.delivery.wrapper.appName}</div>
              <div><strong>Instalable:</strong> {preview.delivery.wrapper.installableName}</div>
              <div><strong>Ejecutable:</strong> {preview.delivery.wrapper.executableName}</div>
              <div><strong>Desktop caption:</strong> {preview.delivery.wrapper.desktopCaption}</div>
              <div><strong>Window title:</strong> {preview.delivery.wrapper.windowTitle}</div>
              <div><strong>Icon hint:</strong> {preview.delivery.wrapper.iconHint}</div>
            </article>
          </section>

          <section
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 18,
              background: "#ffffff",
              padding: 22,
              display: "grid",
              gap: 12,
            }}
          >
            <h2 style={{ marginTop: 0 }}>Acceso y entrega</h2>
            <div><strong>Acceso:</strong> {preview.delivery.access.accessUrl}</div>
            <div><strong>Login:</strong> {preview.delivery.access.loginUrl}</div>
            <div><strong>Primer acceso:</strong> {preview.delivery.access.firstUseUrl}</div>
            <div><strong>Entrega:</strong> {preview.delivery.access.deliveryUrl}</div>
          </section>

          <section
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 16,
            }}
          >
            {preview.cards.map((card) => (
              <article
                key={card.key}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 16,
                  background: "#ffffff",
                  padding: 18,
                  display: "grid",
                  gap: 8,
                }}
              >
                <strong>{card.title}</strong>
                <div style={{ color: "#4b5563" }}>{card.detail}</div>
              </article>
            ))}
          </section>
        </>
      ) : null}

      {error ? (
        <section
          style={{
            border: "1px solid #fecaca",
            borderRadius: 12,
            background: "#fef2f2",
            color: "#991b1b",
            padding: 12,
          }}
        >
          {error}
        </section>
      ) : null}
    </main>
  );
}