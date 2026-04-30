/**
 * Generador del PDF de un justificante de servicio.
 *
 * Un justificante es el albarán que firma el cliente confirmando que se
 * han realizado X horas de trabajo o que se ha entregado una versión.
 * Tradicionalmente esto se imprimía en papel; aquí lo generamos como PDF
 * descargable que el cliente puede firmar electrónicamente o imprimir.
 *
 * Reusa la misma infra de pdfkit que el contrato (contract-generator.ts)
 * y la misma identidad de proveedor (SISPYME, S.L.).
 */
import PDFDocument from "pdfkit";
import {
  CONTRACT_PROVIDER as PROVIDER,
  formatContractDate,
} from "@/lib/saas/contract-content";

export type JustificanteInput = {
  numero: string;
  proyecto: string;
  fecha: string;
  personaResponsable: string;
  personaCliente: string;
  horas: string;
  trabajos: string;
  version?: string;
  estado: string;
  notas?: string;
  /** Datos del cliente del SaaS (la empresa que contrata Prontara) */
  customerCompany?: string;
  customerEmail?: string;
};

const ESTADO_LABEL: Record<string, string> = {
  borrador: "Borrador",
  enviado: "Enviado al cliente",
  firmado: "Firmado",
  rechazado: "Rechazado",
};

export async function generateJustificantePdf(input: JustificanteInput): Promise<Buffer> {
  const fechaFmt = (() => {
    const d = new Date(input.fecha);
    if (Number.isNaN(d.getTime())) return input.fecha || "—";
    return formatContractDate(d);
  })();
  const estadoLabel = ESTADO_LABEL[input.estado] || input.estado;

  return await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 56,
      info: {
        Title: "Justificante " + input.numero,
        Author: input.customerCompany || PROVIDER.legalName,
        Subject: "Justificante de servicio - " + input.proyecto,
        Creator: PROVIDER.productName,
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // === Cabecera con logo brand ===
    doc
      .fillColor("#1d4ed8")
      .fontSize(10)
      .font("Helvetica-Bold")
      .text(
        (input.customerCompany || PROVIDER.legalName).toUpperCase() +
          " · JUSTIFICANTE DE SERVICIO",
        { characterSpacing: 1.2 },
      );

    doc.moveDown(0.3);
    doc
      .fillColor("#0f172a")
      .fontSize(22)
      .font("Helvetica-Bold")
      .text("Justificante " + input.numero);

    doc.moveDown(0.2);
    doc
      .fillColor("#6b7280")
      .fontSize(10)
      .font("Helvetica")
      .text("Proyecto: " + input.proyecto + "  ·  Fecha: " + fechaFmt);

    doc.moveDown(0.1);
    doc
      .fillColor(estadoBadgeColor(input.estado))
      .fontSize(11)
      .font("Helvetica-Bold")
      .text("Estado: " + estadoLabel);

    doc.moveDown(1.2);

    // === Bloque proveedor ===
    sectionTitle(doc, "Prestador del servicio");
    keyValue(doc, "Empresa", input.customerCompany || "—");
    if (input.customerEmail) keyValue(doc, "Email", input.customerEmail);
    if (input.personaResponsable) keyValue(doc, "Responsable que firma", input.personaResponsable);
    doc.moveDown(0.6);

    // === Bloque cliente final ===
    sectionTitle(doc, "Cliente que recibe");
    keyValue(doc, "Persona del cliente", input.personaCliente || "—");
    keyValue(doc, "Proyecto", input.proyecto);
    if (input.version) keyValue(doc, "Versión entregada", input.version);
    doc.moveDown(0.6);

    // === Detalle del trabajo ===
    sectionTitle(doc, "Trabajos realizados");
    paragraph(doc, input.trabajos || "(sin detalle)");
    doc.moveDown(0.4);

    // === Resumen de horas ===
    sectionTitle(doc, "Resumen");
    keyValue(doc, "Horas justificadas", String(input.horas || "0"));
    keyValue(doc, "Fecha", fechaFmt);
    if (input.notas) {
      doc.moveDown(0.4);
      sectionTitle(doc, "Notas adicionales");
      paragraph(doc, input.notas);
    }

    doc.moveDown(1.5);

    // === Bloque de firmas ===
    const x1 = doc.page.margins.left;
    const x2 = doc.page.margins.left + 280;
    const y = doc.y;

    doc
      .fillColor("#0f172a")
      .fontSize(10)
      .font("Helvetica-Bold")
      .text("Por el prestador", x1, y);
    doc
      .fontSize(11)
      .font("Helvetica")
      .text(input.customerCompany || "—", x1, y + 16);
    doc
      .fontSize(9)
      .fillColor("#6b7280")
      .text(input.personaResponsable || "—", x1, y + 32);
    doc.text(fechaFmt, x1, y + 46);

    doc
      .fillColor("#0f172a")
      .fontSize(10)
      .font("Helvetica-Bold")
      .text("Por el cliente", x2, y);
    doc
      .fontSize(11)
      .font("Helvetica")
      .text(input.personaCliente || "—", x2, y + 16);
    doc
      .fontSize(9)
      .fillColor("#6b7280")
      .text("Firma:", x2, y + 32);
    // Línea de firma
    doc
      .moveTo(x2, y + 60)
      .lineTo(x2 + 200, y + 60)
      .strokeColor("#9ca3af")
      .lineWidth(0.5)
      .stroke();

    // Footer
    const pageBottom = doc.page.height - doc.page.margins.bottom + 20;
    doc
      .fillColor("#94a3b8")
      .fontSize(8)
      .font("Helvetica")
      .text(
        "Justificante generado por " + PROVIDER.productName + " (" + PROVIDER.productSite +
          "). Documento sin valor fiscal — los importes y la facturación van por la factura emitida aparte.",
        doc.page.margins.left,
        pageBottom,
        {
          width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
          align: "center",
        },
      );

    doc.end();
  });
}

function estadoBadgeColor(estado: string): string {
  if (estado === "firmado") return "#166534";
  if (estado === "rechazado") return "#991b1b";
  if (estado === "enviado") return "#1d4ed8";
  return "#6b7280"; // borrador u otros
}

function sectionTitle(doc: PDFKit.PDFDocument, text: string) {
  doc.moveDown(0.5);
  doc
    .fillColor("#0f172a")
    .fontSize(13)
    .font("Helvetica-Bold")
    .text(text);
  doc.moveDown(0.2);
}

function paragraph(doc: PDFKit.PDFDocument, text: string) {
  doc
    .fillColor("#1e293b")
    .fontSize(10.5)
    .font("Helvetica")
    .text(text, { align: "justify", lineGap: 2 });
  doc.moveDown(0.3);
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
  doc.moveDown(0.1);
}
