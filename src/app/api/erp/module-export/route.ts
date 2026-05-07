import { NextResponse, type NextRequest } from "next/server";
import { requireTenantSession } from "@/lib/saas/auth-session";
import { listModuleRecordsAsync } from "@/lib/persistence/active-client-data-store-async";

/**
 * GET /api/erp/module-export?modulo=X&format=csv (SCHOOL-04 / motor común)
 *
 * Export genérico de cualquier módulo del ERP a CSV. Sirve para todos los
 * verticales sin código específico por sector. Heredamos el patrón del
 * SF billing-export pero generalizado: el endpoint NO conoce ningún
 * vertical, solo lee el módulo indicado y devuelve sus campos como CSV.
 *
 * Cabecera del CSV: detectada automáticamente uniendo todas las claves
 * que aparecen en los registros (excepto id, createdAt, updatedAt que se
 * añaden al final si están presentes). Esto cubre cualquier estructura
 * sin necesidad de conocer el módulo.
 *
 * Reusable como módulo común — no añadir lógica específica de sector aquí.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HIDDEN_TAIL_COLUMNS = ["id", "createdAt", "updatedAt"];

function unauthorized() {
  return NextResponse.json(
    { ok: false, error: "Sesión no válida o tenant no autorizado." },
    { status: 401 },
  );
}

function escapeCsvCell(value: string): string {
  const s = String(value ?? "");
  if (/[",\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function buildCsvLine(cells: Array<string | number>): string {
  return cells.map((c) => escapeCsvCell(String(c))).join(",");
}

export async function GET(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) return unauthorized();

    const params = request.nextUrl.searchParams;
    const modulo = String(params.get("modulo") || "").trim();
    const format = String(params.get("format") || "csv").toLowerCase();

    if (!modulo) {
      return NextResponse.json(
        { ok: false, error: "Falta el parámetro modulo." },
        { status: 400 },
      );
    }
    if (format !== "csv") {
      return NextResponse.json(
        {
          ok: false,
          error: "Formato no soportado. Por ahora solo csv.",
        },
        { status: 400 },
      );
    }

    const records = await listModuleRecordsAsync(modulo, session.clientId);

    // Detectar columnas: unión de todas las keys excepto las internas que
    // se añaden al final.
    const keySet = new Set<string>();
    for (const r of records) {
      for (const k of Object.keys(r || {})) {
        if (!HIDDEN_TAIL_COLUMNS.includes(k)) keySet.add(k);
      }
    }
    const visibleColumns = Array.from(keySet).sort();
    const hiddenPresent = HIDDEN_TAIL_COLUMNS.filter((c) =>
      records.some((r) => Object.prototype.hasOwnProperty.call(r, c)),
    );
    const columns = [...visibleColumns, ...hiddenPresent];

    const lines: string[] = [];
    lines.push(buildCsvLine(columns));
    for (const r of records) {
      const row = columns.map((c) => String((r as Record<string, string>)[c] ?? ""));
      lines.push(buildCsvLine(row));
    }

    const csv = "﻿" + lines.join("\r\n") + "\r\n";
    const filename =
      modulo.replace(/[^a-zA-Z0-9_-]+/g, "_") +
      "-" +
      session.slug +
      "-" +
      new Date().toISOString().slice(0, 10) +
      ".csv";

    return new NextResponse(csv, {
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
        error: error instanceof Error ? error.message : "Error generando CSV.",
      },
      { status: 500 },
    );
  }
}
