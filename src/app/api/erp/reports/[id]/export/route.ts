import { type NextRequest } from "next/server";
import { requireTenantSession } from "@/lib/saas/auth-session";
import { withPrisma, getPersistenceBackend } from "@/lib/persistence/db";
import { runReport, type ReportDefinition } from "@/lib/saas/report-engine";
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, WidthType, BorderStyle, ShadingType,
} from "docx";

/**
 * TEST-3.6 — Exporta un reporte como documento real.
 *
 *   GET /api/erp/reports/:id/export?format=docx
 *
 * Devuelve un Word (.docx) con cabecera, fecha, descripción, agrupación
 * (si la hay) y la tabla de detalle. Soportamos solo `format=docx` por
 * ahora; la página ya tiene CSV y print-to-PDF para los otros formatos.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BORDER = { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" } as const;
const CELL_BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-z0-9_-]+/gi, "_").slice(0, 80) || "reporte";
}

function fmtFechaIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function plainText(s: unknown): string {
  return s == null ? "" : String(s);
}

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Ctx) {
  try {
    const session = requireTenantSession(request);
    if (!session) return new Response("Sesión inválida.", { status: 401 });
    if (getPersistenceBackend() !== "postgres") {
      return new Response("Solo Postgres.", { status: 400 });
    }

    const format = String(request.nextUrl.searchParams.get("format") || "docx").toLowerCase();
    if (format !== "docx") {
      return new Response("Formato no soportado. Usa format=docx.", { status: 400 });
    }

    const { id } = await context.params;
    const reportId = String(id || "").trim();
    if (!reportId) return new Response("Falta id.", { status: 400 });

    // 1) Cargar metadato del reporte
    const report = await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        tenantReport: {
          findFirst: (a: { where: { id: string; clientId: string } }) => Promise<Record<string, unknown> | null>;
        };
      };
      return await c.tenantReport.findFirst({
        where: { id: reportId, clientId: session.clientId },
      });
    });
    if (!report) return new Response("Reporte no encontrado.", { status: 404 });

    // 2) Ejecutar reporte
    const def: ReportDefinition = {
      moduleKey: String(report.moduleKey),
      columns: Array.isArray(report.columnsJson) ? (report.columnsJson as string[]) : [],
      filters: Array.isArray(report.filtersJson) ? (report.filtersJson as ReportDefinition["filters"]) : [],
      groupBy: (report.groupBy as string) || null,
    };
    const result = await runReport(session.clientId, def);
    const rows: Array<Record<string, unknown>> = Array.isArray(result.rows) ? result.rows : [];
    const groups: Array<{ key: string; count: number }> = Array.isArray(result.groups) ? result.groups : [];

    // 3) Determinar columnas (excluyendo id)
    const cols: string[] = (def.columns && def.columns.length > 0)
      ? def.columns.filter((c) => c && c !== "id")
      : (rows.length > 0 ? Object.keys(rows[0]).filter((k) => k !== "id") : []);

    const reportName = plainText(report.name) || "Reporte";
    const reportDescription = plainText(report.description);
    const moduleKey = plainText(report.moduleKey);

    // 4) Construir documento Word
    const children: Array<Paragraph | Table> = [];

    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: reportName, bold: true })],
    }));

    children.push(new Paragraph({
      children: [new TextRun({
        text: "Módulo: " + moduleKey + "  ·  Generado: " + fmtFechaIso() + "  ·  Total registros: " + String(result.total || rows.length),
        italics: true, color: "64748B", size: 20,
      })],
    }));

    if (reportDescription) {
      children.push(new Paragraph({ children: [new TextRun(reportDescription)] }));
    }

    children.push(new Paragraph({ children: [new TextRun("")] }));

    // 5) Agrupación (si la hay)
    if (groups.length > 0) {
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: "Agrupación", bold: true })],
      }));
      const groupTable = new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [6360, 3000],
        rows: [
          new TableRow({
            tableHeader: true,
            children: [
              new TableCell({
                width: { size: 6360, type: WidthType.DXA },
                borders: CELL_BORDERS,
                shading: { fill: "F1F5F9", type: ShadingType.CLEAR, color: "auto" },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: "Grupo", bold: true })] })],
              }),
              new TableCell({
                width: { size: 3000, type: WidthType.DXA },
                borders: CELL_BORDERS,
                shading: { fill: "F1F5F9", type: ShadingType.CLEAR, color: "auto" },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "Cuenta", bold: true })] })],
              }),
            ],
          }),
          ...groups.map((g) => new TableRow({
            children: [
              new TableCell({
                width: { size: 6360, type: WidthType.DXA },
                borders: CELL_BORDERS,
                margins: { top: 60, bottom: 60, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun(plainText(g.key) || "(sin grupo)")] })],
              }),
              new TableCell({
                width: { size: 3000, type: WidthType.DXA },
                borders: CELL_BORDERS,
                margins: { top: 60, bottom: 60, left: 120, right: 120 },
                children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun(String(g.count))] })],
              }),
            ],
          })),
        ],
      });
      children.push(groupTable);
      children.push(new Paragraph({ children: [new TextRun("")] }));
    }

    // 6) Detalle
    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_2,
      children: [new TextRun({ text: "Detalle (" + rows.length + ")", bold: true })],
    }));

    if (cols.length > 0 && rows.length > 0) {
      const totalWidth = 9360;
      const colWidth = Math.floor(totalWidth / cols.length);
      // Ajustar última columna al residuo para que sume exacto
      const columnWidths: number[] = cols.map((_, i) => i === cols.length - 1 ? totalWidth - colWidth * (cols.length - 1) : colWidth);

      const headerRow = new TableRow({
        tableHeader: true,
        children: cols.map((c, i) => new TableCell({
          width: { size: columnWidths[i], type: WidthType.DXA },
          borders: CELL_BORDERS,
          shading: { fill: "F1F5F9", type: ShadingType.CLEAR, color: "auto" },
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [new Paragraph({ children: [new TextRun({ text: c, bold: true })] })],
        })),
      });

      const bodyRows = rows.map((row) => new TableRow({
        children: cols.map((c, i) => new TableCell({
          width: { size: columnWidths[i], type: WidthType.DXA },
          borders: CELL_BORDERS,
          margins: { top: 60, bottom: 60, left: 120, right: 120 },
          children: [new Paragraph({ children: [new TextRun(plainText(row[c]))] })],
        })),
      }));

      children.push(new Table({
        width: { size: totalWidth, type: WidthType.DXA },
        columnWidths,
        rows: [headerRow, ...bodyRows],
      }));
    } else {
      children.push(new Paragraph({
        children: [new TextRun({ text: "Este reporte no tiene filas con los filtros aplicados.", italics: true, color: "94A3B8" })],
      }));
    }

    const doc = new Document({
      creator: "Prontara",
      title: reportName,
      description: reportDescription || "Reporte exportado de Prontara",
      styles: {
        default: { document: { run: { font: "Arial", size: 22 } } },
        paragraphStyles: [
          { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
            run: { size: 32, bold: true, font: "Arial", color: "0F172A" },
            paragraph: { spacing: { before: 240, after: 160 }, outlineLevel: 0 } },
          { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
            run: { size: 26, bold: true, font: "Arial", color: "0F172A" },
            paragraph: { spacing: { before: 200, after: 120 }, outlineLevel: 1 } },
        ],
      },
      sections: [{
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
          },
        },
        children,
      }],
    });

    const buffer = await Packer.toBuffer(doc);

    const filename = sanitizeFilename(reportName) + "_" + fmtFechaIso() + ".docx";

    // Convert Node Buffer -> Uint8Array for the Web Response body
    const body = new Uint8Array(buffer);

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": "attachment; filename=\"" + filename + "\"",
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return new Response("Error generando el documento: " + msg, { status: 500 });
  }
}
