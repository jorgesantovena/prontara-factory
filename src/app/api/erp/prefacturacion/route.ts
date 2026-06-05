import { NextResponse, type NextRequest } from "next/server";
import { requireTenantSession } from "@/lib/saas/auth-session";
import { listModuleRecordsAsync } from "@/lib/persistence/active-client-data-store-async";
import {
  calcularPrefactura,
  filtrarPorClientePeriodo,
  actividadesAnterioresAlPeriodo,
  type Actividad,
  type BolsaCliente,
} from "@/lib/verticals/software-factory/prefacturacion-engine";
import { captureError } from "@/lib/observability/error-capture";

/**
 * GET /api/erp/prefacturacion?periodo=YYYY-MM (H7-S2)
 *
 * Devuelve la lista de pre-facturas del periodo, con las 8 columnas
 * estilo SISPYME por cada cliente del tenant.
 *
 * La bolsa se infiere del módulo `proyectos` con codigoTipo=BOLSA o
 * MANT, leyendo bolsaContratadaHoras + tarifaHoraOverride. Si el
 * cliente no tiene bolsa contratada, sus horas no-facturables van a 0
 * y todas las facturables se cuentan como sobreconsumo.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function parseHoras(v: unknown): number {
  if (typeof v === "number") return v;
  // TEST-12 #1 — tolerar hh:mm legacy y decimal con coma o punto.
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
    // TEST-20 G — Pedro: el periodo se divide en "tipo" (mensual/trimestral/anual/
    // discreto) + fecha. De momento aceptamos el parámetro y lo devolvemos en la
    // respuesta para que el front pueda confirmar, pero el motor sigue agregando
    // por mes calendario. La ampliación a ventana trimestral/anual queda como
    // siguiente paso (filtrarPorClientePeriodo recibirá un rango en vez de YYYY-MM).
    const tipoPeriodoRaw = String(request.nextUrl.searchParams.get("tipoPeriodo") || "mensual").toLowerCase();
    const tipoPeriodo: "mensual" | "trimestral" | "anual" | "discreto" =
      tipoPeriodoRaw === "trimestral" || tipoPeriodoRaw === "anual" || tipoPeriodoRaw === "discreto"
        ? (tipoPeriodoRaw as "trimestral" | "anual" | "discreto")
        : "mensual";

    const [actividadesRaw, proyectosRaw, clientesRaw, catalogoRaw] = await Promise.all([
      listModuleRecordsAsync("actividades", session.clientId),
      listModuleRecordsAsync("proyectos", session.clientId),
      listModuleRecordsAsync("clientes", session.clientId),
      listModuleRecordsAsync("actividades-catalogo", session.clientId).catch(() => []),
    ]);

    // Mapa código actividad → tipoServicio (para mostrar en el PDF)
    const tipoServicioPorActividad = new Map<string, string>();
    for (const c of catalogoRaw) {
      const codigo = String(c.codigo || "");
      const ts = String(c.tipoServicio || "Otros servicios");
      if (codigo) tipoServicioPorActividad.set(codigo, ts);
    }

    // TEST-20 F.4 — Mapa proyecto → facturable (sí/no) para que el
    // engine sepa qué tareas suman como facturables sin volver a
    // recorrer proyectos en el bucle.
    const facturablePorProyecto = new Map<string, "si" | "no">();
    for (const p of proyectosRaw) {
      const refs = [String(p.nombre || ""), String(p.id || "")].filter(Boolean);
      const facturable = String(p.facturable || "").toLowerCase() === "si" ? "si" : "no";
      for (const r of refs) facturablePorProyecto.set(r, facturable);
    }

    const actividades: Actividad[] = actividadesRaw.map((a) => ({
      id: String(a.id || ""),
      fecha: String(a.fecha || "").slice(0, 10),
      cliente: String(a.cliente || ""),
      proyecto: String(a.proyecto || ""),
      empleado: String(a.empleado || ""),
      actividad: String(a.actividad || ""),
      tipoServicio: tipoServicioPorActividad.get(String(a.actividad || "")) || "Otros servicios",
      tiempoHoras: parseHoras(a.tiempoHoras || a.horas),
      tipoFacturacion: String(a.tipoFacturacion || ""), // legacy
      proyectoFacturable: facturablePorProyecto.get(String(a.proyecto || "")) || "",
      estado: String(a.estado || "borrador"),
      descripcion: String(a.descripcion || ""),
      horaDesde: String(a.horaDesde || ""),
      horaHasta: String(a.horaHasta || ""),
      lugar: String(a.lugar || ""),
    }));

    // TEST-20 F.4 — La bolsa pasa a vivir en el Cliente (Modo/Bolsa/
    // Unidad/Margen/Periodo). Mantenemos compat con el legacy: si el
    // cliente no tiene bolsaCantidad pero sí un proyecto BOLSA/MANT,
    // tomamos sus horas como bolsa.
    const bolsaPorCliente = new Map<string, BolsaCliente>();
    for (const c of clientesRaw) {
      const nombre = String(c.nombre || "");
      if (!nombre) continue;
      const horasBolsa = parseHoras(c.bolsaCantidad);
      const tarifaFallback = 55;
      bolsaPorCliente.set(nombre, {
        cliente: nombre,
        bolsaContratadaHoras: horasBolsa > 0 ? horasBolsa : 0,
        bolsaConcepto: horasBolsa > 0 ? "Bolsa contratada" : "Sin bolsa",
        tarifaHora: tarifaFallback,
        modoFacturacion: String(c.modoFacturacion || "fijo"),
        unidadFacturacion: String(c.unidadFacturacion || "h"),
        margenPorcentaje: parseHoras(c.margenPorcentaje),
        periodoFacturacion: String(c.periodoFacturacion || "mes"),
      });
    }
    // Legacy: relleno desde proyecto BOLSA/MANT si el cliente no tiene
    // bolsaCantidad informado.
    for (const p of proyectosRaw) {
      const cliente = String(p.cliente || "");
      const codigo = String(p.codigoTipo || "");
      if (!cliente || (codigo !== "BOLSA" && codigo !== "MANT")) continue;
      const existente = bolsaPorCliente.get(cliente);
      if (existente && existente.bolsaContratadaHoras > 0) continue;
      const horas = parseHoras(p.bolsaContratadaHoras || p.bolsa || 10);
      const tarifa = parseHoras(p.tarifaHoraOverride || 55);
      bolsaPorCliente.set(cliente, {
        ...(existente || { cliente, bolsaContratadaHoras: 0, bolsaConcepto: "Sin bolsa", tarifaHora: 55 }),
        bolsaContratadaHoras: horas > 0 ? horas : 10,
        bolsaConcepto: codigo === "MANT" ? "Mantenimiento anual" : "Bolsa de horas",
        tarifaHora: tarifa > 0 ? tarifa : 55,
        vigenciaInicio: String(p.fechaInicio || ""),
        vigenciaFin: String(p.fechaCaducidad || ""),
      });
    }

    // Para cada cliente con actividades en el periodo o anteriores, calculamos línea
    const clientes = Array.from(new Set(actividades.map((a) => a.cliente).filter(Boolean)));
    const lineas = clientes.map((cliente) => {
      const acts = filtrarPorClientePeriodo(actividades, cliente, periodo);
      const previas = actividadesAnterioresAlPeriodo(actividades, cliente, periodo);
      const bolsa = bolsaPorCliente.get(cliente) || {
        cliente,
        bolsaContratadaHoras: 0,
        bolsaConcepto: "Sin bolsa",
        tarifaHora: 55,
      };
      return calcularPrefactura(acts, bolsa, previas);
    }).filter((l) => l.hPeriodo > 0 || l.hGastadasAnteriores > 0);

    const totalImporte = lineas.reduce((s, l) => s + l.importe, 0);
    const totalHorasPeriodo = lineas.reduce((s, l) => s + l.hPeriodo, 0);

    return NextResponse.json({
      ok: true,
      periodo,
      tipoPeriodo,
      lineas,
      totales: {
        clientesActivos: lineas.length,
        horasPeriodo: totalHorasPeriodo,
        importe: Math.round(totalImporte * 100) / 100,
      },
      clientesEncontrados: clientesRaw.length,
    });
  } catch (e) {
    captureError(e, { scope: "/api/erp/prefacturacion" });
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
