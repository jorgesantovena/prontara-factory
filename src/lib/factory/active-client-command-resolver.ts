import { getRuntimeProntaraConfig } from "@/lib/factory/active-client-runtime";

export type ActiveClientIntent =
  | "active-client-status"
  | "regenerate-active-client"
  | "add-module"
  | "remove-module"
  | "update-branding"
  | "rebuild-installer"
  | "unknown";

export type ResolvedActiveClientCommand = {
  matched: boolean;
  intent: ActiveClientIntent;
  prompt: string;
  originalPrompt: string;
  activeClientId: string | null;
  displayName: string | null;
  moduleName?: string | null;
  brandingInstruction?: string | null;
};

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function includesAny(text: string, values: string[]) {
  return values.some((value) => text.includes(value));
}

function cleanupModuleCandidate(value: string) {
  return value
    .replace(/\bal cliente activo\b.*$/i, "")
    .replace(/\bdel cliente activo\b.*$/i, "")
    .replace(/\bpara el cliente activo\b.*$/i, "")
    .replace(/\bpara cliente activo\b.*$/i, "")
    .replace(/[.,;:!?]+$/g, "")
    .trim();
}

function extractModuleNameFromAdd(normalizedPrompt: string) {
  const patterns = [
    /anade un modulo de (.+?)(?:\sal cliente activo|\sdel cliente activo|\spara el cliente activo|[.,;:]|$)/,
    /anade un modulo (.+?)(?:\sal cliente activo|\sdel cliente activo|\spara el cliente activo|[.,;:]|$)/,
    /anade el modulo de (.+?)(?:\sal cliente activo|\sdel cliente activo|\spara el cliente activo|[.,;:]|$)/,
    /anade el modulo (.+?)(?:\sal cliente activo|\sdel cliente activo|\spara el cliente activo|[.,;:]|$)/,
    /agrega un modulo de (.+?)(?:\sal cliente activo|\sdel cliente activo|\spara el cliente activo|[.,;:]|$)/,
    /agrega un modulo (.+?)(?:\sal cliente activo|\sdel cliente activo|\spara el cliente activo|[.,;:]|$)/,
    /agrega el modulo de (.+?)(?:\sal cliente activo|\sdel cliente activo|\spara el cliente activo|[.,;:]|$)/,
    /agrega el modulo (.+?)(?:\sal cliente activo|\sdel cliente activo|\spara el cliente activo|[.,;:]|$)/,
  ];

  for (const pattern of patterns) {
    const match = normalizedPrompt.match(pattern);
    if (match?.[1]) {
      const cleaned = cleanupModuleCandidate(match[1]);
      if (cleaned) {
        return cleaned;
      }
    }
  }

  return null;
}

function extractModuleNameFromRemove(normalizedPrompt: string) {
  const patterns = [
    /quita el modulo (.+?)(?:\sal cliente activo|\sdel cliente activo|\spara el cliente activo|[.,;:]|$)/,
    /quita modulo (.+?)(?:\sal cliente activo|\sdel cliente activo|\spara el cliente activo|[.,;:]|$)/,
    /elimina el modulo (.+?)(?:\sal cliente activo|\sdel cliente activo|\spara el cliente activo|[.,;:]|$)/,
    /elimina modulo (.+?)(?:\sal cliente activo|\sdel cliente activo|\spara el cliente activo|[.,;:]|$)/,
    /borra el modulo (.+?)(?:\sal cliente activo|\sdel cliente activo|\spara el cliente activo|[.,;:]|$)/,
    /borra modulo (.+?)(?:\sal cliente activo|\sdel cliente activo|\spara el cliente activo|[.,;:]|$)/,
  ];

  for (const pattern of patterns) {
    const match = normalizedPrompt.match(pattern);
    if (match?.[1]) {
      const cleaned = cleanupModuleCandidate(match[1]);
      if (cleaned) {
        return cleaned;
      }
    }
  }

  return null;
}

function extractBrandingInstruction(originalPrompt: string) {
  const lower = normalizeText(originalPrompt);

  const starts = [
    "cambia el branding del cliente activo a ",
    "cambia el branding del cliente activo ",
    "actualiza el branding del cliente activo a ",
    "actualiza el branding del cliente activo ",
    "mejora el branding del cliente activo a ",
    "mejora el branding del cliente activo ",
  ];

  for (const start of starts) {
    const idx = lower.indexOf(start);
    if (idx >= 0) {
      const originalSlice = originalPrompt.slice(idx + start.length);
      return originalSlice.trim().replace(/\.$/, "");
    }
  }

  return null;
}

export function resolveActiveClientCommand(
  originalPrompt: string
): ResolvedActiveClientCommand {
  const prompt = originalPrompt.trim();
  const normalizedPrompt = normalizeText(prompt);

  const runtimeConfig = getRuntimeProntaraConfig();
  const activeClientId = runtimeConfig?.clientId || null;
  const displayName = runtimeConfig?.displayName || null;

  const mentionsActiveClient = includesAny(normalizedPrompt, [
    "cliente activo",
    "erp activo",
    "actual activo",
  ]);

  if (!mentionsActiveClient) {
    return {
      matched: false,
      intent: "unknown",
      prompt,
      originalPrompt,
      activeClientId,
      displayName,
    };
  }

  if (
    includesAny(normalizedPrompt, [
      "status del cliente activo",
      "estado del cliente activo",
      "resumen del cliente activo",
      "situacion del cliente activo",
    ])
  ) {
    return {
      matched: true,
      intent: "active-client-status",
      originalPrompt,
      prompt:
        "Dame el estado actual del cliente activo " +
        "(" +
        (activeClientId || "sin-id") +
        ") " +
        "incluyendo displayName, sector, businessType, módulos y siguiente mejora recomendada.",
      activeClientId,
      displayName,
    };
  }

  if (
    includesAny(normalizedPrompt, [
      "regenera el cliente activo",
      "regenerar el cliente activo",
      "reconstruye el cliente activo",
    ])
  ) {
    return {
      matched: true,
      intent: "regenerate-active-client",
      originalPrompt,
      prompt:
        "Regenera el cliente activo con clientId " +
        (activeClientId || "") +
        " manteniendo su configuración actual.",
      activeClientId,
      displayName,
    };
  }

  if (
    includesAny(normalizedPrompt, [
      "regenera el instalable del cliente activo",
      "regenerar el instalable del cliente activo",
      "genera el instalable del cliente activo",
      "rebuild installer del cliente activo",
    ])
  ) {
    return {
      matched: true,
      intent: "rebuild-installer",
      originalPrompt,
      prompt:
        "Regenera el instalable del cliente activo con clientId " +
        (activeClientId || "") +
        " manteniendo su configuración actual.",
      activeClientId,
      displayName,
    };
  }

  const moduleToAdd = extractModuleNameFromAdd(normalizedPrompt);
  if (moduleToAdd) {
    return {
      matched: true,
      intent: "add-module",
      originalPrompt,
      prompt:
        "Añade el módulo '" +
        moduleToAdd +
        "' al cliente activo con clientId " +
        (activeClientId || "") +
        ", conservando el resto de módulos y la configuración actual.",
      activeClientId,
      displayName,
      moduleName: moduleToAdd,
    };
  }

  const moduleToRemove = extractModuleNameFromRemove(normalizedPrompt);
  if (moduleToRemove) {
    return {
      matched: true,
      intent: "remove-module",
      originalPrompt,
      prompt:
        "Quita el módulo '" +
        moduleToRemove +
        "' del cliente activo con clientId " +
        (activeClientId || "") +
        ", conservando el resto de módulos y la configuración actual.",
      activeClientId,
      displayName,
      moduleName: moduleToRemove,
    };
  }

  const brandingInstruction = extractBrandingInstruction(originalPrompt);
  if (
    brandingInstruction ||
    includesAny(normalizedPrompt, [
      "cambia el branding del cliente activo",
      "actualiza el branding del cliente activo",
      "mejora el branding del cliente activo",
    ])
  ) {
    const finalBrandingInstruction =
      brandingInstruction ||
      "hazlo más claro, profesional y coherente con el negocio";

    return {
      matched: true,
      intent: "update-branding",
      originalPrompt,
      prompt:
        "Actualiza el branding del cliente activo con clientId " +
        (activeClientId || "") +
        " siguiendo esta instrucción: " +
        finalBrandingInstruction +
        ". Mantén la coherencia con su sector y businessType.",
      activeClientId,
      displayName,
      brandingInstruction: finalBrandingInstruction,
    };
  }

  return {
    matched: true,
    intent: "unknown",
    originalPrompt,
    prompt,
    activeClientId,
    displayName,
  };
}