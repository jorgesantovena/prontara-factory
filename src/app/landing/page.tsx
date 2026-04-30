"use client";

import { useEffect, useState } from "react";

type CommercialLandingRule = {
  key: string;
  label: string;
  description: string;
  instruction: string;
};

type CommercialDelivery = {
  displayName: string;
  slug: string;
  branding: {
    displayName: string;
    shortName: string;
    accentColor: string;
    logoHint: string;
    tone: string;
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
    bullets: string[];
    cta: string;
    trustPoints: string[];
    demoLabel: string;
    loginLabel: string;
    installableName: string;
    wrapperWindowTitle: string;
    iconHint: string;
    logoHint: string;
    landingRules?: CommercialLandingRule[];
  };
};

function readTenant() {
  if (typeof window === "undefined") return "";
  return String(new URLSearchParams(window.location.search).get("tenant") || "").trim();
}

function readSectorPack() {
  if (typeof window === "undefined") return "";
  return String(new URLSearchParams(window.location.search).get("sectorPack") || "").trim();
}

export default function LandingPage() {
  const [delivery, setDelivery] = useState<CommercialDelivery | null>(null);
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
          "/api/runtime/commercial-package" +
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

        // Si el endpoint falla (HTML de error en lugar de JSON, o status
        // no-OK), no rompemos la landing entera — caemos a delivery=null
        // y la página renderiza con su contenido estático (mensajes,
        // sectores, FAQ...). Solo perdemos la personalización por tenant.
        if (!response.ok) {
          if (!cancelled) setDelivery(null);
          return;
        }

        let data: { ok?: boolean; error?: string; delivery?: unknown };
        try {
          data = await response.json();
        } catch {
          if (!cancelled) setDelivery(null);
          return;
        }

        if (!data.ok) {
          if (!cancelled) setDelivery(null);
          return;
        }

        if (!cancelled) {
          setDelivery((data.delivery as typeof delivery) || null);
        }
      } catch (err) {
        // Solo errores de red genuinos llegan aquí (fetch falló).
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "No se pudo cargar la landing comercial.");
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

  const accent = delivery?.branding.accentColor || "#111827";

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
      {busy ? (
        <section
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 18,
            background: "#ffffff",
            padding: 24,
          }}
        >
          Cargando landing comercial...
        </section>
      ) : delivery ? (
        <>
          <section
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 22,
              background: "#ffffff",
              padding: 28,
              display: "grid",
              gap: 18,
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                width: "fit-content",
                borderRadius: 999,
                padding: "8px 14px",
                background: accent + "18",
                color: accent,
                fontWeight: 700,
              }}
            >
              {delivery.branding.displayName}
            </div>

            <div style={{ display: "grid", gap: 12, maxWidth: 920 }}>
              <h1 style={{ margin: 0, fontSize: 44, lineHeight: 1.1 }}>
                {delivery.commercial.headline}
              </h1>
              <p style={{ margin: 0, color: "#4b5563", fontSize: 18 }}>
                {delivery.commercial.subheadline}
              </p>
            </div>

            <div
              style={{
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <a
                href={"/alta?tenant=" + encodeURIComponent(delivery.slug)}
                style={{
                  textDecoration: "none",
                  borderRadius: 12,
                  padding: "12px 16px",
                  background: accent,
                  color: "#ffffff",
                  fontWeight: 700,
                }}
              >
                {delivery.commercial.cta}
              </a>

              <a
                href={"/demo-comercial?tenant=" + encodeURIComponent(delivery.slug)}
                style={{
                  textDecoration: "none",
                  borderRadius: 12,
                  padding: "12px 16px",
                  border: "1px solid #d1d5db",
                  color: "#111827",
                  fontWeight: 700,
                  background: "#ffffff",
                }}
              >
                {delivery.commercial.demoLabel}
              </a>

              <a
                href={delivery.access.loginUrl}
                style={{
                  textDecoration: "none",
                  borderRadius: 12,
                  padding: "12px 16px",
                  border: "1px solid #d1d5db",
                  color: "#111827",
                  fontWeight: 700,
                  background: "#ffffff",
                }}
              >
                {delivery.commercial.loginLabel}
              </a>
            </div>
          </section>

          <section
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(320px, 1.1fr) minmax(320px, 0.9fr)",
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
                gap: 14,
              }}
            >
              <h2 style={{ marginTop: 0 }}>Por qué este ERP encaja</h2>
              <ul style={{ margin: 0, paddingLeft: 20, color: "#374151", display: "grid", gap: 8 }}>
                {delivery.commercial.bullets.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>

            <article
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 18,
                background: "#ffffff",
                padding: 22,
                display: "grid",
                gap: 14,
              }}
            >
              <h2 style={{ marginTop: 0 }}>Confianza y entrega</h2>
              <ul style={{ margin: 0, paddingLeft: 20, color: "#374151", display: "grid", gap: 8 }}>
                {delivery.commercial.trustPoints.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>

              <div
                style={{
                  border: "1px solid #eef2f7",
                  borderRadius: 14,
                  background: "#fafafa",
                  padding: 14,
                  display: "grid",
                  gap: 6,
                }}
              >
                <div><strong>Instalable:</strong> {delivery.commercial.installableName}</div>
                <div><strong>Ventana:</strong> {delivery.commercial.wrapperWindowTitle}</div>
                <div><strong>Icono:</strong> {delivery.commercial.iconHint}</div>
              </div>
            </article>
          </section>

          {delivery.commercial.landingRules && delivery.commercial.landingRules.length > 0 ? (
            <section
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 22,
                background: "#ffffff",
                padding: 28,
                display: "grid",
                gap: 16,
              }}
            >
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 12, color: accent, textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 700 }}>
                  Guías de narrativa sectorial
                </div>
                <h2 style={{ margin: 0, fontSize: 26 }}>Qué resaltar en esta landing según el sector</h2>
                <p style={{ margin: 0, color: "#4b5563" }}>
                  Reglas de landing del TenantRuntimeConfig. Orientan qué mensaje prioriza este vertical antes
                  de aterrizar en la demo y en el formulario.
                </p>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                  gap: 14,
                }}
              >
                {delivery.commercial.landingRules.map((rule) => (
                  <article
                    key={rule.key}
                    style={{
                      border: "1px solid " + accent + "25",
                      borderRadius: 14,
                      background: accent + "08",
                      padding: 16,
                      display: "grid",
                      gap: 8,
                    }}
                  >
                    <div style={{ fontSize: 12, color: accent, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>
                      {rule.label || rule.key}
                    </div>
                    {rule.description ? (
                      <div style={{ color: "#111827", fontSize: 15, lineHeight: 1.5 }}>{rule.description}</div>
                    ) : null}
                    {rule.instruction ? (
                      <div style={{ color: "#4b5563", fontSize: 13, fontStyle: "italic" }}>{rule.instruction}</div>
                    ) : null}
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : (
        // Fallback cuando no hay delivery (no se especificó tenant en
        // la URL o el endpoint /api/runtime/commercial-package falló).
        // Mostramos una mini-landing genérica con CTAs en lugar de
        // dejar la página en blanco.
        <section
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 22,
            background: "#ffffff",
            padding: 32,
            display: "grid",
            gap: 16,
            maxWidth: 720,
            margin: "40px auto",
          }}
        >
          <h1 style={{ margin: 0, fontSize: 28, color: "#111827" }}>Prontara</h1>
          <p style={{ margin: 0, color: "#4b5563", lineHeight: 1.6 }}>
            ERP online por sectores para pymes. Empieza con un plan adaptado
            a tu negocio o reserva una demostración.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 8 }}>
            <a
              href="/precios"
              style={{
                background: "#111827",
                color: "#ffffff",
                padding: "10px 18px",
                borderRadius: 10,
                textDecoration: "none",
                fontWeight: 600,
              }}
            >
              Ver planes y precios
            </a>
            <a
              href="/alta"
              style={{
                background: "#ffffff",
                color: "#111827",
                padding: "10px 18px",
                borderRadius: 10,
                border: "1px solid #d1d5db",
                textDecoration: "none",
                fontWeight: 600,
              }}
            >
              Empezar gratis
            </a>
            <a
              href="/acceso"
              style={{
                color: "#1d4ed8",
                padding: "10px 18px",
                textDecoration: "none",
                fontWeight: 600,
              }}
            >
              Iniciar sesión
            </a>
          </div>
        </section>
      )}

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