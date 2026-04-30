import { NextResponse, type NextRequest } from "next/server";
import { generateJustificantePdf } from "@/lib/saas/justificante-generator";

/**
 * GET /api/erp/justificante-pdf?id=xxx&proyecto=...&numero=...&...
 *
 * Genera un PDF del justificante a partir de los parámetros que llegan.
 * Usamos query string en vez de POST para que el botón "Descargar PDF" en
 * la UI sea un simple <a href> (más simple que un fetch + Blob).
 *
 * Espera al menos numero, proyecto, fecha, horas, trabajos y estado. El
 * resto es opcional. La autenticación queda fuera de este endpoint porque
 * es para uso interno del runtime del tenant, no para Factory.
 */
export const runtime = "nodejs"; // pdfkit necesita Node, no Edge

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const params = Object.fromEntries(url.searchParams.entries()) as Record<string, string>;

  const numero = String(params.numero || params.id || "JUS-SIN-NUMERO").trim();
  const proyecto = String(params.proyecto || "").trim();
  const fecha = String(params.fecha || new Date().toISOString().slice(0, 10)).trim();
  const horas = String(params.horas || "0").trim();
  const trabajos = String(params.trabajos || "").trim();
  const estado = String(params.estado || "borrador").trim();

  if (!numero || !proyecto || !trabajos) {
    return NextResponse.json(
      { ok: false, error: "Faltan parámetros obligatorios: numero, proyecto, trabajos." },
      { status: 400 },
    );
  }

  try {
    const pdf = await generateJustificantePdf({
      numero,
      proyecto,
      fecha,
      horas,
      trabajos,
      estado,
      personaResponsable: String(params.personaResponsable || "").trim(),
      personaCliente: String(params.personaCliente || "").trim(),
      version: String(params.version || "").trim() || undefined,
      notas: String(params.notas || "").trim() || undefined,
      customerCompany: String(params.customerCompany || "").trim() || undefined,
      customerEmail: String(params.customerEmail || "").trim() || undefined,
    });

    const filename = "Justificante-" + numero.replace(/[^a-zA-Z0-9_-]+/g, "_") + ".pdf";

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="' + filename + '"',
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Error generando PDF." },
      { status: 500 },
    );
  }
}
