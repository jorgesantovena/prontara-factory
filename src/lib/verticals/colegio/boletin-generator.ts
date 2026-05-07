/**
 * Generador del boletín de notas en PDF (SCHOOL-05).
 *
 * Específico del vertical colegio. Consume el output del
 * calificaciones-engine y lo presenta en un PDF A4 con cabecera del
 * tenant (centro educativo), datos del alumno, tabla de asignaturas
 * con promedios y estado, y resumen general.
 */
import PDFDocument from "pdfkit";
import type { BoletinAlumno } from "@/lib/verticals/colegio/calificaciones-engine";
import type { EmisorData } from "@/lib/saas/tenant-emisor-resolver";

const ESTADO_LABEL: Record<string, string> = {
  sobresaliente: "Sobresaliente",
  notable: "Notable",
  aprobado: "Aprobado",
  suspenso: "Suspenso",
};

const ESTADO_COLOR: Record<string, string> = {
  sobresaliente: "#166534",
  notable: "#1d4ed8",
  aprobado: "#0f766e",
  suspenso: "#b91c1c",
};

const PERIODO_LABEL: Record<string, string> = {
  "1T": "Primer trimestre",
  "2T": "Segundo trimestre",
  "3T": "Tercer trimestre",
  final: "Evaluación final",
};

export async function generateBoletinPdf(
  boletin: BoletinAlumno,
  emisor: EmisorData,
): Promise<Buffer> {
  return await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 56,
      info: {
        Title: "Boletín " + boletin.alumno + " — " + boletin.periodo,
        Author: emisor.razonSocial,
        Subject: "Boletín de calificaciones",
        Creator: "Prontara",
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const marginL = doc.page.margins.left;
    const pageWidth = doc.page.width;
    const contentWidth = pageWidth - marginL - doc.page.margins.right;

    // Cabecera
    const logoSize = 56;
    doc.rect(marginL, doc.y, logoSize, logoSize).fill(emisor.accentColor);
    doc
      .fillColor("#ffffff")
      .fontSize(22)
      .font("Helvetica-Bold")
      .text(emisor.iniciales, marginL, doc.y - logoSize + 18, {
        width: logoSize,
        align: "center",
      });

    doc
      .fillColor("#0f172a")
      .fontSize(15)
      .font("Helvetica-Bold")
      .text(emisor.razonSocial, marginL + logoSize + 16, doc.y - logoSize, {
        width: contentWidth - logoSize - 16,
      });
    doc
      .fillColor("#475569")
      .fontSize(9.5)
      .font("Helvetica")
      .text(
        "CIF: " + emisor.cif + "  ·  " + emisor.direccion,
        marginL + logoSize + 16,
        doc.y,
        { width: contentWidth - logoSize - 16 },
      );

    doc.y = Math.max(doc.y, doc.page.margins.top + logoSize) + 24;
    drawSeparator(doc);

    // Título y datos del alumno
    doc
      .fillColor(emisor.accentColor)
      .fontSize(20)
      .font("Helvetica-Bold")
      .text("BOLETÍN DE CALIFICACIONES");
    doc.moveDown(0.4);
    doc
      .fillColor("#0f172a")
      .fontSize(11)
      .font("Helvetica-Bold")
      .text("Alumno: ", { continued: true })
      .font("Helvetica")
      .text(boletin.alumno);
    doc
      .font("Helvetica-Bold")
      .text("Curso: ", { continued: true })
      .font("Helvetica")
      .text(boletin.curso);
    doc
      .font("Helvetica-Bold")
      .text("Periodo: ", { continued: true })
      .font("Helvetica")
      .text(PERIODO_LABEL[boletin.periodo] || boletin.periodo);
    doc.moveDown(0.8);
    drawSeparator(doc);

    // Tabla de asignaturas
    const tableY = doc.y;
    doc
      .fillColor("#475569")
      .fontSize(9)
      .font("Helvetica-Bold")
      .text("ASIGNATURA", marginL, tableY, { width: contentWidth * 0.5 });
    doc.text("Nº NOTAS", marginL + contentWidth * 0.5, tableY, {
      width: contentWidth * 0.15,
      align: "center",
    });
    doc.text("PROMEDIO", marginL + contentWidth * 0.65, tableY, {
      width: contentWidth * 0.15,
      align: "center",
    });
    doc.text("ESTADO", marginL + contentWidth * 0.8, tableY, {
      width: contentWidth * 0.2,
      align: "right",
    });
    doc.y = tableY + 16;

    for (const a of boletin.asignaturas) {
      const rowY = doc.y;
      doc
        .fillColor("#0f172a")
        .fontSize(11)
        .font("Helvetica")
        .text(a.asignatura, marginL, rowY, { width: contentWidth * 0.5 });
      doc
        .fillColor("#475569")
        .text(String(a.numeroNotas), marginL + contentWidth * 0.5, rowY, {
          width: contentWidth * 0.15,
          align: "center",
        });
      doc
        .fillColor("#0f172a")
        .font("Helvetica-Bold")
        .text(a.promedio.toFixed(2), marginL + contentWidth * 0.65, rowY, {
          width: contentWidth * 0.15,
          align: "center",
        });
      doc
        .fillColor(ESTADO_COLOR[a.estado])
        .font("Helvetica-Bold")
        .text(ESTADO_LABEL[a.estado], marginL + contentWidth * 0.8, rowY, {
          width: contentWidth * 0.2,
          align: "right",
        });
      doc.y = rowY + 18;

      // Línea fina separadora
      doc
        .moveTo(marginL, doc.y)
        .lineTo(pageWidth - doc.page.margins.right, doc.y)
        .strokeColor("#f1f5f9")
        .lineWidth(0.4)
        .stroke();
      doc.y += 4;
    }

    doc.moveDown(0.6);
    drawSeparator(doc);

    // Resumen general
    doc.moveDown(0.4);
    doc
      .fillColor("#475569")
      .fontSize(11)
      .font("Helvetica-Bold")
      .text("Promedio general: ", { continued: true })
      .fillColor(emisor.accentColor)
      .text(boletin.promedioGeneral.toFixed(2));
    doc
      .fillColor("#475569")
      .text("Asignaturas aprobadas: ", { continued: true })
      .fillColor("#166534")
      .text(String(boletin.asignaturasAprobadas));
    if (boletin.asignaturasSuspensas > 0) {
      doc
        .fillColor("#475569")
        .text("Asignaturas suspensas: ", { continued: true })
        .fillColor("#b91c1c")
        .text(String(boletin.asignaturasSuspensas));
    }

    // Pie
    const pageBottom = doc.page.height - doc.page.margins.bottom + 20;
    doc
      .fillColor("#94a3b8")
      .fontSize(8)
      .font("Helvetica")
      .text(
        "Boletín emitido por " + emisor.razonSocial + " · Generado con Prontara · prontara.com",
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
