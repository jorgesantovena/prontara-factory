import Link from "next/link";
import PublicNav from "@/components/public-nav";
import PublicFooter from "@/components/public-footer";
import {
  CONTRACT_PROVIDER as PROVIDER,
  CONTRACT_VERSION,
  CONTRACT_LAST_UPDATED,
  CONTRACT_PLAN_LABEL,
  CONTRACT_PLAN_FEATURES,
  formatContractEuros,
} from "@/lib/saas/contract-content";
import { getPlanDefinition } from "@/lib/saas/billing-store";

export const metadata = {
  title: "Contrato de servicio · Prontara",
  description:
    "Lee íntegramente el contrato de prestación de servicios de Prontara antes de contratar. Datos de SISPYME, S.L., precios, RGPD, cancelación y jurisdicción.",
  alternates: {
    canonical: "/contrato",
  },
};

/**
 * Página pública /contrato.
 *
 * Muestra el contrato base que el cliente firma electrónicamente al pagar
 * el alta. Es exactamente el mismo contenido que se le adjunta como PDF en
 * el email de bienvenida, salvo los huecos personalizados (nombre cliente,
 * importe del plan elegido, fecha de firma).
 *
 * Existir esta página tiene 3 motivos:
 *   1. Reduce fricción legal: el cliente puede leer las condiciones antes
 *      de pagar.
 *   2. Cumple LSSI-CE: las condiciones del servicio deben ser accesibles
 *      ANTES de la formalización del contrato, no solo después.
 *   3. Mejora SEO: una URL pública con el contrato indica a los buscadores
 *      que somos un proveedor con condiciones contractuales transparentes.
 */
export default function ContratoPage() {
  const basico = getPlanDefinition("basico");
  const estandar = getPlanDefinition("estandar");
  const premium = getPlanDefinition("premium");
  const supportPerUser = basico.supportMonthlyCentsPerUser ?? 1200;

  return (
    <main style={{ fontFamily: "Arial, sans-serif", color: "#111827", background: "#ffffff" }}>
      <PublicNav />

      <article
        style={{
          maxWidth: 820,
          margin: "0 auto",
          padding: "48px 24px 24px",
          lineHeight: 1.7,
        }}
      >
        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>
          Versión {CONTRACT_VERSION} · Última actualización: {CONTRACT_LAST_UPDATED}
        </div>
        <h1 style={{ fontSize: 36, marginTop: 0, lineHeight: 1.2 }}>
          Contrato de prestación de servicios SaaS
        </h1>
        <p style={{ color: "#4b5563", fontSize: 16 }}>
          Este es el contrato que firmas electrónicamente al contratar Prontara. La
          aceptación se produce al completar el pago a través de Stripe. Recibes una
          copia idéntica en PDF junto con tus credenciales de acceso, tras el pago,
          en el correo electrónico que indicaste al darte de alta.
        </p>

        <CallOut>
          <strong>Información clave de un vistazo:</strong>
          <ul style={{ margin: "8px 0 0 20px", padding: 0, fontSize: 14, lineHeight: 1.6 }}>
            <li>Prestador: <strong>{PROVIDER.legalName}</strong> · CIF {PROVIDER.cif}</li>
            <li>Servicio: <strong>{PROVIDER.productName}</strong> ({PROVIDER.productSite})</li>
            <li>
              Pago de alta: {formatContractEuros(basico.setupFeeCents)} ·{" "}
              {formatContractEuros(estandar.setupFeeCents)} ·{" "}
              {formatContractEuros(premium.setupFeeCents)} (según plan, IVA no incluido)
            </li>
            <li>
              Soporte: {formatContractEuros(supportPerUser)} por usuario concurrente al
              mes (IVA no incluido, cancelable mes a mes)
            </li>
            <li>Jurisdicción: Juzgados de {PROVIDER.jurisdiction}, {PROVIDER.province}, España</li>
          </ul>
        </CallOut>

        <Section title="1. Partes contratantes">
          <p>
            De una parte, la entidad prestadora del servicio (en adelante, &ldquo;el Prestador&rdquo;):
          </p>
          <KeyValueBlock
            entries={[
              ["Denominación social", PROVIDER.legalName],
              ["CIF", PROVIDER.cif],
              ["Domicilio social", PROVIDER.address],
              ["Email", PROVIDER.email],
              ["Teléfono", PROVIDER.phone],
            ]}
          />
          <p>De otra parte, el cliente contratante (en adelante, &ldquo;el Cliente&rdquo;):</p>
          <KeyValueBlock
            entries={[
              ["Empresa", "[Tu razón social, indicada al hacer el pago]"],
              ["Persona de contacto", "[Tu nombre, indicado al hacer el pago]"],
              ["Email", "[El email con el que te das de alta]"],
              ["Identificador de cuenta Prontara", "[Asignado automáticamente al crear el entorno]"],
            ]}
          />
        </Section>

        <Section title="2. Objeto del contrato">
          <p>
            El Prestador concede al Cliente una licencia de uso no exclusiva e
            intransferible del servicio {PROVIDER.productName} en el plan contratado
            (Básico, Estándar o Premium) durante el periodo de vigencia del presente
            contrato, conforme a las condiciones aquí descritas y a las publicadas en{" "}
            <Link href="/precios" style={{ color: "#1d4ed8" }}>
              {PROVIDER.productSite}/precios
            </Link>
            .
          </p>
        </Section>

        <Section title="3. Alcance de los planes">
          <p>
            El Cliente contrata uno de los siguientes planes en el momento del pago:
          </p>

          <PlanBlock
            label={CONTRACT_PLAN_LABEL.basico}
            price={formatContractEuros(basico.setupFeeCents)}
            features={CONTRACT_PLAN_FEATURES.basico}
          />
          <PlanBlock
            label={CONTRACT_PLAN_LABEL.estandar}
            price={formatContractEuros(estandar.setupFeeCents)}
            features={CONTRACT_PLAN_FEATURES.estandar}
            featured
          />
          <PlanBlock
            label={CONTRACT_PLAN_LABEL.premium}
            price={formatContractEuros(premium.setupFeeCents)}
            features={CONTRACT_PLAN_FEATURES.premium}
          />

          <p style={{ marginTop: 16, fontSize: 13, color: "#6b7280" }}>
            El Cliente que opta por el periodo de prueba (Trial) no abona ninguna
            cantidad durante 14 días. Pasado ese plazo, el servicio se suspende salvo
            que se contrate uno de los planes de pago.
          </p>
        </Section>

        <Section title="4. Precio y forma de pago">
          <p>El precio del servicio se estructura en dos componentes:</p>
          <ul>
            <li>
              <strong>Pago único de alta</strong>:{" "}
              {formatContractEuros(basico.setupFeeCents)} (Básico),{" "}
              {formatContractEuros(estandar.setupFeeCents)} (Estándar) o{" "}
              {formatContractEuros(premium.setupFeeCents)} (Premium), todos sin IVA.
              Se abona a la firma del presente contrato mediante tarjeta a través del
              procesador Stripe.
            </li>
            <li>
              <strong>Suscripción mensual de soporte y operación</strong>:{" "}
              {formatContractEuros(supportPerUser)} (IVA no incluido) por usuario
              concurrente al mes. Cobro automático mensual mediante tarjeta. La
              medición de usuarios concurrentes es automática y se ajusta al cierre
              de cada periodo mensual.
            </li>
          </ul>
          <p>
            El Cliente declara aceptar las condiciones de pago descritas. La factura se
            emite electrónicamente con los datos fiscales del Cliente y se envía al
            email indicado.
          </p>
        </Section>

        <Section title="5. Duración y renovación">
          <p>
            El presente contrato tiene una duración indefinida desde la fecha de firma.
            La suscripción mensual se renueva automáticamente cada mes salvo
            cancelación expresa.
          </p>
          <p>
            El Cliente puede cancelar la suscripción en cualquier momento con efectos
            al final del periodo mensual en curso, sin penalización ni necesidad de
            aviso previo, accediendo a su panel de suscripción dentro del servicio.
          </p>
        </Section>

        <Section title="6. Protección de datos personales">
          <p>
            El tratamiento de los datos personales se rige por la{" "}
            <Link href="/legal/privacidad" style={{ color: "#1d4ed8" }}>
              Política de Privacidad
            </Link>{" "}
            publicada en {PROVIDER.productSite}/legal/privacidad, que el Cliente
            declara conocer y aceptar.
          </p>
          <p>
            El Prestador actúa como <strong>Responsable del Tratamiento</strong>{" "}
            respecto de los datos identificativos y de facturación del Cliente, y como{" "}
            <strong>Encargado del Tratamiento</strong> respecto de los datos operativos
            que el Cliente y sus usuarios introduzcan en el ERP, conforme al artículo
            28 del RGPD.
          </p>
        </Section>

        <Section title="7. Disponibilidad y soporte">
          <p>
            El Prestador realiza sus mejores esfuerzos para mantener una disponibilidad
            mensual del servicio del 99 %, excluyendo paradas programadas de
            mantenimiento y causas de fuerza mayor.
          </p>
          <p>
            El soporte técnico se presta por correo electrónico en{" "}
            <a href={"mailto:" + PROVIDER.productEmail} style={{ color: "#1d4ed8" }}>
              {PROVIDER.productEmail}
            </a>{" "}
            en horario laboral peninsular (lunes a viernes, 9:00–18:00 CET). En el plan
            Premium se incluye soporte prioritario.
          </p>
        </Section>

        <Section title="8. Cancelación y portabilidad de los datos">
          <p>
            Al finalizar el contrato, sea por cancelación voluntaria del Cliente o por
            impago, el Prestador conservará los datos del Cliente durante <strong>30
            días naturales</strong> en modo solo lectura para permitir su exportación.
          </p>
          <p>
            El Cliente puede exportar sus datos en formatos estándar (CSV, Excel, JSON)
            en cualquier momento desde el propio servicio o solicitándolo a{" "}
            <a href={"mailto:" + PROVIDER.productEmail} style={{ color: "#1d4ed8" }}>
              {PROVIDER.productEmail}
            </a>
            . Transcurridos los 30 días, los datos serán eliminados de forma permanente
            excepto los datos fiscales que la legislación obligue a conservar (6 años
            por norma mercantil/tributaria).
          </p>
        </Section>

        <Section title="9. Limitación de responsabilidad">
          <p>
            La responsabilidad total del Prestador frente al Cliente por cualquier
            reclamación derivada del presente contrato queda limitada al importe
            efectivamente pagado por el Cliente durante los 12 meses inmediatamente
            anteriores al hecho generador de la reclamación.
          </p>
          <p>
            El Prestador no será responsable de los daños indirectos, incluyendo
            pérdida de beneficios, lucro cesante o daño reputacional.
          </p>
        </Section>

        <Section title="10. Legislación aplicable y jurisdicción">
          <p>
            El presente contrato se rige por la legislación española. Las partes se
            someten expresamente a los Juzgados y Tribunales de {PROVIDER.jurisdiction}{" "}
            ({PROVIDER.province}) para la resolución de cualquier controversia, salvo
            que la legislación aplicable al consumidor disponga lo contrario.
          </p>
        </Section>

        <Section title="11. Aceptación">
          <p>
            El Cliente declara haber leído y aceptado el presente contrato y la{" "}
            <Link href="/legal/privacidad" style={{ color: "#1d4ed8" }}>
              Política de Privacidad
            </Link>{" "}
            asociada al realizar el pago. La aceptación electrónica del servicio
            mediante el cobro a través de Stripe equivale a la firma del contrato a
            todos los efectos previstos en la Ley 34/2002 (LSSI-CE) y en el Código
            Civil español.
          </p>
        </Section>

        <hr style={{ border: 0, borderTop: "1px solid #e5e7eb", margin: "40px 0 24px" }} />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 24,
            fontSize: 13,
            color: "#374151",
          }}
        >
          <div>
            <div style={{ fontWeight: 700, color: "#111827", marginBottom: 4 }}>
              Por el Prestador
            </div>
            <div style={{ fontSize: 14 }}>{PROVIDER.legalName}</div>
            <div style={{ color: "#6b7280", fontSize: 12 }}>CIF {PROVIDER.cif}</div>
            <div style={{ color: "#6b7280", fontSize: 12 }}>
              {PROVIDER.city}, fecha de firma electrónica
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 700, color: "#111827", marginBottom: 4 }}>
              Por el Cliente
            </div>
            <div style={{ fontSize: 14 }}>[Tu empresa]</div>
            <div style={{ color: "#6b7280", fontSize: 12 }}>[Tu nombre]</div>
            <div style={{ color: "#6b7280", fontSize: 12 }}>
              Aceptado electrónicamente al completar el pago
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: 40,
            padding: 20,
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            borderRadius: 12,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div style={{ fontSize: 14, color: "#1e3a8a", fontWeight: 600 }}>
            ¿Listo para empezar? Tienes 14 días de prueba gratis sin tarjeta.
          </div>
          <Link
            href="/alta"
            style={{
              background: "#1d4ed8",
              color: "#fff",
              padding: "10px 20px",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            Empezar prueba gratuita
          </Link>
        </div>

        <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 24 }}>
          Documento marco. La copia con tus datos personales y el importe del plan
          contratado te llega como PDF al email tras completar el pago. Si necesitas el
          texto en otro formato o tienes dudas sobre alguna cláusula, escríbenos a{" "}
          <a href={"mailto:" + PROVIDER.productEmail} style={{ color: "#6b7280" }}>
            {PROVIDER.productEmail}
          </a>
          .
        </p>
      </article>

      <PublicFooter />
    </main>
  );
}

// ─── helpers de presentación ──────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 32 }}>
      <h2 style={{ fontSize: 22, color: "#111827" }}>{title}</h2>
      <div style={{ color: "#374151", fontSize: 15 }}>{children}</div>
    </section>
  );
}

function CallOut({ children }: { children: React.ReactNode }) {
  return (
    <aside
      style={{
        marginTop: 24,
        padding: 16,
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
        borderLeft: "4px solid #1d4ed8",
        borderRadius: 8,
        fontSize: 14,
        color: "#1e293b",
      }}
    >
      {children}
    </aside>
  );
}

function KeyValueBlock({ entries }: { entries: Array<[string, string]> }) {
  return (
    <div
      style={{
        margin: "12px 0",
        padding: "12px 16px",
        background: "#f9fafb",
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        fontSize: 14,
      }}
    >
      {entries.map(([label, value]) => (
        <div key={label} style={{ display: "flex", gap: 8, padding: "4px 0", flexWrap: "wrap" }}>
          <span style={{ fontWeight: 700, color: "#111827", minWidth: 200 }}>{label}:</span>
          <span style={{ color: "#374151", flex: 1, minWidth: 200 }}>{value}</span>
        </div>
      ))}
    </div>
  );
}

function PlanBlock({
  label,
  price,
  features,
  featured,
}: {
  label: string;
  price: string;
  features: string[];
  featured?: boolean;
}) {
  return (
    <div
      style={{
        marginTop: 16,
        padding: 16,
        border: featured ? "2px solid #1d4ed8" : "1px solid #e5e7eb",
        borderRadius: 10,
        background: featured ? "#f0f7ff" : "#ffffff",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: "#0f172a" }}>
          Plan {label}
          {featured ? (
            <span
              style={{
                marginLeft: 8,
                fontSize: 11,
                fontWeight: 600,
                color: "#1d4ed8",
                background: "#dbeafe",
                padding: "2px 8px",
                borderRadius: 999,
              }}
            >
              Recomendado
            </span>
          ) : null}
        </div>
        <div style={{ fontSize: 14, color: "#374151" }}>
          Pago único de alta: <strong>{price}</strong> + soporte mensual
        </div>
      </div>
      <ul style={{ margin: "10px 0 0 20px", padding: 0, fontSize: 14, color: "#374151", lineHeight: 1.6 }}>
        {features.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
    </div>
  );
}
