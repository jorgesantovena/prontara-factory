import { NextResponse, type NextRequest } from "next/server";
import { requireTenantSession } from "@/lib/saas/auth-session";
import { checkTenantSubscriptionAsync } from "@/lib/saas/subscription-guard";
import { createModuleRecordAsync } from "@/lib/persistence/active-client-data-store-async";

/**
 * POST /api/erp/module-import (CORE-05)
 *
 * Import genérico de CSV a cualquier módulo del ERP. Multipart con un
 * archivo CSV en el campo "file" y el moduleKey en query param.
 *
 * Formato CSV: primera línea = headers (nombres de campo), siguientes
 * líneas = registros. Soporta BOM UTF-8 al inicio. Cada celda con
 * comillas dobles si contiene comas o saltos de línea.
 *
 * Devuelve { creados: N, errores: [{ fila, error }] }. No es atómico:
 * si una fila falla, las anteriores ya se han creado. Un endpoint
 * transaccional es trabajo posterior.
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
 * Parser CSV mínimo conforme a RFC 4180. Maneja:
 *   - BOM UTF-8 inicial.
 *   - Comillas dobles para escapar comas y saltos de línea.
 *   - Comilla doble dentro de campo entre comillas se escapa con "".
 *   - CRLF, LF y CR como separadores de línea.
 */
function parseCsv(raw: string): string[][] {
  // Strip BOM
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let i = 0;
  let inQuotes = false;
  while (i < raw.length) {
    const ch = raw[i];
    if (inQuotes) {
      if (ch === '"') {
        if (raw[i + 1] === '"') {
          cell += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        cell += ch;
        i++;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        i++;
      } else if (ch === ",") {
        row.push(cell);
        cell = "";
        i++;
      } else if (ch === "\r") {
        // skip; salto de línea real será \n
        i++;
      } else if (ch === "\n") {
        row.push(cell);
        cell = "";
        rows.push(row);
        row = [];
        i++;
      } else {
        cell += ch;
        i++;
      }
    }
  }
  // última celda/fila si no acaba en salto
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

export async function POST(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) return unauthorized();

    const subscription = await checkTenantSubscriptionAsync(session);
    if (!subscription.allowed) {
      return NextResponse.json(
        { ok: false, error: subscription.reason, code: subscription.code },
        { status: 403 },
      );
    }

    const modulo = String(request.nextUrl.searchParams.get("modulo") || "").trim();
    if (!modulo) {
      return NextResponse.json(
        { ok: false, error: "Falta el parámetro modulo." },
        { status: 400 },
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json(
        { ok: false, error: "Falta archivo en campo 'file'." },
        { status: 400 },
      );
    }

    const text = await (file as File).text();
    const rows = parseCsv(text).filter((r) => r.length > 0 && r.some((c) => c.trim() !== ""));
    if (rows.length < 2) {
      return NextResponse.json(
        { ok: false, error: "El CSV está vacío o solo tiene cabecera." },
        { status: 400 },
      );
    }

    const headers = rows[0].map((h) => h.trim());
    const errores: Array<{ fila: number; error: string }> = [];
    let creados = 0;

    for (let i = 1; i < rows.length; i++) {
      const cells = rows[i];
      const payload: Record<string, string> = {};
      for (let j = 0; j < headers.length; j++) {
        const h = headers[j];
        if (!h) continue;
        if (h === "id" || h === "createdAt" || h === "updatedAt") continue; // no importamos campos internos
        payload[h] = String(cells[j] ?? "").trim();
      }

      try {
        await createModuleRecordAsync(modulo, payload, session.clientId);
        creados += 1;
      } catch (err) {
        errores.push({
          fila: i + 1,
          error: err instanceof Error ? err.message : "error desconocido",
        });
      }
    }

    return NextResponse.json({
      ok: true,
      modulo,
      creados,
      total: rows.length - 1,
      errores,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Error en import.",
      },
      { status: 500 },
    );
  }
}
