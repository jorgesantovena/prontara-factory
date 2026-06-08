import { type NextRequest } from "next/server";
import { requireTenantSession } from "@/lib/saas/auth-session";
import { listModuleRecordsAsync } from "@/lib/persistence/active-client-data-store-async";
import {
  calcularPrefactura,
  filtrarPorContratoPeriodo,
  actividadesAnterioresAlPeriodoContrato,
  type Actividad,
  type Contrato,
} from "@/lib/verticals/software-factory/prefacturacion-engine";
import { generateDetalleServiciosPdf } from "@/lib/verticals/software-factory/detalle-servicios-pdf";
import { resolveTenantEmisorAsync } from "@/lib/saas/tenant-emisor-resolver";
import { resolveRequestTenantRuntimeAsync } from "@/lib/saas/request-tenant-runtime-async";
import { captureError } from "@/lib/observability/error-capture";

/**
 * GET /api/erp/detalle-servicios-pdf?cliente=...&periodo=YYYY-MM&contrato=...
 *
 * Facturación.pptx (Pedro) — PDF "Detalle servicios <Cliente>" estilo
 * SISPYME. La unidad de agregación es el CONTRATO: si se pasa
 * `&contrato=`, se usa ese contrato concreto. Si no, se elige el
 * primer contrato activo del cliente.
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

    const cliente = String(request.nextUrl.searchParams.get("cliente") || "").trim();
    const periodo = String(request.nextUrl.searchParams.get("periodo") || new Date().toISOString().slice(0, 7));
    const contratoParam = String(request.nextUrl.searchParams.get("contrato") || "").trim();
    if (!cliente) return new Response("Falta cliente.", { status: 400 });
    if (!/^\d{4}-\d{2}$/.test(periodo)) return new Response("periodo debe ser YYYY-MM.", { status: 400 });

    const [actividadesRaw, proyectosRaw, contratosRaw, catalogoRaw, runtime] = await Promise.all([
      listModuleRecordsAsync("actividades", session.clientId),
      listModuleRecordsAsync("proyectos", session.clientId),
      listModuleRecordsAsync("contratos", session.clientId),
      listModuleRecordsAsync("actividades-catalogo", session.clientId).catch(() => []),
      resolveRequestTenantRuntimeAsync(request),
    ]);

    const tipoServicioPorActividad = new Map<string, string>();
    for (const c of catalogoRaw) {
      const codigo = String(c.codigo || "");
      const ts = String(c.tipoServicio || "Otros servicios");
      if (codigo) tipoServicioPorActividad.set(codigo, ts);
    }

    // Resolver contrato: si viene por URL lo usamos; si no, el primer
    // contrato activo del cliente.
    const contratosCliente = (contratosRaw as Array<Record<string, string>>).filter((c) => String(c.cliente || "") === cliente);
    if (contratosCliente.length === 0) {
      return new Response("El cliente " + cliente + " no tiene contratos.", { status: 404 });
    }
    const contratoRow: Record<string, string> = (contratoParam
      ? contratosCliente.find((c) => String(c.numero || "") === contratoParam || String(c.id || "") === contratoParam)
      : contratosCliente.find((c) => String(c.estado || "").toLowerCase() === "activo") || contratosCliente[0]
    ) || contratosCliente[0];
    const contrato: Contrato = {
      id: String(contratoRow.id || ""),
      numero: String(contratoRow.numero || contratoRow.id || ""),
      cliente,
      nivel: String(contratoRow.nivel || ""),
      modelo: String(contratoRow.modelo || "cuota"),
      periodo: String(contratoRow.periodo || "mensual"),
      bolsaHoras: parseHoras(contratoRow.bolsaHoras),
      precio: parseHoras(contratoRow.precio),
      estado: String(contratoRow.estado || "activo"),
    };
    const contratoRef = contrato.numero;

    // Mapas proyecto → facturable / contrato.
    const proyectoFacturablePorRef = new Map<string, "si" | "no">();
    const proyectoContratoPorRef = new Map<string, string>();
    for (const p of proyectosRaw) {
      const refs = [String(p.nombre || ""), String(p.id || "")].filter(Boolean);
      const facturable = String(p.facturable || "").toLowerCase() === "si" ? "si" : "no";
      const c = String(p.contrato || "");
      for (const r of refs) {
        proyectoFacturablePorRef.set(r, facturable);
        proyectoContratoPorRef.set(r, c);
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
      tipoFacturacion: String(a.tipoFacturacion || ""),
      proyectoFacturable: proyectoFacturablePorRef.get(String(a.proyecto || "")) || "",
      proyectoContrato: proyectoContratoPorRef.get(String(a.proyecto || "")) || "",
      estado: String(a.estado || "borrador"),
      descripcion: String(a.descripcion || ""),
      horaDesde: String(a.horaDesde || ""),
      horaHasta: String(a.horaHasta || ""),
      lugar: String(a.lugar || ""),
    }));

    const acts = filtrarPorContratoPeriodo(actividades, contratoRef, periodo);
    if (acts.length === 0) {
      return new Response("Sin actividades del contrato " + contratoRef + " para el periodo " + periodo + ".", { status: 404 });
    }
    const previas = actividadesAnterioresAlPeriodoContrato(actividades, contratoRef, periodo);
    const prefactura = calcularPrefactura(acts, contrato, previas);

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
