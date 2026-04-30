export type RuntimeSectorContext = {
  clientId: string;
  displayName: string;
  sector: string;
  businessType?: string;
};

export type SectorLabels = {
  clientSingular: string;
  clientPlural: string;
  clientModuleTitle: string;
  appointmentSingular: string;
  appointmentPlural: string;
  crmTitle: string;
  dashboardSubtitle: string;
};

export function getSectorLabels(context: RuntimeSectorContext): SectorLabels {
  if (context.businessType === "clinica-dental") {
    return {
      clientSingular: "paciente",
      clientPlural: "pacientes",
      clientModuleTitle: "Pacientes",
      appointmentSingular: "cita",
      appointmentPlural: "citas",
      crmTitle: "Admisión comercial",
      dashboardSubtitle:
        "ERP clínico del cliente activo con pacientes, citas, presupuestos y facturación.",
    };
  }

  return {
    clientSingular: "cliente",
    clientPlural: "clientes",
    clientModuleTitle: "Clientes",
    appointmentSingular: "cita",
    appointmentPlural: "citas",
    crmTitle: "CRM",
    dashboardSubtitle:
      "Dashboard operativo del cliente activo con métricas reales de clientes, CRM y proyectos.",
  };
}

export function getModuleDisplayLabel(
  moduleKey: string,
  originalLabel: string,
  context: RuntimeSectorContext
): string {
  const labels = getSectorLabels(context);

  if (context.businessType === "clinica-dental") {
    if (moduleKey === "clientes") {
      return labels.clientModuleTitle;
    }
    if (moduleKey === "crm") {
      return labels.crmTitle;
    }
  }

  return originalLabel;
}