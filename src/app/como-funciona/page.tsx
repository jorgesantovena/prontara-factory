import Link from "next/link";
import PublicNav from "@/components/public-nav";
import PublicFooter from "@/components/public-footer";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Cómo funciona",
  description:
    "Cómo se contrata Prontara: eliges vertical, te creamos tu entorno con datos demo, lo personalizas con el chat de IA y empiezas a operar. Todo online, en minutos.",
  alternates: { canonical: "/como-funciona" },
  openGraph: {
    title: "Cómo funciona · Prontara",
    description:
      "Del alta al ERP operativo en minutos: vertical, entorno, personalización, operación.",
    url: "/como-funciona",
  },
};

type Step = {
  number: string;
  title: string;
  description: string;
  duration: string;
};

const STEPS: Step[] = [
  {
    number: "01",
    title: "Eliges tu vertical",
    description:
      "Entra en el catálogo y mira los verticales disponibles: clínica dental, gimnasio, software factory, peluquería, taller, colegio… Cada uno ya viene con sus módulos, vocabulario y flujos específicos del sector.",
    duration: "2 minutos",
  },
  {
    number: "02",
    title: "Te das de alta online",
    description:
      "Rellenas un formulario corto con los datos de tu negocio y eliges plan (Básico, Estándar o Premium). Sin llamadas comerciales obligatorias, sin esperas — todo se procesa en el momento.",
    duration: "3 minutos",
  },
  {
    number: "03",
    title: "Recibes tu entorno",
    description:
      "Te llega un email con el enlace de acceso y una contraseña temporal. Entras, cambias la contraseña y ya estás dentro. El vertical viene con datos de ejemplo opcionales para que veas cómo funciona todo al instante.",
    duration: "5 minutos",
  },
  {
    number: "04",
    title: "Lo configuras a tu medida",
    description:
      "Ajustas branding, etiquetas, módulos desde el editor visual o pidiéndoselo al asistente en lenguaje natural. Importas tus datos desde CSV si vienes de otro sistema. Puedes saltarte este paso si el vertical ya te encaja como está.",
    duration: "Cuando tú quieras",
  },
  {
    number: "05",
    title: "Empiezas a trabajar",
    description:
      "Das de alta a tu equipo, empezáis a meter clientes reales, a emitir facturas, a seguir proyectos. Si necesitas soporte humano activas el plan (desde 12 €/usuario/mes) y listo.",
    duration: "Hoy mismo",
  },
];

export default function ComoFuncionaPage() {
  return (
    <main style={{ fontFamily: "Arial, sans-serif", color: "#111827", background: "#ffffff" }}>
      <PublicNav current="como-funciona" />

      <section
        style={{
          padding: "64px 24px 40px",
          background: "linear-gradient(180deg, #f0f9ff 0%, #ffffff 70%)",
        }}
      >
        <div style={{ maxWidth: 820, margin: "0 auto", textAlign: "center" }}>
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
            Cómo funciona
          </div>
          <h1 style={{ margin: 0, fontSize: 42, lineHeight: 1.15 }}>
            De cero a tu ERP en marcha{" "}
            <span style={{ color: "#1d4ed8" }}>en una mañana</span>
          </h1>
          <p style={{ marginTop: 16, fontSize: 17, color: "#4b5563", lineHeight: 1.55 }}>
            Cinco pasos reales. Sin reuniones obligatorias, sin demos comerciales,
            sin procesos de onboarding de tres semanas. Todo online.
          </p>
        </div>
      </section>

      <section style={{ padding: "20px 24px 60px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "grid", gap: 16 }}>
          {STEPS.map((step, i) => (
            <StepRow key={step.number} step={step} last={i === STEPS.length - 1} />
          ))}
        </div>
      </section>

      <section style={{ padding: "48px 24px", background: "#f8fafc" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <h2 style={{ fontSize: 24, marginBottom: 6 }}>Lo que NO hacemos</h2>
          <p style={{ color: "#4b5563", fontSize: 14, marginTop: 0 }}>
            Porque saber qué evitamos es tan importante como saber qué ofrecemos.
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 14,
              marginTop: 20,
            }}
          >
            <AntiPattern text="No te ponemos un comercial que te llame tres veces antes de firmar." />
            <AntiPattern text="No exigimos demo obligatoria — el trial y el vídeo público son suficientes." />
            <AntiPattern text="No disparamos el precio con añadidos opacos." />
            <AntiPattern text="No te encerramos: tus datos se exportan en CSV cuando quieras." />
            <AntiPattern text="No forzamos compromisos anuales. El soporte es mes a mes." />
            <AntiPattern text="No vendemos tu información a terceros." />
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
          <h2 style={{ fontSize: 28, margin: 0 }}>Elige tu vertical y empieza</h2>
          <p style={{ fontSize: 16, opacity: 0.9, marginTop: 10, lineHeight: 1.5 }}>
            14 días de prueba sin tarjeta. Si al final no te convence, tus datos se van contigo.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 20, flexWrap: "wrap" }}>
            <Link
              href="/verticales"
              style={{
                display: "inline-block",
                padding: "14px 28px",
                background: "#ffffff",
                color: "#1d4ed8",
                textDecoration: "none",
                borderRadius: 12,
                fontWeight: 700,
                fontSize: 16,
              }}
            >
              Ver verticales
            </Link>
            <Link
              href="/alta"
              style={{
                display: "inline-block",
                padding: "14px 28px",
                background: "transparent",
                color: "#ffffff",
                textDecoration: "none",
                borderRadius: 12,
                fontWeight: 700,
                fontSize: 16,
                border: "2px solid rgba(255,255,255,0.4)",
              }}
            >
              Ir directo al alta
            </Link>
          </div>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}

function StepRow({ step, last }: { step: Step; last: boolean; key?: string | number }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "120px 1fr",
        gap: 24,
        padding: 24,
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: 18,
        position: "relative",
      }}
    >
      <div>
        <div
          style={{
            fontSize: 56,
            fontWeight: 800,
            color: "#1d4ed8",
            lineHeight: 1,
          }}
        >
          {step.number}
        </div>
        <div
          style={{
            marginTop: 8,
            fontSize: 11,
            color: "#6b7280",
            fontWeight: 700,
            letterSpacing: 0.4,
            textTransform: "uppercase",
          }}
        >
          ⏱ {step.duration}
        </div>
      </div>
      <div>
        <h3 style={{ margin: 0, fontSize: 22 }}>{step.title}</h3>
        <p style={{ marginTop: 8, color: "#4b5563", fontSize: 15, lineHeight: 1.6 }}>
          {step.description}
        </p>
      </div>
      {!last ? (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            left: 56,
            top: "100%",
            width: 2,
            height: 16,
            background: "#dbeafe",
          }}
        />
      ) : null}
    </div>
  );
}

function AntiPattern({ text }: { text: string }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
        padding: 14,
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        fontSize: 14,
        color: "#374151",
        lineHeight: 1.45,
      }}
    >
      <span style={{ color: "#991b1b", fontWeight: 700, flexShrink: 0 }}>✗</span>
      <span>{text}</span>
    </div>
  );
}
