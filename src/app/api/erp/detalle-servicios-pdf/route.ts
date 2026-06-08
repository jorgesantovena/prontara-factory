import { type NextRequest } from "next/server";
import { requireTenantSession } from "@/lib/saas/auth-session";
import { listModuleRecordsAsync } from "@/lib/persistence/active-client-data-store-async";
import {
  findNivel,
  tareaEsFacturable,
  type Actividad,
  type Contrato,
  type Nivel,
} from "@/lib/verticals/software-factory/prefacturacion-engine";
import { generateDetalleServiciosPdf } from "@/lib/verticals/software-factory/detalle-servicios-pdf";
import { resolveTenantEmisorAsync } from "@/lib/saas/tenant-emisor-resolver";
import { resolveRequestTenantRuntimeAsync } from "@/lib/saas/request-tenant-runtime-async";
import { captureError } from "@/lib/observability/error-capture";

/**
 * GET /api/erp/detalle-servicios-pdf?contrato=...&periodo=YYYY-MM
 *
 * TEST 19 (Pedro) — PDF "Detalle servicios" por Contrato y mes.
 * Muestra el resumen del contrato (Bolsa, Consumo año, Facturadas,
 * Exceso a la fecha) + las tareas del periodo agrupadas por servicio.
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
    if (!session) return new Response("Unauthorized", { status: 401 });

    const contratoParam = String(request.nextUrl.searchParams.get("contrato") || "").trim();
    const periodo = String(request.nextUrl.searchParams.get("periodo") || new Date().toISOString().slice(0, 7));
    // Compat: aceptamos cliente= para enlaces antiguos (toma el primer
    // contrato activo del cliente).
    const clienteParam = String(request.nextUrl.searchParams.get("cliente") || "").trim();
    if (!contratoParam && !clienteParam) return new Response("Falta contrato (o cliente).", { status: 400 });
    if (!/^\d{4}-\d{2}$/.test(periodo)) return new Response("periodo debe ser YYYY-MM.", { status: 400 });

    const [actividadesRaw, proyectosRaw, contratosRaw, nivelesRaw, catalogoRaw, runtime] = await Promise.all([
      listModuleRecordsAsync("actividades", session.clientId),
      listModuleRecordsAsync("proyectos", session.clientId),
      listModuleRecordsAsync("contratos", session.clientId),
      listModuleRecordsAsync("niveles", session.clientId),
      listModuleRecordsAsync("actividades-catalogo", session.clientId).catch(() => []),
      resolveRequestTenantRuntimeAsync(request),
    ]);

    const tipoServicioPorActividad = new Map<string, string>();
    for (const c of catalogoRaw) {
      const codigo = String(c.codigo || "");
      const ts = String(c.tipoServicio || "Otros servicios");
      if (codigo) tipoServicioPorActividad.set(codigo, ts);
    }

    const contratosArr = contratosRaw as Array<Record<string, string>>;
    const contratoRow: Record<string, string> | undefined = contratoParam
      ? contratosArr.find((c) => String(c.codigo || "") === contratoParam || String(c.numero || "") === contratoParam || String(c.id || "") === contratoParam)
      : contratosArr.find((c) => String(c.cliente || "") === clienteParam && String(c.estado || "").toLowerCase() === "activo") || contratosArr.find((c) => String(c.cliente || "") === clienteParam);
    if (!contratoRow) {
      return new Response("Contrato no encontrado.", { status: 404 });
    }
    const contrato: Contrato = {
      id: String(contratoRow.id || ""),
      codigo: String(contratoRow.codigo || contratoRow.numero || contratoRow.id || ""),
      cliente: String(contratoRow.cliente || ""),
      periodo: String(contratoRow.periodo || "mensual"),
      tipoNivel: String(contratoRow.tipoNivel || "M"),
      subtipo: String(contratoRow.subtipo || ""),
      consumo: parseHoras(contratoRow.consumo),
      facturadas: parseHoras(contratoRow.facturadas),
      estado: String(contratoRow.estado || "activo"),
    };
    const niveles: Nivel[] = (nivelesRaw as Array<Record<string, string>>).map((n) => ({
      tipoNivel: String(n.tipoNivel || ""),
      subtipo: String(n.subtipo || ""),
      modelo: String(n.modelo || "cuota"),
      bolsa: parseHoras(n.bolsa),
      precio: parseHoras(n.precio),
      descripcion: String(n.descripcion || ""),
    }));
    const nivelCuota = findNivel(niveles, contrato.tipoNivel, contrato.subtipo, "cuota");
    const nivelHoras = findNivel(niveles, contrato.tipoNivel, contrato.subtipo, "horas");
    const bolsa = (nivelCuota?.bolsa ?? nivelHoras?.bolsa ?? 0);
    const precioCuota = nivelCuota?.precio ?? 0;
    const precioHoras = nivelHoras?.precio ?? 0;

    // Resolver mapa proyecto → (facturable, contrato).
    const proyectoFacturablePorRef = new Map<string, "si" | "no">();
    const proyectoContratoPorRef = new Map<string, string>();
    for (const p of proyectosRaw as Array<Record<string, string>>) {
      const refs = [String(p.nombre || ""), String(p.id || "")].filter(Boolean);
      const facturable = String(p.facturable || "").toLowerCase() === "si" ? "si" : "no";
      const c = String(p.contrato || "");
      for (const r of refs) {
        proyectoFacturablePorRef.set(r, facturable);
        proyectoContratoPorRef.set(r, c);
      }
    }

    const actividades: Actividad[] = (actividadesRaw as Array<Record<string, string>>).map((a) => ({
      id: String(a.id || ""),
      fecha: String(a.fecha || "").slice(0, 10),
      cliente: String(a.cliente || ""),
      proyecto: String(a.proyecto || ""),
      contrato: String(a.contrato || ""),
      empleado: String(a.empleado || ""),
      actividad: String(a.actividad || ""),
      tipoServicio: tipoServicioPorActividad.get(String(a.actividad || "")) || "Otros servicios",
      tiempoHoras: parseHoras(a.tiempoHoras || a.horas),
      tipoFacturacion: String(a.tipoFacturacion || ""),
      proyectoFacturable: proyectoFacturablePorRef.get(String(a.proyecto || "")) || "",
      proyectoContrato: proyectoContratoPorRef.get(String(a.proyecto || "")) || "",
      estado: String(a.estado || "borrador"),
      descripcion: String(a.descripcion || ""),
      horaDesde: String(a.horaDesde || ""),
      horaHasta: String(a.horaHasta || ""),
      lugar: String(a.lugar || ""),
    }));

    // Filtrar tareas del contrato dentro del mes.
    const acts = actividades.filter((a) => {
      const cRef = String(a.contrato || a.proyectoContrato || "");
      if (cRef !== contrato.codigo) return false;
      if (!tareaEsFacturable(a)) return false;
      return String(a.fecha).slice(0, 7) === periodo;
    });
    if (acts.length === 0) {
      return new Response("Sin tareas del contrato " + contrato.codigo + " para el periodo " + periodo + ".", { status: 404 });
    }

    const consumoPeriodo = acts.reduce((s, a) => s + a.tiempoHoras, 0);
    const consumoAnio = contrato.consumo; // ya viene precalculado (reset anual)
    const exceso = Math.max(0, consumoAnio - bolsa - contrato.facturadas);

    const tenantEmisor = await resolveTenantEmisorAsync({
      clientId: session.clientId,
      brandingDisplayName: runtime?.config?.branding?.displayName,
      brandingAccentColor: runtime?.config?.branding?.accentColor,
    });

    const pdf = await generateDetalleServiciosPdf({
      emisor: {
        razonSocial: tenantEmisor.razonSocial || "Emisor",
        direccion: tenantEmisor.direccion || "",
        telefono: tenantEmisor.telefono || "",
        email: tenantEmisor.email || "",
      },
      cliente: contrato.cliente,
      periodo,
      prefactura: {
        contrato: contrato.codigo,
        tipoNivel: contrato.tipoNivel,
        subtipo: contrato.subtipo,
        modelo: contrato.tipoNivel === "B" ? "Bono" : "Mant",
        periodoContrato: contrato.periodo,
        bolsa,
        precioCuota,
        precioHoras,
        consumoAnio,
        consumoPeriodo,
        facturadas: contrato.facturadas,
        exceso,
        importeExceso: exceso * precioHoras,
      },
      actividades: acts,
    });

    return new Response(pdf as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline; filename=\"detalle-" + contrato.codigo + "-" + periodo + ".pdf\"",
      },
    });
  } catch (e) {
    captureError(e, { scope: "/api/erp/detalle-servicios-pdf" });
    return new Response("Error generando PDF: " + (e instanceof Error ? e.message : "desconocido"), { status: 500 });
  }
}
