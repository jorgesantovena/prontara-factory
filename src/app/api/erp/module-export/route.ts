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
 * que aparecen en los registros.
 *
 * TEST-5.2 — Mejoras:
 *  - Omitir `id`, `createdAt`, `updatedAt`, `contactosJson` (datos internos).
 *  - En `clientes`: expandir contactosJson en 4 columnas calculadas
 *    (contactoPreferente, emailContacto, telefonoContacto, cargoContacto).
 *  - Campos con ceros iniciales (codigoPostal, cif, nif) se exportan como
 *    fórmula `="..."` para que Excel los trate como texto.
 *
 * Reusable como módulo común — no añadir lógica específica de sector aquí
 * salvo las expansiones documentadas arriba.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// TEST-5.2 — Columnas que no se exportan nunca (datos internos o crudos).
const HIDDEN_COLUMNS = new Set(["id", "createdAt", "updatedAt", "contactosJson"]);

// Campos donde Excel quita ceros iniciales si los trata como número. Los
// exportamos como `="valor"` para forzar formato texto.
const PRESERVE_LEADING_ZEROS = new Set(["codigoPostal", "cif", "nif", "telefono", "tel"]);

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

// TEST-5.2 — Lee contactosJson y devuelve el contacto preferido (o el primero).
type ContactoPref = { nombre: string; email: string; telefono: string; cargo: string };
function preferidoFromContactosJson(raw: unknown): ContactoPref | null {
  let arr: unknown = raw;
  if (typeof raw === "string") {
    try { arr = JSON.parse(raw); } catch { return null; }
  }
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const pref = arr.find((c) => c && typeof c === "object" && (c as Record<string, unknown>).preferido)
    || arr[0];
  if (!pref || typeof pref !== "object") return null;
  const c = pref as Record<string, unknown>;
  return {
    nombre: String(c.nombre || ""),
    email: String(c.email || ""),
    telefono: String(c.telefono || ""),
    cargo: String(c.cargo || ""),
  };
}

// TEST-5bis — true si en contactosJson hay AL MENOS uno marcado como preferido
// (no solo "el primero por defecto").
function isExplicitPreferido(raw: unknown): boolean {
  let arr: unknown = raw;
  if (typeof raw === "string") {
    try { arr = JSON.parse(raw); } catch { return false; }
  }
  if (!Array.isArray(arr)) return false;
  return arr.some((c) => c && typeof c === "object" && (c as Record<string, unknown>).preferido);
}

function cellWithLeadingZerosFix(column: string, value: string): string {
  if (!value) return value;
  if (!PRESERVE_LEADING_ZEROS.has(column)) return value;
  // Solo aplicamos la fórmula si el valor tiene un cero inicial o es claramente numérico.
  if (!/^[0-9+\-\s]/.test(value)) return value;
  return '="' + value.replace(/"/g, "'") + '"';
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

    // Detectar columnas: unión de todas las keys excepto las HIDDEN.
    const keySet = new Set<string>();
    for (const r of records) {
      for (const k of Object.keys(r || {})) {
        if (!HIDDEN_COLUMNS.has(k)) keySet.add(k);
      }
    }
    const columns = Array.from(keySet).sort();

    // TEST-5bis — En clientes, las columnas `contacto`, `email`, `telefono`
    // del registro se rellenan con los datos del contacto preferido (o el
    // primero si no hay marcado) cuando estén vacías en el record. Se
    // añade una columna "Preferente" con "*" si los datos vienen de un
    // contacto efectivamente marcado como preferido. Antes teníamos 4
    // columnas adicionales (contactoPreferente, emailContacto, ...) que
    // duplicaban la información — el tester pidió eliminarlas.
    const isClientes = modulo === "clientes";
    const allColumns = isClientes ? [...columns, "preferente"] : columns;

    const lines: string[] = [];
    lines.push(buildCsvLine(allColumns));
    for (const r of records) {
      const rec = r as Record<string, unknown>;
      let pref: ReturnType<typeof preferidoFromContactosJson> = null;
      let prefMark = "";
      if (isClientes) {
        pref = preferidoFromContactosJson(rec.contactosJson);
        // Marcamos con "*" solo si hay un contacto explícitamente marcado
        // como preferido en el JSON; si solo cogimos el primero por defecto
        // (sin nadie marcado), no se marca.
        if (pref && isExplicitPreferido(rec.contactosJson)) prefMark = "*";
      }
      const baseCells = columns.map((c) => {
        let raw = rec[c];
        // Sincronizar contacto/email/telefono con el preferido si están vacíos.
        if (isClientes && pref) {
          if (c === "contacto" && (!raw || String(raw).trim() === "")) raw = pref.nombre;
          else if (c === "email" && (!raw || String(raw).trim() === "")) raw = pref.email;
          else if (c === "telefono" && (!raw || String(raw).trim() === "")) raw = pref.telefono;
        }
        const str = raw == null ? "" : String(raw);
        return cellWithLeadingZerosFix(c, str);
      });
      const row = isClientes ? [...baseCells, prefMark] : baseCells;
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
