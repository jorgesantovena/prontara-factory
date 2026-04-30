import fs from "fs";
import path from "path";

type WebsiteDraft = {
  title: string;
  subtitle: string;
  ctas: string[];
  sections: { title: string; body: string }[];
};

function detectWebsiteProfile(prompt: string): WebsiteDraft {
  const text = prompt.toLowerCase();

  if (text.includes("software factory") || text.includes("software-factory")) {
    return {
      title: "Software Factory",
      subtitle:
        "Desarrollo de software a medida, evolución de producto y acompañamiento técnico para empresas que necesitan construir con rapidez y criterio.",
      ctas: ["Solicitar propuesta", "Ver servicios"],
      sections: [
        {
          title: "Qué hacemos",
          body:
            "Ayudamos a diseñar, desarrollar y evolucionar productos digitales con foco en utilidad real, velocidad de entrega y calidad técnica.",
        },
        {
          title: "Servicios",
          body:
            "Producto digital, desarrollo web, aplicaciones internas, automatización de procesos, mantenimiento evolutivo y soporte técnico.",
        },
        {
          title: "Cómo trabajamos",
          body:
            "Empezamos por entender el negocio, priorizamos lo importante y construimos por fases para entregar valor desde el principio.",
        },
        {
          title: "Para quién",
          body:
            "Empresas que necesitan un partner técnico flexible para lanzar, mejorar o rehacer herramientas digitales críticas.",
        },
      ],
    };
  }

  if (text.includes("peluquer")) {
    return {
      title: "Peluquería",
      subtitle:
        "Una web clara para presentar servicios, captar reservas y transmitir imagen profesional desde el primer vistazo.",
      ctas: ["Reservar cita", "Ver servicios"],
      sections: [
        { title: "Servicios", body: "Cortes, color, tratamientos, estilismo y atención personalizada." },
        { title: "Reserva", body: "Facilita la reserva de citas y reduce llamadas innecesarias." },
        { title: "Equipo", body: "Presenta al equipo y refuerza confianza con una imagen cuidada." },
        { title: "Contacto", body: "Horarios, ubicación y canales rápidos para contactar." },
      ],
    };
  }

  if (text.includes("gimnas")) {
    return {
      title: "Gimnasio",
      subtitle:
        "Una web pensada para presentar clases, captar nuevos socios y explicar la propuesta de valor de forma directa.",
      ctas: ["Probar una clase", "Ver tarifas"],
      sections: [
        { title: "Entrenamiento", body: "Clases, planes, entrenadores y experiencia adaptada a cada perfil." },
        { title: "Instalaciones", body: "Explica espacios, equipamiento y ambiente del centro." },
        { title: "Tarifas", body: "Haz fácil entender precios, modalidades y promociones." },
        { title: "Captación", body: "Convierte visitas en leads con llamadas a la acción claras." },
      ],
    };
  }

  return {
    title: "Proyecto web",
    subtitle:
      "Una web clara, profesional y orientada a convertir, creada a partir de una solicitud en lenguaje natural.",
    ctas: ["Solicitar información", "Ver detalles"],
    sections: [
      { title: "Presentación", body: "Explica qué hace el negocio, para quién y por qué elegirlo." },
      { title: "Propuesta de valor", body: "Resume los beneficios principales de forma directa y entendible." },
      { title: "Servicios", body: "Agrupa la oferta en bloques claros y fáciles de recorrer." },
      { title: "Contacto", body: "Haz visible el siguiente paso que quieres que dé el visitante." },
    ],
  };
}

export function generateWebsiteFromPrompt(prompt: string) {
  const root = process.cwd();
  const draft = detectWebsiteProfile(prompt);

  const sectionsTs = draft.sections
    .map(
      (section) => `
        <section style={{ border: "1px solid #e5e7eb", borderRadius: 16, padding: 24, background: "#fff" }}>
          <h2 style={{ marginTop: 0, fontSize: 28 }}>{${JSON.stringify(section.title)}}</h2>
          <p style={{ marginBottom: 0, fontSize: 17, lineHeight: 1.6, color: "#374151" }}>
            {${JSON.stringify(section.body)}}
          </p>
        </section>
`
    )
    .join("\n");

  const pageTsx = `
export default function SitePage() {
  return (
    <main style={{ fontFamily: "Arial, sans-serif", background: "#f8fafc", minHeight: "100vh", color: "#111827" }}>
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "72px 24px 40px 24px" }}>
        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 24,
            padding: 32,
            background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
            marginBottom: 28,
          }}
        >
          <div style={{ fontSize: 14, opacity: 0.65, marginBottom: 12 }}>Landing generada desde Prontara Factory</div>
          <h1 style={{ fontSize: 52, marginTop: 0, marginBottom: 16 }}>${JSON.stringify(draft.title)}</h1>
          <p style={{ fontSize: 20, lineHeight: 1.6, maxWidth: 860, color: "#374151", marginBottom: 24 }}>
            ${JSON.stringify(draft.subtitle)}
          </p>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button
              style={{
                border: "1px solid #111827",
                background: "#111827",
                color: "#fff",
                borderRadius: 12,
                padding: "12px 18px",
                fontSize: 16,
                cursor: "pointer",
              }}
            >
              ${JSON.stringify(draft.ctas[0])}
            </button>

            <button
              style={{
                border: "1px solid #cbd5e1",
                background: "#fff",
                color: "#111827",
                borderRadius: 12,
                padding: "12px 18px",
                fontSize: 16,
                cursor: "pointer",
              }}
            >
              ${JSON.stringify(draft.ctas[1])}
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gap: 20 }}>
          ${sectionsTs}
        </div>
      </section>
    </main>
  );
}
`.trimStart();

  const sitePath = path.join(root, "src", "app", "site", "page.tsx");
  fs.writeFileSync(sitePath, pageTsx, { encoding: "utf8" });

  return {
    ok: true,
    action: "website_request",
    summary: "Web generada correctamente.",
    details: {
      displayName: draft.title,
      sector: "web",
      businessType: "website",
      modules: ["hero", "servicios", "propuesta", "contacto"],
    },
    output:
      "He generado una primera landing funcional dentro de la app.\n" +
      "Ruta disponible: /site\n" +
      "Puedes seguir iterando desde el chat con cambios de estructura, copy o estilo.",
  };
}
