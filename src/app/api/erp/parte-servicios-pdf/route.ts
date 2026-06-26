import { type NextRequest } from "next/server";
import { requireTenantSession } from "@/lib/saas/auth-session";
import { listModuleRecordsAsync } from "@/lib/persistence/active-client-data-store-async";
import { generateParteServiciosPdf, type ParteTarea } from "@/lib/saas/parte-servicios-pdf";
import { resolveTenantEmisorAsync } from "@/lib/saas/tenant-emisor-resolver";
import { resolveRequestTenantRuntimeAsync } from "@/lib/saas/request-tenant-runtime-async";
import { captureError } from "@/lib/observability/error-capture";

/**
 * GET /api/erp/parte-servicios-pdf?cliente=<nombre|id>&periodo=YYYY-MM
 *
 * Pedro 22-06 — PDF "Parte de Servicios" (estado de cuenta) por cliente y mes:
 * tabla de tareas (Trabajador/Fecha/Desde/Hasta/Tiempo/Proyecto/Asunto/
 * Observaciones), total de tiempo y firmas.
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
    return Number.isFinite(h) && Number.isFinite(m) ? h + m / 60 : 0;
  }
  const n = parseFloat(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export async function GET(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) return new Response("Unauthorized", { status: 401 });

    const clienteParam = String(request.nextUrl.searchParams.get("cliente") || "").trim();
    const periodo = String(request.nextUrl.searchParams.get("periodo") || new Date().toISOString().slice(0, 7));
    if (!clienteParam) return new Response("Falta cliente.", { status: 400 });
    if (!/^\d{4}-\d{2}$/.test(periodo)) return new Response("periodo debe ser YYYY-MM.", { status: 400 });

    const [actividadesRaw, proyectosRaw, clientesRaw, catalogoRaw, runtime] = await Promise.all([
      listModuleRecordsAsync("actividades", session.clientId),
      listModuleRecordsAsync("proyectos", session.clientId),
      listModuleRecordsAsync("clientes", session.clientId),
      listModuleRecordsAsync("actividades-catalogo", session.clientId).catch(() => []),
      resolveRequestTenantRuntimeAsync(request),
    ]);
    const arr = (x: unknown) => (Array.isArray(x) ? x : []) as Array<Record<string, string>>;

    // Resolver el cliente (por nombre o id) → nombre + código.
    const clienteRow = arr(clientesRaw).find(
      (c) => String(c.nombre || "") === clienteParam || String(c.id || "") === clienteParam,
    );
    const clienteNombre = clienteRow ? String(clienteRow.nombre || "") : clienteParam;
    const codigoCliente = clienteRow ? String(clienteRow.codigo || clienteRow.codigoCliente || clienteRow.numero || "") : "";

    // Mapas de resolución proyecto/actividad (ref → nombre legible).
    const proyectoNombre = new Map<string, string>();
    for (const p of arr(proyectosRaw)) {
      const nombre = String(p.nombre || "");
      if (p.id) proyectoNombre.set(String(p.id), nombre);
      if (nombre) proyectoNombre.set(nombre, nombre);
    }
    const actividadNombre = new Map<string, string>();
    for (const c of arr(catalogoRaw)) {
      const nombre = String(c.nombre || c.descripcion || "");
      if (c.codigo) actividadNombre.set(String(c.codigo), nombre || String(c.codigo));
      if (c.id) actividadNombre.set(String(c.id), nombre || String(c.id));
    }

    // Tareas del cliente dentro del mes (excluye la pata de Desplazamiento,
    // que no es "servicio prestado": Lugar = desplazamiento).
    const tareas: ParteTarea[] = arr(actividadesRaw)
      .filter((a) => String(a.cliente || "") === clienteNombre
        && String(a.fecha || "").slice(0, 7) === periodo
        && String(a.lugar || "").toLowerCase() !== "desplazamiento")
      .sort((a, b) => String(a.fecha || "").localeCompare(String(b.fecha || "")) || String(a.horaDesde || "").localeCompare(String(b.horaDesde || "")))
      .map((a) => ({
        trabajador: String(a.empleado || ""),
        fecha: String(a.fecha || "").slice(0, 10),
        desde: String(a.horaDesde || ""),
        hasta: String(a.horaHasta || ""),
        tiempo: parseHoras(a.tiempoHoras || a.horas),
        proyecto: proyectoNombre.get(String(a.proyecto || "")) || String(a.proyecto || ""),
        asunto: actividadNombre.get(String(a.actividad || "")) || String(a.actividad || ""),
        observaciones: String(a.concepto || a.descripcion || ""),
      }));

    if (tareas.length === 0) {
      return new Response("Sin tareas para " + clienteNombre + " en el periodo " + periodo + ".", { status: 404 });
    }

    const tenantEmisor = await resolveTenantEmisorAsync({
      clientId: session.clientId,
      brandingDisplayName: runtime?.config?.branding?.displayName,
      brandingAccentColor: runtime?.config?.branding?.accentColor,
    });

    const pdf = await generateParteServiciosPdf({
      emisor: {
        razonSocial: tenantEmisor.razonSocial || "Emisor",
        direccion: tenantEmisor.direccion || "",
        telefono: tenantEmisor.telefono || "",
        email: tenantEmisor.email || "",
      },
      cliente: clienteNombre,
      codigoCliente,
      periodo,
      tareas,
    });

    return new Response(pdf as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline; filename=\"parte-" + clienteNombre.replace(/[^\w]+/g, "_") + "-" + periodo + ".pdf\"",
      },
    });
  } catch (e) {
    captureError(e, { scope: "/api/erp/parte-servicios-pdf" });
    return new Response("Error generando PDF: " + (e instanceof Error ? e.message : "desconocido"), { status: 500 });
  }
}
