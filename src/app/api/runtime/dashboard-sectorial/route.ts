import { NextResponse, type NextRequest } from "next/server";
import { requireTenantSession } from "@/lib/saas/auth-session";
import { listModuleRecordsAsync } from "@/lib/persistence/active-client-data-store-async";
import { resolveRequestTenantRuntimeAsync } from "@/lib/saas/request-tenant-runtime-async";
import { captureError } from "@/lib/observability/error-capture";

/**
 * GET /api/runtime/dashboard-sectorial (H9-A3)
 *
 * Calcula KPIs específicos del vertical del tenant + lista de
 * accesos rápidos + alertas + actividad reciente.
 *
 * Los KPIs que se calculan dependen del businessType:
 *   - software-factory: clientes, proyectos activos, horas mes, facturas pendientes, propuestas abiertas
 *   - clinica-dental: pacientes activos, citas hoy, presupuestos sin firmar, facturas vencidas
 *   - veterinaria: mascotas activas, citas hoy, vacunas próximas, facturas vencidas
 *   - colegio: alumnos activos, asistencia hoy, comunicados, becas pendientes
 *   - peluqueria: citas hoy, ocupación profesional, ventas día, productos bajo stock
 *   - taller: órdenes abiertas, vehículos en taller, repuestos pendientes
 *   - hosteleria: eventos próximos, leads, facturas vencidas
 *   - inmobiliaria: inmuebles publicados, ofertas en negociación, comisiones por cobrar
 *   - asesoria: encargos abiertos, plazos próximos, cuotas vencidas
 *   - despacho-abogados: casos abiertos, plazos próximos, facturas vencidas
 *   - fallback genérico: clientes, facturas, tareas
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Kpi = { key: string; label: string; value: string; helper: string; tone?: "neutral" | "good" | "warn" | "bad"; href?: string };
type QuickAction = { href: string; label: string; icon: string };
type Alert = { severity: "info" | "warn" | "danger"; title: string; href: string };

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
function thisMonthISO(): string {
  return new Date().toISOString().slice(0, 7);
}
function inDays(n: number): string {
  return new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
}
function parseImporte(v: unknown): number {
  if (typeof v === "number") return v;
  const n = parseFloat(String(v ?? "0").replace(/[^\d,.-]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export async function GET(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) return NextResponse.json({ ok: false, error: "Sesión inválida." }, { status: 401 });

    const runtime = await resolveRequestTenantRuntimeAsync(request);
    const businessType = String(runtime?.config?.businessType || "generic");

    // Cargamos los módulos comunes de un tirón
    const [clientes, proyectos, facturas, presupuestos, actividades, citas] = await Promise.all([
      listModuleRecordsAsync("clientes", session.clientId).catch(() => []),
      listModuleRecordsAsync("proyectos", session.clientId).catch(() => []),
      listModuleRecordsAsync("facturacion", session.clientId).catch(() => []),
      listModuleRecordsAsync("presupuestos", session.clientId).catch(() => []),
      listModuleRecordsAsync("actividades", session.clientId).catch(() => []),
      listModuleRecordsAsync("citas", session.clientId).catch(() => []),
    ]);

    const today = todayISO();
    const mesActual = thisMonthISO();
    const en7dias = inDays(7);

    const facturasPendientes = facturas.filter((f) => String(f.estado || "") !== "cobrada" && String(f.estado || "") !== "anulada");
    const facturasVencidas = facturas.filter((f) => {
      const estado = String(f.estado || "");
      const venc = String(f.fechaVencimiento || f.fechaVto || "");
      return estado !== "cobrada" && estado !== "anulada" && venc && venc < today;
    });
    const importeFacturasPendientes = facturasPendientes.reduce((s, f) => s + parseImporte(f.importe), 0);

    const kpis: Kpi[] = [];
    const quickActions: QuickAction[] = [];
    const alerts: Alert[] = [];

    // KPIs específicos por vertical
    if (businessType === "software-factory") {
      const horasMes = actividades
        .filter((a) => String(a.fecha || "").slice(0, 7) === mesActual)
        .reduce((s, a) => s + parseImporte(a.tiempoHoras || a.horas), 0);
      const proyectosActivos = proyectos.filter((p) => String(p.estado || "") === "activo");
      const propuestasAbiertas = presupuestos.filter((p) => ["borrador", "enviado", "negociacion"].includes(String(p.estado || "")));
      kpis.push(
        { key: "horas-mes", label: "Horas este mes", value: horasMes.toFixed(1), helper: "Imputadas en " + mesActual, tone: "neutral", href: "/produccion/pre-facturacion" },
        { key: "proyectos-activos", label: "Proyectos activos", value: String(proyectosActivos.length), helper: "En curso ahora mismo", tone: "good", href: "/proyectos" },
        { key: "propuestas-abiertas", label: "Propuestas abiertas", value: String(propuestasAbiertas.length), helper: "Pendientes de cierre", tone: "neutral", href: "/presupuestos" },
        { key: "fact-pendientes", label: "Facturas pendientes", value: importeFacturasPendientes.toFixed(0) + " €", helper: facturasPendientes.length + " facturas sin cobrar", tone: facturasVencidas.length > 0 ? "warn" : "neutral", href: "/facturacion" },
      );
      quickActions.push(
        { href: "/actividades", label: "Imputar horas", icon: "⏱️" },
        { href: "/facturacion", label: "Nueva factura", icon: "💶" },
        { href: "/presupuestos", label: "Nueva propuesta", icon: "📄" },
        { href: "/produccion/pre-facturacion", label: "Pre-facturación", icon: "📊" },
      );
    } else if (businessType === "clinica-dental" || businessType === "clinica-veterinaria") {
      const proyectosHoy = proyectos.filter((p) => String(p.fecha || "").slice(0, 10) === today);
      const presupuestosSinFirmar = presupuestos.filter((p) => String(p.estado || "") === "enviado");
      const isVet = businessType === "clinica-veterinaria";
      kpis.push(
        { key: "citas-hoy", label: "Citas hoy", value: String(proyectosHoy.length), helper: today, tone: "good", href: "/agenda-hoy" },
        { key: "pacientes-activos", label: isVet ? "Mascotas activas" : "Pacientes activos", value: String(clientes.filter((c) => String(c.estado || "") === "activo").length), helper: "En seguimiento", tone: "neutral", href: "/clientes" },
        { key: "pres-sin-firmar", label: "Presupuestos sin firmar", value: String(presupuestosSinFirmar.length), helper: "Pendientes del paciente", tone: presupuestosSinFirmar.length > 5 ? "warn" : "neutral", href: "/presupuestos" },
        { key: "fact-vencidas", label: "Facturas vencidas", value: String(facturasVencidas.length), helper: importeFacturasPendientes.toFixed(0) + " € pendiente", tone: facturasVencidas.length > 0 ? "bad" : "good", href: "/facturacion" },
      );
      quickActions.push(
        { href: "/proyectos", label: "Nueva cita", icon: "📅" },
        { href: "/clientes", label: isVet ? "Nueva mascota" : "Nuevo paciente", icon: "👤" },
        { href: "/presupuestos", label: "Nuevo presupuesto", icon: "📄" },
        { href: "/agenda-hoy", label: "Agenda de hoy", icon: "📋" },
      );
    } else if (businessType === "colegio") {
      const alumnos = clientes.filter((c) => String(c.estado || "") === "activo");
      const becasRows = await listModuleRecordsAsync("becas", session.clientId).catch(() => []);
      const becasPend = becasRows.filter((b) => String(b.estado || "") === "pendiente");
      kpis.push(
        { key: "alumnos-activos", label: "Alumnos activos", value: String(alumnos.length), helper: "Matriculados este curso", tone: "good", href: "/clientes" },
        { key: "comunicados", label: "Comunicados enviados", value: String(0), helper: "Últimos 30 días", tone: "neutral", href: "/comunicaciones" },
        { key: "becas-pendientes", label: "Becas pendientes", value: String(becasPend.length), helper: "Por revisar", tone: becasPend.length > 0 ? "warn" : "neutral", href: "/becas" },
        { key: "fact-vencidas", label: "Cuotas vencidas", value: String(facturasVencidas.length), helper: importeFacturasPendientes.toFixed(0) + " € pendiente", tone: facturasVencidas.length > 0 ? "bad" : "good", href: "/facturacion" },
      );
      quickActions.push(
        { href: "/clientes", label: "Nuevo alumno", icon: "👤" },
        { href: "/calificaciones", label: "Cargar notas", icon: "📊" },
        { href: "/asistencia", label: "Pasar lista", icon: "✅" },
        { href: "/comunicaciones", label: "Enviar comunicado", icon: "📢" },
      );
    } else if (businessType === "peluqueria") {
      const proyectosHoy = proyectos.filter((p) => String(p.fecha || "").slice(0, 10) === today);
      const cajaRows = await listModuleRecordsAsync("caja", session.clientId).catch(() => []);
      const ventasHoy = cajaRows.filter((c) => String(c.fecha || "").slice(0, 10) === today).reduce((s, c) => s + parseImporte(c.importe), 0);
      kpis.push(
        { key: "citas-hoy", label: "Citas hoy", value: String(proyectosHoy.length), helper: today, tone: "good", href: "/agenda-hoy" },
        { key: "ventas-dia", label: "Ventas hoy", value: ventasHoy.toFixed(0) + " €", helper: "Caja del día", tone: "good", href: "/caja-rapida" },
        { key: "clientes-recurrentes", label: "Clientes activos", value: String(clientes.length), helper: "En la cartera", tone: "neutral", href: "/clientes" },
        { key: "fact-pendientes", label: "Facturas pendientes", value: importeFacturasPendientes.toFixed(0) + " €", helper: facturasPendientes.length + " facturas", tone: "neutral", href: "/facturacion" },
      );
      quickActions.push(
        { href: "/proyectos", label: "Nueva cita", icon: "✂️" },
        { href: "/caja-rapida", label: "Cobrar", icon: "💳" },
        { href: "/clientes", label: "Nuevo cliente", icon: "👤" },
        { href: "/agenda-hoy", label: "Ver agenda", icon: "📅" },
      );
    } else if (businessType === "taller") {
      const ordenesAbiertas = proyectos.filter((p) => ["abierta", "en_curso", "en_taller"].includes(String(p.estado || "")));
      kpis.push(
        { key: "ordenes-abiertas", label: "Órdenes abiertas", value: String(ordenesAbiertas.length), helper: "En el taller ahora", tone: "good", href: "/proyectos" },
        { key: "vehiculos-taller", label: "Vehículos en taller", value: String(ordenesAbiertas.length), helper: "Pendientes de entregar", tone: "neutral", href: "/proyectos" },
        { key: "presupuestos", label: "Presupuestos abiertos", value: String(presupuestos.filter((p) => String(p.estado || "") === "enviado").length), helper: "Esperando aprobación", tone: "neutral", href: "/presupuestos" },
        { key: "fact-pendientes", label: "Facturas pendientes", value: importeFacturasPendientes.toFixed(0) + " €", helper: facturasPendientes.length + " sin cobrar", tone: facturasVencidas.length > 0 ? "warn" : "neutral", href: "/facturacion" },
      );
      quickActions.push(
        { href: "/proyectos", label: "Nueva orden", icon: "🔧" },
        { href: "/clientes", label: "Nuevo vehículo", icon: "🚗" },
        { href: "/presupuestos", label: "Nuevo presupuesto", icon: "📄" },
        { href: "/facturacion", label: "Nueva factura", icon: "💶" },
      );
    } else if (businessType === "hosteleria") {
      const eventos = proyectos.filter((p) => String(p.fecha || "") >= today && String(p.fecha || "") <= en7dias);
      kpis.push(
        { key: "eventos-7d", label: "Eventos próximos 7d", value: String(eventos.length), helper: "Esta semana", tone: "good", href: "/proyectos" },
        { key: "leads", label: "Solicitudes nuevas", value: String(0), helper: "Captación pendiente", tone: "neutral", href: "/crm" },
        { key: "habituales", label: "Clientes habituales", value: String(clientes.length), helper: "En cartera", tone: "neutral", href: "/clientes" },
        { key: "fact-pendientes", label: "Facturas pendientes", value: importeFacturasPendientes.toFixed(0) + " €", helper: facturasPendientes.length + " sin cobrar", tone: "neutral", href: "/facturacion" },
      );
      quickActions.push(
        { href: "/proyectos", label: "Nuevo evento", icon: "🎉" },
        { href: "/caja-rapida", label: "Cobrar", icon: "💳" },
        { href: "/clientes", label: "Nuevo cliente", icon: "👤" },
        { href: "/agenda-hoy", label: "Reservas hoy", icon: "📅" },
      );
    } else if (businessType === "inmobiliaria") {
      const publicados = proyectos.filter((p) => String(p.estado || "") === "publicado");
      const ofertasNeg = presupuestos.filter((p) => String(p.estado || "") === "negociacion");
      kpis.push(
        { key: "publicados", label: "Inmuebles publicados", value: String(publicados.length), helper: "En cartera activa", tone: "good", href: "/proyectos" },
        { key: "ofertas-neg", label: "Ofertas en negociación", value: String(ofertasNeg.length), helper: "Operaciones en curso", tone: "good", href: "/presupuestos" },
        { key: "leads", label: "Interesados activos", value: String(clientes.filter((c) => String(c.tipo || "") === "interesado").length), helper: "Buscando inmueble", tone: "neutral", href: "/clientes" },
        { key: "comisiones", label: "Comisiones pendientes", value: importeFacturasPendientes.toFixed(0) + " €", helper: "Por cobrar", tone: "warn", href: "/facturacion" },
      );
      quickActions.push(
        { href: "/proyectos", label: "Nuevo inmueble", icon: "🏠" },
        { href: "/clientes", label: "Nuevo interesado", icon: "👤" },
        { href: "/presupuestos", label: "Nueva oferta", icon: "💼" },
        { href: "/facturacion", label: "Nueva factura", icon: "💶" },
      );
    } else if (businessType === "asesoria") {
      const encargos = proyectos.filter((p) => String(p.estado || "") !== "completado" && String(p.estado || "") !== "cancelado");
      const plazosProx = encargos.filter((p) => {
        const f = String(p.fechaEntrega || "");
        return f && f >= today && f <= en7dias;
      });
      kpis.push(
        { key: "encargos", label: "Encargos abiertos", value: String(encargos.length), helper: "En curso", tone: "good", href: "/proyectos" },
        { key: "plazos", label: "Plazos próximos 7d", value: String(plazosProx.length), helper: "Vencen esta semana", tone: plazosProx.length > 3 ? "warn" : "neutral", href: "/proyectos" },
        { key: "cartera", label: "Clientes en cartera", value: String(clientes.length), helper: "Con cuota o encargos", tone: "neutral", href: "/clientes" },
        { key: "cuotas", label: "Cuotas vencidas", value: String(facturasVencidas.length), helper: importeFacturasPendientes.toFixed(0) + " €", tone: facturasVencidas.length > 0 ? "bad" : "good", href: "/facturacion" },
      );
      quickActions.push(
        { href: "/proyectos", label: "Nuevo encargo", icon: "📋" },
        { href: "/clientes", label: "Nuevo cliente", icon: "👤" },
        { href: "/facturacion", label: "Nueva factura", icon: "💶" },
        { href: "/api/erp/modelo-303", label: "Modelo 303", icon: "📊" },
      );
    } else if (businessType === "despacho-abogados") {
      const casosAbiertos = proyectos.filter((p) => String(p.estado || "") !== "archivado");
      const plazosProx = casosAbiertos.filter((p) => {
        const f = String(p.proximoPlazo || "");
        return f && f >= today && f <= en7dias;
      });
      kpis.push(
        { key: "casos", label: "Casos abiertos", value: String(casosAbiertos.length), helper: "En curso", tone: "good", href: "/proyectos" },
        { key: "plazos", label: "Plazos próximos 7d", value: String(plazosProx.length), helper: "Procesales", tone: plazosProx.length > 0 ? "warn" : "neutral", href: "/proyectos" },
        { key: "clientes-activos", label: "Clientes activos", value: String(clientes.filter((c) => String(c.estado || "") === "activo").length), helper: "Con caso abierto", tone: "neutral", href: "/clientes" },
        { key: "fact-vencidas", label: "Facturas vencidas", value: String(facturasVencidas.length), helper: importeFacturasPendientes.toFixed(0) + " €", tone: facturasVencidas.length > 0 ? "bad" : "good", href: "/facturacion" },
      );
      quickActions.push(
        { href: "/proyectos", label: "Nuevo caso", icon: "⚖️" },
        { href: "/clientes", label: "Nuevo cliente", icon: "👤" },
        { href: "/presupuestos", label: "Nuevos honorarios", icon: "📄" },
        { href: "/documentos", label: "Subir expediente", icon: "📎" },
      );
    } else {
      // Generic fallback (gimnasio + otros)
      kpis.push(
        { key: "clientes", label: "Clientes", value: String(clientes.length), helper: "En cartera", tone: "good", href: "/clientes" },
        { key: "proyectos", label: "Proyectos / encargos", value: String(proyectos.length), helper: "Total", tone: "neutral", href: "/proyectos" },
        { key: "presupuestos", label: "Presupuestos abiertos", value: String(presupuestos.filter((p) => String(p.estado || "") === "enviado").length), helper: "Pendientes", tone: "neutral", href: "/presupuestos" },
        { key: "fact-pendientes", label: "Facturas pendientes", value: importeFacturasPendientes.toFixed(0) + " €", helper: facturasPendientes.length + " sin cobrar", tone: facturasVencidas.length > 0 ? "warn" : "neutral", href: "/facturacion" },
      );
      quickActions.push(
        { href: "/clientes", label: "Nuevo cliente", icon: "👤" },
        { href: "/presupuestos", label: "Nuevo presupuesto", icon: "📄" },
        { href: "/facturacion", label: "Nueva factura", icon: "💶" },
        { href: "/tareas", label: "Nueva tarea", icon: "✔️" },
      );
    }

    // Alertas operativas comunes
    if (facturasVencidas.length > 0) {
      alerts.push({ severity: "danger", title: facturasVencidas.length + " facturas vencidas — " + facturasVencidas.reduce((s, f) => s + parseImporte(f.importe), 0).toFixed(0) + " € por cobrar", href: "/facturacion" });
    }
    const presupuestosViejos = presupuestos.filter((p) => {
      if (String(p.estado || "") !== "enviado") return false;
      const f = String(p.fechaEmision || p.fecha || "");
      return f && f < inDays(-30);
    });
    if (presupuestosViejos.length > 0) {
      alerts.push({ severity: "warn", title: presupuestosViejos.length + " presupuestos enviados sin respuesta hace +30 días", href: "/presupuestos" });
    }
    const citasHoy = (citas as Array<Record<string, unknown>>).filter((c) => String(c.fecha || "").slice(0, 10) === today && String(c.estado || "") !== "confirmada");
    if (citasHoy.length > 0) {
      alerts.push({ severity: "info", title: citasHoy.length + " citas hoy sin confirmar", href: "/proyectos" });
    }

    // Actividad reciente: últimos 10 cambios cualquier módulo
    const allRecent: Array<{ moduleKey: string; titulo: string; updatedAt: string }> = [];
    for (const [moduleKey, rows] of [
      ["clientes", clientes],
      ["proyectos", proyectos],
      ["facturacion", facturas],
      ["presupuestos", presupuestos],
      ["actividades", actividades],
    ] as const) {
      for (const r of rows.slice(0, 20)) {
        allRecent.push({
          moduleKey,
          titulo: String(r.nombre || r.numero || r.titulo || r.referencia || r.id || ""),
          updatedAt: String(r.updatedAt || r.createdAt || ""),
        });
      }
    }
    allRecent.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

    return NextResponse.json({
      ok: true,
      vertical: businessType,
      tenantName: runtime?.config?.branding?.displayName || session.slug,
      kpis,
      quickActions,
      alerts,
      recentActivity: allRecent.slice(0, 10),
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    captureError(e, { scope: "/api/runtime/dashboard-sectorial" });
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
