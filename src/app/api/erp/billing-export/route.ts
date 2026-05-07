import { NextRequest, NextResponse } from "next/server";
import { requireTenantSession } from "@/lib/saas/auth-session";
import { getMonthlyBillingPreview } from "@/lib/verticals/software-factory/billing-preview";

/**
 * GET /api/erp/billing-export?mes=YYYY-MM&format=csv (SF-03)
 *
 * Descarga el resumen mensual de horas facturables (preview, sin emitir
 * facturas). Devuelve un CSV con una fila por actividad pendiente,
 * agrupable a posteriori en Excel/Sheets.
 *
 * No exige guard de suscripción — es solo lectura, no muta nada. Sí exige
 * sesión válida del tenant.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json(
    { ok: false, error: "Sesión no válida o tenant no autorizado." },
    { status: 401 },
  );
}

/**
 * Escapa un campo para CSV según RFC 4180: encierra entre comillas dobles
 * si contiene coma, salto de línea o comilla; las comillas internas se
 * duplican.
 */
function escapeCsvCell(value: string): string {
  const s = String(value ?? "");
  if (/[",\r\n]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function buildCsvLine(cells: Array<string | number>): string {
  return cells.map((c) => escapeCsvCell(String(c))).join(",");
}

export async function GET(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) return unauthorized();

    const mes = String(request.nextUrl.searchParams.get("mes") || "").trim();
    const format = String(
      request.nextUrl.searchParams.get("format") || "csv",
    )
      .toLowerCase()
      .trim();

    if (format !== "csv") {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Formato no soportado. Solo 'csv' por ahora (PDF llegará en una iteración posterior).",
        },
        { status: 400 },
      );
    }

    const preview = await getMonthlyBillingPreview(
      session.clientId,
      mes || undefined,
    );

    // Cabecera + una fila por actividad. Agregamos también una fila final
    // de TOTAL para que abrir el CSV en Excel ya muestre el sumatorio.
    const lines: string[] = [];
    lines.push(
      buildCsvLine([
        "Mes",
        "Cliente",
        "Proyecto",
        "CodigoTipo",
        "Fecha",
        "Persona",
        "Concepto",
        "Horas",
        "Tarifa_h",
        "Importe_EUR",
      ]),
    );

    for (const clientGroup of preview.clientes) {
      for (const proj of clientGroup.proyectos) {
        for (const line of proj.actividades) {
          lines.push(
            buildCsvLine([
              preview.mes,
              clientGroup.cliente,
              proj.proyecto,
              proj.codigoTipo,
              line.fecha,
              line.persona,
              line.concepto,
              line.horas,
              line.tarifaHora,
              line.importe.toFixed(2),
            ]),
          );
        }
      }
    }

    // Fila resumen final, separada por una línea vacía. Excel la interpreta
    // bien como fila independiente.
    lines.push("");
    lines.push(
      buildCsvLine([
        "TOTAL",
        "",
        "",
        "",
        "",
        "",
        "",
        preview.totalHoras,
        "",
        preview.totalImporte.toFixed(2),
      ]),
    );

    const csv = lines.join("\r\n") + "\r\n";
    // Prefijo BOM UTF-8 para que Excel detecte la codificación correctamente
    // y no rompa los acentos.
    const body = "﻿" + csv;

    const filename =
      "horas-facturables-" + (mes || preview.mes) + "-" + session.slug + ".csv";

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="' + filename + '"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Error generando export.",
      },
      { status: 500 },
    );
  }
}
