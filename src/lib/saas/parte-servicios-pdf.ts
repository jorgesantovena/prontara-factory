/**
 * Generador PDF "Parte de Servicios" — Pedro 22-06 (horizontal/CORE).
 *
 * Imita el documento que SISPYME envía al cliente como "estado de cuenta":
 * por cliente y mes, una tabla de los trabajos realizados (Trabajador, Fecha,
 * Desde, Hasta, Tiempo, Proyecto, Asunto, Observaciones), el total de tiempo y
 * dos líneas de firma ("Por la Empresa" / "Por <emisor>").
 *
 * Notación española (dd/mm/aaaa, X.XXX,XX) vía @/lib/ui/format-es.
 */
import PDFDocument from "pdfkit";
import { fechaES, numeroES } from "@/lib/ui/format-es";

export type ParteTarea = {
  trabajador: string;
  fecha: string; // ISO yyyy-mm-dd
  desde: string; // hh:mm
  hasta: string; // hh:mm
  tiempo: number; // horas decimales
  proyecto: string;
  asunto: string;
  observaciones: string;
};

export type ParteServiciosInput = {
  emisor: { razonSocial: string; direccion?: string; telefono?: string; email?: string };
  cliente: string;
  codigoCliente?: string;
  periodo: string; // YYYY-MM
  tareas: ParteTarea[];
};

// Anchura útil A4 con margen 36: 595 − 72 = 523 (usamos hasta x=559).
const COLS = {
  trabajador: { x: 36, w: 78, label: "Trabajador" },
  fecha: { x: 116, w: 52, label: "Fecha" },
  desde: { x: 168, w: 34, label: "Desde" },
  hasta: { x: 202, w: 34, label: "Hasta" },
  tiempo: { x: 236, w: 32, label: "Tiempo" },
  proyecto: { x: 270, w: 80, label: "Proyecto" },
  asunto: { x: 352, w: 95, label: "Asunto" },
  obs: { x: 449, w: 110, label: "Observaciones" },
};
const RIGHT_EDGE = 559;

export function generateParteServiciosPdf(input: ParteServiciosInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 36, info: { Title: "Parte de servicios " + input.cliente, Author: input.emisor.razonSocial } });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const drawHeader = () => {
      // Datos del emisor (arriba-izquierda) + fecha de emisión (derecha).
      doc.fontSize(8).fillColor("#475569").font("Helvetica");
      doc.text(input.emisor.razonSocial || "", 36, 28);
      if (input.emisor.direccion) doc.text(input.emisor.direccion, 36, 39);
      const contacto = [input.emisor.telefono ? "T: " + input.emisor.telefono : "", input.emisor.email || ""].filter(Boolean).join("  ·  ");
      if (contacto) doc.text(contacto, 36, 50);
      doc.text("Fecha " + fechaES(new Date().toISOString().slice(0, 10)), 400, 28, { width: 159, align: "right" });

      // Título.
      doc.fontSize(15).fillColor("#0f172a").font("Helvetica-Bold");
      doc.text("PARTE DE SERVICIOS", 36, 70, { width: RIGHT_EDGE - 36, align: "center" });

      // Cliente (izda) + Código cliente (dcha).
      doc.fontSize(11).font("Helvetica-Bold").fillColor("#0f172a");
      doc.text("Cliente  " + input.cliente, 36, 98);
      if (input.codigoCliente) doc.text(input.codigoCliente, 400, 98, { width: 159, align: "right" });
      doc.fontSize(9).font("Helvetica").fillColor("#64748b");
      doc.text("Periodo  " + fechaPeriodo(input.periodo), 36, 114);
    };

    const drawTableHead = (y: number): number => {
      doc.fontSize(7.5).font("Helvetica-Bold").fillColor("#475569");
      for (const c of Object.values(COLS)) {
        doc.text(c.label, c.x, y, { width: c.w, align: c.x >= COLS.desde.x && c.x <= COLS.tiempo.x ? "right" : "left" });
      }
      doc.moveTo(36, y + 11).lineTo(RIGHT_EDGE, y + 11).strokeColor("#cbd5e1").stroke();
      return y + 15;
    };

    drawHeader();
    let y = drawTableHead(134);

    doc.fontSize(7.5).font("Helvetica").fillColor("#0f172a");
    let total = 0;
    for (const t of input.tareas) {
      total += t.tiempo;
      // Altura de fila = la mayor de Asunto/Observaciones (las que envuelven).
      const hAsunto = doc.heightOfString(t.asunto || "", { width: COLS.asunto.w });
      const hObs = doc.heightOfString(t.observaciones || "", { width: COLS.obs.w });
      const rowH = Math.max(12, hAsunto, hObs) + 4;

      // Salto de página si no cabe.
      if (y + rowH > 760) {
        doc.addPage();
        drawHeader();
        y = drawTableHead(134);
        doc.fontSize(7.5).font("Helvetica").fillColor("#0f172a");
      }

      doc.text(t.trabajador || "", COLS.trabajador.x, y, { width: COLS.trabajador.w });
      doc.text(fechaES(t.fecha), COLS.fecha.x, y, { width: COLS.fecha.w });
      doc.text(hhmm(t.desde), COLS.desde.x, y, { width: COLS.desde.w, align: "right" });
      doc.text(hhmm(t.hasta), COLS.hasta.x, y, { width: COLS.hasta.w, align: "right" });
      doc.text(numeroES(t.tiempo, 2), COLS.tiempo.x, y, { width: COLS.tiempo.w, align: "right" });
      doc.text(t.proyecto || "", COLS.proyecto.x, y, { width: COLS.proyecto.w });
      doc.text(t.asunto || "", COLS.asunto.x, y, { width: COLS.asunto.w });
      doc.text(t.observaciones || "", COLS.obs.x, y, { width: COLS.obs.w });
      y += rowH;
    }

    // Total de tiempo.
    doc.moveTo(36, y + 2).lineTo(RIGHT_EDGE, y + 2).strokeColor("#cbd5e1").stroke();
    y += 8;
    doc.fontSize(8.5).font("Helvetica-Bold").fillColor("#0f172a");
    doc.text("Total tiempo", COLS.proyecto.x - 80, y, { width: 100, align: "right" });
    doc.text(numeroES(total, 2) + " h", COLS.tiempo.x - 28, y, { width: COLS.tiempo.w + 28, align: "right" });

    // Firmas.
    y += 50;
    if (y > 720) { doc.addPage(); y = 120; }
    doc.fontSize(9).font("Helvetica").fillColor("#0f172a");
    doc.moveTo(70, y).lineTo(240, y).strokeColor("#94a3b8").stroke();
    doc.moveTo(330, y).lineTo(500, y).strokeColor("#94a3b8").stroke();
    doc.text("Por la Empresa", 70, y + 6, { width: 170, align: "center" });
    doc.text("Por " + (input.emisor.razonSocial || ""), 330, y + 6, { width: 170, align: "center" });

    doc.end();
  });
}

function hhmm(v: string): string {
  const m = String(v || "").match(/^(\d{1,2}):(\d{2})/);
  return m ? m[1].padStart(2, "0") + ":" + m[2] : String(v || "");
}
function fechaPeriodo(ym: string): string {
  const m = String(ym || "").match(/^(\d{4})-(\d{2})$/);
  if (!m) return ym;
  const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  return (meses[parseInt(m[2], 10) - 1] || m[2]) + " " + m[1];
}
