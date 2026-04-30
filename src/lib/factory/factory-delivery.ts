import fs from "node:fs";
import path from "node:path";
import { listTenantClientsIndex } from "@/lib/saas/tenant-clients-index";

export type FactoryDeliveryState = "ready" | "partial" | "missing" | "error";
export type FactoryOnboardingState = "ready" | "partial" | "missing";

export type FactoryDeliveryValidationCheck = {
  key: string;
  label: string;
  passed: boolean;
  detail: string;
};

export type FactoryDeliveryRow = {
  clientId: string;
  tenantId: string;
  slug: string;
  displayName: string;
  accessUrl: string;
  loginUrl: string;
  firstUseUrl: string;
  deliveryUrl: string;
  openUrl: string;
  onboardingState: FactoryOnboardingState;
  wrapper: {
    appName: string;
    installableName: string;
    executableName: string;
    windowTitle: string;
    desktopCaption: string;
    iconHint: string;
    deliveryMode: string;
  };
  branding: {
    displayName: string;
    shortName: string;
    accentColor: string;
    tone: string;
    logoHint: string;
  };
  demoValidation: {
    passed: number;
    total: number;
    checks: FactoryDeliveryValidationCheck[];
  };
  deliveryState: FactoryDeliveryState;
  updatedAt: string | null;
};

export type FactoryDeliverySnapshot = {
  generatedAt: string;
  summary: {
    total: number;
    ready: number;
    partial: number;
    missing: number;
    error: number;
    onboardingReady: number;
    onboardingPartial: number;
    onboardingMissing: number;
    demoValidated: number;
    wrappersReady: number;
  };
  rows: FactoryDeliveryRow[];
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

function latestValue(values: Array<string | null | undefined>): string | null {
  const cleaned = values
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .sort()
    .reverse();

  return cleaned[0] || null;
}

function readBranding(clientId: string, fallbackDisplayName: string) {
  const brandingJson = safeReadJson<Record<string, unknown> | null>(
    getRootPath(".prontara", "clients", clientId, "branding.json"),
    null
  );

  const runtimeJson = safeReadJson<Record<string, unknown> | null>(
    getRootPath("data", "saas", "tenant-runtime-config", clientId + ".json"),
    null
  );

  const runtimeConfig = (runtimeJson?.config || runtimeJson || {}) as Record<string, unknown>;
  const runtimeBranding = (runtimeConfig.branding || runtimeJson?.branding || {}) as Record<string, unknown>;

  return {
    displayName: String(
      brandingJson?.displayName ||
      runtimeBranding.displayName ||
      fallbackDisplayName
    ).trim() || fallbackDisplayName,
    shortName: String(
      brandingJson?.shortName ||
      runtimeBranding.shortName ||
      "PR"
    ).trim() || "PR",
    accentColor: String(
      brandingJson?.accentColor ||
      runtimeBranding.accentColor ||
      "#111827"
    ).trim() || "#111827",
    tone: String(
      brandingJson?.tone ||
      runtimeBranding.tone ||
      "professional"
    ).trim() || "professional",
    logoHint: String(
      brandingJson?.logoHint ||
      runtimeBranding.logoHint ||
      ""
    ).trim(),
  };
}

function readWrapper(clientId: string, fallbackDisplayName: string) {
  const runtimeJson = safeReadJson<Record<string, unknown> | null>(
    getRootPath("data", "saas", "tenant-runtime-config", clientId + ".json"),
    null
  );

  const evolutionCurrent = safeReadJson<Record<string, unknown> | null>(
    getRootPath("data", "saas", "evolution", clientId, "current-runtime-config.json"),
    null
  );

  const runtimeConfig = (runtimeJson?.config || runtimeJson || {}) as Record<string, unknown>;
  const wrapper = (runtimeConfig.wrapper || runtimeJson?.wrapper || evolutionCurrent?.wrapper || {}) as Record<string, unknown>;

  return {
    appName: String(wrapper.appName || fallbackDisplayName).trim() || fallbackDisplayName,
    installableName: String(wrapper.installableName || fallbackDisplayName.replace(/\s+/g, "") + "-Setup").trim(),
    executableName: String(wrapper.executableName || "app.exe").trim(),
    windowTitle: String(wrapper.windowTitle || fallbackDisplayName).trim(),
    desktopCaption: String(wrapper.desktopCaption || fallbackDisplayName + " Desktop").trim(),
    iconHint: String(wrapper.iconHint || "").trim(),
    deliveryMode: String(wrapper.deliveryMode || "desktop-wrapper").trim(),
  };
}

function readDeliveryArtifacts(clientId: string) {
  const activationPackage = safeReadJson<Record<string, unknown> | null>(
    getRootPath("data", "saas", "activation-package", clientId + ".json"),
    null
  );

  const activationEmail = safeReadJson<Record<string, unknown> | null>(
    getRootPath("data", "saas", "activation-email", clientId + ".json"),
    null
  );

  return {
    activationPackage,
    activationEmail,
  };
}

function getDeliveryState(clientId: string): {
  state: FactoryDeliveryState;
  updatedAt: string | null;
  activationPackage: Record<string, unknown> | null;
  activationEmail: Record<string, unknown> | null;
} {
  const { activationPackage, activationEmail } = readDeliveryArtifacts(clientId);

  const hasPackage = Boolean(activationPackage);
  const hasEmail = Boolean(activationEmail);
  const hasAccess = Boolean(activationPackage?.accessUrl || activationPackage?.loginUrl);
  const hasSent = Boolean(activationEmail?.sentAt || activationEmail?.sent === true);
  const hasError = Boolean(activationEmail?.error || activationPackage?.error);

  let state: FactoryDeliveryState = "missing";

  if (hasError) {
    state = "error";
  } else if (hasPackage && hasEmail && hasAccess && hasSent) {
    state = "ready";
  } else if (hasPackage || hasEmail || hasAccess) {
    state = "partial";
  }

  return {
    state,
    updatedAt: latestValue([
      String(activationPackage?.updatedAt || ""),
      String(activationEmail?.updatedAt || ""),
      String(activationEmail?.sentAt || ""),
    ]),
    activationPackage,
    activationEmail,
  };
}

function getOnboardingState(clientId: string): FactoryOnboardingState {
  const onboarding = safeReadJson<Record<string, unknown> | null>(
    getRootPath("data", "saas", "onboarding", clientId + ".json"),
    null
  );

  const onboardingStatus = String(onboarding?.status || "").trim().toLowerCase();
  const hasSteps = Array.isArray(onboarding?.steps) && (onboarding?.steps as Array<unknown>).length > 0;
  const completed = Boolean(onboarding?.completed || onboardingStatus === "completed" || onboardingStatus === "ready");

  if (completed) {
    return "ready";
  }

  if (onboarding || hasSteps) {
    return "partial";
  }

  return "missing";
}

function getDemoValidation(clientId: string, slug: string): {
  passed: number;
  total: number;
  checks: FactoryDeliveryValidationCheck[];
} {
  const validation = safeReadJson<Record<string, unknown> | null>(
    getRootPath("data", "saas", "commercial-validation", clientId + ".json"),
    null
  );

  const checksFromFile =
    Array.isArray(validation?.checks)
      ? (validation?.checks as Array<Record<string, unknown>>).map((item, index) => ({
          key: String(item.key || "check-" + index),
          label: String(item.label || "Check"),
          passed: Boolean(item.passed),
          detail: String(item.detail || ""),
        }))
      : [];

  if (checksFromFile.length > 0) {
    return {
      passed: checksFromFile.filter((item) => item.passed).length,
      total: checksFromFile.length,
      checks: checksFromFile,
    };
  }

  const runtimeExists = fs.existsSync(getRootPath("data", "saas", "tenant-runtime-config", clientId + ".json"));
  const packageExists = fs.existsSync(getRootPath("data", "saas", "activation-package", clientId + ".json"));
  const accessResolved = String(slug || "").trim().length > 0;

  const checks: FactoryDeliveryValidationCheck[] = [
    {
      key: "runtime",
      label: "Runtime disponible",
      passed: runtimeExists,
      detail: runtimeExists ? "Existe runtime configurado." : "No existe runtime configurado.",
    },
    {
      key: "delivery",
      label: "Entrega preparada",
      passed: packageExists,
      detail: packageExists ? "Existe paquete de activación." : "No existe paquete de activación.",
    },
    {
      key: "access",
      label: "Acceso resoluble",
      passed: accessResolved,
      detail: accessResolved ? "El slug y la URL de acceso están resueltos." : "No se ha resuelto la URL de acceso.",
    },
  ];

  return {
    passed: checks.filter((item) => item.passed).length,
    total: checks.length,
    checks,
  };
}

export function getFactoryDeliverySnapshot(): FactoryDeliverySnapshot {
  const baseUrl = getBaseUrl();
  const clients = listTenantClientsIndex();

  const rows: FactoryDeliveryRow[] = clients.map((client) => {
    const branding = readBranding(client.clientId, client.displayName);
    const wrapper = readWrapper(client.clientId, branding.displayName);
    const delivery = getDeliveryState(client.clientId);
    const onboardingState = getOnboardingState(client.clientId);
    const demoValidation = getDemoValidation(client.clientId, client.slug);

    return {
      clientId: client.clientId,
      tenantId: client.tenantId,
      slug: client.slug,
      displayName: client.displayName,
      accessUrl: baseUrl + "/acceso?tenant=" + encodeURIComponent(client.slug),
      loginUrl: baseUrl + "/acceso?tenant=" + encodeURIComponent(client.slug),
      firstUseUrl: baseUrl + "/primer-acceso?tenant=" + encodeURIComponent(client.slug),
      deliveryUrl: baseUrl + "/entrega?tenant=" + encodeURIComponent(client.slug),
      openUrl: baseUrl + "/?tenant=" + encodeURIComponent(client.slug),
      onboardingState,
      wrapper,
      branding,
      demoValidation,
      deliveryState: delivery.state,
      updatedAt: latestValue([
        client.lastUpdatedAt,
        delivery.updatedAt,
      ]),
    };
  }).sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      total: rows.length,
      ready: rows.filter((row) => row.deliveryState === "ready").length,
      partial: rows.filter((row) => row.deliveryState === "partial").length,
      missing: rows.filter((row) => row.deliveryState === "missing").length,
      error: rows.filter((row) => row.deliveryState === "error").length,
      onboardingReady: rows.filter((row) => row.onboardingState === "ready").length,
      onboardingPartial: rows.filter((row) => row.onboardingState === "partial").length,
      onboardingMissing: rows.filter((row) => row.onboardingState === "missing").length,
      demoValidated: rows.filter((row) => row.demoValidation.passed === row.demoValidation.total && row.demoValidation.total > 0).length,
      wrappersReady: rows.filter((row) => String(row.wrapper.installableName || "").trim().length > 0).length,
    },
    rows,
  };
}