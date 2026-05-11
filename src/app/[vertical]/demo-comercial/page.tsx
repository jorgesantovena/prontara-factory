"use client";

import { useEffect, useState } from "react";

type DemoScenario = {
  title: string;
  subtitle: string;
  sectorLabel: string;
  steps: Array<{
    key: string;
    title: string;
    description: string;
    href: string;
  }>;
  expectedResult: string;
};

type Validation = {
  checks: Array<{
    key: string;
    label: string;
    passed: boolean;
    detail: string;
  }>;
  summary: {
    passed: number;
    total: number;
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

export default function DemoComercialPage() {
  const [scenario, setScenario] = useState<DemoScenario | null>(null);
  const [validation, setValidation] = useState<Validation | null>(null);
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
        const query =
          tenant || sectorPack
            ? "?" +
              [
                tenant ? "tenant=" + encodeURIComponent(tenant) : "",
                sectorPack ? "sectorPack=" + encodeURIComponent(sectorPack) : "",
              ]
                .filter(Boolean)
                .join("&")
            : "";

        const previewResponse = await fetch("/api/runtime/commercial-package" + query, { cache: "no-store" });
        const previewData = await previewResponse.json();

        const validateResponse = await fetch("/api/runtime/demo-validate" + query, { cache: "no-store" });
        const validateData = await validateResponse.json();

        if (!validateResponse.ok || !validateData.ok) {
          throw new Error(validateData.error || "No se pudo validar la demo.");
        }

        if (!previewResponse.ok || !previewData.ok) {
          throw new Error(previewData.error || "No se pudo cargar el paquete comercial.");
        }

        const delivery = previewData.delivery;
        const nextScenario: DemoScenario = {
          title: "Demo comercial estándar",
          subtitle: "Recorrido completo para enseñar el producto con seguridad.",
          sectorLabel: delivery.commercial.displayName,
          steps: [
            {
              key: "landing",
              title: "Landing comercial",
              description: "Explica el producto y lleva al alta online.",
              href: "/landing" + query,
            },
            {
              key: "signup",
              title: "Alta online",
              description: "El cliente deja datos y activa su cuenta.",
              href: "/alta" + query,
            },
            {
              key: "login",
              title: "Acceso",
              description: "Entrada real con tenant, email y contraseña.",
              href: "/acceso" + query,
            },
            {
              key: "erp",
              title: "ERP",
              description: "Entorno listo para trabajar desde el segundo uno.",
              href: "/" + query,
            },
            {
              key: "delivery",
              title: "Entrega",
              description: "Pantalla final de entrega y experiencia comercial.",
              href: "/entrega" + query,
            },
          ],
          expectedResult:
            "La demo debe transmitir claridad, sencillez y sensación de producto listo para vender.",
        };

        if (!cancelled) {
          setScenario(nextScenario);
          setValidation(validateData.validation || null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "No se pudo cargar la demo comercial.");
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
          borderRadius: 18,
          background: "#ffffff",
          padding: 24,
        }}
      >
        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>
          Demo comercial
        </div>
        <h1 style={{ marginTop: 0, marginBottom: 10, fontSize: 32 }}>
          Demo estándar lista para enseñar
        </h1>
        <p style={{ margin: 0, color: "#4b5563" }}>
          Recorrido comercial preparado para enseñar el producto de punta a punta.
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
          Cargando demo comercial...
        </section>
      ) : null}

      {scenario ? (
        <section
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 18,
            background: "#ffffff",
            padding: 24,
            display: "grid",
            gap: 16,
          }}
        >
          <h2 style={{ marginTop: 0 }}>{scenario.title}</h2>
          <div style={{ color: "#4b5563" }}>{scenario.subtitle}</div>

          <div style={{ display: "grid", gap: 12 }}>
            {scenario.steps.map((step, index) => (
              <a
                key={step.key}
                href={step.href}
                style={{
                  textDecoration: "none",
                  color: "inherit",
                  border: "1px solid #eef2f7",
                  borderRadius: 14,
                  background: "#fafafa",
                  padding: 14,
                  display: "grid",
                  gap: 6,
                }}
              >
                <div style={{ fontSize: 12, color: "#6b7280" }}>Paso {index + 1}</div>
                <strong>{step.title}</strong>
                <div style={{ color: "#4b5563" }}>{step.description}</div>
              </a>
            ))}
          </div>

          <div
            style={{
              border: "1px solid #dbeafe",
              borderRadius: 14,
              background: "#eff6ff",
              padding: 14,
              color: "#1d4ed8",
            }}
          >
            {scenario.expectedResult}
          </div>
        </section>
      ) : null}

      {validation ? (
        <section
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 18,
            background: "#ffffff",
            padding: 24,
            display: "grid",
            gap: 16,
          }}
        >
          <h2 style={{ marginTop: 0 }}>Validación comercial</h2>
          <div style={{ color: "#4b5563" }}>
            Pasadas: {validation.summary.passed} de {validation.summary.total}
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            {validation.checks.map((check) => (
              <article
                key={check.key}
                style={{
                  border: "1px solid #eef2f7",
                  borderRadius: 12,
                  background: check.passed ? "#f0fdf4" : "#fef2f2",
                  padding: 14,
                  display: "grid",
                  gap: 6,
                }}
              >
                <div style={{ fontWeight: 700 }}>
                  {check.label} · {check.passed ? "OK" : "Pendiente"}
                </div>
                <div style={{ color: "#4b5563" }}>{check.detail}</div>
              </article>
            ))}
          </div>
        </section>
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