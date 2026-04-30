import Link from "next/link";
import PublicNav from "@/components/public-nav";
import PublicFooter from "@/components/public-footer";

export const metadata = {
  title: "Precios",
  description:
    "Tres planes de Prontara con pago único de alta (590 €, 990 € o 1.490 €) y soporte mensual desde 12 € por usuario concurrente. Sin permanencia, sin sorpresas.",
  alternates: { canonical: "/precios" },
  openGraph: {
    title: "Precios · Prontara",
    description:
      "Pago único de alta + soporte mensual por usuario. Tres planes: Básico, Estándar y Premium. Prueba 14 días sin tarjeta.",
    url: "/precios",
  },
};

export const dynamic = "force-dynamic";

type Tier = {
  key: "basico" | "estandar" | "premium";
  label: string;
  subtitle: string;
  priceEuros: number;
  featured?: boolean;
  includes: string[];
  idealFor: string;
};

const TIERS: Tier[] = [
  {
    key: "basico",
    label: "Básico",
    subtitle: "Para arrancar con un vertical base",
    priceEuros: 590,
    includes: [
      "Un vertical del catálogo ya configurado",
      "Módulos estándar del sector",
      "Hasta 2 usuarios",
      "Asistente interno y dashboard operativo",
      "Despliegue 100% online",
    ],
    idealFor: "Autónomo o pyme muy pequeña que quiere tener su ERP en marcha sin fricción.",
  },
  {
    key: "estandar",
    label: "Estándar",
    subtitle: "El más elegido",
    priceEuros: 990,
    featured: true,
    includes: [
      "Todo lo de Básico",
      "Branding propio (colores, logo, textos)",
      "Ajustes del vertical (módulos, etiquetas, entidades)",
      "Hasta 5 usuarios",
      "Alta de usuarios extra sin recargo",
      "Importación de datos inicial",
    ],
    idealFor: "Equipos pequeños que quieren el ERP a su medida sin desarrollo a medida.",
  },
  {
    key: "premium",
    label: "Premium",
    subtitle: "Para personalizar a fondo",
    priceEuros: 1490,
    includes: [
      "Todo lo de Estándar",
      "Campos y reglas personalizadas del negocio",
      "Integraciones puntuales (facturación, email, etc.)",
      "Usuarios ilimitados",
      "Acompañamiento en el primer mes",
      "Migración desde sistemas previos",
    ],
    idealFor: "Equipos con procesos específicos que necesitan un vertical a medida o integrarlo con lo que ya usan.",
  },
];

function formatEuros(amount: number): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function PreciosPage() {
  return (
    <main style={{ fontFamily: "Arial, sans-serif", color: "#111827", background: "#ffffff" }}>
      <PublicNav current="precios" />

      <section
        style={{
          padding: "64px 24px 32px",
          background: "linear-gradient(180deg, #f0f9ff 0%, #ffffff 70%)",
        }}
      >
        <div style={{ maxWidth: 900, margin: "0 auto", textAlign: "center" }}>
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
            Precios
          </div>
          <h1 style={{ margin: 0, fontSize: 42, lineHeight: 1.15 }}>
            Precio cerrado, <span style={{ color: "#1d4ed8" }}>sin sorpresas</span>
          </h1>
          <p style={{ marginTop: 16, fontSize: 17, color: "#4b5563", lineHeight: 1.55 }}>
            Pago único por la puesta en marcha de tu vertical + soporte opcional por usuario concurrente.
            Sin cuotas sorpresa, sin letra pequeña, 100% online.{" "}
            <strong>No obligamos a llamadas comerciales</strong> — firmas y te vas a trabajar.
          </p>
        </div>
      </section>

      <section style={{ padding: "24px 24px 56px" }}>
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 18,
          }}
        >
          {TIERS.map((tier) => (
            <TierCard key={tier.key} tier={tier} />
          ))}
        </div>
      </section>

      <section style={{ padding: "40px 24px", background: "#f8fafc" }}>
        <div
          style={{
            maxWidth: 900,
            margin: "0 auto",
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: 20,
            padding: 28,
          }}
        >
          <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" }}>
            Soporte y mantenimiento (opcional)
          </div>
          <h2 style={{ margin: "8px 0 14px 0", fontSize: 28 }}>
            Desde <span style={{ color: "#1d4ed8" }}>12 € / usuario concurrente / mes</span>
          </h2>
          <p style={{ color: "#4b5563", fontSize: 15, lineHeight: 1.55, marginTop: 0 }}>
            Un único precio variable según cuántas personas realmente usan Prontara a la vez.
            Incluye actualizaciones del producto, parches de seguridad y asistencia humana en horario laboral.
            Cancelable mes a mes, sin permanencias, sin consumos ocultos.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 16 }}>
            <Link
              href="/contacto"
              style={{
                padding: "12px 22px",
                background: "#1d4ed8",
                color: "#fff",
                textDecoration: "none",
                borderRadius: 12,
                fontWeight: 700,
                fontSize: 15,
              }}
            >
              Calcular mi soporte
            </Link>
            <Link
              href="/faq"
              style={{
                padding: "12px 22px",
                background: "#ffffff",
                color: "#111827",
                textDecoration: "none",
                borderRadius: 12,
                fontWeight: 700,
                fontSize: 15,
                border: "1px solid #e5e7eb",
              }}
            >
              Ver FAQ
            </Link>
          </div>
        </div>
      </section>

      <section style={{ padding: "48px 24px", background: "#ffffff" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <h2 style={{ fontSize: 24, marginBottom: 16 }}>Lo que NO cobramos</h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 14,
            }}
          >
            <NoCharge text="Por usuario extra dentro de tu plan." />
            <NoCharge text="Por número de clientes o registros." />
            <NoCharge text="Por migrar de nuestro sistema a otro." />
            <NoCharge text="Por cancelar el soporte el mes que quieras." />
            <NoCharge text="Por llamadas de onboarding obligatorias." />
            <NoCharge text="Por exportar tus datos en CSV/JSON." />
          </div>
        </div>
      </section>

      <section
        style={{
          padding: "56px 24px",
          background: "#1d4ed8",
          color: "#ffffff",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <h2 style={{ fontSize: 28, margin: 0 }}>Prueba el entorno antes de decidir</h2>
          <p style={{ fontSize: 16, opacity: 0.9, marginTop: 10, lineHeight: 1.5 }}>
            14 días con tu vertical activo, sin tarjeta. Si te encaja, pagas el alta una vez y sigues.
            Si no, no pasa nada.
          </p>
          <Link
            href="/alta"
            style={{
              display: "inline-block",
              padding: "14px 28px",
              background: "#ffffff",
              color: "#1d4ed8",
              textDecoration: "none",
              borderRadius: 12,
              fontWeight: 700,
              fontSize: 16,
              marginTop: 20,
            }}
          >
            Empezar prueba gratis
          </Link>
          <p style={{ fontSize: 13, opacity: 0.85, marginTop: 16 }}>
            Al contratar aceptas el{" "}
            <Link href="/contrato" style={{ color: "#ffffff", textDecoration: "underline" }}>
              contrato de servicio
            </Link>
            . Puedes leerlo íntegro antes de pagar.
          </p>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}

function TierCard({ tier }: { tier: Tier; key?: string | number }) {
  const featured = Boolean(tier.featured);
  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid " + (featured ? "#1d4ed8" : "#e5e7eb"),
        borderWidth: featured ? 2 : 1,
        borderRadius: 20,
        padding: 24,
        display: "flex",
        flexDirection: "column",
        gap: 14,
        position: "relative",
        boxShadow: featured ? "0 10px 30px rgba(29, 78, 216, 0.12)" : "0 1px 0 rgba(17,24,39,0.04)",
      }}
    >
      {featured ? (
        <div
          style={{
            position: "absolute",
            top: -12,
            right: 20,
            background: "#1d4ed8",
            color: "#fff",
            padding: "4px 12px",
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          El más elegido
        </div>
      ) : null}

      <div>
        <div style={{ fontSize: 14, color: "#6b7280", fontWeight: 600 }}>{tier.subtitle}</div>
        <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>{tier.label}</div>
      </div>

      <div>
        <div style={{ fontSize: 40, fontWeight: 800, color: "#111827", lineHeight: 1 }}>
          {formatEuros(tier.priceEuros)}
        </div>
        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
          Pago único · IVA no incluido
        </div>
      </div>

      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
        {tier.includes.map((item, i) => (
          <li key={i} style={{ display: "flex", gap: 8, fontSize: 14, color: "#374151", lineHeight: 1.45 }}>
            <span style={{ color: "#1d4ed8", fontWeight: 700, marginTop: 1 }}>✓</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>

      <div
        style={{
          fontSize: 12,
          color: "#6b7280",
          background: "#f9fafb",
          borderRadius: 10,
          padding: 10,
          marginTop: 4,
          lineHeight: 1.45,
        }}
      >
        <strong>Para quién:</strong> {tier.idealFor}
      </div>

      <Link
        href="/alta"
        style={{
          display: "block",
          padding: "12px 16px",
          background: featured ? "#1d4ed8" : "#111827",
          color: "#fff",
          textAlign: "center",
          textDecoration: "none",
          borderRadius: 12,
          fontWeight: 700,
          fontSize: 14,
          marginTop: "auto",
        }}
      >
        Empezar con {tier.label}
      </Link>
    </div>
  );
}

function NoCharge({ text }: { text: string }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
        padding: 14,
        background: "#f8fafc",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        fontSize: 14,
        color: "#374151",
        lineHeight: 1.45,
      }}
    >
      <span
        style={{
          color: "#991b1b",
          fontWeight: 700,
          fontSize: 14,
          flexShrink: 0,
        }}
      >
        ✗
      </span>
      <span>{text}</span>
    </div>
  );
}
