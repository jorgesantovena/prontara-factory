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
  const n = parseFloat(String(v ?? "0").replace(",", "."));
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

    const actividades: Actividad[] = actividadesRaw.map((a) => ({
      id: String(a.id || ""),
      fecha: String(a.fecha || "").slice(0, 10),
      cliente: String(a.cliente || ""),
      proyecto: String(a.proyecto || ""),
      empleado: String(a.empleado || ""),
      actividad: String(a.actividad || ""),
      tipoServicio: tipoServicioPorActividad.get(String(a.actividad || "")) || "Otros servicios",
      tiempoHoras: parseHoras(a.tiempoHoras || a.horas),
      tipoFacturacion: (String(a.tipoFacturacion || "no-facturable") as Actividad["tipoFacturacion"]),
      estado: String(a.estado || "borrador"),
      descripcion: String(a.descripcion || ""),
      horaDesde: String(a.horaDesde || ""),
      horaHasta: String(a.horaHasta || ""),
      lugar: String(a.lugar || ""),
    }));

    // Inferir bolsa de cada cliente: buscamos el proyecto con codigoTipo BOLSA / MANT más reciente
    const bolsaPorCliente = new Map<string, BolsaCliente>();
    for (const p of proyectosRaw) {
      const cliente = String(p.cliente || "");
      const codigo = String(p.codigoTipo || "");
      if (!cliente || (codigo !== "BOLSA" && codigo !== "MANT")) continue;
      const horas = parseHoras(p.bolsaContratadaHoras || p.bolsa || 10);
      const tarifa = parseHoras(p.tarifaHoraOverride || 55);
      // Nos quedamos con la primera bolsa encontrada por cliente (suficiente MVP)
      if (!bolsaPorCliente.has(cliente)) {
        bolsaPorCliente.set(cliente, {
          cliente,
          bolsaContratadaHoras: horas > 0 ? horas : 10,
          bolsaConcepto: codigo === "MANT" ? "Mantenimiento anual" : "Bolsa de horas",
          tarifaHora: tarifa > 0 ? tarifa : 55,
          vigenciaInicio: String(p.fechaInicio || ""),
          vigenciaFin: String(p.fechaCaducidad || ""),
        });
      }
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
