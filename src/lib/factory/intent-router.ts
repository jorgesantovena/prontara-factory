export type FactoryIntent =
  | "new"
  | "update"
  | "generate"
  | "status"
  | "current"
  | "clients"
  | "use"
  | "unknown";

export type FactoryTarget =
  | "erp"
  | "website"
  | "unknown";

export type IntentResult = {
  intent: FactoryIntent;
  target: FactoryTarget;
  confidence: number;
  reason: string;
};

function looksLikeWebsiteRequest(text: string) {
  return (
    text.includes("landing") ||
    text.includes("página web") ||
    text.includes("pagina web") ||
    text.includes("sitio web") ||
    text.includes("web corporativa") ||
    text.includes("web comercial") ||
    text.includes("haz una web") ||
    text.includes("crea una web") ||
    text.includes("quiero una web") ||
    text.includes("crear una web")
  );
}

export function resolveFactoryIntent(prompt: string): IntentResult {
  const text = prompt.trim().toLowerCase();

  if (!text) {
    return {
      intent: "unknown",
      target: "unknown",
      confidence: 0,
      reason: "Prompt vacío",
    };
  }

  if (looksLikeWebsiteRequest(text)) {
    return {
      intent: "new",
      target: "website",
      confidence: 0.98,
      reason: "Solicitud de web detectada",
    };
  }

  if (text === "clientes") {
    return {
      intent: "clients",
      target: "erp",
      confidence: 0.99,
      reason: "Listado de clientes",
    };
  }

  if (text === "cliente activo") {
    return {
      intent: "current",
      target: "erp",
      confidence: 0.99,
      reason: "Consulta de cliente activo",
    };
  }

  if (text.includes("status del cliente activo") || text.includes("estado del cliente activo")) {
    return {
      intent: "status",
      target: "erp",
      confidence: 0.98,
      reason: "Consulta de estado del cliente activo",
    };
  }

  if (text.includes("regenera")) {
    return {
      intent: "generate",
      target: "erp",
      confidence: 0.98,
      reason: "Petición de regeneración",
    };
  }

  if (text.startsWith("usa ") || text.startsWith("use ")) {
    return {
      intent: "use",
      target: "erp",
      confidence: 0.95,
      reason: "Cambio de cliente activo",
    };
  }

  if (
    text.startsWith("añade ") ||
    text.startsWith("anade ") ||
    text.startsWith("quita ") ||
    text.startsWith("cambia ") ||
    text.startsWith("renombra ") ||
    text.startsWith("update ")
  ) {
    return {
      intent: "update",
      target: "erp",
      confidence: 0.92,
      reason: "Cambio sobre ERP existente",
    };
  }

  if (
    text.startsWith("crea ") ||
    text.startsWith("haz ") ||
    text.startsWith("desarrolla ") ||
    text.startsWith("monta ") ||
    text.startsWith("quiero ")
  ) {
    return {
      intent: "new",
      target: "erp",
      confidence: 0.95,
      reason: "Alta de nuevo ERP",
    };
  }

  return {
    intent: "new",
    target: "erp",
    confidence: 0.55,
    reason: "Fallback conservador a alta nueva",
  };
}
