import { NextRequest, NextResponse } from "next/server";
import { requireTenantSession } from "@/lib/saas/auth-session";
import { listModuleRecordsAsync } from "@/lib/persistence/active-client-data-store-async";
import { captureError } from "@/lib/observability/error-capture";

/**
 * GET /api/runtime/sf/team-utilization (H15-C #4)
 *
 * Métrica de utilización del equipo: % horas cargables por persona
 * vs disponibles. Default 40h/semana laborable.
 *
 * Query: ?from=YYYY-MM-DD &to=YYYY-MM-DD (default: últimas 4 semanas)
 *
 * Devuelve por persona:
 *   - horasTotales (todas las imputaciones)
 *   - horasFacturables (las que tienen facturable=si)
 *   - horasDisponibles (40h * semanas en ventana, ajustado)
 *   - utilizacionPct = horasTotales / horasDisponibles * 100
 *   - facturablePct  = horasFacturables / horasTotales * 100
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEFAULT_HORAS_SEMANA = 40;

function parseImporte(v: unknown): number {
  const n = parseFloat(String(v ?? "0").replace(/[^\d,.-]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function diffWeeks(from: string, to: string): number {
  const f = new Date(from).getTime();
  const t = new Date(to).getTime();
  return Math.max(1, Math.round((t - f) / (7 * 86400_000)));
}

export async function GET(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) return NextResponse.json({ ok: false, error: "Sesión inválida." }, { status: 401 });

    const now = new Date();
    const fourWeeksAgo = new Date(now.getTime() - 28 * 86400_000);
    const from = String(request.nextUrl.searchParams.get("from") || fourWeeksAgo.toISOString().slice(0, 10));
    const to = String(request.nextUrl.searchParams.get("to") || now.toISOString().slice(0, 10));

    const [actividades, empleados] = await Promise.all([
      listModuleRecordsAsync("actividades", session.clientId).catch(() => []),
      listModuleRecordsAsync("empleados", session.clientId).catch(() => []),
    ]);

    const inWindow = (d: string): boolean => d >= from && d <= to;

    type Row = { persona: string; horasTotales: number; horasFacturables: number };
    const byPerson = new Map<string, Row>();

    for (const a of actividades) {
      const fecha = String(a.fecha || "").slice(0, 10);
      if (!inWindow(fecha)) continue;
      const persona = String(a.persona || a.empleado || a.responsable || "—").trim();
      if (!persona || persona === "—") continue;
      const horas = parseImporte(a.horas || a.tiempoHoras);
      const facturable = String(a.facturable || "").toLowerCase() === "si";
      const cur = byPerson.get(persona) || { persona, horasTotales: 0, horasFacturables: 0 };
      cur.horasTotales += horas;
      if (facturable) cur.horasFacturables += horas;
      byPerson.set(persona, cur);
    }

    // Asegura que TODOS los empleados aparecen, aunque tengan 0 horas
    for (const e of empleados) {
      const nombre = String(e.nombre || e.codigoCorto || "").trim();
      const enBaja = String(e.estado || "").toLowerCase() === "baja";
      if (!nombre || enBaja) continue;
      if (!byPerson.has(nombre)) {
        byPerson.set(nombre, { persona: nombre, horasTotales: 0, horasFacturables: 0 });
      }
    }

    const weeks = diffWeeks(from, to);
    const horasDisponibles = weeks * DEFAULT_HORAS_SEMANA;

    const rows = Array.from(byPerson.values()).map((r) => {
      const util = horasDisponibles > 0 ? (r.horasTotales * 100) / horasDisponibles : 0;
      const fact = r.horasTotales > 0 ? (r.horasFacturables * 100) / r.horasTotales : 0;
      return {
        persona: r.persona,
        horasTotales: Math.round(r.horasTotales * 100) / 100,
        horasFacturables: Math.round(r.horasFacturables * 100) / 100,
        horasDisponibles,
        utilizacionPct: Math.round(util * 10) / 10,
        facturablePct: Math.round(fact * 10) / 10,
      };
    }).sort((a, b) => b.utilizacionPct - a.utilizacionPct);

    const totalH = rows.reduce((s, r) => s + r.horasTotales, 0);
    const totalF = rows.reduce((s, r) => s + r.horasFacturables, 0);
    const totalDisp = rows.length * horasDisponibles;

    return NextResponse.json({
      ok: true,
      window: { from, to, weeks },
      rows,
      teamSummary: {
        people: rows.length,
        horasTotales: Math.round(totalH * 100) / 100,
        horasFacturables: Math.round(totalF * 100) / 100,
        horasDisponibles: totalDisp,
        utilizacionPct: totalDisp > 0 ? Math.round((totalH * 1000) / totalDisp) / 10 : 0,
        facturablePct: totalH > 0 ? Math.round((totalF * 1000) / totalH) / 10 : 0,
      },
    });
  } catch (e) {
    captureError(e, { scope: "/sf/team-utilization" });
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
