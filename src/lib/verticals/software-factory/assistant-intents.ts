/**
 * Intents específicos del asistente para el vertical Software Factory.
 *
 * Se componen sobre el overview del vertical (proyectos en riesgo,
 * entregables recientes, pipeline por fase, facturas vencidas, propuestas
 * estancadas) para que la respuesta del asistente sea consistente con lo
 * que el cliente ve en /software-factory.
 *
 * `answerSoftwareFactoryIntent` devuelve una `AssistantAnswer` si reconoce
 * uno de los intents del vertical, o `null` si no — en cuyo caso el API
 * del asistente delega en el router genérico `answerErpAssistant`.
 */

import type { AssistantAnswer } from "@/lib/erp/assistant-core";
import { assembleSoftwareFactoryOverview } from "@/lib/verticals/software-factory/overview";
import { listModuleRecords } from "@/lib/erp/active-client-data-store";

const INVOICE_OVERDUE_STATES = ["vencida", "overdue"];
const INVOICE_PENDING_STATES = ["emitida", "pendiente", "vencida"];
const PROPOSAL_OPEN_STATES = ["pendiente", "enviado", "enviada", "negociacion", "borrador"];
const PROPOSAL_STALE_DAYS = 14;

function normalize(value: string): string {
  return String(value || "").trim().toLowerCase();
}

function containsAny(haystack: string, needles: string[]): boolean {
  return needles.some((needle) => haystack.includes(needle));
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

function formatRelative(iso: string): string {
  const ts = parseDate(iso);
  if (ts <= 0) return "sin fecha";
  const days = daysBetween(ts, Date.now());
  if (days < 1) return "hoy";
  if (days === 1) return "ayer";
  if (days < 30) return "hace " + days + " días";
  return new Date(ts).toLocaleDateString("es-ES");
}

export function answerSoftwareFactoryIntent(
  prompt: string,
  clientId: string,
  displayName: string,
): AssistantAnswer | null {
  const raw = String(prompt || "").trim();
  const lower = normalize(raw);
  if (!lower) {
    // Prompt vacío — dejamos que el router genérico ponga la bienvenida.
    return null;
  }

  const overview = assembleSoftwareFactoryOverview({
    clientId,
    displayName,
    businessType: "software-factory",
  });

  // ---- Intent: proyectos en riesgo --------------------------------------
  if (
    containsAny(lower, ["en riesgo", "riesgo", "bloqueado", "bloqueados", "atascados", "problemas"])
  ) {
    const projects = listModuleRecords("proyectos", clientId).filter((row) => {
      const estado = normalize(String(row.estado));
      return estado === "en_riesgo" || estado === "bloqueado";
    });
    return {
      title: "Proyectos en riesgo",
      summary:
        projects.length === 0
          ? "No hay proyectos marcados como en riesgo ahora mismo."
          : "Hay " + projects.length + " proyecto(s) con bandera roja.",
      bullets:
        projects.length === 0
          ? ["Revisa el panel /proyectos si quieres comprobarlo en detalle."]
          : projects.map((row) => {
              const nombre = String(row.nombre || "Sin nombre");
              const cliente = String(row.cliente || "—");
              const responsable = String(row.responsable || "sin responsable");
              return nombre + " · " + cliente + " · " + responsable;
            }),
    };
  }

  // ---- Intent: entregables recientes ------------------------------------
  if (
    containsAny(lower, [
      "entregable",
      "entregables",
      "documento reciente",
      "documentos recientes",
      "últimos entregables",
      "ultimos entregables",
    ])
  ) {
    const feed = overview.recentDeliverables;
    return {
      title: "Entregables recientes",
      summary:
        feed.length === 0
          ? "Todavía no hay entregables registrados."
          : feed.length + " entregable(s) en el último mes.",
      bullets:
        feed.length === 0
          ? ["Los documentos que subas o produzcas aparecerán aquí."]
          : feed.map((item) => {
              const tipo = item.subtitle ? " · " + item.subtitle : "";
              return item.title + tipo + " · " + formatRelative(item.updatedAt);
            }),
    };
  }

  // ---- Intent: pipeline / carga comercial -------------------------------
  if (
    containsAny(lower, [
      "pipeline",
      "carga comercial",
      "oportunidades abiertas",
      "por fase",
      "pipe",
      "embudo",
    ])
  ) {
    const stages = overview.pipelineByStage;
    const total = stages.reduce((acc, stage) => acc + stage.value, 0);
    return {
      title: "Pipeline por fase",
      summary:
        total === 0
          ? "No hay valor abierto en el pipeline ahora mismo."
          : "Valor total abierto: " + formatMoney(total) + ".",
      bullets:
        total === 0
          ? ["Cuando añadas oportunidades al CRM aparecerán aquí."]
          : stages.map(
              (stage) =>
                stage.label +
                ": " +
                stage.count +
                " oportunidad(es) · " +
                formatMoney(stage.value),
            ),
    };
  }

  // ---- Intent: facturas vencidas / cobros -------------------------------
  if (
    containsAny(lower, [
      "vencida",
      "vencidas",
      "cobros pendientes",
      "cobros",
      "impago",
      "impagos",
      "deuda",
    ])
  ) {
    const facturas = listModuleRecords("facturacion", clientId);
    const vencidas = facturas.filter((row) => INVOICE_OVERDUE_STATES.includes(normalize(String(row.estado))));
    const pendientes = facturas.filter((row) =>
      INVOICE_PENDING_STATES.includes(normalize(String(row.estado))),
    );
    return {
      title: "Cobros por revisar",
      summary:
        vencidas.length === 0 && pendientes.length === 0
          ? "No hay facturas pendientes ni vencidas."
          : "Vencidas: " + vencidas.length + " · Pendientes totales: " + pendientes.length + ".",
      bullets:
        vencidas.length > 0
          ? vencidas.map(
              (row) =>
                String(row.numero || "—") +
                " · " +
                String(row.cliente || "—") +
                " · " +
                String(row.importe || "—") +
                " · vencida",
            )
          : pendientes.slice(0, 8).map(
              (row) =>
                String(row.numero || "—") +
                " · " +
                String(row.cliente || "—") +
                " · " +
                String(row.importe || "—") +
                " · " +
                String(row.estado || "—"),
            ),
    };
  }

  // ---- Intent: propuestas estancadas ------------------------------------
  if (
    containsAny(lower, [
      "propuesta parada",
      "propuestas paradas",
      "sin mover",
      "estancada",
      "estancadas",
      "atascada",
      "atascadas",
    ])
  ) {
    const propuestas = listModuleRecords("presupuestos", clientId).filter((row) =>
      PROPOSAL_OPEN_STATES.includes(normalize(String(row.estado))),
    );
    const now = Date.now();
    const stale = propuestas.filter((row) => {
      const ts = parseDate(row.updatedAt ?? row.createdAt ?? row.fecha);
      return ts > 0 && daysBetween(ts, now) >= PROPOSAL_STALE_DAYS;
    });
    return {
      title: "Propuestas paradas",
      summary:
        stale.length === 0
          ? "Todas las propuestas abiertas se han movido en los últimos " + PROPOSAL_STALE_DAYS + " días."
          : stale.length + " propuesta(s) sin movimiento hace más de " + PROPOSAL_STALE_DAYS + " días.",
      bullets:
        stale.length === 0
          ? ["No hace falta seguimiento agresivo ahora."]
          : stale.map(
              (row) =>
                String(row.numero || "—") +
                " · " +
                String(row.cliente || "—") +
                " · " +
                formatRelative(String(row.updatedAt || row.createdAt || row.fecha || "")),
            ),
    };
  }

  // No es un intent del vertical — que siga el router genérico.
  return null;
}

/**
 * Chips de sugerencias específicas del vertical. Se muestran como botones
 * rápidos cuando el asistente está en un tenant software-factory.
 */
export function softwareFactorySuggestions(): string[] {
  return [
    "¿Qué proyectos están en riesgo?",
    "Enséñame las propuestas paradas",
    "Pipeline por fase",
    "Entregables recientes",
    "Cobros pendientes",
  ];
}
