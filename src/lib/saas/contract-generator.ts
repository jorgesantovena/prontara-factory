/**
 * Generador del contrato PDF que se adjunta al email post-pago.
 *
 * El cliente recibe tras la compra un email con:
 *   - URL del entorno + usuario admin + contraseña temporal
 *   - Un PDF adjunto con el contrato firmado por SISPYME, S.L.
 *     (responsable del tratamiento, datos fiscales, condiciones del plan,
 *     duración, precios, política de cancelación)
 *
 * Devuelve un Buffer con el PDF listo para adjuntar a un email transaccional.
 */
import PDFDocument from "pdfkit";
import type { BillingPlanKey } from "@/lib/saas/billing-definition";
import {
  CONTRACT_PROVIDER as PROVIDER,
  CONTRACT_PLAN_LABEL as PLAN_LABEL,
  CONTRACT_PLAN_FEATURES as PLAN_FEATURES,
  formatContractEuros as formatEuros,
  formatContractDate as formatDate,
} from "@/lib/saas/contract-content";

export type ContractInput = {
  /** ID del tenant (clientId interno) */
  clientId: string;
  /** Razón social o nombre del cliente que firma */
  customerName: string;
  /** Email del cliente */
  customerEmail: string;
  /** Empresa del cliente (puede coincidir con customerName) */
  customerCompany: string;
  /** Plan contratado */
  planKey: BillingPlanKey;
  /** Importe del setup en céntimos */
  setupAmountCents: number;
  /** Importe del soporte mensual por usuario en céntimos */
  monthlySupportCentsPerUser: number;
  /** Stripe checkout session id (para trazabilidad) */
  stripeCheckoutSessionId?: string;
  /** Fecha del contrato (default: ahora) */
  signedAt?: Date;
};

/**
 * Genera el contrato como PDF. Devuelve un Buffer listo para adjuntar al
 * email transaccional con el header `Content-Type: application/pdf`.
 */
export async function generateContractPdf(input: ContractInput): Promise<Buffer> {
  const signedAt = input.signedAt || new Date();
  const planLabel = PLAN_LABEL[input.planKey];
  const features = PLAN_FEATURES[input.planKey];

  return await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 56,
      info: {
        Title:
          "Contrato de prestación de servicios — " +
          PROVIDER.productName +
          " " +
          planLabel,
        Author: PROVIDER.legalName,
        Subject: "Contrato de servicio Prontara",
        Creator: PROVIDER.productName,
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // === Cabecera ===
    doc
      .fillColor("#1d4ed8")
      .fontSize(10)
      .font("Helvetica-Bold")
      .text("PRONTARA · CONTRATO DE PRESTACIÓN DE SERVICIOS", {
        characterSpacing: 1.5,
      });

    doc.moveDown(0.4);
    doc
      .fillColor("#0f172a")
      .fontSize(20)
      .font("Helvetica-Bold")
      .text("Contrato de prestación de servicios SaaS");

    doc.moveDown(0.3);
    doc
      .fillColor("#6b7280")
      .fontSize(10)
      .font("Helvetica")
      .text(
        "Plan " +
          planLabel +
          " · Versión 1.0 · Firmado el " +
          formatDate(signedAt),
      );

    doc.moveDown(1.5);

    // === Partes ===
    sectionTitle(doc, "1. Partes contratantes");

    paragraph(
      doc,
      "De una parte, la entidad prestadora del servicio (en adelante, “el Prestador”):",
    );
    doc.moveDown(0.3);
    keyValue(doc, "Denominación social", PROVIDER.legalName);
    keyValue(doc, "CIF", PROVIDER.cif);
    keyValue(doc, "Domicilio social", PROVIDER.address);
    keyValue(doc, "Email", PROVIDER.email);
    keyValue(doc, "Teléfono", PROVIDER.phone);

    doc.moveDown(0.5);
    paragraph(doc, "De otra parte, el cliente contratante (en adelante, “el Cliente”):");
    doc.moveDown(0.3);
    keyValue(doc, "Empresa", input.customerCompany);
    keyValue(doc, "Persona de contacto", input.customerName);
    keyValue(doc, "Email", input.customerEmail);
    keyValue(doc, "Identificador de cuenta Prontara", input.clientId);

    doc.moveDown(1);

    // === Objeto ===
    sectionTitle(doc, "2. Objeto del contrato");
    paragraph(
      doc,
      "El Prestador concede al Cliente una licencia de uso no exclusiva e intransferible del servicio Prontara en su modalidad “" +
        planLabel +
        "” durante el periodo de vigencia del presente contrato, conforme a las condiciones aquí descritas y a las publicadas en " +
        PROVIDER.productSite +
        ".",
    );

    // === Alcance ===
    sectionTitle(doc, "3. Alcance del plan " + planLabel);
    for (const feature of features) {
      bulletItem(doc, feature);
    }

    // === Precio y forma de pago ===
    sectionTitle(doc, "4. Precio y forma de pago");
    paragraph(
      doc,
      "El precio del servicio se estructura en dos componentes:",
    );
    doc.moveDown(0.3);
    bulletItem(
      doc,
      "Pago único de alta: " +
        formatEuros(input.setupAmountCents) +
        " (IVA no incluido), abonado a la firma del presente contrato mediante tarjeta a través del procesador Stripe.",
    );
    bulletItem(
      doc,
      "Suscripción mensual de soporte y operación: " +
        formatEuros(input.monthlySupportCentsPerUser) +
        " (IVA no incluido) por usuario concurrente al mes. Cobro automático mensual mediante tarjeta. La medición de usuarios concurrentes es automática y se ajusta al cierre de cada periodo mensual.",
    );

    doc.moveDown(0.4);
    paragraph(
      doc,
      "El Cliente declara aceptar las condiciones de pago descritas. La factura se emite electrónicamente con los datos fiscales del Cliente y se envía al email indicado.",
    );

    if (input.stripeCheckoutSessionId) {
      doc.moveDown(0.3);
      doc
        .fillColor("#6b7280")
        .fontSize(9)
        .font("Helvetica")
        .text(
          "Referencia interna del pago: " + input.stripeCheckoutSessionId,
        );
    }

    // === Duración ===
    sectionTitle(doc, "5. Duración y renovación");
    paragraph(
      doc,
      "El presente contrato tiene una duración indefinida desde la fecha de firma. La suscripción mensual se renueva automáticamente cada mes salvo cancelación expresa.",
    );
    paragraph(
      doc,
      "El Cliente puede cancelar la suscripción en cualquier momento con efectos al final del periodo mensual en curso, sin penalización ni necesidad de aviso previo, accediendo a su panel de suscripción dentro del servicio.",
    );

    // === Tratamiento de datos ===
    sectionTitle(doc, "6. Protección de datos personales");
    paragraph(
      doc,
      "El tratamiento de los datos personales se rige por la Política de Privacidad publicada en " +
        PROVIDER.productSite +
        "/privacidad, que el Cliente declara conocer y aceptar.",
    );
    paragraph(
      doc,
      "El Prestador actúa como Responsable del Tratamiento respecto de los datos identificativos y de facturación del Cliente, y como Encargado del Tratamiento respecto de los datos operativos que el Cliente y sus usuarios introduzcan en el ERP, conforme al artículo 28 del RGPD.",
    );

    // === Disponibilidad y soporte ===
    sectionTitle(doc, "7. Disponibilidad y soporte");
    paragraph(
      doc,
      "El Prestador realiza sus mejores esfuerzos para mantener una disponibilidad mensual del servicio del 99 %, excluyendo paradas programadas de mantenimiento y causas de fuerza mayor.",
    );
    paragraph(
      doc,
      "El soporte técnico se presta por correo electrónico en " +
        PROVIDER.productEmail +
        " en horario laboral peninsular (lunes a viernes, 9:00–18:00 CET). En el plan Premium se incluye soporte prioritario.",
    );

    // === Cancelación y portabilidad ===
    sectionTitle(doc, "8. Cancelación y portabilidad de los datos");
    paragraph(
      doc,
      "Al finalizar el contrato, sea por cancelación voluntaria del Cliente o por impago, el Prestador conservará los datos del Cliente durante 30 días naturales en modo solo lectura para permitir su exportación.",
    );
    paragraph(
      doc,
      "El Cliente puede exportar sus datos en formatos estándar (CSV, Excel, JSON) en cualquier momento desde el propio servicio o solicitándolo a " +
        PROVIDER.productEmail +
        ". Transcurridos los 30 días, los datos serán eliminados de forma permanente excepto los datos fiscales que la legislación obligue a conservar (6 años por norma mercantil/tributaria).",
    );

    // === Limitación de responsabilidad ===
    sectionTitle(doc, "9. Limitación de responsabilidad");
    paragraph(
      doc,
      "La responsabilidad total del Prestador frente al Cliente por cualquier reclamación derivada del presente contrato queda limitada al importe efectivamente pagado por el Cliente durante los 12 meses inmediatamente anteriores al hecho generador de la reclamación.",
    );
    paragraph(
      doc,
      "El Prestador no será responsable de los daños indirectos, incluyendo pérdida de beneficios, lucro cesante o daño reputacional.",
    );

    // === Legislación ===
    sectionTitle(doc, "10. Legislación aplicable y jurisdicción");
    paragraph(
      doc,
      "El presente contrato se rige por la legislación española. Las partes se someten expresamente a los Juzgados y Tribunales de Oviedo (Asturias) para la resolución de cualquier controversia, salvo que la legislación aplicable al consumidor disponga lo contrario.",
    );

    // === Firma ===
    sectionTitle(doc, "11. Aceptación");
    paragraph(
      doc,
      "El Cliente declara haber leído y aceptado el presente contrato y la Política de Privacidad asociada al realizar el pago. La aceptación electrónica del servicio mediante el cobro mediante Stripe equivale a la firma del contrato a todos los efectos previstos en la Ley 34/2002 (LSSI-CE) y en el Código Civil español.",
    );

    doc.moveDown(1);

    // Bloque de firmas
    const x1 = doc.page.margins.left;
    const x2 = doc.page.margins.left + 280;
    const y = doc.y;

    doc
      .fillColor("#0f172a")
      .fontSize(10)
      .font("Helvetica-Bold")
      .text("Por el Prestador", x1, y);
    doc
      .fontSize(11)
      .font("Helvetica")
      .text(PROVIDER.legalName, x1, y + 16);
    doc
      .fontSize(9)
      .fillColor("#6b7280")
      .text("CIF " + PROVIDER.cif, x1, y + 32);
    doc.text("Pola de Siero, " + formatDate(signedAt), x1, y + 46);

    doc
      .fillColor("#0f172a")
      .fontSize(10)
      .font("Helvetica-Bold")
      .text("Por el Cliente", x2, y);
    doc
      .fontSize(11)
      .font("Helvetica")
      .text(input.customerCompany, x2, y + 16);
    doc
      .fontSize(9)
      .fillColor("#6b7280")
      .text(input.customerName, x2, y + 32);
    doc.text(
      "Aceptado electrónicamente el " + formatDate(signedAt),
      x2,
      y + 46,
    );

    // Footer
    const pageBottom = doc.page.height - doc.page.margins.bottom + 20;
    doc
      .fillColor("#94a3b8")
      .fontSize(8)
      .font("Helvetica")
      .text(
        PROVIDER.legalName +
          " · CIF " +
          PROVIDER.cif +
          " · " +
          PROVIDER.address +
          " · " +
          PROVIDER.productSite,
        doc.page.margins.left,
        pageBottom,
        {
          width:
            doc.page.width - doc.page.margins.left - doc.page.margins.right,
          align: "center",
        },
      );

    doc.end();
  });
}

// ─── helpers ───────────────────────────────────────────────────────────

function sectionTitle(doc: PDFKit.PDFDocument, text: string) {
  doc.moveDown(0.8);
  doc
    .fillColor("#0f172a")
    .fontSize(13)
    .font("Helvetica-Bold")
    .text(text);
  doc.moveDown(0.3);
}

function paragraph(doc: PDFKit.PDFDocument, text: string) {
  doc
    .fillColor("#1e293b")
    .fontSize(10.5)
    .font("Helvetica")
    .text(text, { align: "justify", lineGap: 2 });
  doc.moveDown(0.4);
}

function keyValue(doc: PDFKit.PDFDocument, label: string, value: string) {
  doc
    .fillColor("#0f172a")
    .fontSize(10)
    .font("Helvetica-Bold")
    .text(label + ": ", { continued: true })
    .font("Helvetica")
    .fillColor("#1e293b")
    .text(value);
  doc.moveDown(0.15);
}

function bulletItem(doc: PDFKit.PDFDocument, text: string) {
  doc
    .fillColor("#1e293b")
    .fontSize(10.5)
    .font("Helvetica")
    .text("•  " + text, { indent: 8, lineGap: 2 });
  doc.moveDown(0.25);
}
