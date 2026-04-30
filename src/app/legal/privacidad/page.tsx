import PublicNav from "@/components/public-nav";

export const metadata = {
  title: "Política de privacidad · Prontara",
};

const COMPANY_NAME = process.env.PRONTARA_LEGAL_COMPANY_NAME || "Prontara";
const COMPANY_NIF = process.env.PRONTARA_LEGAL_NIF || "[Pendiente de configurar PRONTARA_LEGAL_NIF]";
const COMPANY_ADDRESS =
  process.env.PRONTARA_LEGAL_ADDRESS ||
  "[Pendiente de configurar PRONTARA_LEGAL_ADDRESS]";
const CONTACT_EMAIL = process.env.PRONTARA_LEGAL_EMAIL || "hola@prontara.com";
const DPO_EMAIL = process.env.PRONTARA_DPO_EMAIL || CONTACT_EMAIL;
const LAST_UPDATED = "27 de abril de 2026";

export default function PrivacidadPage() {
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
        <h1 style={{ fontSize: 36, marginTop: 0, lineHeight: 1.2 }}>Política de privacidad</h1>
        <p style={{ color: "#4b5563", fontSize: 16 }}>
          Esta política explica cómo {COMPANY_NAME} trata los datos personales que recoge cuando
          usas Prontara. Cumple con el Reglamento General de Protección de Datos (UE 2016/679) y
          con la Ley Orgánica 3/2018 de Protección de Datos.
        </p>

        <Section title="1. Responsable del tratamiento">
          <p>
            <strong>{COMPANY_NAME}</strong>, NIF {COMPANY_NIF}, domicilio en {COMPANY_ADDRESS}.
            <br />
            Contacto: <a href={"mailto:" + CONTACT_EMAIL}>{CONTACT_EMAIL}</a>
            <br />
            Delegado de protección de datos: <a href={"mailto:" + DPO_EMAIL}>{DPO_EMAIL}</a>
          </p>
        </Section>

        <Section title="2. Qué datos recogemos">
          <p>Distinguimos dos perfiles de tratamiento:</p>
          <h3 style={{ fontSize: 16, marginTop: 16 }}>2.1. Visitante de la web pública</h3>
          <ul>
            <li>
              Datos de contacto si rellenas el formulario de <a href="/contacto">/contacto</a>:
              nombre, email, teléfono opcional, empresa, mensaje.
            </li>
            <li>
              Datos técnicos automáticos: dirección IP, navegador, fecha de visita.
              Conservados máximo 30 días para fines de seguridad.
            </li>
          </ul>
          <h3 style={{ fontSize: 16, marginTop: 16 }}>2.2. Cliente del servicio</h3>
          <ul>
            <li>
              Datos identificativos del administrador y miembros del equipo: nombre, email,
              teléfono.
            </li>
            <li>Datos de facturación: razón social, NIF, dirección fiscal, email de facturación.</li>
            <li>
              Datos operativos del cliente cargados en el ERP (clientes, proyectos, facturas,
              etc.). <strong>Estos datos pertenecen al cliente</strong>; Prontara los procesa en
              calidad de encargado del tratamiento.
            </li>
            <li>Logs de acceso: cuándo entras y desde qué IP, para diagnóstico y seguridad.</li>
          </ul>
        </Section>

        <Section title="3. Para qué usamos los datos">
          <ul>
            <li>Prestar el servicio Prontara (gestión del ERP del cliente).</li>
            <li>Facturación, cobro y cumplimiento de obligaciones contables y fiscales.</li>
            <li>Soporte técnico y comunicaciones operativas (avisos de trial, cancelaciones).</li>
            <li>
              Mejora del producto: análisis agregado de uso. No usamos datos identificables del
              cliente para entrenar modelos ni vender perfiles.
            </li>
            <li>Cumplimiento de obligaciones legales (Hacienda, Seguridad Social, etc.).</li>
          </ul>
        </Section>

        <Section title="4. Base jurídica del tratamiento">
          <p>
            <strong>Visitantes web:</strong> tu consentimiento explícito al enviar el formulario,
            o nuestro interés legítimo en la seguridad para los datos técnicos automáticos.
          </p>
          <p>
            <strong>Clientes del servicio:</strong> ejecución del contrato suscrito (los términos
            de servicio) y obligaciones legales (facturación).
          </p>
        </Section>

        <Section title="5. Cuánto tiempo conservamos los datos">
          <ul>
            <li>
              <strong>Leads del formulario web</strong>: hasta 24 meses si no llegan a contratar,
              luego se eliminan o anonimizan.
            </li>
            <li>
              <strong>Datos del cliente activo</strong>: durante toda la vigencia del contrato.
            </li>
            <li>
              <strong>Datos del cliente tras cancelación</strong>: 30 días en servidores activos
              para que el cliente exporte. Después se eliminan. Los backups que los contengan se
              eliminan en el siguiente ciclo de rotación (máximo 60 días).
            </li>
            <li>
              <strong>Datos de facturación y contables</strong>: 6 años (obligación legal
              española) en archivo aislado.
            </li>
            <li>
              <strong>Logs de acceso</strong>: 90 días.
            </li>
          </ul>
        </Section>

        <Section title="6. Con quién compartimos los datos">
          <p>
            Compartimos lo estrictamente necesario con proveedores que nos ayudan a operar.
            Todos están vinculados por un acuerdo de tratamiento de datos (DPA) y operan dentro
            del Espacio Económico Europeo o con garantías equivalentes.
          </p>
          <ul>
            <li>
              <strong>Stripe</strong> (pasarela de pago) — datos de facturación. Stripe Payments
              Europe Ltd., Irlanda.
            </li>
            <li>
              <strong>Resend</strong> (proveedor de email transaccional) — emails operativos.
              Resend, Estados Unidos, con cláusulas estándar UE.
            </li>
            <li>
              <strong>Anthropic</strong> (asistente IA del chat) — solo cuando el administrador
              del cliente usa el chat interno; los mensajes se envían a sus modelos. No se
              entrenan con datos del cliente.
            </li>
            <li>
              <strong>Vercel / Neon / [proveedor hosting]</strong> — almacenamiento y cómputo de
              la aplicación.
            </li>
          </ul>
          <p>
            No vendemos datos personales a terceros con fines comerciales. Nunca.
          </p>
        </Section>

        <Section title="7. Tus derechos">
          <p>Como interesado tienes derecho a:</p>
          <ul>
            <li>Acceder a tus datos.</li>
            <li>Rectificarlos si son incorrectos.</li>
            <li>Suprimirlos cuando no sean necesarios para los fines del tratamiento.</li>
            <li>Oponerte al tratamiento o solicitar su limitación.</li>
            <li>
              Portabilidad: recibir tus datos en formato estructurado (CSV/JSON) para
              transferirlos a otro responsable.
            </li>
            <li>Retirar el consentimiento en cualquier momento.</li>
          </ul>
          <p>
            Para ejercerlos, escribe a <a href={"mailto:" + DPO_EMAIL}>{DPO_EMAIL}</a> con copia
            de tu DNI/NIE. Respondemos en menos de 30 días.
          </p>
          <p>
            Si consideras que tratamos tus datos incorrectamente puedes reclamar a la Agencia
            Española de Protección de Datos (<a href="https://www.aepd.es" target="_blank" rel="noopener noreferrer">aepd.es</a>).
          </p>
        </Section>

        <Section title="8. Seguridad">
          <p>
            Aplicamos medidas técnicas y organizativas razonables: cifrado en tránsito (HTTPS),
            cifrado en reposo en la base de datos, contraseñas almacenadas con scrypt salado,
            autenticación con cookies firmadas, log de acceso para detección de anomalías,
            backups automáticos diarios, limitación de personal con acceso a datos del cliente.
          </p>
          <p>
            Si detectamos una brecha que afecte a tus datos, te lo comunicaremos en menos de 72 h
            conforme al RGPD.
          </p>
        </Section>

        <Section title="9. Menores">
          <p>
            Prontara está dirigido a profesionales y empresas. No aceptamos cuentas de menores de
            18 años. Si detectamos que se ha registrado un menor, eliminamos la cuenta y los
            datos asociados.
          </p>
        </Section>

        <Section title="10. Cambios en esta política">
          <p>
            Si introducimos cambios sustanciales, te avisaremos con al menos 30 días de
            antelación por email. Los cambios menores (correcciones, aclaraciones) se publican
            directamente.
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
