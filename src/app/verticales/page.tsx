import Link from "next/link";
import { listSectorPacks } from "@/lib/factory/sector-pack-registry";
import PublicNav from "@/components/public-nav";
import PublicFooter from "@/components/public-footer";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Verticales — ERP por sector",
  description:
    "Prontara para gimnasios, peluquerías, colegios, software factories y más. Entornos preconfigurados con KPIs, módulos y datos demo del sector.",
  alternates: { canonical: "/verticales" },
  openGraph: {
    title: "Verticales · Prontara",
    description:
      "ERP preconfigurado por sector: gimnasios, peluquerías, colegios, software factories y más.",
    url: "/verticales",
  },
};

type PublicSummary = {
  key: string;
  label: string;
  sector: string;
  businessType: string;
  description: string;
  displayName: string;
  accentColor: string;
  headline: string;
  subheadline: string;
  moduleCount: number;
  entityCount: number;
};

function buildSummaries(): PublicSummary[] {
  const packs = listSectorPacks();
  return packs.map((p) => ({
    key: p.key,
    label: p.label,
    sector: p.sector,
    businessType: p.businessType,
    description: p.description,
    displayName: p.branding.displayName,
    accentColor: p.branding.accentColor,
    headline: p.landing.headline,
    subheadline: p.landing.subheadline,
    moduleCount: p.modules.filter((m) => m.enabled).length,
    entityCount: p.entities.length,
  }));
}

export default function VerticalesCatalogPage() {
  const items = buildSummaries();

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(180deg, #f0f9ff 0%, #ffffff 40%, #ffffff 100%)",
        fontFamily: "Arial, sans-serif",
        color: "#111827",
      }}
    >
      <PublicNav current="verticales" />
      <section style={{ padding: "56px 24px 32px", maxWidth: 1200, margin: "0 auto" }}>
        <div
          style={{
            fontSize: 12,
            color: "#1d4ed8",
            fontWeight: 700,
            letterSpacing: 0.8,
            textTransform: "uppercase",
            marginBottom: 10,
          }}
        >
          Catálogo Prontara
        </div>
        <h1 style={{ margin: 0, fontSize: 42, lineHeight: 1.15, maxWidth: 820 }}>
          Un ERP pensado para tu sector,{" "}
          <span style={{ color: "#1d4ed8" }}>listo en minutos</span>.
        </h1>
        <p style={{ marginTop: 16, fontSize: 17, color: "#4b5563", maxWidth: 720, lineHeight: 1.55 }}>
          Elige tu vertical y arranca con un entorno completo: módulos, formularios, asistente
          y dashboard ya configurados con el vocabulario y los flujos de tu negocio.
        </p>
      </section>

      <section style={{ padding: "0 24px 64px", maxWidth: 1200, margin: "0 auto" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: 18,
          }}
        >
          {items.map((v) => (
            <Link
              key={v.key}
              href={"/verticales/" + encodeURIComponent(v.key)}
              style={{
                background: "#ffffff",
                border: "1px solid #e5e7eb",
                borderRadius: 20,
                padding: 20,
                textDecoration: "none",
                color: "inherit",
                display: "flex",
                flexDirection: "column",
                gap: 14,
                boxShadow: "0 1px 0 rgba(17,24,39,0.04)",
                transition: "transform 120ms ease, box-shadow 120ms ease",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 14,
                    background: v.accentColor || "#1d4ed8",
                    flexShrink: 0,
                  }}
                />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      fontSize: 11,
                      color: "#6b7280",
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                    }}
                  >
                    {v.sector}
                  </div>
                  <div style={{ fontSize: 19, fontWeight: 700, marginTop: 2 }}>
                    {v.label}
                  </div>
                </div>
              </div>

              <div style={{ fontSize: 15, fontWeight: 600, color: "#111827", lineHeight: 1.3 }}>
                {v.headline}
              </div>
              <div style={{ fontSize: 13, color: "#4b5563", lineHeight: 1.5 }}>
                {v.subheadline || v.description}
              </div>

              <div style={{ display: "flex", gap: 14, marginTop: "auto", paddingTop: 10, borderTop: "1px solid #f3f4f6" }}>
                <Stat label="Módulos" value={v.moduleCount} />
                <Stat label="Entidades" value={v.entityCount} />
                <div style={{ flex: 1 }} />
                <span
                  style={{
                    fontSize: 13,
                    color: v.accentColor || "#1d4ed8",
                    fontWeight: 700,
                  }}
                >
                  Ver detalle →
                </span>
              </div>
            </Link>
          ))}
        </div>

        <div
          style={{
            marginTop: 40,
            padding: 24,
            background: "#f8fafc",
            border: "1px solid #e5e7eb",
            borderRadius: 16,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 15, color: "#374151", marginBottom: 10 }}>
            ¿No ves tu sector? Trabajamos sobre pedido: configuramos un vertical a medida en pocos días.
          </div>
          <Link
            href="/contacto"
            style={{
              display: "inline-block",
              padding: "10px 20px",
              background: "#1d4ed8",
              color: "#fff",
              textDecoration: "none",
              borderRadius: 10,
              fontWeight: 700,
            }}
          >
            Escríbenos
          </Link>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: "#9ca3af", fontWeight: 600, letterSpacing: 0.3 }}>
        {label.toUpperCase()}
      </div>
      <div style={{ fontSize: 15, color: "#111827", fontWeight: 700 }}>{value}</div>
    </div>
  );
}
