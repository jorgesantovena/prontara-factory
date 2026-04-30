import fs from "node:fs";
import { prontaraConfig } from "@/lib/prontara.generated";
import { getRuntimeTenantContext } from "@/lib/factory/runtime-tenant-context";

export type RuntimeModule = {
  key: string;
  label: string;
  description: string;
  route: string;
  area: string;
  simulatedActions?: string[];
};

export type RuntimeBlueprintMeta = {
  companySize: string;
  coreFlow: string[];
  reportingNeeds: string[];
};

export type RuntimeProntaraConfig = {
  clientId: string;
  displayName: string;
  sector: string;
  businessType: string;
  version: string;
  createdAt?: string;
  status?: string;
  blueprintMeta: RuntimeBlueprintMeta;
  modules: RuntimeModule[];
};

export type RuntimeKpi = {
  label: string;
  value: string;
  detail: string;
};

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asStringArray(value: unknown, fallback: string[] = []) {
  return Array.isArray(value) ? value.map((item) => String(item)) : fallback;
}

function readJsonFileSafe(filePath: string) {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function getResolvedRuntimeTenantContext(clientId?: string | null) {
  return getRuntimeTenantContext({
    clientId: typeof clientId === "string" ? clientId : undefined,
    fallbackToActiveClient: true,
  });
}

function prettifyModuleLabel(moduleKey: string) {
  const map: Record<string, string> = {
    clientes: "Clientes",
    crm: "CRM",
    presupuestos: "Presupuestos",
    proyectos: "Proyectos",
    timesheets: "Timesheets",
    planificacion_recursos: "PlanificaciÃ³n de recursos",
    facturacion: "FacturaciÃ³n",
    finanzas: "Finanzas",
    rrhh: "RRHH",
    documentos: "Documentos",
    ajustes: "Ajustes",
    asistente: "Asistente",
    citas: "Citas",
    tratamientos: "Tratamientos",
    pacientes: "Pacientes",
    socios: "Socios",
    clases: "Clases",
    contratos: "Contratos",
    web: "Web",
    tareas: "Tareas",
    cobros: "Cobros",
    pagos: "Pagos",
    tesoreria: "TesorerÃ­a",
    productos: "Productos",
    compras: "Compras",
    proveedores: "Proveedores",
    almacen: "AlmacÃ©n",
    vehiculos: "VehÃ­culos",
    taller: "Taller",
    ordenes_trabajo: "Ã“rdenes de trabajo",
    embarcaciones: "Embarcaciones",
    pedidos: "Pedidos",
  };

  if (map[moduleKey]) {
    return map[moduleKey];
  }

  return moduleKey
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function guessModuleArea(moduleKey: string) {
  const comercial = ["clientes", "crm", "presupuestos", "ventas", "contratos"];
  const operacion = ["proyectos", "timesheets", "planificacion_recursos", "citas", "tratamientos", "taller", "ordenes_trabajo", "clases", "pedidos"];
  const finanzas = ["facturacion", "finanzas", "cobros", "pagos", "tesoreria", "compras"];
  const personas = ["rrhh", "socios", "pacientes"];
  const gestion = ["documentos", "asistente", "productos", "proveedores", "almacen", "vehiculos", "embarcaciones", "web"];
  const otros = ["ajustes"];

  if (comercial.includes(moduleKey)) return "Comercial";
  if (operacion.includes(moduleKey)) return "OperaciÃ³n";
  if (finanzas.includes(moduleKey)) return "Finanzas";
  if (personas.includes(moduleKey)) return "Personas";
  if (gestion.includes(moduleKey)) return "GestiÃ³n";
  if (otros.includes(moduleKey)) return "Otros";

  return "General";
}

function guessModuleDescription(moduleKey: string, moduleLabel: string) {
  const map: Record<string, string> = {
    clientes: "GestiÃ³n de clientes y cuentas.",
    crm: "Leads, oportunidades y pipeline comercial.",
    presupuestos: "Presupuestos, propuestas y cotizaciones.",
    proyectos: "GestiÃ³n de proyectos, fases y entregables.",
    timesheets: "ImputaciÃ³n de horas por proyecto, tarea y cliente.",
    planificacion_recursos: "Capacidad, carga y disponibilidad del equipo.",
    facturacion: "Facturas, cobros y seguimiento administrativo.",
    finanzas: "TesorerÃ­a, ingresos, gastos y control bÃ¡sico.",
    rrhh: "Empleados, ausencias y documentaciÃ³n laboral.",
    documentos: "DocumentaciÃ³n y archivos asociados.",
    ajustes: "ConfiguraciÃ³n general del ERP.",
    asistente: "Asistente conversacional para consultar este ERP.",
    citas: "Agenda y gestiÃ³n de citas.",
    tratamientos: "Seguimiento de tratamientos y servicios.",
    pacientes: "GestiÃ³n de pacientes y fichas.",
    socios: "GestiÃ³n de socios y relaciÃ³n activa.",
    clases: "PlanificaciÃ³n y seguimiento de clases.",
    contratos: "Contratos, renovaciones y documentaciÃ³n asociada.",
    cobros: "Cobros y seguimiento de vencimientos.",
    pagos: "Pagos y control de salidas.",
    tesoreria: "TesorerÃ­a y previsiÃ³n de caja.",
    productos: "CatÃ¡logo de productos y referencias.",
    compras: "Compras, pedidos y seguimiento.",
    proveedores: "GestiÃ³n de proveedores.",
    almacen: "Stock, movimientos y control de almacÃ©n.",
    vehiculos: "GestiÃ³n de vehÃ­culos.",
    taller: "Operativa del taller.",
    ordenes_trabajo: "Ã“rdenes de trabajo y seguimiento.",
    embarcaciones: "GestiÃ³n de embarcaciones.",
    pedidos: "Pedidos y seguimiento comercial.",
    web: "GestiÃ³n de presencia web y contenido.",
    ventas: "Seguimiento de ventas y actividad comercial.",
    tareas: "Tareas y seguimiento operativo.",
  };

  return map[moduleKey] || ("GestiÃ³n de " + moduleLabel.toLowerCase() + ".");
}

function buildModuleFromString(moduleKey: string, fallbackModules: RuntimeModule[]) {
  const fallbackMatch = fallbackModules.find((item) => item.key === moduleKey);
  if (fallbackMatch) {
    return fallbackMatch;
  }

  const label = prettifyModuleLabel(moduleKey);

  return {
    key: moduleKey,
    label,
    description: guessModuleDescription(moduleKey, label),
    route: "/" + moduleKey,
    area: guessModuleArea(moduleKey),
    simulatedActions: [],
  };
}

function buildModulesFromClientJson(value: unknown, fallbackModules: RuntimeModule[]) {
  if (!Array.isArray(value) || value.length === 0) {
    return fallbackModules;
  }

  return value.map((item, index) => {
    if (typeof item === "string") {
      return buildModuleFromString(item, fallbackModules);
    }

    const moduleItem =
      item && typeof item === "object" ? (item as Record<string, unknown>) : {};

    const key = asString(moduleItem.key, "modulo-" + String(index + 1));
    const fallbackMatch = fallbackModules.find((mod) => mod.key === key);

    const label = asString(
      moduleItem.label,
      fallbackMatch?.label || prettifyModuleLabel(key)
    );
    const description = asString(
      moduleItem.description,
      fallbackMatch?.description || guessModuleDescription(key, label)
    );
    const route = asString(
      moduleItem.route,
      fallbackMatch?.route || "/" + key
    );
    const area = asString(
      moduleItem.area,
      fallbackMatch?.area || guessModuleArea(key)
    );
    const simulatedActions = asStringArray(
      moduleItem.simulatedActions,
      fallbackMatch?.simulatedActions || []
    );

    return {
      key,
      label,
      description,
      route,
      area,
      simulatedActions,
    };
  });
}

function getFallbackConfig(): RuntimeProntaraConfig {
  return {
    clientId: String(prontaraConfig.clientId),
    displayName: String(prontaraConfig.displayName),
    sector: String(prontaraConfig.sector),
    businessType: "general",
    version: String(prontaraConfig.version),
    blueprintMeta: {
      companySize: asString(prontaraConfig.blueprintMeta?.companySize, ""),
      coreFlow: asStringArray(prontaraConfig.blueprintMeta?.coreFlow, []),
      reportingNeeds: asStringArray(prontaraConfig.blueprintMeta?.reportingNeeds, []),
    },
    modules: Array.isArray(prontaraConfig.modules)
      ? prontaraConfig.modules.map((mod) => ({
          key: String(mod.key),
          label: String(mod.label),
          description: String(mod.description),
          route: String(mod.route),
          area: String(mod.area),
          simulatedActions: [],
        }))
      : [],
  };
}

export function getRuntimeProntaraConfig(): RuntimeProntaraConfig {
  const fallbackConfig = getFallbackConfig();
  const activeClientId = getResolvedRuntimeTenantContext().clientId;

  if (!activeClientId) {
    return fallbackConfig;
  }

  const clientJsonPath = getResolvedRuntimeTenantContext(activeClientId).definitionPath;

  const clientJson = readJsonFileSafe(clientJsonPath);

  if (!clientJson || typeof clientJson !== "object") {
    return {
      ...fallbackConfig,
      clientId: activeClientId,
    };
  }

  const clientData = clientJson as Record<string, unknown>;
  const blueprintMetaRaw =
    clientData.blueprintMeta && typeof clientData.blueprintMeta === "object"
      ? (clientData.blueprintMeta as Record<string, unknown>)
      : {};

  return {
    clientId: asString(clientData.clientId, activeClientId),
    displayName: asString(clientData.displayName, fallbackConfig.displayName),
    sector: asString(clientData.sector, fallbackConfig.sector),
    businessType: asString(clientData.businessType, fallbackConfig.businessType || "general"),
    version: fallbackConfig.version,
    createdAt: asString(clientData.createdAt, ""),
    status: asString(clientData.status, ""),
    blueprintMeta: {
      companySize: asString(
        clientData.companySize,
        asString(blueprintMetaRaw.companySize, fallbackConfig.blueprintMeta.companySize)
      ),
      coreFlow: asStringArray(
        blueprintMetaRaw.coreFlow,
        fallbackConfig.blueprintMeta.coreFlow
      ),
      reportingNeeds: asStringArray(
        blueprintMetaRaw.reportingNeeds,
        fallbackConfig.blueprintMeta.reportingNeeds
      ),
    },
    modules: buildModulesFromClientJson(clientData.modules, fallbackConfig.modules),
  };
}

export function getRuntimeModuleByKey(moduleKey: string) {
  const config = getRuntimeProntaraConfig();
  return config.modules.find((moduleItem) => moduleItem.key === moduleKey) || null;
}

export function getSuggestedAssistantPrompts(config: RuntimeProntaraConfig): string[] {
  const basePrompts = [
    "Resume el estado actual del ERP activo.",
    "Enumera los mÃ³dulos actuales y para quÃ© sirve cada uno.",
    "QuÃ© mejoras rÃ¡pidas propones para este cliente.",
    "QuÃ© mÃ³dulo aÃ±adirÃ­as a continuaciÃ³n y por quÃ©.",
  ];

  const byBusinessType: Record<string, string[]> = {
    "clinica-dental": [
      "PropÃ³n mejoras para la gestiÃ³n de citas y pacientes.",
      "QuÃ© indicadores pondrÃ­as en el dashboard de una clÃ­nica dental.",
      "QuÃ© flujo propones entre pacientes, citas, presupuestos y facturaciÃ³n.",
    ],
    "software-factory": [
      "CÃ³mo mejorarÃ­as proyectos, timesheets y planificaciÃ³n de recursos.",
      "QuÃ© KPI pondrÃ­as para una software factory.",
      "QuÃ© flujo propones entre CRM, presupuestos, proyectos y facturaciÃ³n.",
    ],
    "gimnasio": [
      "QuÃ© mejoras harÃ­as para cuotas, socios y clases.",
      "QuÃ© indicadores usarÃ­as para un gimnasio.",
    ],
    "peluqueria": [
      "QuÃ© mejoras harÃ­as para citas, clientes y cobros.",
      "QuÃ© datos conviene mostrar en una peluquerÃ­a.",
    ],
  };

  const extra = byBusinessType[config.businessType] || [];
  return [...basePrompts, ...extra];
}

export function getDashboardKpis(config: RuntimeProntaraConfig): RuntimeKpi[] {
  const byBusinessType: Record<string, RuntimeKpi[]> = {
    "clinica-dental": [
      { label: "Citas confirmadas", value: "38", detail: "Semana actual" },
      { label: "Tratamientos abiertos", value: "12", detail: "Pendientes de cierre" },
      { label: "Cobros pendientes", value: "4.250 EUR", detail: "FacturaciÃ³n pendiente" },
      { label: "Pacientes recurrentes", value: "67%", detail: "Ãšltimos 90 dÃ­as" },
    ],
    "software-factory": [
      { label: "Proyectos activos", value: "9", detail: "En curso" },
      { label: "Horas imputadas", value: "312 h", detail: "Semana actual" },
      { label: "Margen estimado", value: "28%", detail: "Promedio cartera activa" },
      { label: "Presupuestos abiertos", value: "6", detail: "En seguimiento comercial" },
    ],
    "gimnasio": [
      { label: "Socios activos", value: "284", detail: "Con cuota vigente" },
      { label: "Renovaciones pendientes", value: "19", detail: "PrÃ³ximos 10 dÃ­as" },
      { label: "Clases semanales", value: "42", detail: "Planificadas" },
      { label: "Cobros pendientes", value: "1.920 EUR", detail: "Cuotas y servicios" },
    ],
    "peluqueria": [
      { label: "Citas del dÃ­a", value: "23", detail: "Agenda actual" },
      { label: "Ticket medio", value: "36 EUR", detail: "Ãšltimos 30 dÃ­as" },
      { label: "Clientes recurrentes", value: "58%", detail: "Ãšltimos 90 dÃ­as" },
      { label: "Cobros pendientes", value: "480 EUR", detail: "Servicios pendientes" },
    ],
  };

  return byBusinessType[config.businessType] || [
    { label: "Clientes activos", value: "124", detail: "Base operativa" },
    { label: "Procesos abiertos", value: "18", detail: "Pendientes de seguimiento" },
    { label: "Cobros pendientes", value: "7.800 EUR", detail: "Operativa financiera" },
    { label: "MÃ³dulos activos", value: String(config.modules.length), detail: "ConfiguraciÃ³n actual" },
  ];
}

export function getTopRecommendations(config: RuntimeProntaraConfig): string[] {
  const map: Record<string, string[]> = {
    "clinica-dental": [
      "AÃ±adir recordatorios y confirmaciones de cita.",
      "Separar pacientes, tratamientos y presupuestos.",
      "Mejorar indicadores de agenda, cobro y recurrencia.",
    ],
    "software-factory": [
      "Conectar mejor CRM, presupuestos, proyectos y facturaciÃ³n.",
      "Afinar timesheets y planificaciÃ³n de recursos.",
      "AÃ±adir rentabilidad por proyecto y cliente.",
    ],
    "gimnasio": [
      "AÃ±adir control de socios, cuotas y clases.",
      "Mejorar seguimiento de renovaciones.",
      "AÃ±adir mÃ©tricas de asistencia y bajas.",
    ],
    "peluqueria": [
      "Mejorar agenda, servicios y recurrencia de clientes.",
      "AÃ±adir bonos, productos y seguimiento de ticket medio.",
      "Separar mejor citas, cobros y fidelizaciÃ³n.",
    ],
  };

  return map[config.businessType] || [
    "Revisar naming de mÃ³dulos y consistencia de procesos.",
    "Enriquecer dashboard e indicadores.",
    "Definir siguiente mÃ³dulo prioritario segÃºn operativa real.",
  ];
}

export function getBusinessTypeSummary(config: RuntimeProntaraConfig): string {
  const map: Record<string, string> = {
    "clinica-dental":
      "El foco principal debe estar en pacientes, citas, tratamientos, presupuestos y cobro clÃ­nico.",
    "software-factory":
      "El foco principal debe estar en comercial, proyectos, horas, capacidad del equipo y rentabilidad.",
    "gimnasio":
      "El foco principal debe estar en socios, cuotas, clases, renovaciones y asistencia.",
    "peluqueria":
      "El foco principal debe estar en agenda, servicios, recurrencia, cobros y fidelizaciÃ³n.",
  };

  return map[config.businessType] ||
    "El foco principal debe estar en ordenar procesos, medir actividad y reforzar la operativa comercial y administrativa.";
}

export function getModuleRecommendations(
  moduleKey: string,
  config: RuntimeProntaraConfig
): string[] {
  const generic: Record<string, string[]> = {
    clientes: [
      "Definir mejor segmentaciÃ³n y campos clave.",
      "Separar clientes activos, potenciales y estratÃ©gicos.",
      "AÃ±adir trazabilidad comercial y documental.",
    ],
    crm: [
      "Ordenar pipeline y estados de oportunidad.",
      "Definir siguiente acciÃ³n comercial obligatoria.",
      "Medir conversiÃ³n por etapa y origen.",
    ],
    presupuestos: [
      "Normalizar estados, versiones y seguimiento.",
      "Relacionar cada propuesta con cliente y oportunidad.",
      "Medir aceptaciÃ³n y tiempo medio de cierre.",
    ],
    proyectos: [
      "Separar proyecto, fase, tarea y entregable.",
      "Relacionar avance con presupuesto y horas.",
      "Controlar desviaciones y bloqueos.",
    ],
    timesheets: [
      "Estandarizar imputaciÃ³n por proyecto y tarea.",
      "Detectar huecos y sobrecargas.",
      "Conectar horas con facturaciÃ³n y margen.",
    ],
    planificacion_recursos: [
      "Visualizar capacidad, carga y disponibilidad.",
      "Detectar cuellos de botella.",
      "Cruzar planificaciÃ³n con prioridades comerciales.",
    ],
    facturacion: [
      "Separar emitido, cobrado, vencido y pendiente.",
      "Conectar facturas con presupuestos y proyectos.",
      "Controlar vencimientos y seguimiento de cobro.",
    ],
    finanzas: [
      "Ordenar ingresos, gastos y tesorerÃ­a.",
      "Separar visiÃ³n diaria y mensual.",
      "AÃ±adir previsiÃ³n bÃ¡sica de caja.",
    ],
    rrhh: [
      "Ordenar empleados, ausencias y documentaciÃ³n.",
      "Separar datos maestros y operativa diaria.",
      "AÃ±adir alertas de vencimientos documentales.",
    ],
    documentos: [
      "Clasificar por cliente, proyecto o proceso.",
      "Evitar archivos huÃ©rfanos.",
      "Mejorar bÃºsqueda y contexto documental.",
    ],
    ajustes: [
      "Centralizar configuraciÃ³n operativa.",
      "Separar parÃ¡metros generales y sectoriales.",
      "Documentar impactos de cada cambio.",
    ],
    asistente: [
      "Usar el asistente para priorizar la siguiente evoluciÃ³n.",
      "Conectar prompts con mÃ³dulos reales.",
      "Mantener coherencia con el cliente activo.",
    ],
  };

  const extraByBusinessType: Record<string, Partial<Record<string, string[]>>> = {
    "clinica-dental": {
      clientes: [
        "Distinguir paciente, tutor y aseguradora si aplica.",
        "AÃ±adir histÃ³rico clÃ­nico resumido y consentimiento.",
      ],
      facturacion: [
        "Relacionar tratamiento, presupuesto y cobro.",
        "Controlar pagos parciales y financiaciÃ³n.",
      ],
      documentos: [
        "Separar consentimientos, presupuestos y documentaciÃ³n clÃ­nica.",
        "Agrupar documentos por paciente y tratamiento.",
      ],
    },
    "software-factory": {
      crm: [
        "Separar lead, oportunidad y propuesta activa.",
        "Medir tasa de conversiÃ³n por origen comercial.",
      ],
      proyectos: [
        "Separar discovery, delivery y soporte.",
        "Medir avance real frente a presupuesto vendido.",
      ],
      timesheets: [
        "Obligar imputaciÃ³n por proyecto y tipo de trabajo.",
        "Cruzar horas con rentabilidad y capacidad.",
      ],
      planificacion_recursos: [
        "Distinguir capacidad disponible y comprometida.",
        "Detectar sobreasignaciÃ³n por perfil.",
      ],
    },
  };

  const base = generic[moduleKey] || [
    "Definir mejor objetivos y campos clave.",
    "Mejorar relaciÃ³n con el resto del ERP.",
    "AÃ±adir mÃ©tricas operativas Ãºtiles.",
  ];

  const extra =
    extraByBusinessType[config.businessType]?.[moduleKey] || [];

  return [...base, ...extra];
}

export function getModuleFocusSummary(
  moduleKey: string,
  config: RuntimeProntaraConfig
): string {
  const summaries: Record<string, string> = {
    clientes: "Este mÃ³dulo debe consolidar la visiÃ³n principal de las relaciones del negocio.",
    crm: "Este mÃ³dulo debe ordenar la actividad comercial y el seguimiento de oportunidades.",
    presupuestos: "Este mÃ³dulo debe convertir propuestas en operaciones trazables.",
    proyectos: "Este mÃ³dulo debe ordenar ejecuciÃ³n, avance y entregables.",
    timesheets: "Este mÃ³dulo debe convertir tiempo en control operativo y rentabilidad.",
    planificacion_recursos: "Este mÃ³dulo debe dar visibilidad de capacidad y carga real.",
    facturacion: "Este mÃ³dulo debe conectar operaciÃ³n, emisiÃ³n y cobro.",
    finanzas: "Este mÃ³dulo debe sintetizar la salud econÃ³mica diaria del negocio.",
    rrhh: "Este mÃ³dulo debe ordenar la capa de personas y cumplimiento interno.",
    documentos: "Este mÃ³dulo debe dar soporte documental al resto del ERP.",
    ajustes: "Este mÃ³dulo debe centralizar configuraciÃ³n sin complicar la operativa.",
    asistente: "Este mÃ³dulo debe ayudar a decidir y evolucionar el ERP activo.",
  };

  const base = summaries[moduleKey] || "Este mÃ³dulo debe reforzar la operativa principal del cliente activo.";
  return base + " " + getBusinessTypeSummary(config);
}