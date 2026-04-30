/**
 * Tipos específicos del vertical Software Factory.
 *
 * Todo lo que este vertical expone como "producto", en contraposición a los
 * tipos genéricos del runtime (dashboard-metrics, client-360, etc.).
 *
 * Los KPIs elevan sobre el snapshot genérico conceptos propios de una
 * software factory pequeña: pipeline comercial, proyectos en riesgo,
 * propuestas estancadas, entregables recientes, carga operativa.
 */

export type SoftwareFactoryKpi = {
  key:
    | "clientes"
    | "pipeline"
    | "proyectosActivos"
    | "proyectosEnRiesgo"
    | "propuestasAbiertas"
    | "facturasPendientes"
    | "entregablesRecientes"
    | "cargaOperativa";
  label: string;
  value: string;
  helper: string;
  tone: "neutral" | "good" | "warn" | "bad";
};

export type SoftwareFactoryPipelineStage = {
  key: string;
  label: string;
  count: number;
  value: number;
};

export type SoftwareFactoryAlert = {
  key: string;
  severity: "info" | "warn" | "danger";
  title: string;
  detail: string;
  href: string;
};

export type SoftwareFactoryActivityItem = {
  id: string;
  kind: "cliente" | "oportunidad" | "propuesta" | "proyecto" | "factura" | "entregable";
  title: string;
  subtitle: string;
  status: string;
  href: string;
  updatedAt: string;
};

export type SoftwareFactoryOverview = {
  ok: boolean;
  clientId: string;
  displayName: string;
  businessType: string;
  kpis: SoftwareFactoryKpi[];
  pipelineByStage: SoftwareFactoryPipelineStage[];
  alerts: SoftwareFactoryAlert[];
  recentActivity: SoftwareFactoryActivityItem[];
  recentDeliverables: SoftwareFactoryActivityItem[];
};
