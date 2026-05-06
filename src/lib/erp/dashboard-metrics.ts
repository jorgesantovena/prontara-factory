import { listModuleRecordsAsync } from "@/lib/persistence/active-client-data-store-async";

export type DashboardMetric = {
  key: string;
  label: string;
  value: string;
  helper: string;
};

export type DashboardActivityItem = {
  id: string;
  title: string;
  subtitle: string;
  moduleKey: string;
  moduleLabel: string;
  href: string;
  updatedAt: string;
};

export type DashboardQuickAction = {
  href: string;
  label: string;
  helper: string;
};

export type DashboardSnapshot = {
  activeClientId: string | null;
  metrics: DashboardMetric[];
  activity: DashboardActivityItem[];
  quickActions: DashboardQuickAction[];
  summary: {
    totalClientes: number;
    oportunidadesAbiertas: number;
    pipelineAbierto: number;
    proyectosActivos: number;
    presupuestosAbiertos: number;
    facturasPendientes: number;
    totalDocumentos: number;
  };
};

async function safeModule(moduleKey: string, clientId?: string): Promise<Array<Record<string, string>>> {
  try {
    return await listModuleRecordsAsync(moduleKey, clientId);
  } catch {
    return [];
  }
}

function countByStatus(rows: Array<Record<string, string>>, keys: string[]) {
  return rows.filter((item) => {
    const value = String(item.estado || item.fase || "").trim().toLowerCase();
    return keys.includes(value);
  }).length;
}

function moneyToNumber(value: string) {
  const normalized = String(value || "")
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildActivity(
  rows: Array<Record<string, string>>,
  moduleKey: string,
  moduleLabel: string,
  href: string,
  titleField: string,
  subtitleField?: string
): DashboardActivityItem[] {
  return rows.slice(0, 5).map((item) => ({
    id: String(item.id || Math.random()),
    title: String(item[titleField] || "Sin título"),
    subtitle: subtitleField ? String(item[subtitleField] || "") : "",
    moduleKey,
    moduleLabel,
    href,
    updatedAt: String(item.updatedAt || item.createdAt || ""),
  }));
}

export async function getDashboardSnapshot(clientId?: string): Promise<DashboardSnapshot> {
  const [clientes, crm, proyectos, presupuestos, facturacion, documentos] =
    await Promise.all([
      safeModule("clientes", clientId),
      safeModule("crm", clientId),
      safeModule("proyectos", clientId),
      safeModule("presupuestos", clientId),
      safeModule("facturacion", clientId),
      safeModule("documentos", clientId),
    ]);

  const oportunidadesAbiertas = countByStatus(crm, ["lead", "contactado", "propuesta", "abierto"]);
  const proyectosActivos = countByStatus(proyectos, ["en_marcha", "activo", "planificado", "en_riesgo"]);
  const presupuestosAbiertos = countByStatus(presupuestos, ["enviado", "abierto", "pendiente"]);
  const facturasPendientes = countByStatus(facturacion, ["emitida", "pendiente", "vencida"]);

  const pipelineAbierto = crm.reduce((acc, item) => {
    return acc + moneyToNumber(String(item.importe || item.valor || "0"));
  }, 0);

  const metrics: DashboardMetric[] = [
    {
      key: "clientes",
      label: "Clientes",
      value: String(clientes.length),
      helper: "Base activa de clientes.",
    },
    {
      key: "oportunidades",
      label: "Oportunidades",
      value: String(oportunidadesAbiertas),
      helper: "Seguimiento comercial abierto.",
    },
    {
      key: "pipeline",
      label: "Pipeline",
      value: pipelineAbierto.toLocaleString("es-ES", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0,
      }),
      helper: "Valor potencial abierto.",
    },
    {
      key: "proyectos",
      label: "Trabajos activos",
      value: String(proyectosActivos),
      helper: "Trabajos o proyectos en marcha.",
    },
    {
      key: "presupuestos",
      label: "Propuestas abiertas",
      value: String(presupuestosAbiertos),
      helper: "Presupuestos pendientes de cerrar.",
    },
    {
      key: "facturas",
      label: "Facturas pendientes",
      value: String(facturasPendientes),
      helper: "Facturas por cobrar o revisar.",
    },
  ];

  const activity = [
    ...buildActivity(clientes, "clientes", "Clientes", "/clientes", "nombre", "email"),
    ...buildActivity(crm, "crm", "CRM", "/crm", "contacto", "empresa"),
    ...buildActivity(proyectos, "proyectos", "Trabajos", "/proyectos", "nombre", "cliente"),
    ...buildActivity(presupuestos, "presupuestos", "Propuestas", "/presupuestos", "numero", "cliente"),
    ...buildActivity(facturacion, "facturacion", "Facturas", "/facturacion", "numero", "cliente"),
    ...buildActivity(documentos, "documentos", "Documentos", "/documentos", "nombre", "tipo"),
  ]
    .sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime())
    .slice(0, 12);

  const quickActions: DashboardQuickAction[] = [
    {
      href: "/clientes",
      label: "Crear cliente",
      helper: "Empieza por dar de alta una empresa o persona.",
    },
    {
      href: "/presupuestos",
      label: "Preparar propuesta",
      helper: "Haz una propuesta sencilla para mover el negocio.",
    },
    {
      href: "/facturacion",
      label: "Emitir factura",
      helper: "Deja lista la parte básica de cobro.",
    },
    {
      href: "/documentos",
      label: "Guardar documento",
      helper: "Centraliza lo importante en un solo sitio.",
    },
  ];

  return {
    activeClientId: clientId || null,
    metrics,
    activity,
    quickActions,
    summary: {
      totalClientes: clientes.length,
      oportunidadesAbiertas,
      pipelineAbierto,
      proyectosActivos,
      presupuestosAbiertos,
      facturasPendientes,
      totalDocumentos: documentos.length,
    },
  };
}