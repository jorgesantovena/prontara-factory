import Link from "next/link";
import { buildDemoPresentationFromRequest } from "@/lib/factory/demo-presentation";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

function buildRequestFromSearchParams(searchParams: {
  [key: string]: string | string[] | undefined;
}) {
  const url = new URL("http://localhost/demo");

  for (const [key, value] of Object.entries(searchParams || {})) {
    if (Array.isArray(value)) {
      for (const item of value) {
        url.searchParams.append(key, item);
      }
    } else if (typeof value === "string") {
      url.searchParams.set(key, value);
    }
  }

  return new NextRequest(url.toString());
}

export default async function DemoPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedSearchParams = await searchParams;
  const request = buildRequestFromSearchParams(resolvedSearchParams);
  const presentation = await buildDemoPresentationFromRequest(request);

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
          borderRadius: 20,
          background: "#ffffff",
          padding: 28,
          display: "grid",
          gap: 20,
          boxShadow: "0 8px 24px rgba(15, 23, 42, 0.04)",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            width: "fit-content",
            padding: "8px 12px",
            borderRadius: 999,
            background: "#f3f4f6",
            color: "#374151",
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 999,
              background: presentation.branding.accentColor,
              display: "inline-block",
            }}
          />
          Demo comercial conectada al ERP
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ fontSize: 13, color: "#6b7280", fontWeight: 700 }}>
            {presentation.hero.eyebrow}
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: 42,
              lineHeight: 1.08,
              maxWidth: 980,
            }}
          >
            {presentation.hero.headline}
          </h1>
          <p
            style={{
              margin: 0,
              color: "#4b5563",
              fontSize: 18,
              maxWidth: 920,
              lineHeight: 1.5,
            }}
          >
            {presentation.hero.subheadline}
          </p>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link
            href={presentation.hero.primaryCtaHref}
            style={{
              border: "1px solid " + presentation.branding.accentColor,
              borderRadius: 12,
              padding: "12px 16px",
              textDecoration: "none",
              color: "#ffffff",
              background: presentation.branding.accentColor,
              fontWeight: 700,
            }}
          >
            {presentation.hero.primaryCtaLabel}
          </Link>

          <Link
            href={presentation.hero.secondaryCtaHref}
            style={{
              border: "1px solid #d1d5db",
              borderRadius: 12,
              padding: "12px 16px",
              textDecoration: "none",
              color: "#111827",
              background: "#ffffff",
              fontWeight: 700,
            }}
          >
            {presentation.hero.secondaryCtaLabel}
          </Link>

          <Link
            href={presentation.links.acceso}
            style={{
              border: "1px solid #d1d5db",
              borderRadius: 12,
              padding: "12px 16px",
              textDecoration: "none",
              color: "#111827",
              background: "#ffffff",
              fontWeight: 700,
            }}
          >
            Acceder
          </Link>
        </div>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
        }}
      >
        {presentation.proof.map((item) => (
          <article
            key={item.key}
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 16,
              background: "#ffffff",
              padding: 18,
              display: "grid",
              gap: 8,
            }}
          >
            <div style={{ fontSize: 12, color: "#6b7280" }}>{item.label}</div>
            <div style={{ fontSize: 30, fontWeight: 700 }}>{item.value}</div>
            <div style={{ color: "#4b5563", fontSize: 14 }}>{item.helper}</div>
          </article>
        ))}
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.1fr) minmax(320px, 0.9fr)",
          gap: 24,
          alignItems: "start",
        }}
      >
        <article
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 16,
            background: "#ffffff",
            padding: 20,
            display: "grid",
            gap: 16,
          }}
        >
          <div>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>
              Copy comercial
            </div>
            <h2 style={{ marginTop: 0, marginBottom: 8, fontSize: 28 }}>
              Una demo para enseñar y vender mejor
            </h2>
          </div>

          <div
            style={{
              border: "1px solid #eef2f7",
              borderRadius: 12,
              background: "#fafafa",
              padding: 14,
              display: "grid",
              gap: 10,
            }}
          >
            <div><strong>One-liner:</strong> {presentation.commercialCopy.oneLiner}</div>
            <div><strong>Para quién:</strong> {presentation.commercialCopy.forWho}</div>
            <div><strong>Por qué ahora:</strong> {presentation.commercialCopy.whyNow}</div>
            <div><strong>Cierre:</strong> {presentation.commercialCopy.closing}</div>
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            {presentation.features.map((item) => (
              <article
                key={item.title}
                style={{
                  border: "1px solid #eef2f7",
                  borderRadius: 12,
                  background: "#ffffff",
                  padding: 14,
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: 6 }}>{item.title}</div>
                <div style={{ color: "#4b5563", fontSize: 14 }}>{item.description}</div>
              </article>
            ))}
          </div>
        </article>

        <article
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 16,
            background: "#ffffff",
            padding: 20,
            display: "grid",
            gap: 16,
          }}
        >
          <div>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>
              Branding por cliente
            </div>
            <h2 style={{ marginTop: 0, marginBottom: 8, fontSize: 24 }}>
              Identidad visible y coherente
            </h2>
          </div>

          <div
            style={{
              border: "1px solid #eef2f7",
              borderRadius: 12,
              background: "#fafafa",
              padding: 14,
              display: "grid",
              gap: 8,
            }}
          >
            <div><strong>Display name:</strong> {presentation.branding.displayName}</div>
            <div><strong>Short name:</strong> {presentation.branding.shortName}</div>
            <div><strong>Sector:</strong> {presentation.branding.sector || "-"}</div>
            <div><strong>Business type:</strong> {presentation.branding.businessType || "-"}</div>
            <div><strong>Color base:</strong> {presentation.branding.accentColor}</div>
            <div><strong>Pista de logo:</strong> {presentation.branding.logoHint || "-"}</div>
          </div>

          <div
            style={{
              borderRadius: 14,
              background: presentation.branding.accentColor,
              color: "#ffffff",
              padding: 16,
              fontWeight: 700,
            }}
          >
            Vista rápida de color comercial para la demo
          </div>
        </article>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 16,
        }}
      >
        {presentation.sections.map((section) => (
          <article
            key={section.title}
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 16,
              background: "#ffffff",
              padding: 18,
              display: "grid",
              gap: 10,
            }}
          >
            <h3 style={{ margin: 0, fontSize: 20 }}>{section.title}</h3>
            <p style={{ margin: 0, color: "#4b5563" }}>{section.description}</p>
            <ul style={{ margin: 0, paddingLeft: 18, color: "#374151" }}>
              {section.bullets.map((item) => (
                <li key={item} style={{ marginBottom: 8 }}>
                  {item}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      <section
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 16,
          background: "#ffffff",
          padding: 20,
          display: "grid",
          gap: 14,
        }}
      >
        <div>
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>
            Demo sectorial lista para enseñar
          </div>
          <h2 style={{ marginTop: 0, marginBottom: 8, fontSize: 28 }}>
            Conecta discurso comercial y producto real
          </h2>
          <p style={{ margin: 0, color: "#4b5563", maxWidth: 900 }}>
            Ya puedes enseñar una historia más completa: mensaje comercial, branding,
            alta, acceso y entorno real. Eso reduce bastante la distancia entre visión y producto.
          </p>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link
            href={presentation.links.alta}
            style={{
              border: "1px solid " + presentation.branding.accentColor,
              borderRadius: 12,
              padding: "12px 16px",
              textDecoration: "none",
              color: "#ffffff",
              background: presentation.branding.accentColor,
              fontWeight: 700,
            }}
          >
            Ir a alta
          </Link>

          <Link
            href={presentation.links.entorno}
            style={{
              border: "1px solid #d1d5db",
              borderRadius: 12,
              padding: "12px 16px",
              textDecoration: "none",
              color: "#111827",
              background: "#ffffff",
              fontWeight: 700,
            }}
          >
            Ver entorno
          </Link>

          <Link
            href={presentation.links.suscripcion}
            style={{
              border: "1px solid #d1d5db",
              borderRadius: 12,
              padding: "12px 16px",
              textDecoration: "none",
              color: "#111827",
              background: "#ffffff",
              fontWeight: 700,
            }}
          >
            Ver suscripción
          </Link>

          <Link
            href={presentation.links.packs}
            style={{
              border: "1px solid #d1d5db",
              borderRadius: 12,
              padding: "12px 16px",
              textDecoration: "none",
              color: "#111827",
              background: "#ffffff",
              fontWeight: 700,
            }}
          >
            Ver packs
          </Link>
        </div>
      </section>
    </main>
  );
}