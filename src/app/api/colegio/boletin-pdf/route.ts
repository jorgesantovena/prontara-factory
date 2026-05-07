import { NextResponse, type NextRequest } from "next/server";
import { requireTenantSession } from "@/lib/saas/auth-session";
import { resolveTenantEmisorAsync } from "@/lib/saas/tenant-emisor-resolver";
import { resolveRequestTenantRuntimeAsync } from "@/lib/saas/request-tenant-runtime-async";
import { getBoletinAlumnoAsync } from "@/lib/verticals/colegio/calificaciones-engine";
import { generateBoletinPdf } from "@/lib/verticals/colegio/boletin-generator";

/**
 * GET /api/colegio/boletin-pdf?alumno=Lucia Romero&periodo=2T (SCHOOL-05)
 *
 * Genera el boletín de calificaciones de un alumno en un periodo
 * concreto, en PDF, usando el calificaciones-engine y el boletin-generator.
 *
 * Específico del vertical colegio. Los datos del centro emisor (razón
 * social, dirección, color) vienen del tenant (común a todos los
 * verticales — AUDIT-06).
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) {
      return NextResponse.json(
        { ok: false, error: "Sesión no válida." },
        { status: 401 },
      );
    }

    const params = request.nextUrl.searchParams;
    const alumno = String(params.get("alumno") || "").trim();
    const periodo = String(params.get("periodo") || "").trim();
    if (!alumno || !periodo) {
      return NextResponse.json(
        { ok: false, error: "Faltan parámetros: alumno, periodo." },
        { status: 400 },
      );
    }

    const boletin = await getBoletinAlumnoAsync(session.clientId, alumno, periodo);
    if (!boletin) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "No hay calificaciones registradas para " +
            alumno +
            " en el periodo " +
            periodo +
            ".",
        },
        { status: 404 },
      );
    }

    const runtime = await resolveRequestTenantRuntimeAsync(request);
    const emisor = await resolveTenantEmisorAsync({
      clientId: session.clientId,
      brandingDisplayName: runtime?.config?.branding?.displayName,
      brandingAccentColor: runtime?.config?.branding?.accentColor,
    });

    const pdf = await generateBoletinPdf(boletin, emisor);
    const filename =
      "Boletin-" +
      alumno.replace(/[^a-zA-Z0-9_-]+/g, "_") +
      "-" +
      periodo +
      ".pdf";

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="' + filename + '"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Error generando boletín.",
      },
      { status: 500 },
    );
  }
}
