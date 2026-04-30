/**
 * Motor del dashboard del vertical Software Factory.
 *
 * Lee los datos del tenant vía `listModuleRecords` (no se acopla a Prisma
 * ni a ningún backend concreto — delega en la capa de persistencia) y
 * compone un SoftwareFactoryOverview con:
 *   - KPIs específicos del vertical (pipeline, proyectos en riesgo,
 *     propuestas estancadas, carga operativa, entregables recientes)
 *   - Pipeline desglosado por fase
 *   - Alertas operativas sobre la foto actual (factura vencida, propuesta
 *     parada, proyecto en riesgo)
 *   - Actividad reciente cruzada entre módulos
 *   - Entregables recientes (documentos) en feed separado
 *
 * Diseñado para ser consumido desde /api/software-factory/overview y
 * desde los intents del asistente ("proyectos en riesgo", "carga
 * operativa", "entregables recientes").
 */

import { listModuleRecords } from "@/lib/erp/active-client-data-store";
import type {
  SoftwareFactoryAlert,
  SoftwareFactoryActivityItem,
  SoftwareFactoryKpi,
  SoftwareFactoryOverview,
  SoftwareFactoryPipelineStage,
} from "@/lib/verticals/software-factory/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PIPELINE_OPEN_PHASES = ["lead", "contactado", "propuesta", "negociacion"];
const PROJECT_ACTIVE_STATES = ["en_marcha", "activo", "planificado"];
const PROJECT_RISK_STATES = ["en_riesgo", "bloqueado"];
const PROPOSAL_OPEN_STATES = ["pendiente", "enviado", "enviada", "negociacion", "borrador"];
const INVOICE_PENDING_STATES = ["emitida", "pendiente", "vencida"];
const INVOICE_OVERDUE_STATES = ["vencida", "overdue"];

const PROPOSAL_STALE_DAYS = 14;
const ACTIVITY_LIMIT = 12;
const DELIVERABLES_LIMIT = 6;

function normalize(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function parseMoney(value: unknown): number {
  const raw = String(value ?? "").trim();
  if (!raw) return 0;
  // Admite formatos ES (1.234,56) y US (1,234.56) además de enteros con o sin "EUR"/€
  const cleaned = raw
    .replace(/[^\d.,-]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "") // miles ES
    .replace(",", ".");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseDate(value: unknown): number {
  const raw = String(value ?? "").trim();
  if (!raw) return 0;
  const ts = new Date(raw).getTime();
  return Number.isFinite(ts) ? ts : 0;
}

function daysBetween(from: number, to: number): number {
  if (from <= 0 || to <= 0) return 0;
  return Math.floor((to - from) / (1000 * 60 * 60 * 24));
}

function formatMoney(amount: number): string {
  return amount.toLocaleString("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

// ---------------------------------------------------------------------------
// Overview composition
// ---------------------------------------------------------------------------

export function assembleSoftwareFactoryOverview(input: {
  clientId: string;
  displayName: string;
  businessType: string;
}): SoftwareFactoryOverview {
  const clientId = input.clientId;

  const clientes = safeList("clientes", clientId);
  const crm = safeList("crm", clientId);
  const proyectos = safeList("proyectos", clientId);
  const propuestas = safeList("presupuestos", clientId);
  const facturas = safeList("facturacion", clientId);
  const entregables = safeList("documentos", clientId);

  // KPI 1: clientes totales (todos cuentan — el vertical no filtra por estado aquí)
  const totalClientes = clientes.length;

  // KPI 2: pipeline abierto (suma de valorEstimado en oportunidades en fases abiertas)
  const pipelineRows = crm.filter((row) => PIPELINE_OPEN_PHASES.includes(normalize(row.fase)));
  const pipelineValue = pipelineRows.reduce(
    (acc, row) => acc + parseMoney(row.valorEstimado ?? row.valor),
    0,
  );

  // KPI 3/4: proyectos activos y en riesgo
  const proyectosActivos = proyectos.filter((row) => PROJECT_ACTIVE_STATES.includes(normalize(row.estado)));
  const proyectosRiesgo = proyectos.filter((row) => PROJECT_RISK_STATES.includes(normalize(row.estado)));

  // KPI 5: propuestas abiertas
  const propuestasAbiertas = propuestas.filter((row) => PROPOSAL_OPEN_STATES.includes(normalize(row.estado)));

  // KPI 6: facturas pendientes
  const facturasPendientes = facturas.filter((row) => INVOICE_PENDING_STATES.includes(normalize(row.estado)));

  // KPI 7: entregables recientes (últimos 30 días)
  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
  const entregablesRecientes = entregables.filter((row) => {
    const ts = parseDate(row.updatedAt ?? row.createdAt);
    return ts >= thirtyDaysAgo;
  });

  // KPI 8: carga operativa = proyectos activos + propuestas abiertas + facturas pendientes
  // (métrica informal de "cuánto fuego hay ahora en la mesa")
  const cargaOperativa = proyectosActivos.length + propuestasAbiertas.length + facturasPendientes.length;

  const kpis: SoftwareFactoryKpi[] = [
    {
      key: "clientes",
      label: "Clientes",
      value: String(totalClientes),
      helper: "Base activa de clientes B2B.",
      tone: totalClientes > 0 ? "neutral" : "warn",
    },
    {
      key: "pipeline",
      label: "Pipeline abierto",
      value: formatMoney(pipelineValue),
      helper: pipelineRows.length + " oportunidades en juego.",
      tone: pipelineValue > 0 ? "good" : "neutral",
    },
    {
      key: "proyectosActivos",
      label: "Proyectos activos",
      value: String(proyectosActivos.length),
      helper: "Proyectos en marcha o planificados.",
      tone: proyectosActivos.length > 0 ? "good" : "neutral",
    },
    {
      key: "proyectosEnRiesgo",
      label: "Proyectos en riesgo",
      value: String(proyectosRiesgo.length),
      helper: proyectosRiesgo.length === 0 ? "Ninguno ahora mismo." : "Requieren atención.",
      tone: proyectosRiesgo.length === 0 ? "good" : "bad",
    },
    {
      key: "propuestasAbiertas",
      label: "Propuestas abiertas",
      value: String(propuestasAbiertas.length),
      helper: "Pendientes de cerrar con el cliente.",
      tone: propuestasAbiertas.length > 0 ? "neutral" : "neutral",
    },
    {
      key: "facturasPendientes",
      label: "Facturas pendientes",
      value: String(facturasPendientes.length),
      helper: facturasPendientes.length === 0 ? "Sin pendientes." : "Cobros por revisar.",
      tone: facturasPendientes.length > 0 ? "warn" : "good",
    },
    {
      key: "entregablesRecientes",
      label: "Entregables (30 d)",
      value: String(entregablesRecientes.length),
      helper: "Documentos producidos en el último mes.",
      tone: "neutral",
    },
    {
      key: "cargaOperativa",
      label: "Carga operativa",
      value: String(cargaOperativa),
      helper: "Proyectos + propuestas + facturas en juego.",
      tone: cargaOperativa > 12 ? "warn" : "neutral",
    },
  ];

  // Pipeline desglosado por fase
  const pipelineByStage: SoftwareFactoryPipelineStage[] = PIPELINE_OPEN_PHASES.map((phase) => {
    const rows = crm.filter((row) => normalize(row.fase) === phase);
    const value = rows.reduce((acc, row) => acc + parseMoney(row.valorEstimado ?? row.valor), 0);
    return {
      key: phase,
      label: phase.charAt(0).toUpperCase() + phase.slice(1),
      count: rows.length,
      value,
    };
  });

  // Alertas operativas
  const alerts: SoftwareFactoryAlert[] = [];

  // Proyecto en riesgo
  for (const row of proyectosRiesgo) {
    alerts.push({
      key: "proyecto-riesgo-" + (row.id ?? row.nombre ?? Math.random()),
      severity: "danger",
      title: "Proyecto en riesgo: " + String(row.nombre ?? "Sin nombre"),
      detail: "Cliente: " + String(row.cliente ?? "—") + ". Revisa el estado con el responsable.",
      href: "/proyectos",
    });
  }

  // Factura vencida
  const facturasVencidas = facturas.filter((row) => INVOICE_OVERDUE_STATES.includes(normalize(row.estado)));
  for (const row of facturasVencidas) {
    alerts.push({
      key: "factura-vencida-" + (row.id ?? row.numero ?? Math.random()),
      severity: "warn",
      title: "Factura vencida: " + String(row.numero ?? "—"),
      detail: "Cliente: " + String(row.cliente ?? "—") + ". Reclama el cobro esta semana.",
      href: "/facturacion",
    });
  }

  // Propuesta parada (enviada hace > 14 días y sin mover)
  for (const row of propuestasAbiertas) {
    const ts = parseDate(row.updatedAt ?? row.createdAt ?? row.fecha);
    if (ts <= 0) continue;
    const days = daysBetween(ts, now);
    if (days >= PROPOSAL_STALE_DAYS) {
      alerts.push({
        key: "propuesta-estancada-" + (row.id ?? row.numero ?? Math.random()),
        severity: "warn",
        title: "Propuesta parada: " + String(row.numero ?? "—"),
        detail:
          "Cliente: " +
          String(row.cliente ?? "—") +
          ". Sin movimiento hace " +
          days +
          " días. Haz seguimiento.",
        href: "/presupuestos",
      });
    }
  }

  // Actividad reciente cruzada
  const recentActivity = buildRecentActivity({
    clientes,
    crm,
    proyectos,
    propuestas,
    facturas,
    entregables,
  }).slice(0, ACTIVITY_LIMIT);

  // Entregables recientes (feed dedicado)
  const recentDeliverables = entregables
    .slice()
    .sort((a, b) => parseDate(b.updatedAt ?? b.createdAt) - parseDate(a.updatedAt ?? a.createdAt))
    .slice(0, DELIVERABLES_LIMIT)
    .map((row) => toActivityItem("entregable", row, "/documentos"));

  return {
    ok: true,
    clientId,
    displayName: input.displayName,
    businessType: input.businessType,
    kpis,
    pipelineByStage,
    alerts,
    recentActivity,
    recentDeliverables,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function safeList(moduleKey: string, clientId: string): Array<Record<string, string>> {
  try {
    return listModuleRecords(moduleKey, clientId);
  } catch {
    return [];
  }
}

function buildRecentActivity(input: {
  clientes: Array<Record<string, string>>;
  crm: Array<Record<string, string>>;
  proyectos: Array<Record<string, string>>;
  propuestas: Array<Record<string, string>>;
  facturas: Array<Record<string, string>>;
  entregables: Array<Record<string, string>>;
}): SoftwareFactoryActivityItem[] {
  const items: SoftwareFactoryActivityItem[] = [];

  for (const row of input.clientes.slice(-5)) {
    items.push(toActivityItem("cliente", row, "/clientes"));
  }
  for (const row of input.crm.slice(-5)) {
    items.push(toActivityItem("oportunidad", row, "/crm"));
  }
  for (const row of input.proyectos.slice(-5)) {
    items.push(toActivityItem("proyecto", row, "/proyectos"));
  }
  for (const row of input.propuestas.slice(-5)) {
    items.push(toActivityItem("propuesta", row, "/presupuestos"));
  }
  for (const row of input.facturas.slice(-5)) {
    items.push(toActivityItem("factura", row, "/facturacion"));
  }
  for (const row of input.entregables.slice(-5)) {
    items.push(toActivityItem("entregable", row, "/documentos"));
  }

  return items.sort(
    (a, b) => parseDate(b.updatedAt) - parseDate(a.updatedAt),
  );
}

function toActivityItem(
  kind: SoftwareFactoryActivityItem["kind"],
  row: Record<string, string>,
  href: string,
): SoftwareFactoryActivityItem {
  const title = resolveActivityTitle(kind, row);
  const subtitle = resolveActivitySubtitle(kind, row);
  return {
    id: String(row.id ?? title),
    kind,
    title,
    subtitle,
    status: String(row.estado ?? row.fase ?? ""),
    href,
    updatedAt: String(row.updatedAt ?? row.createdAt ?? ""),
  };
}

function resolveActivityTitle(
  kind: SoftwareFactoryActivityItem["kind"],
  row: Record<string, string>,
): string {
  switch (kind) {
    case "cliente":
      return String(row.nombre ?? "Cliente");
    case "oportunidad":
      return String(row.empresa ?? row.contacto ?? "Oportunidad");
    case "proyecto":
      return String(row.nombre ?? "Proyecto");
    case "propuesta":
      return String(row.numero ?? "Propuesta");
    case "factura":
      return String(row.numero ?? "Factura");
    case "entregable":
      return String(row.nombre ?? "Entregable");
    default:
      return "Actividad";
  }
}

function resolveActivitySubtitle(
  kind: SoftwareFactoryActivityItem["kind"],
  row: Record<string, string>,
): string {
  switch (kind) {
    case "cliente":
      return String(row.email ?? row.telefono ?? "");
    case "oportunidad":
      return String(row.contacto ?? row.fase ?? "");
    case "proyecto":
      return String(row.cliente ?? row.responsable ?? "");
    case "propuesta":
    case "factura":
      return String(row.cliente ?? row.concepto ?? "");
    case "entregable":
      return String(row.tipo ?? row.cliente ?? "");
    default:
      return "";
  }
}
