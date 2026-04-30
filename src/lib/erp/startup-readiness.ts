import type { DashboardSnapshot } from "@/lib/erp/dashboard-metrics";

export type StartupReadinessCard = {
  key: string;
  label: string;
  value: string;
  helper: string;
};

export type StartupReadiness = {
  score: number;
  statusLabel: "listo" | "casi-listo" | "arrancando";
  headline: string;
  summary: string;
  cards: StartupReadinessCard[];
  recommendedToday: string[];
  confidenceBullets: string[];
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function getStartupReadiness(snapshot: DashboardSnapshot): StartupReadiness {
  const summary = snapshot.summary;

  let score = 20;

  if (summary.totalClientes > 0) score += 20;
  if (summary.presupuestosAbiertos > 0) score += 20;
  if (summary.facturasPendientes > 0) score += 15;
  if (summary.proyectosActivos > 0) score += 10;
  if (summary.totalDocumentos > 0) score += 10;
  if (summary.oportunidadesAbiertas > 0) score += 5;

  score = clamp(score, 0, 100);

  let statusLabel: StartupReadiness["statusLabel"] = "arrancando";
  if (score >= 75) {
    statusLabel = "listo";
  } else if (score >= 45) {
    statusLabel = "casi-listo";
  }

  const cards: StartupReadinessCard[] = [
    {
      key: "clientes",
      label: "Clientes preparados",
      value: String(summary.totalClientes),
      helper:
        summary.totalClientes > 0
          ? "Ya tienes base para presupuestos y facturas."
          : "Conviene crear al menos un cliente hoy.",
    },
    {
      key: "presupuestos",
      label: "Presupuestos en marcha",
      value: String(summary.presupuestosAbiertos),
      helper:
        summary.presupuestosAbiertos > 0
          ? "Ya hay actividad comercial abierta."
          : "Puedes preparar una propuesta en pocos minutos.",
    },
    {
      key: "facturas",
      label: "Facturas vivas",
      value: String(summary.facturasPendientes),
      helper:
        summary.facturasPendientes > 0
          ? "El circuito de facturación ya está en uso."
          : "Todavía no has puesto en marcha la facturación.",
    },
    {
      key: "documentos",
      label: "Documentos guardados",
      value: String(summary.totalDocumentos),
      helper:
        summary.totalDocumentos > 0
          ? "Ya hay documentación disponible en el sistema."
          : "Sube o genera documentos para tenerlo todo a mano.",
    },
  ];

  const recommendedToday: string[] = [];
  if (summary.totalClientes === 0) {
    recommendedToday.push("Crear tu primer cliente");
  }
  if (summary.presupuestosAbiertos === 0) {
    recommendedToday.push("Preparar un presupuesto sencillo");
  }
  if (summary.facturasPendientes === 0) {
    recommendedToday.push("Emitir una primera factura de prueba o real");
  }
  if (summary.totalDocumentos === 0) {
    recommendedToday.push("Guardar un documento importante");
  }
  if (recommendedToday.length === 0) {
    recommendedToday.push("Seguir trabajando con normalidad");
    recommendedToday.push("Invitar a otra persona del equipo");
  }

  const confidenceBullets = [
    "No hace falta configurarlo todo antes de empezar.",
    "Puedes trabajar con lo básico desde hoy mismo.",
    "Los módulos principales están organizados para una pyme pequeña.",
  ];

  let headline = "Tu entorno está arrancando";
  let text =
    "Ya puedes trabajar, pero conviene completar dos o tres pasos básicos para que todo quede más cómodo.";

  if (statusLabel === "casi-listo") {
    headline = "Tu entorno está casi listo para el día a día";
    text =
      "Ya tienes una base razonable. Con un par de acciones más podrás trabajar con más tranquilidad.";
  }

  if (statusLabel === "listo") {
    headline = "Tu entorno está listo para trabajar";
    text =
      "Ya tienes suficiente base para usar Prontara sin depender de ayuda externa en lo básico.";
  }

  return {
    score,
    statusLabel,
    headline,
    summary: text,
    cards,
    recommendedToday,
    confidenceBullets,
  };
}