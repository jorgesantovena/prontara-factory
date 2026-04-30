import fs from "node:fs";
import path from "node:path";

export type FactoryProvisioningStepState = "done" | "pending" | "error";

export type FactoryProvisioningStep = {
  key:
    | "signup_created"
    | "account_created"
    | "tenant_created"
    | "runtime_ready"
    | "email_ready"
    | "email_sent"
    | "access_ready";
  label: string;
  state: FactoryProvisioningStepState;
  detail: string;
};

export type FactoryProvisioningErrorItem = {
  id: string;
  title: string;
  detail: string;
  createdAt: string;
};

export type FactoryProvisioningRetryItem = {
  id: string;
  title: string;
  detail: string;
  createdAt: string;
};

export type FactoryProvisioningRow = {
  clientId: string;
  tenantId: string;
  slug: string;
  displayName: string;
  plan: string;
  status: "ready" | "pending" | "error";
  updatedAt: string | null;
  steps: FactoryProvisioningStep[];
  errors: FactoryProvisioningErrorItem[];
  retries: FactoryProvisioningRetryItem[];
};

export type FactoryProvisioningSnapshot = {
  generatedAt: string;
  summary: {
    total: number;
    ready: number;
    pending: number;
    error: number;
    signupCreated: number;
    accountCreated: number;
    tenantCreated: number;
    runtimeReady: number;
    emailReady: number;
    emailSent: number;
    accessReady: number;
    totalErrors: number;
    totalRetries: number;
  };
  rows: FactoryProvisioningRow[];
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

function listClientIds(): string[] {
  const clientsRoot = getRootPath(".prontara", "clients");
  if (!fs.existsSync(clientsRoot)) {
    return [];
  }

  return fs
    .readdirSync(clientsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function existsFile(filePath: string) {
  return fs.existsSync(filePath);
}

function resolveSignupJson(clientId: string) {
  return safeReadJson<Record<string, unknown> | null>(
    getRootPath("data", "saas", "signup", clientId + ".json"),
    null
  );
}

function resolveOrderJson(clientId: string) {
  return safeReadJson<Record<string, unknown> | null>(
    getRootPath("data", "saas", "orders", clientId + ".json"),
    null
  );
}

function resolveAccountJson(clientId: string) {
  return safeReadJson<Record<string, unknown> | null>(
    getRootPath("data", "saas", "accounts", clientId + ".json"),
    null
  );
}

function resolveTenantJson(clientId: string) {
  return safeReadJson<Record<string, unknown> | null>(
    getRootPath(".prontara", "clients", clientId, "tenant.json"),
    null
  );
}

function resolveRuntimeJson(clientId: string) {
  return safeReadJson<Record<string, unknown> | null>(
    getRootPath("data", "saas", "tenant-runtime-config", clientId + ".json"),
    null
  );
}

function resolveProvisioningJson(clientId: string) {
  return safeReadJson<Record<string, unknown> | null>(
    getRootPath("data", "saas", "provisioning", clientId + ".json"),
    null
  );
}

function resolveActivationPackageJson(clientId: string) {
  return safeReadJson<Record<string, unknown> | null>(
    getRootPath("data", "saas", "activation-package", clientId + ".json"),
    null
  );
}

function resolveActivationEmailJson(clientId: string) {
  return safeReadJson<Record<string, unknown> | null>(
    getRootPath("data", "saas", "activation-email", clientId + ".json"),
    null
  );
}

function resolveHealthJson(clientId: string) {
  return safeReadJson<Record<string, unknown> | null>(
    getRootPath("data", "saas", "health", clientId + ".json"),
    null
  );
}

function resolveSubscriptionJson(clientId: string) {
  return safeReadJson<Record<string, unknown> | null>(
    getRootPath("data", "saas", "subscriptions", clientId + ".json"),
    null
  );
}

function statusFromState(value: string): "ready" | "pending" | "error" {
  const normalized = String(value || "").trim().toLowerCase();
  if (["ready", "done", "completed", "success"].includes(normalized)) {
    return "ready";
  }
  if (["error", "failed"].includes(normalized)) {
    return "error";
  }
  return "pending";
}

function buildStep(
  key: FactoryProvisioningStep["key"],
  label: string,
  condition: boolean,
  errorCondition: boolean,
  detailOk: string,
  detailPending: string,
  detailError: string
): FactoryProvisioningStep {
  return {
    key,
    label,
    state: errorCondition ? "error" : condition ? "done" : "pending",
    detail: errorCondition ? detailError : condition ? detailOk : detailPending,
  };
}

function latestValue(values: Array<string | null | undefined>): string | null {
  const cleaned = values
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .sort()
    .reverse();

  return cleaned[0] || null;
}

function buildProvisioningRow(clientId: string): FactoryProvisioningRow {
  const signup = resolveSignupJson(clientId);
  const order = resolveOrderJson(clientId);
  const account = resolveAccountJson(clientId);
  const tenant = resolveTenantJson(clientId);
  const runtime = resolveRuntimeJson(clientId);
  const provisioning = resolveProvisioningJson(clientId);
  const activationPackage = resolveActivationPackageJson(clientId);
  const activationEmail = resolveActivationEmailJson(clientId);
  const health = resolveHealthJson(clientId);
  const subscription = resolveSubscriptionJson(clientId);

  const displayName =
    String(
      tenant?.displayName ||
      tenant?.name ||
      order?.companyName ||
      signup?.companyName ||
      clientId
    ).trim() || clientId;

  const tenantId =
    String(tenant?.tenantId || tenant?.id || tenant?.slug || clientId).trim() || clientId;

  const slug =
    String(tenant?.slug || tenant?.tenantSlug || tenantId).trim() || tenantId;

  const plan =
    String(subscription?.plan || subscription?.planCode || order?.plan || "starter").trim() || "starter";

  const provisioningState = statusFromState(String(provisioning?.status || provisioning?.state || ""));

  const signupCreated = Boolean(signup || order);
  const accountCreated = Boolean(account);
  const tenantCreated = Boolean(tenant);
  const runtimeReady = Boolean(runtime);
  const emailReady = Boolean(activationPackage || activationEmail);
  const emailSent = Boolean(activationEmail?.sentAt || activationEmail?.sent === true);
  const accessReady =
    Boolean(activationPackage?.accessUrl || activationPackage?.loginUrl || runtimeReady && tenantCreated && accountCreated);

  const rawErrors = [
    ...(Array.isArray(provisioning?.errors) ? (provisioning?.errors as Array<Record<string, unknown>>) : []),
    ...(Array.isArray(health?.errors) ? (health?.errors as Array<Record<string, unknown>>) : []),
  ];

  const errors: FactoryProvisioningErrorItem[] = rawErrors.map((item, index) => ({
    id: clientId + "-error-" + index,
    title: String(item.title || "Error de provisioning"),
    detail: String(item.detail || item.message || ""),
    createdAt: String(item.createdAt || item.at || provisioning?.updatedAt || health?.updatedAt || ""),
  }));

  const rawRetries =
    Array.isArray(provisioning?.retries)
      ? (provisioning?.retries as Array<Record<string, unknown>>)
      : [];

  const retries: FactoryProvisioningRetryItem[] = rawRetries.map((item, index) => ({
    id: clientId + "-retry-" + index,
    title: String(item.title || "Reintento"),
    detail: String(item.detail || item.message || ""),
    createdAt: String(item.createdAt || item.at || provisioning?.updatedAt || ""),
  }));

  const hasError = provisioningState === "error" || errors.length > 0;

  const steps: FactoryProvisioningStep[] = [
    buildStep(
      "signup_created",
      "Alta creada",
      signupCreated,
      false,
      "Existe alta o pedido inicial del cliente.",
      "Todavía no existe alta registrada.",
      "Error en alta."
    ),
    buildStep(
      "account_created",
      "Cuenta creada",
      accountCreated,
      hasError && signupCreated && !accountCreated,
      "La cuenta del cliente está creada.",
      "La cuenta todavía no está creada.",
      "La cuenta debería existir y no está creada."
    ),
    buildStep(
      "tenant_created",
      "Tenant creado",
      tenantCreated,
      hasError && accountCreated && !tenantCreated,
      "El tenant del cliente está creado.",
      "El tenant todavía no está creado.",
      "El tenant debería existir y no está creado."
    ),
    buildStep(
      "runtime_ready",
      "Runtime listo",
      runtimeReady,
      hasError && tenantCreated && !runtimeReady,
      "El runtime del tenant está listo.",
      "El runtime todavía no está listo.",
      "El runtime debería estar listo y no lo está."
    ),
    buildStep(
      "email_ready",
      "Email preparado",
      emailReady,
      false,
      "Existe paquete o contenido de activación listo.",
      "El email de activación todavía no está preparado.",
      "Error preparando el email."
    ),
    buildStep(
      "email_sent",
      "Email enviado",
      emailSent,
      false,
      "El correo de activación ya se ha enviado.",
      "El correo de activación todavía no se ha enviado.",
      "Error enviando el correo."
    ),
    buildStep(
      "access_ready",
      "Acceso operativo",
      accessReady,
      hasError && runtimeReady && !accessReady,
      "El acceso del cliente ya es operativo.",
      "El acceso del cliente todavía no está operativo.",
      "El acceso debería estar operativo y no lo está."
    ),
  ];

  const finalStatus =
    errors.length > 0 || provisioningState === "error"
      ? "error"
      : steps.every((step) => step.state === "done")
        ? "ready"
        : "pending";

  return {
    clientId,
    tenantId,
    slug,
    displayName,
    plan,
    status: finalStatus,
    updatedAt: latestValue([
      String(provisioning?.updatedAt || ""),
      String(runtime?.updatedAt || ""),
      String(activationEmail?.updatedAt || ""),
      String(account?.updatedAt || ""),
      String(order?.createdAt || ""),
      String(signup?.createdAt || ""),
    ]),
    steps,
    errors: errors
      .filter((item) => String(item.createdAt || "").trim().length > 0 || String(item.detail || "").trim().length > 0)
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()),
    retries: retries
      .filter((item) => String(item.createdAt || "").trim().length > 0 || String(item.detail || "").trim().length > 0)
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()),
  };
}

export function getFactoryProvisioningSnapshot(): FactoryProvisioningSnapshot {
  const clientIds = listClientIds();
  const rows = clientIds.map((clientId) => buildProvisioningRow(clientId));

  const countStep = (key: FactoryProvisioningStep["key"]) =>
    rows.filter((row) => row.steps.some((step) => step.key === key && step.state === "done")).length;

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      total: rows.length,
      ready: rows.filter((row) => row.status === "ready").length,
      pending: rows.filter((row) => row.status === "pending").length,
      error: rows.filter((row) => row.status === "error").length,
      signupCreated: countStep("signup_created"),
      accountCreated: countStep("account_created"),
      tenantCreated: countStep("tenant_created"),
      runtimeReady: countStep("runtime_ready"),
      emailReady: countStep("email_ready"),
      emailSent: countStep("email_sent"),
      accessReady: countStep("access_ready"),
      totalErrors: rows.reduce((acc, row) => acc + row.errors.length, 0),
      totalRetries: rows.reduce((acc, row) => acc + row.retries.length, 0),
    },
    rows: rows.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()),
  };
}