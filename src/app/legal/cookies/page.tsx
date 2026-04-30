import PublicNav from "@/components/public-nav";

export const metadata = {
  title: "Política de cookies · Prontara",
};

const COMPANY_NAME = process.env.PRONTARA_LEGAL_COMPANY_NAME || "Prontara";
const CONTACT_EMAIL = process.env.PRONTARA_LEGAL_EMAIL || "hola@prontara.com";
const LAST_UPDATED = "27 de abril de 2026";

export default function CookiesPage() {
  return (
    <main style={{ fontFamily: "Arial, sans-serif", color: "#111827", background: "#ffffff" }}>
      <PublicNav />
      <article
        style={{
          maxWidth: 800,
          margin: "0 auto",
          padding: "48px 24px 64px",
          lineHeight: 1.7,
        }}
      >
        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>
          Última actualización: {LAST_UPDATED}
        </div>
        <h1 style={{ fontSize: 36, marginTop: 0, lineHeight: 1.2 }}>Política de cookies</h1>
        <p style={{ color: "#4b5563", fontSize: 16 }}>
          Esta página explica las cookies que {COMPANY_NAME} usa en su web pública y en el ERP.
        </p>

        <Section title="1. Qué son las cookies">
          <p>
            Una cookie es un pequeño archivo que un sitio web guarda en tu navegador para
            recordar información entre visitas (idioma, sesión iniciada, preferencias).
          </p>
        </Section>

        <Section title="2. Cookies que usamos">
          <p>
            Prontara usa el mínimo imprescindible para funcionar.{" "}
            <strong>No usamos cookies publicitarias ni de seguimiento de terceros.</strong>
          </p>

          <h3 style={{ fontSize: 16, marginTop: 16 }}>2.1. Cookies estrictamente necesarias (no requieren consentimiento)</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, marginTop: 12 }}>
            <thead>
              <tr style={{ background: "#f9fafb", textAlign: "left" }}>
                <th style={th()}>Nombre</th>
                <th style={th()}>Finalidad</th>
                <th style={th()}>Duración</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: "1px solid #f3f4f6" }}>
                <td style={td()}><code>prontara_session</code></td>
                <td style={td()}>
                  Mantener tu sesión iniciada en el ERP. Sin esta cookie no puedes usar el
                  servicio mientras estés autenticado.
                </td>
                <td style={td()}>7 días</td>
              </tr>
            </tbody>
          </table>

          <h3 style={{ fontSize: 16, marginTop: 24 }}>2.2. Cookies de sesión técnicas</h3>
          <p>
            La aplicación puede usar almacenamiento local del navegador (localStorage,
            sessionStorage) para guardar preferencias temporales del usuario actual (último
            tenant accedido, qué pestañas tenías abiertas en el editor). Esto no son cookies en
            sentido estricto y no se envían a ningún servidor; viven solo en tu dispositivo.
          </p>
        </Section>

        <Section title="3. Cookies que NO usamos">
          <ul>
            <li>Google Analytics u otros analytics de terceros.</li>
            <li>Cookies publicitarias.</li>
            <li>Pixel de Facebook, LinkedIn ni similares.</li>
            <li>Sistemas de retargeting o tracking comportamental.</li>
          </ul>
          <p>
            Si en el futuro incorporamos analytics, será con una herramienta que no use cookies
            (servidor) o pidiendo consentimiento explícito antes de cargarla.
          </p>
        </Section>

        <Section title="4. Cómo gestionar las cookies">
          <p>
            Puedes borrar las cookies almacenadas y bloquear las nuevas desde la configuración
            de tu navegador. Si bloqueas <code>prontara_session</code>, no podrás iniciar sesión
            en el ERP.
          </p>
          <ul>
            <li>
              <a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer">
                Cómo borrar cookies en Chrome
              </a>
            </li>
            <li>
              <a href="https://support.mozilla.org/es/kb/limpiar-cookies-borrar-datos-paginas" target="_blank" rel="noopener noreferrer">
                Cómo borrar cookies en Firefox
              </a>
            </li>
            <li>
              <a href="https://support.apple.com/es-es/guide/safari/sfri11471/mac" target="_blank" rel="noopener noreferrer">
                Cómo borrar cookies en Safari
              </a>
            </li>
            <li>
              <a href="https://support.microsoft.com/es-es/microsoft-edge/eliminar-las-cookies-en-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09" target="_blank" rel="noopener noreferrer">
                Cómo borrar cookies en Edge
              </a>
            </li>
          </ul>
        </Section>

        <Section title="5. Contacto">
          <p>
            Para cualquier consulta sobre cookies, escribe a{" "}
            <a href={"mailto:" + CONTACT_EMAIL}>{CONTACT_EMAIL}</a>.
          </p>
        </Section>

        <hr style={{ border: 0, borderTop: "1px solid #e5e7eb", margin: "40px 0 20px" }} />
        <p style={{ fontSize: 12, color: "#9ca3af" }}>
          Documento adaptable. Verificado por asesor antes de uso comercial real.
        </p>
      </article>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 32 }}>
      <h2 style={{ fontSize: 22, color: "#111827" }}>{title}</h2>
      <div style={{ color: "#374151", fontSize: 15 }}>{children}</div>
    </section>
  );
}

function th(): React.CSSProperties {
  return { padding: "8px 12px", fontWeight: 700, color: "#374151", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.4 };
}

function td(): React.CSSProperties {
  return { padding: "10px 12px", color: "#111827" };
}
