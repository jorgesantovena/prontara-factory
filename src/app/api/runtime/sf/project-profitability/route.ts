import { NextRequest, NextResponse } from "next/server";
import { requireTenantSession } from "@/lib/saas/auth-session";
import { listModuleRecordsAsync } from "@/lib/persistence/active-client-data-store-async";
import { captureError } from "@/lib/observability/error-capture";

/**
 * GET /api/runtime/sf/project-profitability (H15-C #3)
 *
 * Calcula rentabilidad por proyecto:
 *   ingresos = sum(facturas.importe del cliente del proyecto)
 *   costes   = sum(actividades.horas * tarifaCoste)
 *              + sum(gastos.importe asociados al proyecto)
 *   margen   = ingresos - costes
 *   margenPct = margen / ingresos * 100
 *
 * Query opcional ?projectId=  → solo ese proyecto
 *               ?from=YYYY-MM &to=YYYY-MM → ventana temporal
 *
 * Devuelve array ordenado por margen desc (los más rentables arriba).
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function parseImporte(v: unknown): number {
  const n = parseFloat(String(v ?? "0").replace(/[^\d,.-]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

// Tarifa coste/hora promedio para SF (sueldo bruto + cargas / horas año).
// TODO: hacer configurable por tenant en /ajustes/sf.
const DEFAULT_COSTE_HORA = 25;

export async function GET(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) return NextResponse.json({ ok: false, error: "Sesión inválida." }, { status: 401 });

    const projectId = String(request.nextUrl.searchParams.get("projectId") || "").trim();
    const from = String(request.nextUrl.searchParams.get("from") || "").trim();
    const to = String(request.nextUrl.searchParams.get("to") || "").trim();

    const [proyectos, facturas, actividades, gastos] = await Promise.all([
      listModuleRecordsAsync("proyectos", session.clientId).catch(() => []),
      listModuleRecordsAsync("facturacion", session.clientId).catch(() => []),
      listModuleRecordsAsync("actividades", session.clientId).catch(() => []),
      listModuleRecordsAsync("gastos", session.clientId).catch(() => []),
    ]);

    function inWindow(dateStr: string): boolean {
      if (!from && !to) return true;
      const d = dateStr.slice(0, 7); // YYYY-MM
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    }

    const proyectosToScore = projectId
      ? proyectos.filter((p) => p.id === projectId)
      : proyectos;

    const rows = proyectosToScore.map((p) => {
      const cliente = String(p.cliente || "");
      const pId = String(p.id || "");

      // Ingresos = facturas del proyecto (vía recurringPlan.proyectoRefId o vía cliente+proyecto en notas)
      const ingresos = facturas
        .filter((f) => String(f.cliente || "") === cliente)
        .filter((f) => inWindow(String(f.fechaEmision || f.fecha || "")))
        .filter((f) => !projectId || String(f.proyectoRefId || "") === pId || (f.cliente === cliente && cliente))
        .reduce((s, f) => s + parseImporte(f.importe), 0);

      // Horas imputadas al proyecto
      const horas = actividades
        .filter((a) => String(a.proyecto || "") === pId || String(a.proyecto || "") === String(p.nombre || ""))
        .filter((a) => inWindow(String(a.fecha || "")))
        .reduce((s, a) => s + parseImporte(a.horas), 0);

      // Tarifa hora coste (override por proyecto o default)
      const costeHora = parseImporte(p.tarifaCosteHora) || DEFAULT_COSTE_HORA;
      const costeHoras = horas * costeHora;

      // Gastos del proyecto
      const costeGastos = gastos
        .filter((g) => String(g.proyecto || "") === pId || String(g.proyecto || "") === String(p.nombre || ""))
        .filter((g) => inWindow(String(g.fecha || "")))
        .reduce((s, g) => s + parseImporte(g.importe), 0);

      const costes = costeHoras + costeGastos;
      const margen = ingresos - costes;
      const margenPct = ingresos > 0 ? (margen * 100) / ingresos : null;

      return {
        id: pId,
        nombre: p.nombre || "",
        cliente,
        estado: p.estado || "",
        ingresos: Math.round(ingresos * 100) / 100,
        horas: Math.round(horas * 100) / 100,
        costeHoras: Math.round(costeHoras * 100) / 100,
        costeGastos: Math.round(costeGastos * 100) / 100,
        costes: Math.round(costes * 100) / 100,
        margen: Math.round(margen * 100) / 100,
        margenPct: margenPct != null ? Math.round(margenPct * 10) / 10 : null,
        costeHoraUsado: costeHora,
      };
    });

    rows.sort((a, b) => b.margen - a.margen);

    const totals = rows.reduce((acc, r) => ({
      ingresos: acc.ingresos + r.ingresos,
      costes: acc.costes + r.costes,
      margen: acc.margen + r.margen,
      horas: acc.horas + r.horas,
    }), { ingresos: 0, costes: 0, margen: 0, horas: 0 });

    return NextResponse.json({
      ok: true,
      window: { from, to },
      defaultCosteHora: DEFAULT_COSTE_HORA,
      rows,
      totals: {
        ingresos: Math.round(totals.ingresos * 100) / 100,
        costes: Math.round(totals.costes * 100) / 100,
        margen: Math.round(totals.margen * 100) / 100,
        margenPct: totals.ingresos > 0 ? Math.round((totals.margen * 1000) / totals.ingresos) / 10 : null,
        horas: Math.round(totals.horas * 100) / 100,
      },
    });
  } catch (e) {
    captureError(e, { scope: "/sf/project-profitability" });
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
