export const prontaraConfig = {
  clientId: "estandar-20260419194129",
  displayName: "Software Factory Demo",
  sector: "tecnologia",
  version: "0.1.0",
  blueprintMeta: {
    companySize: "",
    coreFlow: [""],
    reportingNeeds: [""]
  },
  modules: [
    { key: "clientes", label: "Clientes", description: "Gestion de clientes y cuentas.", route: "/clientes", area: "Comercial" },
    { key: "crm", label: "CRM", description: "Leads, oportunidades y pipeline comercial.", route: "/crm", area: "Comercial" },
    { key: "presupuestos", label: "Presupuestos", description: "Presupuestos, propuestas y cotizaciones.", route: "/presupuestos", area: "Comercial" },
    { key: "proyectos", label: "Proyectos", description: "Gestion de proyectos, fases y entregables.", route: "/proyectos", area: "Operacion" },
    { key: "timesheets", label: "Timesheets", description: "Imputacion de horas por proyecto, tarea y cliente.", route: "/timesheets", area: "Operacion" },
    { key: "planificacion_recursos", label: "Planificacion de recursos", description: "Capacidad, carga y disponibilidad del equipo.", route: "/planificacion_recursos", area: "Operacion" },
    { key: "facturacion", label: "Facturacion", description: "Facturas, cobros y seguimiento administrativo.", route: "/facturacion", area: "Finanzas" },
    { key: "finanzas", label: "Finanzas", description: "Tesoreria, ingresos, gastos y control basico.", route: "/finanzas", area: "Finanzas" },
    { key: "rrhh", label: "RRHH", description: "Empleados, ausencias y documentacion laboral.", route: "/rrhh", area: "Personas" },
    { key: "documentos", label: "Documentos", description: "Documentacion y archivos asociados.", route: "/documentos", area: "Gestion" },
    { key: "ajustes", label: "Ajustes", description: "Configuracion general del ERP.", route: "/ajustes", area: "Otros" },
    { key: "contratos", label: "Contratos", description: "Contratos, bolsas de horas y condiciones de servicio.", route: "/contratos", area: "Gestion" },
    { key: "asistente", label: "Asistente", description: "Asistente conversacional para consultar este ERP.", route: "/asistente", area: "Gestion" }
  ]
} as const