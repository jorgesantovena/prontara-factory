import type {
  RuntimeComposableBlueprint,
  BlueprintCompanySize,
} from "@/lib/factory/blueprint-definition";

function buildBaseBlueprint(input: {
  sector: string;
  sectorLabel: string;
  businessType: string;
  businessTypeLabel: string;
  companySize: BlueprintCompanySize;
  displayName: string;
  shortName: string;
  accentColor: string;
  logoHint: string;
  tone: "simple" | "professional" | "sectorial";
  modules: Array<{
    moduleKey: string;
    label: string;
    navigationLabel: string;
    emptyState: string;
    enabled?: boolean;
  }>;
  labels: Record<string, string>;
  entities: RuntimeComposableBlueprint["entities"];
  flows: RuntimeComposableBlueprint["flows"];
  dashboardPriorities: RuntimeComposableBlueprint["dashboardPriorities"];
  landingRules: RuntimeComposableBlueprint["landingRules"];
  texts: RuntimeComposableBlueprint["texts"];
  fields: RuntimeComposableBlueprint["fields"];
  demoData: RuntimeComposableBlueprint["demoData"];
}): RuntimeComposableBlueprint {
  return {
    version: "1.0.0",
    sector: input.sector,
    sectorLabel: input.sectorLabel,
    businessType: input.businessType,
    businessTypeLabel: input.businessTypeLabel,
    companySize: input.companySize,
    modules: input.modules.map((item) => ({
      moduleKey: item.moduleKey,
      enabled: item.enabled !== false,
      label: item.label,
      navigationLabel: item.navigationLabel,
      emptyState: item.emptyState,
    })),
    entities: input.entities,
    flows: input.flows,
    dashboardPriorities: input.dashboardPriorities,
    landingRules: input.landingRules,
    branding: {
      displayName: input.displayName,
      shortName: input.shortName,
      sectorLabel: input.sectorLabel,
      businessTypeLabel: input.businessTypeLabel,
      tone: input.tone,
      accentColor: input.accentColor,
      logoHint: input.logoHint,
    },
    texts: input.texts,
    fields: input.fields,
    demoData: input.demoData,
    labels: input.labels,
  };
}

const SOFTWARE_FACTORY_BLUEPRINT = buildBaseBlueprint({
  sector: "tecnologia",
  sectorLabel: "Tecnología",
  businessType: "software-factory",
  businessTypeLabel: "Software Factory",
  companySize: "small",
  displayName: "Prontara Tech",
  shortName: "PT",
  accentColor: "#2563eb",
  logoHint: "símbolo limpio, digital y profesional",
  tone: "professional",
  modules: [
    { moduleKey: "clientes", label: "Clientes", navigationLabel: "Clientes", emptyState: "Todavía no hay clientes." },
    { moduleKey: "crm", label: "Oportunidades", navigationLabel: "Oportunidades", emptyState: "Todavía no hay oportunidades abiertas." },
    { moduleKey: "proyectos", label: "Proyectos", navigationLabel: "Trabajos", emptyState: "Todavía no hay proyectos activos." },
    { moduleKey: "presupuestos", label: "Propuestas", navigationLabel: "Propuestas", emptyState: "Todavía no hay propuestas abiertas." },
    { moduleKey: "facturacion", label: "Facturas", navigationLabel: "Facturas", emptyState: "Todavía no hay facturas emitidas." },
    { moduleKey: "documentos", label: "Entregables", navigationLabel: "Documentos", emptyState: "Todavía no hay entregables guardados." },
    { moduleKey: "ajustes", label: "Ajustes", navigationLabel: "Ajustes", emptyState: "Configura los datos básicos." },
    { moduleKey: "asistente", label: "Asistente", navigationLabel: "Asistente", emptyState: "Haz tu primera consulta." }
  ],
  labels: {
    clientes: "Clientes",
    crm: "Oportunidades",
    proyectos: "Proyectos",
    presupuestos: "Propuestas",
    facturacion: "Facturas",
    documentos: "Entregables",
    ajustes: "Ajustes",
    asistente: "Asistente"
  },
  entities: [
    {
      key: "cliente",
      label: "Cliente",
      description: "Empresa o persona con la que trabajas.",
      moduleKey: "clientes",
      primaryFields: ["nombre", "email", "telefono"],
      relatedTo: ["oportunidad", "proyecto", "propuesta", "factura", "documento"]
    },
    {
      key: "oportunidad",
      label: "Oportunidad",
      description: "Seguimiento comercial abierto.",
      moduleKey: "crm",
      primaryFields: ["empresa", "contacto", "fase", "valor"],
      relatedTo: ["cliente", "propuesta"]
    },
    {
      key: "proyecto",
      label: "Proyecto",
      description: "Trabajo técnico en marcha.",
      moduleKey: "proyectos",
      primaryFields: ["nombre", "cliente", "responsable", "estado"],
      relatedTo: ["cliente", "documento", "factura"]
    },
    {
      key: "propuesta",
      label: "Propuesta",
      description: "Presupuesto comercial enviado al cliente.",
      moduleKey: "presupuestos",
      primaryFields: ["numero", "cliente", "concepto", "importe"],
      relatedTo: ["cliente", "factura", "documento"]
    },
    {
      key: "factura",
      label: "Factura",
      description: "Documento de cobro emitido.",
      moduleKey: "facturacion",
      primaryFields: ["numero", "cliente", "concepto", "importe"],
      relatedTo: ["cliente", "propuesta"]
    },
    {
      key: "documento",
      label: "Documento",
      description: "Archivo o entregable relacionado con el negocio.",
      moduleKey: "documentos",
      primaryFields: ["nombre", "tipo", "cliente", "entidadOrigen"],
      relatedTo: ["cliente", "proyecto", "propuesta", "factura"]
    }
  ],
  flows: [
    {
      key: "captacion-comercial",
      label: "Captación comercial",
      description: "Desde el cliente potencial hasta la propuesta enviada.",
      steps: ["cliente", "oportunidad", "propuesta"],
      relatedEntities: ["cliente", "oportunidad", "propuesta"]
    },
    {
      key: "entrega-y-cobro",
      label: "Entrega y cobro",
      description: "Desde el proyecto en marcha hasta la facturación final.",
      steps: ["proyecto", "documento", "factura"],
      relatedEntities: ["proyecto", "documento", "factura", "cliente"]
    }
  ],
  dashboardPriorities: [
    { key: "clientes", label: "Clientes activos", description: "Visibilidad del negocio base.", order: 1 },
    { key: "pipeline", label: "Pipeline comercial", description: "Valor abierto en oportunidades.", order: 2 },
    { key: "proyectos", label: "Proyectos activos", description: "Control de ejecución.", order: 3 },
    { key: "facturas", label: "Facturas pendientes", description: "Seguimiento de cobro.", order: 4 },
    { key: "actividad", label: "Actividad reciente", description: "Lo último que ha pasado.", order: 5 }
  ],
  landingRules: [
    {
      key: "claridad",
      label: "Claridad",
      description: "La landing debe sonar clara y directa.",
      instruction: "Explicar qué hace Prontara en lenguaje no técnico."
    },
    {
      key: "target-pyme",
      label: "Target pyme",
      description: "La landing debe hablar a equipos pequeños.",
      instruction: "Hablar a empresas de 4 a 20 empleados con necesidad de orden y rapidez."
    },
    {
      key: "cta-unico",
      label: "CTA principal",
      description: "La acción principal debe ser muy clara.",
      instruction: "Llevar al usuario a comprar o empezar el alta online."
    }
  ],
  texts: {
    welcomeHeadline: "Organiza clientes, propuestas, proyectos y cobros sin complicarte.",
    welcomeSubheadline: "Pensado para software factories y equipos técnicos pequeños.",
    assistantWelcome: "Te ayudo a revisar clientes, propuestas, proyectos y facturas de forma clara.",
    assistantSuggestion: "Muéstrame los proyectos con más riesgo esta semana.",
    navigationLabelMap: {
      clientes: "Clientes",
      crm: "Oportunidades",
      proyectos: "Trabajos",
      presupuestos: "Propuestas",
      facturacion: "Facturas",
      documentos: "Documentos",
      ajustes: "Ajustes",
      asistente: "Asistente"
    },
    emptyStateMap: {
      clientes: "Todavía no hay clientes.",
      crm: "Todavía no hay oportunidades abiertas.",
      proyectos: "Todavía no hay proyectos activos.",
      presupuestos: "Todavía no hay propuestas abiertas.",
      facturacion: "Todavía no hay facturas emitidas.",
      documentos: "Todavía no hay documentos guardados."
    }
  },
  fields: [
    { moduleKey: "clientes", fieldKey: "nombre", label: "Nombre", kind: "text", required: true, placeholder: "Empresa o persona" },
    { moduleKey: "clientes", fieldKey: "email", label: "Email", kind: "email", placeholder: "contacto@empresa.com" },
    { moduleKey: "clientes", fieldKey: "telefono", label: "Teléfono", kind: "tel", placeholder: "+34 ..." },
    { moduleKey: "clientes", fieldKey: "estado", label: "Estado", kind: "status", placeholder: "activo / seguimiento / inactivo" },

    { moduleKey: "crm", fieldKey: "empresa", label: "Cliente", kind: "relation", required: true, relationModuleKey: "clientes" },
    { moduleKey: "crm", fieldKey: "contacto", label: "Contacto", kind: "text", required: true, placeholder: "Persona de contacto" },
    { moduleKey: "crm", fieldKey: "fase", label: "Fase", kind: "status", required: true, placeholder: "lead / contactado / propuesta / ganado / perdido" },
    { moduleKey: "crm", fieldKey: "valor", label: "Valor", kind: "money", placeholder: "2500 EUR" },

    { moduleKey: "proyectos", fieldKey: "nombre", label: "Proyecto", kind: "text", required: true, placeholder: "Nombre del proyecto" },
    { moduleKey: "proyectos", fieldKey: "cliente", label: "Cliente", kind: "relation", required: true, relationModuleKey: "clientes" },
    { moduleKey: "proyectos", fieldKey: "responsable", label: "Responsable", kind: "text", placeholder: "Persona responsable" },
    { moduleKey: "proyectos", fieldKey: "estado", label: "Estado", kind: "status", required: true, placeholder: "planificado / en_marcha / en_riesgo / cerrado" },

    { moduleKey: "presupuestos", fieldKey: "numero", label: "Número", kind: "text", required: true, placeholder: "PRE-2026-001" },
    { moduleKey: "presupuestos", fieldKey: "cliente", label: "Cliente", kind: "relation", required: true, relationModuleKey: "clientes" },
    { moduleKey: "presupuestos", fieldKey: "concepto", label: "Concepto", kind: "textarea", required: true, placeholder: "Descripción de la propuesta" },
    { moduleKey: "presupuestos", fieldKey: "importe", label: "Importe", kind: "money", required: true, placeholder: "3500 EUR" },

    { moduleKey: "facturacion", fieldKey: "numero", label: "Número", kind: "text", required: true, placeholder: "FAC-2026-001" },
    { moduleKey: "facturacion", fieldKey: "cliente", label: "Cliente", kind: "relation", required: true, relationModuleKey: "clientes" },
    { moduleKey: "facturacion", fieldKey: "presupuesto", label: "Propuesta origen", kind: "relation", relationModuleKey: "presupuestos" },
    { moduleKey: "facturacion", fieldKey: "importe", label: "Importe", kind: "money", required: true, placeholder: "3500 EUR" },

    { moduleKey: "documentos", fieldKey: "nombre", label: "Nombre", kind: "text", required: true, placeholder: "Nombre del documento" },
    { moduleKey: "documentos", fieldKey: "tipo", label: "Tipo", kind: "text", required: true, placeholder: "acta / propuesta / contrato..." },
    { moduleKey: "documentos", fieldKey: "cliente", label: "Cliente", kind: "relation", relationModuleKey: "clientes" },
    { moduleKey: "documentos", fieldKey: "entidadOrigen", label: "Entidad origen", kind: "text", placeholder: "Proyecto, propuesta o factura" }
  ],
  demoData: [
    {
      moduleKey: "clientes",
      records: [
        { nombre: "Acme Labs", email: "contacto@acme.com", telefono: "+34 600 111 111", estado: "activo", segmento: "Pyme", notas: "Cliente estratégico" },
        { nombre: "Nova Retail", email: "it@novaretail.com", telefono: "+34 600 222 222", estado: "seguimiento", segmento: "Retail", notas: "Pendiente propuesta" }
      ]
    },
    {
      moduleKey: "crm",
      records: [
        { empresa: "Acme Labs", contacto: "Laura Martín", fase: "propuesta", valor: "12500 EUR", email: "laura@acme.com", notas: "Pendiente revisión final" },
        { empresa: "Nova Retail", contacto: "Carlos Vega", fase: "contactado", valor: "4800 EUR", email: "carlos@nova.com", notas: "Llamar el viernes" }
      ]
    },
    {
      moduleKey: "proyectos",
      records: [
        { nombre: "ERP comercial", cliente: "Acme Labs", responsable: "Laura", estado: "en_marcha", fechaInicio: "2026-01-15", fechaFin: "2026-04-30" },
        { nombre: "Mantenimiento Nova", cliente: "Nova Retail", responsable: "Carlos", estado: "planificado", fechaInicio: "2026-02-01", fechaFin: "2026-06-30" }
      ]
    },
    {
      moduleKey: "presupuestos",
      records: [
        { numero: "PRE-2026-014", cliente: "Nova Retail", concepto: "Mantenimiento y soporte", importe: "4800 EUR", estado: "enviado" },
        { numero: "PRE-2026-021", cliente: "Acme Labs", concepto: "Implantación inicial", importe: "12500 EUR", estado: "pendiente" }
      ]
    },
    {
      moduleKey: "facturacion",
      records: [
        { numero: "FAC-2026-011", cliente: "Acme Labs", presupuesto: "PRE-2026-021", concepto: "Hito implantación", importe: "3500 EUR", estado: "emitida" },
        { numero: "FAC-2026-015", cliente: "Nova Retail", presupuesto: "PRE-2026-014", concepto: "Soporte mensual", importe: "480 EUR", estado: "pendiente" }
      ]
    },
    {
      moduleKey: "documentos",
      records: [
        { nombre: "Acta de arranque", tipo: "acta", cliente: "Acme Labs", entidadOrigen: "ERP comercial", estado: "vigente" },
        { nombre: "Propuesta funcional", tipo: "propuesta", cliente: "Nova Retail", entidadOrigen: "PRE-2026-014", estado: "vigente" }
      ]
    }
  ]
});

const GENERIC_PYME_BLUEPRINT = buildBaseBlueprint({
  sector: "general",
  sectorLabel: "Pyme",
  businessType: "generic-pyme",
  businessTypeLabel: "Pyme general",
  companySize: "small",
  displayName: "Prontara",
  shortName: "PR",
  accentColor: "#111827",
  logoHint: "logo simple, profesional y claro",
  tone: "simple",
  modules: [
    { moduleKey: "clientes", label: "Clientes", navigationLabel: "Clientes", emptyState: "Todavía no hay clientes." },
    { moduleKey: "crm", label: "Seguimiento comercial", navigationLabel: "Seguimiento", emptyState: "Todavía no hay seguimiento comercial." },
    { moduleKey: "presupuestos", label: "Presupuestos", navigationLabel: "Presupuestos", emptyState: "Todavía no hay presupuestos." },
    { moduleKey: "facturacion", label: "Facturación", navigationLabel: "Facturación", emptyState: "Todavía no hay facturas." },
    { moduleKey: "documentos", label: "Documentos", navigationLabel: "Documentos", emptyState: "Todavía no hay documentos." },
    { moduleKey: "ajustes", label: "Ajustes", navigationLabel: "Ajustes", emptyState: "Configura los datos básicos." },
    { moduleKey: "asistente", label: "Asistente", navigationLabel: "Asistente", emptyState: "Haz tu primera consulta." }
  ],
  labels: {
    clientes: "Clientes",
    crm: "Seguimiento",
    presupuestos: "Presupuestos",
    facturacion: "Facturación",
    documentos: "Documentos",
    ajustes: "Ajustes",
    asistente: "Asistente"
  },
  entities: [
    {
      key: "cliente",
      label: "Cliente",
      description: "Empresa o persona con la que trabajas.",
      moduleKey: "clientes",
      primaryFields: ["nombre", "email", "telefono"],
      relatedTo: ["seguimiento", "presupuesto", "factura", "documento"]
    },
    {
      key: "seguimiento",
      label: "Seguimiento",
      description: "Actividad comercial o administrativa pendiente.",
      moduleKey: "crm",
      primaryFields: ["empresa", "contacto", "fase", "valor"],
      relatedTo: ["cliente", "presupuesto"]
    },
    {
      key: "presupuesto",
      label: "Presupuesto",
      description: "Propuesta enviada a cliente.",
      moduleKey: "presupuestos",
      primaryFields: ["numero", "cliente", "concepto", "importe"],
      relatedTo: ["cliente", "factura", "documento"]
    },
    {
      key: "factura",
      label: "Factura",
      description: "Documento de cobro emitido.",
      moduleKey: "facturacion",
      primaryFields: ["numero", "cliente", "concepto", "importe"],
      relatedTo: ["cliente", "presupuesto"]
    },
    {
      key: "documento",
      label: "Documento",
      description: "Archivo relacionado con el negocio.",
      moduleKey: "documentos",
      primaryFields: ["nombre", "tipo", "cliente", "entidadOrigen"],
      relatedTo: ["cliente", "presupuesto", "factura"]
    }
  ],
  flows: [
    {
      key: "venta-basica",
      label: "Venta básica",
      description: "Desde el primer contacto hasta la factura.",
      steps: ["cliente", "seguimiento", "presupuesto", "factura"],
      relatedEntities: ["cliente", "seguimiento", "presupuesto", "factura"]
    }
  ],
  dashboardPriorities: [
    { key: "clientes", label: "Clientes", description: "Base del negocio.", order: 1 },
    { key: "presupuestos", label: "Presupuestos", description: "Propuestas abiertas.", order: 2 },
    { key: "facturas", label: "Facturas pendientes", description: "Cobros por revisar.", order: 3 },
    { key: "actividad", label: "Actividad reciente", description: "Lo último que ha pasado.", order: 4 }
  ],
  landingRules: [
    {
      key: "lenguaje-simple",
      label: "Lenguaje simple",
      description: "Hablar en lenguaje no técnico.",
      instruction: "Explicar el producto de forma clara para una pyme no técnica."
    },
    {
      key: "cta-claro",
      label: "CTA claro",
      description: "Acción principal clara.",
      instruction: "Llevar a comprar o empezar el alta online."
    }
  ],
  texts: {
    welcomeHeadline: "Ordena clientes, presupuestos, facturas y documentos sin complicarte.",
    welcomeSubheadline: "ERP online claro para pymes pequeñas.",
    assistantWelcome: "Te ayudo a revisar clientes, presupuestos, facturas y actividad del negocio.",
    assistantSuggestion: "Enséñame los presupuestos pendientes y las facturas abiertas.",
    navigationLabelMap: {
      clientes: "Clientes",
      crm: "Seguimiento",
      presupuestos: "Presupuestos",
      facturacion: "Facturación",
      documentos: "Documentos",
      ajustes: "Ajustes",
      asistente: "Asistente"
    },
    emptyStateMap: {
      clientes: "Todavía no hay clientes.",
      crm: "Todavía no hay seguimiento comercial.",
      presupuestos: "Todavía no hay presupuestos.",
      facturacion: "Todavía no hay facturas.",
      documentos: "Todavía no hay documentos."
    }
  },
  fields: [
    { moduleKey: "clientes", fieldKey: "nombre", label: "Nombre", kind: "text", required: true, placeholder: "Empresa o persona" },
    { moduleKey: "clientes", fieldKey: "email", label: "Email", kind: "email", placeholder: "contacto@empresa.com" },
    { moduleKey: "clientes", fieldKey: "telefono", label: "Teléfono", kind: "tel", placeholder: "+34 ..." },

    { moduleKey: "crm", fieldKey: "empresa", label: "Cliente", kind: "relation", required: true, relationModuleKey: "clientes" },
    { moduleKey: "crm", fieldKey: "contacto", label: "Contacto", kind: "text", required: true, placeholder: "Persona de contacto" },
    { moduleKey: "crm", fieldKey: "fase", label: "Fase", kind: "status", required: true, placeholder: "lead / contactado / propuesta / ganado / perdido" },
    { moduleKey: "crm", fieldKey: "valor", label: "Valor", kind: "money", placeholder: "2500 EUR" },

    { moduleKey: "presupuestos", fieldKey: "numero", label: "Número", kind: "text", required: true, placeholder: "PRE-2026-001" },
    { moduleKey: "presupuestos", fieldKey: "cliente", label: "Cliente", kind: "relation", required: true, relationModuleKey: "clientes" },
    { moduleKey: "presupuestos", fieldKey: "concepto", label: "Concepto", kind: "textarea", required: true, placeholder: "Descripción del presupuesto" },
    { moduleKey: "presupuestos", fieldKey: "importe", label: "Importe", kind: "money", required: true, placeholder: "3500 EUR" },

    { moduleKey: "facturacion", fieldKey: "numero", label: "Número", kind: "text", required: true, placeholder: "FAC-2026-001" },
    { moduleKey: "facturacion", fieldKey: "cliente", label: "Cliente", kind: "relation", required: true, relationModuleKey: "clientes" },
    { moduleKey: "facturacion", fieldKey: "presupuesto", label: "Presupuesto origen", kind: "relation", relationModuleKey: "presupuestos" },
    { moduleKey: "facturacion", fieldKey: "importe", label: "Importe", kind: "money", required: true, placeholder: "3500 EUR" },

    { moduleKey: "documentos", fieldKey: "nombre", label: "Nombre", kind: "text", required: true, placeholder: "Nombre del documento" },
    { moduleKey: "documentos", fieldKey: "tipo", label: "Tipo", kind: "text", required: true, placeholder: "contrato / propuesta / acta..." },
    { moduleKey: "documentos", fieldKey: "cliente", label: "Cliente", kind: "relation", relationModuleKey: "clientes" }
  ],
  demoData: [
    {
      moduleKey: "clientes",
      records: [
        { nombre: "Demo Cliente 1", email: "demo1@empresa.com", telefono: "+34 600 333 111", estado: "activo" },
        { nombre: "Demo Cliente 2", email: "demo2@empresa.com", telefono: "+34 600 333 222", estado: "seguimiento" }
      ]
    },
    {
      moduleKey: "crm",
      records: [
        { empresa: "Demo Cliente 1", contacto: "Ana", fase: "propuesta", valor: "3200 EUR" }
      ]
    },
    {
      moduleKey: "presupuestos",
      records: [
        { numero: "PRE-001", cliente: "Demo Cliente 1", concepto: "Servicio mensual", importe: "3200 EUR", estado: "enviado" }
      ]
    },
    {
      moduleKey: "facturacion",
      records: [
        { numero: "FAC-001", cliente: "Demo Cliente 1", presupuesto: "PRE-001", concepto: "Servicio inicial", importe: "1200 EUR", estado: "emitida" }
      ]
    },
    {
      moduleKey: "documentos",
      records: [
        { nombre: "Contrato inicial", tipo: "contrato", cliente: "Demo Cliente 1", entidadOrigen: "PRE-001", estado: "vigente" }
      ]
    }
  ]
});

const BLUEPRINTS: RuntimeComposableBlueprint[] = [
  SOFTWARE_FACTORY_BLUEPRINT,
  GENERIC_PYME_BLUEPRINT,
];

export function listBlueprints(): RuntimeComposableBlueprint[] {
  return BLUEPRINTS;
}

export function getBlueprintByBusinessType(businessType: string): RuntimeComposableBlueprint | null {
  const normalized = String(businessType || "").trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  return (
    BLUEPRINTS.find((item) => item.businessType.trim().toLowerCase() === normalized) || null
  );
}

export function getBlueprintFallback(): RuntimeComposableBlueprint {
  return SOFTWARE_FACTORY_BLUEPRINT;
}