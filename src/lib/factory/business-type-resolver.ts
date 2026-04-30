export type BusinessResolution = {
  businessType: string;
  sector: string;
  modules: string[];
  confidence: number;
  reason: string;
};

export function resolveBusinessType(prompt: string): BusinessResolution {
  const text = prompt.trim().toLowerCase();

  if (
    text.includes("clínica dental") ||
    text.includes("clinica dental") ||
    text.includes("dentista") ||
    text.includes("dental")
  ) {
    return {
      businessType: "clinica-dental",
      sector: "salud",
      modules: ["clientes", "citas", "documentos", "facturacion", "ajustes"],
      confidence: 0.98,
      reason: "Negocio dental detectado",
    };
  }

  if (
    text.includes("gimnasio") ||
    text.includes("gym") ||
    text.includes("centro deportivo")
  ) {
    return {
      businessType: "gimnasio",
      sector: "fitness",
      modules: ["clientes", "ventas", "facturacion", "documentos", "ajustes"],
      confidence: 0.97,
      reason: "Gimnasio detectado",
    };
  }

  if (
    text.includes("peluquería") ||
    text.includes("peluqueria") ||
    text.includes("salón de belleza") ||
    text.includes("salon de belleza") ||
    text.includes("barbería") ||
    text.includes("barberia")
  ) {
    return {
      businessType: "peluqueria",
      sector: "belleza",
      modules: ["clientes", "ventas", "facturacion", "documentos", "ajustes"],
      confidence: 0.97,
      reason: "Peluquería detectada",
    };
  }

  if (
    text.includes("software factory") ||
    text.includes("software-factory") ||
    text.includes("fábrica de software") ||
    text.includes("fabrica de software")
  ) {
    return {
      businessType: "software-factory",
      sector: "tecnologia",
      modules: [
        "clientes",
        "crm",
        "presupuestos",
        "proyectos",
        "timesheets",
        "planificacion_recursos",
        "facturacion",
        "finanzas",
        "rrhh",
        "documentos",
        "ajustes",
      ],
      confidence: 0.99,
      reason: "Software factory detectada",
    };
  }

  return {
    businessType: "general",
    sector: "estandar",
    modules: ["clientes", "ventas", "facturacion", "documentos", "ajustes"],
    confidence: 0.55,
    reason: "Sin coincidencia específica",
  };
}
