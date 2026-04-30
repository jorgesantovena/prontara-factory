import Link from "next/link";
import PublicNav from "@/components/public-nav";
import PublicFooter from "@/components/public-footer";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Preguntas frecuentes",
  description:
    "Las dudas más habituales sobre Prontara: planes, soporte, datos, cancelación, integraciones, soporte técnico.",
  alternates: { canonical: "/faq" },
  openGraph: {
    title: "Preguntas frecuentes · Prontara",
    description:
      "Respuestas claras sobre planes, datos, cancelación y soporte técnico de Prontara.",
    url: "/faq",
  },
};

type FaqGroup = {
  title: string;
  items: Array<{ q: string; a: string }>;
};

const FAQS: FaqGroup[] = [
  {
    title: "Precio y contratación",
    items: [
      {
        q: "¿Cómo es el precio exactamente?",
        a:
          "Pago único por la puesta en marcha del vertical: Básico 590 €, Estándar 990 € o Premium 1.490 €. A eso se suma, si quieres, el soporte mensual desde 12 € por usuario concurrente. No hay cuotas mensuales escondidas.",
      },
      {
        q: "¿Qué significa \"usuario concurrente\"?",
        a:
          "Alguien que está usando Prontara en ese momento. Si tienes 10 empleados pero normalmente solo 4 entran a la vez, cuenta como 4. Esto permite que equipos grandes paguen solo por lo que realmente usan.",
      },
      {
        q: "¿Necesito tarjeta para probar?",
        a:
          "No. Tienes 14 días de prueba sin tarjeta. Si al final decides pagar, metes tarjeta o te pasamos la factura para transferencia — tú eliges.",
      },
      {
        q: "¿Hay permanencia?",
        a:
          "Ninguna. El alta se paga una vez. El soporte es mes a mes: cancelas cuando quieras y el ERP sigue funcionando, solo deja de recibir actualizaciones y asistencia humana.",
      },
      {
        q: "¿Y si me paso de usuarios concurrentes un mes puntual?",
        a:
          "No pasa nada. Ajustamos solo al mes siguiente y hablamos contigo antes de subirte — nunca cobramos extras sin avisar.",
      },
    ],
  },
  {
    title: "Cómo funciona",
    items: [
      {
        q: "¿Me va a llamar un comercial?",
        a:
          "Solo si tú lo pides desde el formulario de contacto. El alta es 100% online y nunca la bloqueamos con una llamada obligatoria. Si prefieres hablar, claro que podemos, pero es tu decisión.",
      },
      {
        q: "¿Cuánto tardo en tener el entorno listo?",
        a:
          "Tras el alta, el entorno está en minutos. Los datos de ejemplo entran con un click, y ya puedes configurar branding, módulos y usuarios. Una pyme pequeña está operativa el mismo día.",
      },
      {
        q: "¿Y si mi negocio no encaja exactamente en un vertical?",
        a:
          "Con el plan Estándar o Premium puedes ajustar el vertical (módulos, etiquetas, campos) sin tocar código. Si necesitas algo más específico, contrata Premium y lo hacemos por ti. Si ninguna opción encaja, escríbenos y creamos un vertical a medida.",
      },
      {
        q: "¿Puedo cambiar de vertical después?",
        a:
          "Sí. Se mantiene la base de datos del cliente, pero cambian los módulos, vocabulario y flujos. No es gratis (hay trabajo detrás) pero tampoco hay que pagar el alta entera otra vez.",
      },
    ],
  },
  {
    title: "Datos, seguridad y soporte",
    items: [
      {
        q: "¿De quién son mis datos?",
        a:
          "Tuyos. Los puedes exportar en cualquier momento en CSV o JSON, y si cancelas te entregamos todo y borramos de nuestros servidores lo que tú nos pidas.",
      },
      {
        q: "¿Hay copia de seguridad?",
        a:
          "Sí. Los backups se hacen automáticamente todos los días. Si algo se borra sin querer, podemos recuperar el estado de ayer, anteayer y hasta hace 30 días.",
      },
      {
        q: "¿Qué incluye el soporte mensual?",
        a:
          "Actualizaciones del producto, parches de seguridad y asistencia humana por email o chat en horario laboral (lunes a viernes, 9-18 hora Madrid). Tiempo de respuesta objetivo: menos de 4 horas en horario laboral.",
      },
      {
        q: "¿Vendéis mis datos a alguien?",
        a:
          "No. Ni los datos de tus clientes, ni los tuyos, ni los de uso. Somos una pyme española, no una multinacional que vive de ads. Tu dato se queda en Prontara.",
      },
    ],
  },
  {
    title: "Personalización y migración",
    items: [
      {
        q: "¿Puedo migrar desde mi sistema actual?",
        a:
          "Sí. En el plan Premium va incluida la migración desde CSV, Excel, Google Sheets o exports de otros ERPs. En Básico y Estándar lo hacemos como servicio aparte, presupuestado caso a caso.",
      },
      {
        q: "¿Puedo integrarlo con mi pasarela de pagos / emails / etc.?",
        a:
          "Las integraciones estándar (Stripe, email transaccional básico) están disponibles en todos los planes. Integraciones puntuales con sistemas específicos (contabilidad, ERPs grandes) entran en Premium o como bolsa de horas.",
      },
      {
        q: "¿Puedo pedir al asistente que modifique cosas en lenguaje natural?",
        a:
          "Sí. Dentro de Prontara tienes un asistente que entiende peticiones tipo \"añade un campo 'código postal' al cliente\" o \"ocúltame el módulo de documentos\". Te lo resuelve en el momento.",
      },
    ],
  },
];

export default function FaqPage() {
  return (
    <main style={{ fontFamily: "Arial, sans-serif", color: "#111827", background: "#ffffff" }}>
      <PublicNav current="faq" />

      <section
        style={{
          padding: "64px 24px 32px",
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
            Preguntas frecuentes
          </div>
          <h1 style={{ margin: 0, fontSize: 40, lineHeight: 1.15 }}>
            Lo que la gente suele <span style={{ color: "#1d4ed8" }}>preguntarnos</span>
          </h1>
          <p style={{ marginTop: 16, fontSize: 17, color: "#4b5563", lineHeight: 1.55 }}>
            Respuestas honestas — incluidas las que a los comerciales no les gustan.
            Si algo no está aquí, escríbenos y lo añadimos.
          </p>
        </div>
      </section>

      <section style={{ padding: "20px 24px 56px" }}>
        <div style={{ maxWidth: 820, margin: "0 auto", display: "grid", gap: 28 }}>
          {FAQS.map((group) => (
            <div key={group.title}>
              <h2
                style={{
                  margin: 0,
                  marginBottom: 12,
                  fontSize: 18,
                  color: "#1d4ed8",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: 0.8,
                }}
              >
                {group.title}
              </h2>
              <div style={{ display: "grid", gap: 4 }}>
                {group.items.map((item, i) => (
                  <details
                    key={i}
                    style={{
                      background: "#ffffff",
                      border: "1px solid #e5e7eb",
                      borderRadius: 12,
                      padding: "14px 18px",
                    }}
                  >
                    <summary
                      style={{
                        cursor: "pointer",
                        listStyle: "none",
                        fontWeight: 600,
                        fontSize: 15,
                        color: "#111827",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <span>{item.q}</span>
                      <span style={{ color: "#1d4ed8", fontSize: 18, fontWeight: 700, flexShrink: 0 }}>
                        +
                      </span>
                    </summary>
                    <div
                      style={{
                        marginTop: 10,
                        fontSize: 14,
                        color: "#4b5563",
                        lineHeight: 1.6,
                      }}
                    >
                      {item.a}
                    </div>
                  </details>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ padding: "40px 24px", background: "#f8fafc", textAlign: "center" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <h2 style={{ fontSize: 22 }}>¿Tu pregunta no está aquí?</h2>
          <p style={{ color: "#4b5563", fontSize: 15, lineHeight: 1.55 }}>
            Escríbenos. Contestamos en menos de 24 h y añadimos la pregunta a esta página si es útil para otros.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 16, flexWrap: "wrap" }}>
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
              Escribir
            </Link>
            <Link
              href="/alta"
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
              O empezar prueba
            </Link>
          </div>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}
