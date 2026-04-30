import Link from "next/link";
import PublicNav from "@/components/public-nav";

export const metadata = {
  title: "Términos de servicio · Prontara",
};

const COMPANY_NAME = process.env.PRONTARA_LEGAL_COMPANY_NAME || "Prontara";
const COMPANY_NIF = process.env.PRONTARA_LEGAL_NIF || "[Pendiente de configurar PRONTARA_LEGAL_NIF]";
const COMPANY_ADDRESS =
  process.env.PRONTARA_LEGAL_ADDRESS ||
  "[Pendiente de configurar PRONTARA_LEGAL_ADDRESS]";
const CONTACT_EMAIL = process.env.PRONTARA_LEGAL_EMAIL || "hola@prontara.com";
const LAST_UPDATED = "27 de abril de 2026";

export default function TerminosPage() {
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
        <h1 style={{ fontSize: 36, marginTop: 0, lineHeight: 1.2 }}>Términos de servicio</h1>
        <p style={{ color: "#4b5563", fontSize: 16 }}>
          Estos términos regulan el uso de Prontara, el ERP online ofrecido por {COMPANY_NAME}.
          Al contratar el servicio, el cliente acepta estas condiciones. Si no estás de acuerdo,
          no contrates el servicio.
        </p>

        <Section title="1. Quiénes somos">
          <p>
            {COMPANY_NAME}, con NIF {COMPANY_NIF}, domicilio en {COMPANY_ADDRESS}, contacto en{" "}
            <a href={"mailto:" + CONTACT_EMAIL}>{CONTACT_EMAIL}</a>. En adelante &ldquo;Prontara&rdquo; o &ldquo;nosotros&rdquo;.
          </p>
        </Section>

        <Section title="2. Qué es el servicio">
          <p>
            Prontara es un software como servicio (SaaS) que proporciona un entorno de gestión
            empresarial (ERP) configurable por sectores. Se accede vía navegador desde una URL
            dedicada al cliente.
          </p>
          <p>El servicio se presta en dos componentes diferenciados:</p>
          <ul>
            <li>
              <strong>Alta del entorno</strong> — pago único al contratar el plan elegido (Básico
              590 €, Estándar 990 € o Premium 1.490 €). Da acceso a la configuración del vertical
              y a los módulos contratados.
            </li>
            <li>
              <strong>Soporte mensual</strong> — opcional, 12 € por usuario concurrente al mes.
              Incluye actualizaciones del producto, parches de seguridad y asistencia humana en
              horario laboral. Cancelable mes a mes.
            </li>
          </ul>
        </Section>

        <Section title="3. Cuenta y uso">
          <p>
            El cliente nombra a una persona como administrador (owner) que será responsable de
            las cuentas creadas dentro de su entorno. El cliente se compromete a:
          </p>
          <ul>
            <li>Mantener la confidencialidad de las credenciales.</li>
            <li>No usar el servicio para fines ilegales o que vulneren derechos de terceros.</li>
            <li>No intentar acceder a entornos de otros clientes.</li>
            <li>No revender el acceso al servicio a terceros sin autorización expresa.</li>
          </ul>
          <p>
            Prontara puede suspender el servicio si detecta uso indebido, previa comunicación
            cuando sea posible.
          </p>
        </Section>

        <Section title="4. Precios, pagos y facturación">
          <p>
            Los precios son los publicados en{" "}
            <Link href="/precios" style={{ color: "#1d4ed8" }}>/precios</Link>. Sujetos a IVA
            según legislación española. Pagos vía Stripe (tarjeta) o transferencia bancaria a
            petición.
          </p>
          <p>
            <strong>Alta:</strong> pago único, factura emitida tras el cobro. No reembolsable,
            salvo lo indicado en la sección 5.
          </p>
          <p>
            <strong>Soporte:</strong> facturación mensual por adelantado al inicio de cada
            periodo, calculada según los usuarios concurrentes facturados. El cliente puede
            cambiar el número de usuarios o cancelar antes del cierre del periodo.
          </p>
        </Section>

        <Section title="5. Periodo de prueba">
          <p>
            Cada nuevo entorno tiene 14 días de prueba sin cargo, sin tarjeta requerida. Durante
            ese periodo el cliente puede usar todas las funcionalidades del plan correspondiente.
          </p>
          <p>
            Si el cliente paga el alta dentro de los primeros 7 días tras el alta y no hace uso
            sustancial del entorno (definido como tener menos de 10 registros operativos
            creados), Prontara devolverá íntegramente el importe a petición.
          </p>
        </Section>

        <Section title="6. Datos del cliente y propiedad">
          <p>
            <strong>Los datos del cliente son y siguen siendo del cliente.</strong> Prontara
            actúa como encargado de tratamiento conforme al RGPD. El cliente puede exportar sus
            datos en CSV o JSON desde el panel de administración en cualquier momento, durante
            la vigencia del contrato y hasta 30 días tras su finalización.
          </p>
          <p>
            Tras 30 días de finalizado el contrato, los datos del cliente se eliminan de
            nuestros servidores activos. Los backups con datos del cliente se eliminan en el
            siguiente ciclo de rotación (máximo 60 días).
          </p>
          <p>
            Prontara <strong>no vende ni cede</strong> los datos de los clientes a terceros con
            fines comerciales.
          </p>
        </Section>

        <Section title="7. Disponibilidad del servicio">
          <p>
            Prontara aspira a un objetivo de disponibilidad mensual del 99 %, excluyendo paradas
            programadas anunciadas con al menos 48 h de antelación. No constituye un SLA
            contractual con compensaciones automáticas.
          </p>
          <p>
            Las paradas no programadas se comunicarán por email o por la propia interfaz de
            Prontara. Los daños indirectos derivados de la indisponibilidad no se asumen.
          </p>
        </Section>

        <Section title="8. Limitación de responsabilidad">
          <p>
            La responsabilidad máxima de Prontara frente al cliente, por cualquier concepto, queda
            limitada al importe pagado por el cliente en los 12 meses inmediatamente anteriores
            al hecho que dé lugar a la reclamación.
          </p>
          <p>
            Prontara no se responsabiliza de pérdidas indirectas, lucro cesante o daños
            consecuenciales derivados del uso o imposibilidad de uso del servicio.
          </p>
          <p>
            Prontara <strong>no</strong> sustituye a un asesor fiscal, contable o jurídico. El
            cliente es responsable de cumplir con las obligaciones fiscales y normativas
            aplicables a su negocio.
          </p>
        </Section>

        <Section title="9. Cancelación">
          <p>
            El cliente puede cancelar el soporte mensual cuando quiera desde el panel de
            suscripción. La cancelación es efectiva al final del periodo facturado actual; no se
            prorratean periodos parciales.
          </p>
          <p>
            Tras cancelar el soporte, el cliente conserva acceso al ERP en modo lectura durante
            los 30 días siguientes para exportar datos y descargar facturas.
          </p>
        </Section>

        <Section title="10. Modificaciones">
          <p>
            Estos términos pueden actualizarse cuando sea necesario para reflejar cambios en el
            servicio o en la legislación. Los cambios sustanciales se comunicarán por email con
            30 días de antelación. Los cambios menores (correcciones, aclaraciones) se publican
            directamente.
          </p>
        </Section>

        <Section title="11. Ley aplicable y jurisdicción">
          <p>
            Estos términos se rigen por la legislación española. Para cualquier controversia, las
            partes se someten a los juzgados y tribunales del domicilio del consumidor cuando se
            trate de un cliente persona física, o a los juzgados de [Provincia] cuando se trate
            de cliente persona jurídica.
          </p>
        </Section>

        <Section title="12. Contacto">
          <p>
            Para cualquier cuestión sobre estos términos, escribe a{" "}
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
