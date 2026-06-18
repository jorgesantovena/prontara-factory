import { NextResponse, type NextRequest } from "next/server";
import { requireTenantSession } from "@/lib/saas/auth-session";
import { listModuleRecordsAsync } from "@/lib/persistence/active-client-data-store-async";
import {
  prefacturar,
  type Contrato,
  type Nivel,
  type LineaPrefactura,
  type Actividad,
  type ProyectoLite,
  type AplicacionContrato,
  type DesplazamientoLite,
} from "@/lib/verticals/software-factory/prefacturacion-engine";
import { captureError } from "@/lib/observability/error-capture";
import { ensureTest19Seed } from "@/lib/verticals/software-factory/ensure-test19-seed";

/**
 * GET /api/erp/prefacturacion?modelo=cuota|horas&periodo=mensual|trimestral|semestral|anual|discreto
 *
 * TEST 19 (Pedro) — Diálogo previo con dos parámetros (Modelo + Periodo).
 * Devuelve una línea por contrato que cumple los filtros:
 *   - Caso A (modelo=cuota): selecciona contratos con el periodo
 *     indicado. Importe = Bolsa × Precio del Nivel (Tipo+Subtipo+Cuota).
 *   - Caso B (modelo=horas): solo Tipo M, periodo Mensual.
 *     Importe = max(0, Consumo − Bolsa − Facturadas) × Precio del
 *     Nivel (M, Subtipo, Horas).
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function parseNum(v: unknown): number {
  if (typeof v === "number") return v;
  const s = String(v ?? "0").trim();
  const n = parseFloat(s.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export async function GET(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) return NextResponse.json({ ok: false, error: "Sesión inválida." }, { status: 401 });

    const modeloRaw = String(request.nextUrl.searchParams.get("modelo") || "cuota").toLowerCase();
    const modelo: "cuota" | "horas" | "desplazamiento" =
      modeloRaw === "horas" ? "horas" : modeloRaw === "desplazamiento" ? "desplazamiento" : "cuota";

    const periodoRaw = String(request.nextUrl.searchParams.get("periodo") || "mensual").toLowerCase();
    const PERIODOS = ["mensual", "trimestral", "semestral", "anual", "discreto"] as const;
    const periodo: typeof PERIODOS[number] = (PERIODOS as readonly string[]).includes(periodoRaw)
      ? (periodoRaw as typeof PERIODOS[number])
      : "mensual";

    // Test 19 bis G — Fecha (mes a facturar) en formato "YYYY-MM". Solo
    // afecta al Caso B (filtra las tareas del mes para el desglose por
    // servicio). Vacío = sin filtro de mes.
    const fecha = String(request.nextUrl.searchParams.get("fecha") || "").trim();

    let [contratosRaw, nivelesRaw] = await Promise.all([
      listModuleRecordsAsync("contratos", session.clientId),
      listModuleRecordsAsync("niveles", session.clientId),
    ]);

    // TEST 19 — Auto-seed self-healing: si el tenant aún no tiene Niveles
    // ni Contratos (tenant anterior a TEST 19), los sembramos aquí mismo
    // para que la Pre-facturación funcione aunque Pedro entre directo sin
    // pasar antes por las tablas. Idempotente.
    if (
      (contratosRaw as unknown[]).length === 0 &&
      (nivelesRaw as unknown[]).length === 0
    ) {
      try {
        await ensureTest19Seed(session.clientId);
        [contratosRaw, nivelesRaw] = await Promise.all([
          listModuleRecordsAsync("contratos", session.clientId),
          listModuleRecordsAsync("niveles", session.clientId),
        ]);
      } catch (e) {
        captureError(e, { scope: "/api/erp/prefacturacion → ensureTest19Seed" });
      }
    }

    const contratos: Contrato[] = (contratosRaw as Array<Record<string, string>>).map((c) => ({
      id: String(c.id || ""),
      codigo: String(c.codigo || c.numero || c.id || ""),
      cliente: String(c.cliente || ""),
      periodo: String(c.periodo || "mensual"),
      tipoNivel: String(c.tipoNivel || "M"),
      subtipo: String(c.subtipo || ""),
      consumo: parseNum(c.consumo),
      facturadas: parseNum(c.facturadas),
      referenciaPropuesta: String(c.referenciaPropuesta || ""),
      estado: String(c.estado || "activo"),
      fechaInicio: String(c.fechaInicio || ""),
      fechaFin: String(c.fechaFin || ""),
    }));

    const niveles: Nivel[] = (nivelesRaw as Array<Record<string, string>>).map((n) => ({
      tipoNivel: String(n.tipoNivel || ""),
      subtipo: String(n.subtipo || ""),
      modelo: String(n.modelo || "cuota"),
      bolsa: parseNum(n.bolsa),
      precio: parseNum(n.precio),
      servicio: String(n.servicio || ""),
      aplicacion: String(n.aplicacion || ""),
      descripcion: String(n.descripcion || ""),
    }));

    // Test 23 — Para la cuota trimestral de Mantº Errores cargamos la tabla
    // A/C (Aplicaciones/Contrato).
    let aplicacionesContrato: AplicacionContrato[] = [];
    if (modelo === "cuota") {
      const acRaw = await listModuleRecordsAsync("aplicaciones-contrato", session.clientId);
      aplicacionesContrato = (acRaw as Array<Record<string, string>>).map((a) => ({
        contrato: String(a.contrato || ""),
        aplicacion: String(a.aplicacion || ""),
        codigo: String(a.codigo || ""),
      }));
    }

    // Test 19 bis G — Para el Caso B (Horas) cargamos tareas y proyectos
    // para desglosar el exceso por servicio. En Caso A no hace falta.
    let actividades: Actividad[] = [];
    let proyectos: ProyectoLite[] = [];
    if (modelo === "horas") {
      const [actsRaw, proysRaw] = await Promise.all([
        listModuleRecordsAsync("actividades", session.clientId),
        listModuleRecordsAsync("proyectos", session.clientId),
      ]);
      actividades = (actsRaw as Array<Record<string, string>>).map((a) => ({
        id: String(a.id || ""),
        fecha: String(a.fecha || ""),
        cliente: String(a.cliente || ""),
        proyecto: String(a.proyecto || ""),
        contrato: String(a.contrato || ""),
        tiempoHoras: parseNum(a.tiempoHoras || a.horas),
        estado: String(a.estado || ""),
      }));
      proyectos = (proysRaw as Array<Record<string, string>>).map((p) => ({
        nombre: String(p.nombre || ""),
        id: String(p.id || ""),
        contrato: String(p.contrato || ""),
        codigoTipo: String(p.codigoTipo || ""),
        facturable: String(p.facturable || ""),
      }));
    }

    // Test 25 — Modelo Desplazamiento: cargamos los desplazamientos.
    let desplazamientos: DesplazamientoLite[] = [];
    if (modelo === "desplazamiento") {
      const dRaw = await listModuleRecordsAsync("desplazamientos", session.clientId);
      desplazamientos = (dRaw as Array<Record<string, string>>).map((d) => ({
        fecha: String(d.fecha || ""),
        cliente: String(d.puntoVenta || d.cliente || ""),
        kilometros: parseNum(d.kilometros),
        importeTotal: parseNum(d.importeTotal),
        facturable: String(d.facturable || ""),
        estado: String(d.estado || ""),
      }));
    }

    const lineas: LineaPrefactura[] = prefacturar(contratos, niveles, modelo, periodo, {
      fecha: fecha || undefined,
      actividades,
      proyectos,
      aplicacionesContrato,
      desplazamientos,
    });
    const totalImporte = lineas.reduce((s, l) => s + l.importe, 0);
    const totalHoras = lineas.reduce((s, l) => s + l.horasAFacturar, 0);

    return NextResponse.json({
      ok: true,
      modelo,
      periodo,
      fecha,
      lineas,
      totales: {
        contratos: lineas.length,
        clientes: new Set(lineas.map((l) => l.cliente)).size,
        horasAFacturar: Math.round(totalHoras * 100) / 100,
        importe: Math.round(totalImporte * 100) / 100,
      },
      contratosEvaluados: contratos.length,
      nivelesDisponibles: niveles.length,
    });
  } catch (e) {
    captureError(e, { scope: "/api/erp/prefacturacion" });
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
