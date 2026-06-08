import { NextResponse, type NextRequest } from "next/server";
import { requireTenantSession } from "@/lib/saas/auth-session";
import { listModuleRecordsAsync } from "@/lib/persistence/active-client-data-store-async";
import {
  calcularPrefactura,
  filtrarPorContratoPeriodo,
  actividadesAnterioresAlPeriodoContrato,
  type Actividad,
  type Contrato,
  type LineaPrefactura,
} from "@/lib/verticals/software-factory/prefacturacion-engine";
import { captureError } from "@/lib/observability/error-capture";

/**
 * GET /api/erp/prefacturacion?periodo=YYYY-MM&tipoPeriodo=mensual|trimestral|anual|discreto
 *
 * Facturación.pptx (Pedro) — Una línea por CONTRATO activo del tenant
 * en el periodo solicitado. El método (Cuota/Horas/Bono), bolsa y
 * precio se leen del propio contrato; el consumo se calcula sumando
 * las tareas cuyo proyecto está asociado a ese contrato y marcado
 * facturable.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function parseHoras(v: unknown): number {
  if (typeof v === "number") return v;
  const s = String(v ?? "0").trim();
  if (s.includes(":")) {
    const [hh = "0", mm = "0"] = s.split(":");
    const h = parseInt(hh, 10);
    const m = parseInt(mm, 10);
    if (Number.isFinite(h) && Number.isFinite(m)) return h + m / 60;
    return 0;
  }
  const n = parseFloat(s.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export async function GET(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) return NextResponse.json({ ok: false, error: "Sesión inválida." }, { status: 401 });

    const periodo = String(request.nextUrl.searchParams.get("periodo") || new Date().toISOString().slice(0, 7));
    if (!/^\d{4}-\d{2}$/.test(periodo)) {
      return NextResponse.json({ ok: false, error: "periodo debe ser YYYY-MM." }, { status: 400 });
    }
    // TEST-20 G — Pedro: el periodo se divide en "tipo" (mensual/trimestral/
    // anual/discreto) + fecha. De momento aceptamos el parámetro y lo
    // devolvemos en la respuesta; el motor sigue agregando por mes.
    const tipoPeriodoRaw = String(request.nextUrl.searchParams.get("tipoPeriodo") || "mensual").toLowerCase();
    const tipoPeriodo: "mensual" | "trimestral" | "anual" | "discreto" =
      tipoPeriodoRaw === "trimestral" || tipoPeriodoRaw === "anual" || tipoPeriodoRaw === "discreto"
        ? (tipoPeriodoRaw as "trimestral" | "anual" | "discreto")
        : "mensual";

    const [actividadesRaw, proyectosRaw, contratosRaw, catalogoRaw] = await Promise.all([
      listModuleRecordsAsync("actividades", session.clientId),
      listModuleRecordsAsync("proyectos", session.clientId),
      listModuleRecordsAsync("contratos", session.clientId),
      listModuleRecordsAsync("actividades-catalogo", session.clientId).catch(() => []),
    ]);

    const tipoServicioPorActividad = new Map<string, string>();
    for (const c of catalogoRaw) {
      const codigo = String(c.codigo || "");
      const ts = String(c.tipoServicio || "Otros servicios");
      if (codigo) tipoServicioPorActividad.set(codigo, ts);
    }

    // Facturación.pptx — Mapas proyecto → facturable / contrato.
    const proyectoFacturablePorRef = new Map<string, "si" | "no">();
    const proyectoContratoPorRef = new Map<string, string>();
    for (const p of proyectosRaw) {
      const refs = [String(p.nombre || ""), String(p.id || "")].filter(Boolean);
      const facturable = String(p.facturable || "").toLowerCase() === "si" ? "si" : "no";
      const contrato = String(p.contrato || "");
      for (const r of refs) {
        proyectoFacturablePorRef.set(r, facturable);
        proyectoContratoPorRef.set(r, contrato);
      }
    }

    const actividades: Actividad[] = actividadesRaw.map((a) => ({
      id: String(a.id || ""),
      fecha: String(a.fecha || "").slice(0, 10),
      cliente: String(a.cliente || ""),
      proyecto: String(a.proyecto || ""),
      contrato: String(a.contrato || ""),
      empleado: String(a.empleado || ""),
      actividad: String(a.actividad || ""),
      tipoServicio: tipoServicioPorActividad.get(String(a.actividad || "")) || "Otros servicios",
      tiempoHoras: parseHoras(a.tiempoHoras || a.horas),
      tipoFacturacion: String(a.tipoFacturacion || ""), // legacy
      proyectoFacturable: proyectoFacturablePorRef.get(String(a.proyecto || "")) || "",
      proyectoContrato: proyectoContratoPorRef.get(String(a.proyecto || "")) || "",
      estado: String(a.estado || "borrador"),
      descripcion: String(a.descripcion || ""),
      horaDesde: String(a.horaDesde || ""),
      horaHasta: String(a.horaHasta || ""),
      lugar: String(a.lugar || ""),
    }));

    // Filtramos a contratos vigentes (estado in [activo, borrador]) y
    // construimos una línea por contrato.
    const contratos: Contrato[] = (contratosRaw as Array<Record<string, string>>)
      .filter((c) => {
        const estado = String(c.estado || "").toLowerCase();
        return estado !== "cancelado" && estado !== "finalizado";
      })
      .map((c) => ({
        id: String(c.id || ""),
        numero: String(c.numero || c.id || ""),
        cliente: String(c.cliente || ""),
        nivel: String(c.nivel || ""),
        modelo: String(c.modelo || "cuota"),
        periodo: String(c.periodo || "mensual"),
        bolsaHoras: parseHoras(c.bolsaHoras),
        precio: parseHoras(c.precio),
        estado: String(c.estado || "activo"),
        fechaInicio: String(c.fechaInicio || ""),
        fechaFin: String(c.fechaFin || ""),
      }));

    const lineas: LineaPrefactura[] = contratos.map((contrato) => {
      const ref = contrato.numero || contrato.id;
      const acts = filtrarPorContratoPeriodo(actividades, ref, periodo);
      const previas = actividadesAnterioresAlPeriodoContrato(actividades, ref, periodo);
      return calcularPrefactura(acts, contrato, previas);
    });

    const lineasVisibles = lineas.filter((l) => {
      // Cuotas y bonos se enseñan siempre (factura aunque no haya
      // consumo). Horas solo si hay horas o gastadas anteriormente.
      if (l.modelo === "cuota" || l.modelo === "bono") return true;
      return l.hPeriodo > 0 || l.hGastadasAnteriores > 0;
    });

    const totalImporte = lineasVisibles.reduce((s, l) => s + l.importe + l.importeExceso, 0);
    const totalHorasPeriodo = lineasVisibles.reduce((s, l) => s + l.hPeriodo, 0);

    return NextResponse.json({
      ok: true,
      periodo,
      tipoPeriodo,
      lineas: lineasVisibles,
      totales: {
        clientesActivos: new Set(lineasVisibles.map((l) => l.cliente)).size,
        horasPeriodo: totalHorasPeriodo,
        importe: Math.round(totalImporte * 100) / 100,
      },
      contratosEvaluados: contratos.length,
    });
  } catch (e) {
    captureError(e, { scope: "/api/erp/prefacturacion" });
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
