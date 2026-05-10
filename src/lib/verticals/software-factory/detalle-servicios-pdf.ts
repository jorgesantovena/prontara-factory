/**
 * Generador PDF "Detalle servicios <Cliente>" estilo SISPYME (H7-S3).
 *
 * Replica visualmente el informe que SISPYME envía a sus clientes
 * (ver delca.pdf como referencia):
 *   - Cabecera con razón social del emisor + datos contacto + paginación
 *   - Título "Detalle servicios <Cliente>" + Periodo
 *   - Resumen bolsa: Contratadas / Gastadas anteriormente / Imputadas / A facturar / Saldo
 *   - Tareas agrupadas por Tipo de Servicio
 *     - Para cada tarea: Fecha · Desde · Hasta · Empleado · Proyecto · Descripción · Tiempo
 *     - Asterisco * si es facturable
 *   - Total por Tipo de Servicio + "A Facturar"
 *   - Pie: "(*) Servicio facturable. El importe a facturar será 0 mientras no se superen las horas contratadas"
 */
import PDFDocument from "pdfkit";
import {
  agruparPorTipoServicio,
  type Actividad,
  type LineaPrefactura,
} from "@/lib/verticals/software-factory/prefacturacion-engine";

export type DetalleServiciosInput = {
  emisor: { razonSocial: string; direccion?: string; telefono?: string; email?: string };
  cliente: string;
  periodo: string; // YYYY-MM o "/"
  prefactura: LineaPrefactura;
  actividades: Actividad[];
};

const LABEL_FACTURABLE = "(*) Servicio facturable. El importe a facturar será 0 mientras no se superen las horas contratadas";

export function generateDetalleServiciosPdf(input: DetalleServiciosInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 36, info: { Title: "Detalle servicios " + input.cliente, Author: input.emisor.razonSocial } });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    let pageNumber = 1;
    const totalGroups = agruparPorTipoServicio(input.actividades);
    const totalPagesEstimate = Math.max(1, Math.ceil(totalGroups.size / 4));

    // === Cabecera (se repite en cada página) ===
    const header = (n: number) => {
      doc.fontSize(8).fillColor("#475569");
      doc.text(input.emisor.direccion || "", 36, 30);
      doc.text(input.emisor.telefono ? "T: " + input.emisor.telefono + "  ·  " + (input.emisor.email || "") : (input.emisor.email || ""), 36, 42);
      doc.text("Fecha " + new Date().toLocaleDateString("es-ES"), 450, 30, { align: "right", width: 109 });
      doc.text("Página " + n + " de " + totalPagesEstimate, 450, 42, { align: "right", width: 109 });
      doc.moveTo(36, 60).lineTo(559, 60).strokeColor("#cbd5e1").stroke();
    };

    header(pageNumber);

    // === Título + periodo ===
    doc.fontSize(14).fillColor("#0f172a").font("Helvetica-Bold");
    doc.text("Detalle servicios " + input.cliente, 36, 75);
    doc.fontSize(10).font("Helvetica").fillColor("#475569");
    doc.text("Periodo  " + (input.periodo || "/"), 400, 80, { align: "right", width: 159 });

    // === Resumen bolsa ===
    let y = 105;
    doc.fontSize(10).fillColor("#0f172a").font("Helvetica-Bold");
    doc.text("Resumen horas " + input.prefactura.bolsaConcepto, 36, y);
    y += 16;
    doc.fontSize(8).font("Helvetica-Bold").fillColor("#475569");
    const colW = 100;
    const colsX = [36, 140, 245, 350, 455];
    ["Contratadas", "Gastadas anteriormente", "Imputadas", "A facturar", "Saldo"].forEach((label, i) => {
      doc.text(label, colsX[i], y, { width: colW });
    });
    y += 12;
    doc.fontSize(11).font("Helvetica").fillColor("#0f172a");
    [
      input.prefactura.bolsaContratada.toFixed(2) + " h/Año",
      input.prefactura.hGastadasAnteriores.toFixed(2),
      input.prefactura.hImputadasCliente.toFixed(2),
      input.prefactura.hAFacturar.toFixed(2),
      input.prefactura.saldo.toFixed(2),
    ].forEach((v, i) => doc.text(v, colsX[i], y, { width: colW }));
    y += 22;

    // === Detalle por Tipo de Servicio ===
    doc.fontSize(8).font("Helvetica-Bold").fillColor("#475569");
    const tableCols = { fecha: 36, desde: 90, hasta: 130, empleado: 170, proyecto: 240, descripcion: 360, tiempo: 530 };
    doc.text("Fecha", tableCols.fecha, y);
    doc.text("Desde", tableCols.desde, y);
    doc.text("Hasta", tableCols.hasta, y);
    doc.text("Empleado", tableCols.empleado, y);
    doc.text("Proyecto", tableCols.proyecto, y);
    doc.text("Descripción", tableCols.descripcion, y);
    doc.text("Tiempo", tableCols.tiempo, y, { align: "right", width: 30 });
    y += 12;

    const drawSeparator = () => {
      doc.moveTo(36, y).lineTo(559, y).strokeColor("#e5e7eb").stroke();
      y += 4;
    };
    drawSeparator();

    const checkPageBreak = (heightNeeded: number) => {
      if (y + heightNeeded > 770) {
        doc.addPage();
        pageNumber += 1;
        header(pageNumber);
        y = 75;
      }
    };

    const grupos = agruparPorTipoServicio(input.actividades);
    let totalGeneralFacturable = 0;

    for (const [tipoServicio, tareas] of grupos.entries()) {
      checkPageBreak(40);
      doc.fontSize(9).font("Helvetica-Bold").fillColor("#0f172a");
      doc.text("Tipo Servicio", 36, y);
      doc.text(tipoServicio, 110, y);
      y += 16;

      let totalTipo = 0;
      let totalFacturableTipo = 0;
      for (const t of tareas) {
        checkPageBreak(28);
        doc.fontSize(8).font("Helvetica").fillColor("#0f172a");
        const fechaCorta = String(t.fecha).slice(8, 10) + "-" + String(t.fecha).slice(5, 7) + "-" + String(t.fecha).slice(2, 4);
        doc.text(fechaCorta, tableCols.fecha, y);
        doc.text(String(t.horaDesde || "—"), tableCols.desde, y);
        doc.text(String(t.horaHasta || "—"), tableCols.hasta, y);
        doc.text(String(t.empleado || "—").slice(0, 14), tableCols.empleado, y);
        const proyectoText = String(t.proyecto || "—");
        const facturableMarker = (t.tipoFacturacion === "fuera-bolsa") ? " *" : "";
        doc.text(proyectoText.slice(0, 22) + facturableMarker, tableCols.proyecto, y);
        const desc = String(t.descripcion || "");
        doc.text(desc.slice(0, 50), tableCols.descripcion, y, { width: 165 });
        doc.text(t.tiempoHoras.toFixed(2), tableCols.tiempo, y, { align: "right", width: 30 });
        const lineHeight = Math.max(12, Math.ceil(desc.length / 50) * 12);
        y += lineHeight;
        totalTipo += t.tiempoHoras;
        if (t.tipoFacturacion === "fuera-bolsa") totalFacturableTipo += t.tiempoHoras;
      }

      checkPageBreak(30);
      doc.moveTo(36, y).lineTo(559, y).strokeColor("#cbd5e1").stroke();
      y += 4;
      doc.fontSize(8).font("Helvetica-Bold").fillColor("#0f172a");
      doc.text("Total " + tipoServicio, 350, y, { align: "right", width: 175 });
      doc.text(totalTipo.toFixed(2), tableCols.tiempo, y, { align: "right", width: 30 });
      y += 14;
      doc.fontSize(8).font("Helvetica").fillColor("#475569");
      doc.text("A Facturar", 350, y, { align: "right", width: 175 });
      doc.text(totalFacturableTipo.toFixed(2), tableCols.tiempo, y, { align: "right", width: 30 });
      y += 18;
      totalGeneralFacturable += totalFacturableTipo;
    }

    // === Pie ===
    checkPageBreak(40);
    y = Math.max(y, 770);
    doc.fontSize(7).font("Helvetica").fillColor("#94a3b8");
    doc.text(LABEL_FACTURABLE, 36, 770, { width: 523 });

    doc.end();
  });
}
