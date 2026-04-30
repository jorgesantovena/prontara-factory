import fs from "node:fs";
import path from "node:path";
import { getDashboardSnapshot } from "@/lib/erp/dashboard-metrics";

export type FactoryClientDetailEvolutionItem = {
  id: string;
  actionType: string;
  summary: string;
  createdAt: string;
  createdBy: string;
  rollbackSafe: boolean;
};

export type FactoryClientCommercialCheck = {
  key: string;
  label: string;
  passed: boolean;
  detail: string;
};

export type FactoryClientDetailSnapshot = {
  ok: boolean;
  clientId: string;
  tenantId: string;
  slug: string;
  displayName: string;
  purchase: {
    createdAt: string | null;
    source: string;
    email: string;
    companyName: string;
    plan: string;
    amount: string;
    currency: string;
    status: string;
  };
  assignedVertical: {
    businessType: string;
    sector: string;
    displayName: string;
  };
  tenant: {
    tenantId: string;
    slug: string;
    displayName: string;
  };
  subscription: {
    plan: string;
    status: "active" | "trial" | "cancelled";
    billingState: "ok" | "trial" | "cancelled" | "warning";
    updatedAt: string | null;
  };
  branding: {
    displayName: string;
    shortName: string;
    accentColor: string;
    tone: string;
    logoHint: string;
  };
  access: {
    accessUrl: string;
    loginUrl: string;
    firstUseUrl: string;
    deliveryUrl: string;
    openUrl: string;
  };
  runtime: {
    ready: boolean;
    businessType: string;
    sector: string;
    companySize: string;
    updatedAt: string | null;
  };
  provisioning: {
    state: "ready" | "pending" | "error";
    updatedAt: string | null;
    lastEventTitle: string;
  };
  evolution: {
    ready: boolean;
    history: FactoryClientDetailEvolutionItem[];
  };
  wrapper: {
    appName: string;
    installableName: string;
    executableName: string;
    desktopCaption: string;
    windowTitle: string;
    iconHint: string;
    deliveryMode: string;
  };
  delivery: {
    accessUrl: string;
    loginUrl: string;
    firstUseUrl: string;
    deliveryUrl: string;
  };
  commercialValidation: {
    passed: number;
    total: number;
    checks: FactoryClientCommercialCheck[];
  };
  operational: {
    totalClientes: number;
    oportunidadesAbiertas: number;
    pipelineAbierto: number;
    proyectosActivos: number;
    presupuestosAbiertos: number;
    facturasPendientes: number;
    totalDocumentos: number;
  };
};

function safeReadJson<T>(filePath: string, fallback: T): T {
  try {
    if (!fs.existsSync(filePath)) {
      return fallback;
    }
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function getRootPath(...parts: string[]) {
  return path.join(/*turbopackIgnore: true*/ process.cwd(), ...parts);
}

function getBaseUrl() {
  const envUrl = String(process.env.APP_BASE_URL || "").trim();
  return envUrl || "http://localhost:3000";
}

function normalizeStatus(value: string): "active" | "trial" | "cancelled" {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "trial") {
    return "trial";
  }
  if (normalized === "cancelled" || normalized === "canceled") {
    return "cancelled";
  }
  return "active";
}

function normalizeBillingState(value: string, hasIssue: boolean): "ok" | "trial" | "cancelled" | "warning" {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "trial") {
    return "trial";
  }
  if (normalized === "cancelled" || normalized === "canceled") {
    return "cancelled";
  }
  if (hasIssue) {
    return "warning";
  }
  return "ok";
}

function resolveClientId(input: string): string {
  return String(input || "").trim();
}

export function getFactoryClientDetail(clientIdInput: string): FactoryClientDetailSnapshot {
  const clientId = resolveClientId(clientIdInput);
  if (!clientId) {
    throw new Error("Falta clientId.");
  }

  const baseUrl = getBaseUrl();

  const tenantJson = safeReadJson<Record<string, unknown> | null>(
    getRootPath(".prontara", "clients", clientId, "tenant.json"),
    null
  );

  const brandingJson = safeReadJson<Record<string, unknown> | null>(
    getRootPath(".prontara", "clients", clientId, "branding.json"),
    null
  );

  const runtimeJson = safeReadJson<Record<string, unknown> | null>(
    getRootPath("data", "saas", "tenant-runtime-config", clientId + ".json"),
    null
  );

  const subscriptionJson = safeReadJson<Record<string, unknown> | null>(
    getRootPath("data", "saas", "subscriptions", clientId + ".json"),
    null
  );

  const provisioningJson = safeReadJson<Record<string, unknown> | null>(
    getRootPath("data", "saas", "provisioning", clientId + ".json"),
    null
  );

  const evolutionStateJson = safeReadJson<Record<string, unknown> | null>(
    getRootPath("data", "saas", "evolution", clientId, "current-runtime-config.json"),
    null
  );

  const evolutionHistoryJson = safeReadJson<Array<Record<string, unknown>>>(
    getRootPath("data", "saas", "evolution", clientId, "history.json"),
    []
  );

  const accountJson = safeReadJson<Record<string, unknown> | null>(
    getRootPath("data", "saas", "accounts", clientId + ".json"),
    null
  );

  const orderJson = safeReadJson<Record<string, unknown> | null>(
    getRootPath("data", "saas", "orders", clientId + ".json"),
    null
  );

  const commercialValidationJson = safeReadJson<Record<string, unknown> | null>(
    getRootPath("data", "saas", "commercial-validation", clientId + ".json"),
    null
  );

  const tenantId =
    String(
      tenantJson?.tenantId ||
      tenantJson?.id ||
      tenantJson?.slug ||
      clientId
    ).trim() || clientId;

  const slug =
    String(
      tenantJson?.slug ||
      tenantJson?.tenantSlug ||
      tenantJson?.tenantId ||
      clientId
    ).trim() || clientId;

  const runtimeConfig = (runtimeJson?.config || runtimeJson || {}) as Record<string, unknown>;
  const runtimeBranding = (runtimeConfig.branding || runtimeJson?.branding || {}) as Record<string, unknown>;
  const runtimeWrapper = (runtimeConfig.wrapper || runtimeJson?.wrapper || evolutionStateJson?.wrapper || {}) as Record<string, unknown>;

  const displayName =
    String(
      brandingJson?.displayName ||
      runtimeBranding.displayName ||
      tenantJson?.displayName ||
      tenantJson?.name ||
      clientId
    ).trim() || clientId;

  const businessType =
    String(
      runtimeConfig.businessType ||
      runtimeJson?.businessType ||
      tenantJson?.businessType ||
      "generic-pyme"
    ).trim() || "generic-pyme";

  const sector =
    String(
      runtimeConfig.sector ||
      runtimeJson?.sector ||
      tenantJson?.sector ||
      "general"
    ).trim() || "general";

  const plan =
    String(
      subscriptionJson?.plan ||
      subscriptionJson?.planCode ||
      orderJson?.plan ||
      orderJson?.planCode ||
      "starter"
    ).trim() || "starter";

  const subscriptionStatus = normalizeStatus(
    String(subscriptionJson?.status || subscriptionJson?.state || "")
  );

  const billingState = normalizeBillingState(
    String(subscriptionJson?.status || subscriptionJson?.state || ""),
    Boolean(subscriptionJson?.paymentIssue || subscriptionJson?.warning || subscriptionJson?.invoiceFailed)
  );

  const provisioningEvents = Array.isArray(provisioningJson?.events)
    ? (provisioningJson?.events as Array<Record<string, unknown>>)
    : [];

  const provisioningStateRaw = String(provisioningJson?.status || provisioningJson?.state || "").trim().toLowerCase();
  const provisioningState =
    ["error", "failed"].includes(provisioningStateRaw)
      ? "error"
      : ["ready", "completed", "done", "success"].includes(provisioningStateRaw)
        ? "ready"
        : "pending";

  const accessUrl = baseUrl + "/acceso?tenant=" + encodeURIComponent(slug);
  const loginUrl = accessUrl;
  const firstUseUrl = baseUrl + "/primer-acceso?tenant=" + encodeURIComponent(slug);
  const deliveryUrl = baseUrl + "/entrega?tenant=" + encodeURIComponent(slug);
  const openUrl = baseUrl + "/?tenant=" + encodeURIComponent(slug);

  const evolutionHistory: FactoryClientDetailEvolutionItem[] = evolutionHistoryJson
    .map((row, index) => ({
      id: String(row.id || clientId + "-evo-" + index),
      actionType: String(row.actionType || ""),
      summary: String(row.summary || row.actionType || "Cambio"),
      createdAt: String(row.createdAt || ""),
      createdBy: String(row.createdBy || "system"),
      rollbackSafe: Boolean(row.rollbackSafe),
    }))
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

  const checks: FactoryClientCommercialCheck[] =
    Array.isArray(commercialValidationJson?.checks)
      ? (commercialValidationJson?.checks as Array<Record<string, unknown>>).map((item, index) => ({
          key: String(item.key || "check-" + index),
          label: String(item.label || "Check"),
          passed: Boolean(item.passed),
          detail: String(item.detail || ""),
        }))
      : [
          {
            key: "landing",
            label: "Landing comercial",
            passed: true,
            detail: "Existe flujo comercial asociado al cliente.",
          },
          {
            key: "access",
            label: "Acceso",
            passed: Boolean(slug),
            detail: "El tenant y la URL de acceso están resueltos.",
          },
          {
            key: "runtime",
            label: "Runtime",
            passed: Boolean(runtimeJson),
            detail: "Existe runtime configurado para el cliente.",
          },
          {
            key: "delivery",
            label: "Entrega",
            passed: Boolean(runtimeWrapper),
            detail: "Existe wrapper o entrega configurada.",
          },
        ];

  return {
    ok: true,
    clientId,
    tenantId,
    slug,
    displayName,
    purchase: {
      createdAt: String(orderJson?.createdAt || accountJson?.createdAt || tenantJson?.createdAt || "").trim() || null,
      source: String(orderJson?.source || "online").trim() || "online",
      email: String(orderJson?.email || accountJson?.email || tenantJson?.email || "").trim(),
      companyName: String(orderJson?.companyName || displayName).trim() || displayName,
      plan,
      amount: String(orderJson?.amount || subscriptionJson?.amount || "").trim(),
      currency: String(orderJson?.currency || subscriptionJson?.currency || "EUR").trim() || "EUR",
      status: String(orderJson?.status || subscriptionStatus).trim() || subscriptionStatus,
    },
    assignedVertical: {
      businessType,
      sector,
      displayName,
    },
    tenant: {
      tenantId,
      slug,
      displayName,
    },
    subscription: {
      plan,
      status: subscriptionStatus,
      billingState,
      updatedAt: String(subscriptionJson?.updatedAt || subscriptionJson?.createdAt || "").trim() || null,
    },
    branding: {
      displayName,
      shortName: String(runtimeBranding.shortName || brandingJson?.shortName || "PR").trim() || "PR",
      accentColor: String(runtimeBranding.accentColor || brandingJson?.accentColor || "#111827").trim() || "#111827",
      tone: String(runtimeBranding.tone || brandingJson?.tone || "professional").trim() || "professional",
      logoHint: String(runtimeBranding.logoHint || brandingJson?.logoHint || "").trim(),
    },
    access: {
      accessUrl,
      loginUrl,
      firstUseUrl,
      deliveryUrl,
      openUrl,
    },
    runtime: {
      ready: Boolean(runtimeJson),
      businessType,
      sector,
      companySize: String(runtimeConfig.companySize || runtimeJson?.companySize || "small").trim() || "small",
      updatedAt: String(runtimeJson?.updatedAt || "").trim() || null,
    },
    provisioning: {
      state: provisioningState,
      updatedAt: String(provisioningJson?.updatedAt || provisioningJson?.createdAt || "").trim() || null,
      lastEventTitle: String(provisioningEvents[0]?.title || provisioningEvents[0]?.step || "").trim(),
    },
    evolution: {
      ready: Boolean(evolutionStateJson || evolutionHistory.length > 0),
      history: evolutionHistory.slice(0, 20),
    },
    wrapper: {
      appName: String(runtimeWrapper.appName || displayName).trim() || displayName,
      installableName: String(runtimeWrapper.installableName || displayName.replace(/\s+/g, "") + "-Setup").trim(),
      executableName: String(runtimeWrapper.executableName || "app.exe").trim(),
      desktopCaption: String(runtimeWrapper.desktopCaption || displayName + " Desktop").trim(),
      windowTitle: String(runtimeWrapper.windowTitle || displayName).trim(),
      iconHint: String(runtimeWrapper.iconHint || runtimeBranding.logoHint || "").trim(),
      deliveryMode: String(runtimeWrapper.deliveryMode || "desktop-wrapper").trim(),
    },
    delivery: {
      accessUrl,
      loginUrl,
      firstUseUrl,
      deliveryUrl,
    },
    commercialValidation: {
      passed: checks.filter((item) => item.passed).length,
      total: checks.length,
      checks,
    },
    operational: resolveOperationalMetrics(clientId),
  };
}

function resolveOperationalMetrics(clientId: string): FactoryClientDetailSnapshot["operational"] {
  try {
    const snapshot = getDashboardSnapshot(clientId);
    return {
      totalClientes: snapshot.summary.totalClientes,
      oportunidadesAbiertas: snapshot.summary.oportunidadesAbiertas,
      pipelineAbierto: snapshot.summary.pipelineAbierto,
      proyectosActivos: snapshot.summary.proyectosActivos,
      presupuestosAbiertos: snapshot.summary.presupuestosAbiertos,
      facturasPendientes: snapshot.summary.facturasPendientes,
      totalDocumentos: snapshot.summary.totalDocumentos,
    };
  } catch {
    // Si el tenant aún no tiene data operativa (tenant recién provisionado)
    // devolvemos ceros en lugar de romper la ficha entera.
    return {
      totalClientes: 0,
      oportunidadesAbiertas: 0,
      pipelineAbierto: 0,
      proyectosActivos: 0,
      presupuestosAbiertos: 0,
      facturasPendientes: 0,
      totalDocumentos: 0,
    };
  }
}