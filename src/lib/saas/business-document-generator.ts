/**
 * Generador genérico de documentos comerciales en PDF (AUDIT-06).
 *
 * Sirve para presupuesto, factura, pedido, albarán, recibo, ticket, bono...
 * El layout es el mismo para todos los verticales — solo cambia el TÍTULO
 * del documento (que viene de los `labels` del pack: ej. "Presupuesto" en
 * SF, "Bono" en gimnasio, "Recibo" en colegio, "Ticket" en peluquería) y
 * los datos:
 *   - Emisor: del tenant (resolveTenantEmisorAsync)
 *   - Cliente: del registro del módulo (campo `cliente`)
 *   - Concepto + importe: del registro
 *
 * El PDF tiene este layout fijo:
 *
 *   +---------------------------+
 *   | [LOGO]   EMISOR (cabecera)|
 *   |---------------------------|
 *   | TIPO Nº          Fecha    |
 *   |                  Estado   |
 *   |---------------------------|
 *   | CLIENTE                   |
 *   |---------------------------|
 *   | CONCEPTO         IMPORTE  |
 *   | Descripción              |
 *   |                           |
 *   |    Base imponible: X EUR  |
 *   |    IVA 21%:        Y EUR  |
 *   |    TOTAL:          Z EUR  |
 *   |---------------------------|
 *   | Notas                     |
 *   |---------------------------|
 *   | Vencimiento (factura) o   |
 *   | Validez (presupuesto)     |
 *   |---------------------------|
 *   | Pie generado por Prontara |
 *   +---------------------------+
 */

import PDFDocument from "pdfkit";
import type { EmisorData } from "@/lib/saas/tenant-emisor-resolver";

export type BusinessDocumentType =
  | "presupuesto"
  | "factura"
  | "pedido"
  | "albaran"
  | "recibo"
  | "ticket"
  | "bono";

export type BusinessDocumentInput = {
  /** Tipo de documento — define el título y algunas etiquetas. */
  tipo: BusinessDocumentType;
  /** Etiqueta visible en el PDF. Si no se pasa, se infiere del tipo. */
  tituloOverride?: string;
  /** Numero del documento (FAC-2026-001, PRES-2026-014, etc.). */
  numero: string;
  /** Estado del documento (emitida, cobrada, vencida, borrador, ...). */
  estado: string;
  /** Fecha de emisión en formato YYYY-MM-DD. */
  fechaEmision: string;
  /** Fecha de vencimiento (factura) o validez (presupuesto). Opcional. */
  fechaSecundaria?: string;
  /** Etiqueta de la fecha secundaria ("Vencimiento", "Validez", "Entrega"). */
  fechaSecundariaLabel?: string;
  /** Concepto principal — descripción del trabajo/servicio/bien. */
  concepto: string;
  /** Importe TOTAL (con IVA) en EUR. Si la cadena trae unidades, se extraen. */
  importeTotal: number;
  /** Tipo IVA aplicado. Default 21. Si =0, se considera exento. */
  tipoIva?: number;
  /** Notas opcionales. */
  notas?: string;

  /** Emisor (del tenant) */
  emisor: EmisorData;

  /** Cliente al que va dirigido (del registro). */
  cliente: {
    razonSocial: string;
    cif?: string;
    direccion?: string;
    email?: string;
    telefono?: string;
  };
};

const DEFAULT_TITULO_BY_TIPO: Record<BusinessDocumentType, string> = {
  presupuesto: "PRESUPUESTO",
  factura: "FACTURA",
  pedido: "PEDIDO",
  albaran: "ALBARÁN",
  recibo: "RECIBO",
  ticket: "TICKET",
  bono: "BONO",
};

const ESTADO_COLOR: Record<string, string> = {
  borrador: "#6b7280",
  emitida: "#1d4ed8",
  emitido: "#1d4ed8",
  enviado: "#1d4ed8",
  pendiente: "#ca8a04",
  negociacion: "#7c3aed",
  cobrada: "#166534",
  cobrado: "#166534",
  pagada: "#166534",
  pagado: "#166534",
  aceptado: "#166534",
  ganado: "#166534",
  vencida: "#b91c1c",
  vencido: "#b91c1c",
  rechazado: "#b91c1c",
  perdido: "#b91c1c",
  anulada: "#6b7280",
  anulado: "#6b7280",
};

function formatDateEs(iso: string): string {
  if (!iso) return "—";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return m[3] + "/" + m[2] + "/" + m[1];
  return iso;
}

function formatEur(value: number): string {
  const fixed = value.toFixed(2);
  // Separador miles con punto (estilo europeo).
  const [whole, dec] = fixed.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return grouped + "," + dec + " €";
}

export async function generateBusinessDocumentPdf(
  input: BusinessDocumentInput,
): Promise<Buffer> {
  const titulo =
    input.tituloOverride || DEFAULT_TITULO_BY_TIPO[input.tipo] || "DOCUMENTO";
  const tipoIva = input.tipoIva ?? 21;
  const total = Math.max(0, Number(input.importeTotal) || 0);
  const baseImponible =
    tipoIva === 0 ? total : Math.round((total / (1 + tipoIva / 100)) * 100) / 100;
  const cuotaIva = Math.round((total - baseImponible) * 100) / 100;
  const estadoColor = ESTADO_COLOR[input.estado.toLowerCase()] || "#6b7280";
  const estadoLabel =
    input.estado.charAt(0).toUpperCase() + input.estado.slice(1).toLowerCase();

  return await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 56,
      info: {
        Title: titulo + " " + input.numero,
        Author: input.emisor.razonSocial,
        Subject: titulo + " — " + input.concepto,
        Creator: "Prontara",
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width;
    const marginL = doc.page.margins.left;
    const marginR = doc.page.margins.right;
    const contentWidth = pageWidth - marginL - marginR;

    // ============================================================
    // CABECERA: Logo cuadrado coloreado + datos del emisor
    // ============================================================
    const logoSize = 56;
    const logoX = marginL;
    const logoY = doc.y;

    doc.rect(logoX, logoY, logoSize, logoSize).fill(input.emisor.accentColor);
    doc
      .fillColor("#ffffff")
      .fontSize(22)
      .font("Helvetica-Bold")
      .text(input.emisor.iniciales, logoX, logoY + logoSize / 2 - 12, {
        width: logoSize,
        align: "center",
      });

    const headerX = logoX + logoSize + 16;
    const headerWidth = contentWidth - logoSize - 16;
    doc
      .fillColor("#0f172a")
      .fontSize(15)
      .font("Helvetica-Bold")
      .text(input.emisor.razonSocial, headerX, logoY, { width: headerWidth });
    doc
      .fillColor("#475569")
      .fontSize(9.5)
      .font("Helvetica")
      .text(
        "CIF: " + input.emisor.cif + "  ·  " + input.emisor.direccion,
        headerX,
        logoY + 18,
        { width: headerWidth },
      );
    doc.text(
      "Tel: " + input.emisor.telefono + "  ·  " + input.emisor.email,
      headerX,
      logoY + 32,
      { width: headerWidth },
    );

    doc.y = logoY + logoSize + 24;
    drawSeparator(doc);

    // ============================================================
    // TIPO + Nº + Fecha + Estado
    // ============================================================
    const titleY = doc.y;
    doc
      .fillColor(input.emisor.accentColor)
      .fontSize(20)
      .font("Helvetica-Bold")
      .text(titulo + "  Nº " + input.numero, marginL, titleY, {
        width: contentWidth - 200,
      });

    doc
      .fillColor("#0f172a")
      .fontSize(10)
      .font("Helvetica-Bold")
      .text("Fecha: ", pageWidth - marginR - 200, titleY, {
        width: 200,
        align: "right",
        continued: true,
      })
      .font("Helvetica")
      .text(formatDateEs(input.fechaEmision));

    doc
      .fontSize(10)
      .font("Helvetica-Bold")
      .text("Estado: ", pageWidth - marginR - 200, titleY + 14, {
        width: 200,
        align: "right",
        continued: true,
      })
      .fillColor(estadoColor)
      .font("Helvetica-Bold")
      .text(estadoLabel)
      .fillColor("#0f172a");

    doc.y = titleY + 44;
    drawSeparator(doc);

    // ============================================================
    // CLIENTE
    // ============================================================
    sectionTitle(doc, "Cliente");
    doc
      .fillColor("#0f172a")
      .fontSize(11)
      .font("Helvetica-Bold")
      .text(input.cliente.razonSocial || "—");
    doc.fillColor("#475569").fontSize(9.5).font("Helvetica");
    if (input.cliente.cif) doc.text("CIF/NIF: " + input.cliente.cif);
    if (input.cliente.direccion) doc.text(input.cliente.direccion);
    const contactBits: string[] = [];
    if (input.cliente.email) contactBits.push(input.cliente.email);
    if (input.cliente.telefono) contactBits.push(input.cliente.telefono);
    if (contactBits.length) doc.text(contactBits.join("  ·  "));
    doc.moveDown(0.8);

    // ============================================================
    // CONCEPTO + IMPORTE (tabla simple de 1 línea)
    // ============================================================
    drawSeparator(doc);
    const tableY = doc.y;
    doc
      .fillColor("#475569")
      .fontSize(9)
      .font("Helvetica-Bold")
      .text("CONCEPTO", marginL, tableY, { width: contentWidth - 110 });
    doc.text("IMPORTE", marginL + contentWidth - 110, tableY, {
      width: 110,
      align: "right",
    });
    doc.y = tableY + 14;

    const conceptY = doc.y;
    doc
      .fillColor("#0f172a")
      .fontSize(11)
      .font("Helvetica")
      .text(input.concepto || "—", marginL, conceptY, {
        width: contentWidth - 110,
      });
    doc
      .fontSize(11)
      .font("Helvetica-Bold")
      .text(
        formatEur(tipoIva === 0 ? total : baseImponible),
        marginL + contentWidth - 110,
        conceptY,
        { width: 110, align: "right" },
      );
    doc.moveDown(0.8);
    drawSeparator(doc);

    // ============================================================
    // TOTALES (alineados a la derecha)
    // ============================================================
    const totalsX = marginL + contentWidth - 220;
    let ty = doc.y + 4;

    if (tipoIva > 0) {
      doc
        .fillColor("#475569")
        .fontSize(10)
        .font("Helvetica")
        .text("Base imponible:", totalsX, ty, { width: 120, align: "right" });
      doc
        .fillColor("#0f172a")
        .fontSize(10)
        .font("Helvetica")
        .text(formatEur(baseImponible), totalsX + 120, ty, {
          width: 100,
          align: "right",
        });
      ty += 14;

      doc
        .fillColor("#475569")
        .text("IVA " + tipoIva + "%:", totalsX, ty, { width: 120, align: "right" });
      doc
        .fillColor("#0f172a")
        .text(formatEur(cuotaIva), totalsX + 120, ty, {
          width: 100,
          align: "right",
        });
      ty += 14;
    } else {
      doc
        .fillColor("#475569")
        .fontSize(10)
        .font("Helvetica-Oblique")
        .text("Operación exenta de IVA", totalsX, ty, {
          width: 220,
          align: "right",
        });
      ty += 14;
    }

    // Línea fina antes del total.
    doc
      .moveTo(totalsX, ty)
      .lineTo(totalsX + 220, ty)
      .strokeColor("#cbd5e1")
      .lineWidth(0.5)
      .stroke();
    ty += 6;

    doc
      .fillColor("#0f172a")
      .fontSize(13)
      .font("Helvetica-Bold")
      .text("TOTAL:", totalsX, ty, { width: 120, align: "right" });
    doc
      .fillColor(input.emisor.accentColor)
      .text(formatEur(total), totalsX + 120, ty, {
        width: 100,
        align: "right",
      });
    doc.y = ty + 24;

    // ============================================================
    // Vencimiento / validez si aplica
    // ============================================================
    if (input.fechaSecundaria) {
      const label = input.fechaSecundariaLabel || "Vencimiento";
      drawSeparator(doc);
      doc
        .fillColor("#475569")
        .fontSize(10)
        .font("Helvetica-Bold")
        .text(label + ": ", marginL, doc.y, { continued: true })
        .font("Helvetica")
        .fillColor("#0f172a")
        .text(formatDateEs(input.fechaSecundaria));
      doc.moveDown(0.4);
    }

    // ============================================================
    // Notas
    // ============================================================
    if (input.notas) {
      drawSeparator(doc);
      sectionTitle(doc, "Notas");
      doc
        .fillColor("#1e293b")
        .fontSize(10)
        .font("Helvetica")
        .text(input.notas, { align: "justify", lineGap: 2 });
      doc.moveDown(0.4);
    }

    // ============================================================
    // Pie
    // ============================================================
    const pageBottom = doc.page.height - doc.page.margins.bottom + 20;
    doc
      .fillColor("#94a3b8")
      .fontSize(8)
      .font("Helvetica")
      .text(
        "Documento generado con Prontara · prontara.com",
        marginL,
        pageBottom,
        { width: contentWidth, align: "center" },
      );

    doc.end();
  });
}

function drawSeparator(doc: PDFKit.PDFDocument) {
  const y = doc.y + 2;
  doc
    .moveTo(doc.page.margins.left, y)
    .lineTo(doc.page.width - doc.page.margins.right, y)
    .strokeColor("#e2e8f0")
    .lineWidth(0.5)
    .stroke();
  doc.y = y + 8;
}

function sectionTitle(doc: PDFKit.PDFDocument, text: string) {
  doc
    .fillColor("#0f172a")
    .fontSize(11)
    .font("Helvetica-Bold")
    .text(text);
  doc.moveDown(0.2);
}
