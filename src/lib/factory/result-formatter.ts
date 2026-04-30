export type FactoryResponsePayload = {
  ok?: boolean;
  action?: string;
  clientId?: string;
  output?: string;
  error?: string;
  summary?: string;
  details?: {
    displayName?: string;
    sector?: string;
    businessType?: string;
    modules?: string[];
    installerName?: string;
    downloadUrl?: string;
  };
};

function normalizeText(value: string) {
  return value.replace(/\r\n/g, "\n").trim();
}

function cleanupBrokenAccents(text: string) {
  return text
    .replace(/M�dulos/g, "Módulos")
    .replace(/Versi�n/g, "Versión")
    .replace(/gesti�n/g, "gestión")
    .replace(/facturaci�n/g, "facturación")
    .replace(/Peluquer�a/g, "Peluquería")
    .replace(/Cl�nica/g, "Clínica")
    .replace(/aqu�/g, "aquí")
    .replace(/tambi�n/g, "también")
    .replace(/acci�n/g, "acción");
}

function stripTrailingRawJson(text: string) {
  const normalized = normalizeText(text);

  const firstBraceAtLineStart = normalized.search(/\n\{/);
  if (firstBraceAtLineStart >= 0) {
    return normalized.slice(0, firstBraceAtLineStart).trim();
  }

  const firstQuotedOk = normalized.search(/\n"ok":/);
  if (firstQuotedOk >= 0) {
    return normalized.slice(0, firstQuotedOk).trim();
  }

  const firstBraceAnywhere = normalized.indexOf("{");
  if (firstBraceAnywhere >= 0) {
    return normalized.slice(0, firstBraceAnywhere).trim();
  }

  return normalized;
}

function stripTechnicalLines(text: string) {
  return normalizeText(text)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => {
      const lower = line.toLowerCase();

      if (lower === "{") return false;
      if (lower === "}") return false;
      if (lower.startsWith('"ok":')) return false;
      if (lower.startsWith('"action":')) return false;
      if (lower.startsWith('"clientid":')) return false;
      if (lower.startsWith('"output":')) return false;
      if (lower.startsWith('"details":')) return false;

      if (lower.startsWith("archivo:")) return false;
      if (lower.startsWith("dashboard:")) return false;
      if (lower.startsWith("config:")) return false;
      if (lower.startsWith("datos:")) return false;

      if (lower.includes(".json")) return false;
      if (lower.includes("src/app/")) return false;
      if (lower.includes("src/lib/")) return false;

      return true;
    })
    .join("\n");
}

function cleanupOutput(text: string) {
  const withoutJson = stripTrailingRawJson(text);
  const fixed = cleanupBrokenAccents(withoutJson);
  return stripTechnicalLines(fixed);
}

export function formatFactoryResult(payload: FactoryResponsePayload) {
  if (payload.ok === false) {
    return {
      title: "Error",
      text: normalizeText(payload.error || payload.output || "Ha ocurrido un error."),
      downloadUrl: undefined,
      downloadLabel: undefined,
    };
  }

  if (payload.summary || payload.details) {
    const blocks: string[] = [];

    if (payload.summary) {
      blocks.push(payload.summary);
    }

    if (payload.details) {
      if (payload.details.displayName) {
        blocks.push(`Cliente: ${payload.details.displayName}`);
      }
      if (payload.clientId) {
        blocks.push(`ID: ${payload.clientId}`);
      }
      if (payload.details.sector) {
        blocks.push(`Sector: ${payload.details.sector}`);
      }
      if (payload.details.businessType) {
        blocks.push(`Tipo de negocio: ${payload.details.businessType}`);
      }
      if (payload.details.modules && payload.details.modules.length > 0) {
        blocks.push(`Módulos: ${payload.details.modules.join(", ")}`);
      }
      if (payload.details.installerName) {
        blocks.push(`Instalable: ${payload.details.installerName}`);
      }
    }

    return {
      title:
        payload.action === "new"
          ? "ERP creado"
          : payload.action === "update"
          ? "Cambio aplicado"
          : payload.action === "generate"
          ? "Cliente regenerado"
          : payload.action === "status"
          ? "Status del cliente"
          : "Resultado",
      text: blocks.join("\n"),
      downloadUrl: payload.details?.downloadUrl,
      downloadLabel: payload.details?.installerName || "Descargar instalable",
    };
  }

  const clean = cleanupOutput(payload.output || "");

  return {
    title:
      payload.action === "new"
        ? "ERP creado"
        : payload.action === "update"
        ? "Cambio aplicado"
        : payload.action === "generate"
        ? "Cliente regenerado"
        : payload.action === "status"
        ? "Status del cliente"
        : payload.action === "clients"
        ? "Listado de clientes"
        : payload.action === "current"
        ? "Cliente activo"
        : "Resultado",
    text: clean || "Acción completada.",
    downloadUrl: undefined,
    downloadLabel: undefined,
  };
}
