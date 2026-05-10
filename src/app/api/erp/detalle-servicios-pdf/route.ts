import { type NextRequest } from "next/server";
import { requireTenantSession } from "@/lib/saas/auth-session";
import { listModuleRecordsAsync } from "@/lib/persistence/active-client-data-store-async";
import {
  calcularPrefactura,
  filtrarPorClientePeriodo,
  actividadesAnterioresAlPeriodo,
  type Actividad,
  type BolsaCliente,
} from "@/lib/verticals/software-factory/prefacturacion-engine";
import { generateDetalleServiciosPdf } from "@/lib/verticals/software-factory/detalle-servicios-pdf";
import { resolveTenantEmisorAsync } from "@/lib/saas/tenant-emisor-resolver";
import { resolveRequestTenantRuntimeAsync } from "@/lib/saas/request-tenant-runtime-async";
import { captureError } from "@/lib/observability/error-capture";

/**
 * GET /api/erp/detalle-servicios-pdf?cliente=...&periodo=YYYY-MM (H7-S3)
 *
 * Devuelve el PDF "Detalle servicios <Cliente>" estilo SISPYME para
 * el cliente y periodo indicados.
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
    if (!session) return new Response("Unauthorized", { status: 401 });

    const cliente = String(request.nextUrl.searchParams.get("cliente") || "").trim();
    const periodo = String(request.nextUrl.searchParams.get("periodo") || new Date().toISOString().slice(0, 7));
    if (!cliente) return new Response("Falta cliente.", { status: 400 });
    if (!/^\d{4}-\d{2}$/.test(periodo)) return new Response("periodo debe ser YYYY-MM.", { status: 400 });

    const [actividadesRaw, proyectosRaw, catalogoRaw, runtime] = await Promise.all([
      listModuleRecordsAsync("actividades", session.clientId),
      listModuleRecordsAsync("proyectos", session.clientId),
      listModuleRecordsAsync("actividades-catalogo", session.clientId).catch(() => []),
      resolveRequestTenantRuntimeAsync(request),
    ]);

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

    const acts = filtrarPorClientePeriodo(actividades, cliente, periodo);
    if (acts.length === 0) {
      return new Response("Sin actividades del cliente " + cliente + " para el periodo " + periodo + ".", { status: 404 });
    }
    const previas = actividadesAnterioresAlPeriodo(actividades, cliente, periodo);

    let bolsa: BolsaCliente = { cliente, bolsaContratadaHoras: 10, bolsaConcepto: "Sin bolsa", tarifaHora: 55 };
    for (const p of proyectosRaw) {
      const c = String(p.cliente || "");
      const codigo = String(p.codigoTipo || "");
      if (c === cliente && (codigo === "BOLSA" || codigo === "MANT")) {
        bolsa = {
          cliente,
          bolsaContratadaHoras: parseHoras(p.bolsaContratadaHoras || p.bolsa || 10),
          bolsaConcepto: codigo === "MANT" ? "Mant. Nivel 1" : "Bolsa horas",
          tarifaHora: parseHoras(p.tarifaHoraOverride || 55),
        };
        break;
      }
    }

    const prefactura = calcularPrefactura(acts, bolsa, previas);

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
      cliente,
      periodo,
      prefactura,
      actividades: acts,
    });

    return new Response(pdf as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline; filename=\"detalle-servicios-" + cliente.replace(/\s+/g, "_") + "-" + periodo + ".pdf\"",
      },
    });
  } catch (e) {
    captureError(e, { scope: "/api/erp/detalle-servicios-pdf" });
    return new Response("Error generando PDF: " + (e instanceof Error ? e.message : "desconocido"), { status: 500 });
  }
}
