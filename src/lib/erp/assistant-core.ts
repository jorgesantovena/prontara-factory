import { getDashboardSnapshot } from "@/lib/erp/dashboard-metrics";
import { getClient360Snapshot } from "@/lib/erp/client-360";
import { listModuleRecords } from "@/lib/erp/active-client-data-store";

export type AssistantAnswer = {
  title: string;
  summary: string;
  bullets: string[];
};

function normalize(value: string) {
  return String(value || "").trim().toLowerCase();
}

type AssistantContext = {
  labels?: Record<string, string>;
  assistantWelcome?: string;
  assistantSuggestion?: string;
};

export function answerErpAssistant(
  prompt: string,
  activeClientId?: string,
  context?: AssistantContext
): AssistantAnswer {
  const raw = String(prompt || "").trim();
  const lower = normalize(raw);

  if (!raw) {
    return {
      title: "Asistente listo",
      summary:
        context?.assistantWelcome ||
        "Puedo ayudarte a revisar clientes, presupuestos, facturas y actividad reciente.",
      bullets: [
        context?.assistantSuggestion || "Prueba con: enséñame las facturas pendientes",
        "Prueba con: resume la actividad reciente",
        "Prueba con: dame una visión de un cliente",
      ],
    };
  }

  if (lower.includes("factura") || lower.includes("cuota") || lower.includes("ticket") || lower.includes("recibo")) {
    const rows = listModuleRecords("facturacion", activeClientId);
    const pending = rows.filter((item) =>
      ["emitida", "pendiente", "vencida"].includes(normalize(item.estado))
    );

    return {
      title: context?.labels?.facturacion || "Facturación pendiente",
      summary: "He revisado la facturación pendiente del entorno.",
      bullets:
        pending.length > 0
          ? pending.slice(0, 8).map((item) =>
              String(item.numero || "Documento") + " · " + String(item.cliente || "") + " · " + String(item.importe || "")
            )
          : ["No hay elementos pendientes ahora mismo."],
    };
  }

  if (lower.includes("actividad") || lower.includes("resumen")) {
    const snapshot = getDashboardSnapshot(activeClientId);

    return {
      title: "Resumen operativo",
      summary: "Aquí tienes una visión rápida del entorno.",
      bullets: [
        (context?.labels?.clientes || "Clientes") + ": " + snapshot.summary.totalClientes,
        (context?.labels?.crm || "CRM") + ": " + snapshot.summary.oportunidadesAbiertas,
        (context?.labels?.proyectos || "Proyectos") + ": " + snapshot.summary.proyectosActivos,
        (context?.labels?.presupuestos || "Presupuestos") + ": " + snapshot.summary.presupuestosAbiertos,
        (context?.labels?.facturacion || "Facturación") + ": " + snapshot.summary.facturasPendientes,
      ],
    };
  }

  if (lower.includes("cliente") || lower.includes("paciente") || lower.includes("socio") || lower.includes("familia")) {
    const clientes = listModuleRecords("clientes", activeClientId);
    const found = clientes.find((item) => lower.includes(normalize(item.nombre)));

    if (found) {
      const detail = getClient360Snapshot(String(found.nombre || ""), activeClientId);
      return {
        title: "Visión 360",
        summary: "He encontrado información relacionada con " + String(found.nombre || ""),
        bullets: [
          (context?.labels?.crm || "CRM") + ": " + detail.summary.oportunidades,
          (context?.labels?.proyectos || "Proyectos") + ": " + detail.summary.proyectos,
          (context?.labels?.presupuestos || "Presupuestos") + ": " + detail.summary.presupuestos,
          (context?.labels?.facturacion || "Facturación") + ": " + detail.summary.facturas,
          (context?.labels?.documentos || "Documentos") + ": " + detail.summary.documentos,
        ],
      };
    }
  }

  return {
    title: "Respuesta rápida",
    summary:
      context?.assistantWelcome ||
      "Todavía no he encontrado una intención muy concreta, pero puedo ayudarte con lo operativo.",
    bullets: [
      context?.assistantSuggestion || "Pídeme un resumen del entorno",
      "Pídeme facturas o cobros pendientes",
      "Pídeme la visión de un cliente",
    ],
  };
}