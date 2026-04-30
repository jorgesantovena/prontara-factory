import Link from "next/link";
import { notFound } from "next/navigation";
import { getSectorPackByKey } from "@/lib/factory/sector-pack-registry";
import PublicNav from "@/components/public-nav";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ key: string }> };

/**
 * Metadata dinámica por vertical: cada página tiene su propio title y
 * description usando la cabecera del sector pack, lo que mejora el ranking
 * en búsquedas tipo "ERP gimnasio", "software para peluquería", etc.
 */
export async function generateMetadata({ params }: PageProps) {
  const { key } = await params;
  const pack = getSectorPackByKey(decodeURIComponent(key));
  if (!pack) {
    return { title: "Vertical no encontrado", robots: { index: false } };
  }
  const url = "/verticales/" + encodeURIComponent(pack.key);
  return {
    title: pack.label + " — ERP para " + pack.sector,
    description: pack.landing.subheadline || pack.description,
    alternates: { canonical: url },
    openGraph: {
      title: pack.label + " · Prontara",
      description: pack.landing.subheadline || pack.description,
      url,
    },
  };
}

export default async function VerticalPublicDetailPage({ params }: PageProps) {
  const { key } = await params;
  const pack = getSectorPackByKey(decodeURIComponent(key));
  if (!pack) {
    notFound();
    return null;
  }

  const accent = pack.branding.accentColor || "#1d4ed8";
  const moduleList = pack.modules.filter((m) => m.enabled);
  const altaHref = "/alta?vertical=" + encodeURIComponent(pack.key);

  return (
    <main style={{ fontFamily: "Arial, sans-serif", color: "#111827", background: "#ffffff" }}>
      <PublicNav current="verticales" />
      <section
        style={{
          background:
            "linear-gradient(180deg, " + accent + "14 0%, " + accent + "05 60%, #ffffff 100%)",
          padding: "56px 24px 48px",
        }}
      >
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 10 }}>
            <Link href="/verticales" style={{ color: "#6b7280", textDecoration: "none" }}>
              ← Catálogo
            </Link>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 14 }}>
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: 18,
                background: accent,
                flexShrink: 0,
              }}
            />
            <div>
              <div
                style={{
                  fontSize: 11,
                  color: accent,
                  fontWeight: 700,
                  letterSpacing: 0.8,
                  textTransform: "uppercase",
                }}
              >
                {pack.sector} · {pack.businessType}
              </div>
              <h1 style={{ margin: 0, fontSize: 40, lineHeight: 1.15 }}>{pack.label}</h1>
            </div>
          </div>

          <h2 style={{ fontSize: 26, lineHeight: 1.2, maxWidth: 820, marginTop: 20 }}>
            {pack.landing.headline}
          </h2>
          <p style={{ fontSize: 17, color: "#4b5563", maxWidth: 780, lineHeight: 1.55, marginTop: 10 }}>
            {pack.landing.subheadline}
          </p>

          <div style={{ display: "flex", gap: 12, marginTop: 24, flexWrap: "wrap" }}>
            <Link
              href={altaHref}
              style={{
                padding: "14px 24px",
                background: accent,
                color: "#fff",
                textDecoration: "none",
                borderRadius: 12,
                fontWeight: 700,
                fontSize: 15,
              }}
            >
              {pack.landing.cta}
            </Link>
            <Link
              href={"/contacto?vertical=" + encodeURIComponent(pack.key)}
              style={{
                padding: "14px 24px",
                background: "#ffffff",
                color: "#111827",
                textDecoration: "none",
                borderRadius: 12,
                fontWeight: 700,
                fontSize: 15,
                border: "1px solid #e5e7eb",
              }}
            >
              Hablar con ventas
            </Link>
          </div>
        </div>
      </section>

      {pack.landing.bullets.length > 0 ? (
        <section style={{ padding: "48px 24px", background: "#ffffff" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            <h2 style={{ fontSize: 22, margin: 0, marginBottom: 20 }}>Qué incluye</h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: 16,
              }}
            >
              {pack.landing.bullets.map((b, i) => (
                <div
                  key={i}
                  style={{
                    background: "#f8fafc",
                    border: "1px solid #e5e7eb",
                    borderRadius: 14,
                    padding: 16,
                    fontSize: 15,
                    color: "#111827",
                    lineHeight: 1.5,
                  }}
                >
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 999,
                      background: accent,
                      marginBottom: 10,
                    }}
                  />
                  {b}
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section style={{ padding: "48px 24px", background: "#f8fafc" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <h2 style={{ fontSize: 22, margin: 0, marginBottom: 6 }}>Módulos incluidos</h2>
          <p style={{ margin: 0, marginBottom: 20, color: "#4b5563", fontSize: 14 }}>
            Estos son los espacios de trabajo que verás dentro de tu Prontara.
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 12,
            }}
          >
            {moduleList.map((m) => (
              <div
                key={m.moduleKey}
                style={{
                  background: "#ffffff",
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  padding: 14,
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}>
                  {m.navigationLabel || m.label}
                </div>
                <div
                  style={{
                    marginTop: 4,
                    fontSize: 12,
                    color: "#6b7280",
                    fontFamily: "monospace",
                  }}
                >
                  {m.moduleKey}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {pack.dashboardPriorities.length > 0 ? (
        <section style={{ padding: "48px 24px", background: "#ffffff" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            <h2 style={{ fontSize: 22, margin: 0, marginBottom: 20 }}>Qué verás en tu dashboard</h2>
            <div style={{ display: "grid", gap: 12 }}>
              {pack.dashboardPriorities.map((p) => (
                <div
                  key={p.key}
                  style={{
                    display: "flex",
                    gap: 14,
                    padding: 14,
                    background: "#f8fafc",
                    border: "1px solid #e5e7eb",
                    borderRadius: 12,
                  }}
                >
                  <div
                    style={{
                      width: 4,
                      alignSelf: "stretch",
                      background: accent,
                      borderRadius: 2,
                    }}
                  />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{p.label}</div>
                    <div style={{ fontSize: 13, color: "#4b5563", marginTop: 2 }}>{p.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section
        style={{
          padding: "48px 24px",
          background: accent,
          color: "#ffffff",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <h2 style={{ fontSize: 28, margin: 0 }}>
            Arranca tu prueba gratuita de {pack.label}
          </h2>
          <p style={{ fontSize: 16, opacity: 0.9, marginTop: 10, lineHeight: 1.5 }}>
            14 días para configurar tu negocio sin tarjeta. Si te sirve, sigues. Si no, nada que cancelar.
          </p>
          <Link
            href={altaHref}
            style={{
              display: "inline-block",
              padding: "14px 28px",
              background: "#ffffff",
              color: accent,
              textDecoration: "none",
              borderRadius: 12,
              fontWeight: 700,
              fontSize: 16,
              marginTop: 20,
            }}
          >
            {pack.landing.cta}
          </Link>
        </div>
      </section>
    </main>
  );
}
