import fs from "node:fs";
import path from "node:path";
import { listTenantClientsIndex } from "@/lib/saas/tenant-clients-index";

export type FactorySubscriptionStatus = "active" | "trial" | "cancelled" | "pending";
export type FactoryBillingState = "ok" | "warning" | "failed" | "missing";

export type FactorySubscriptionLimit = {
  key: string;
  label: string;
  value: string;
};

export type FactorySubscriptionChange = {
  id: string;
  type: "upgrade" | "downgrade";
  fromPlan: string;
  toPlan: string;
  createdAt: string;
  detail: string;
};

export type FactorySubscriptionIssue = {
  id: string;
  title: string;
  detail: string;
  createdAt: string;
  severity: "warn" | "danger";
};

export type FactorySubscriptionRow = {
  clientId: string;
  tenantId: string;
  slug: string;
  displayName: string;
  plan: string;
  status: FactorySubscriptionStatus;
  billingState: FactoryBillingState;
  monetizationClosed: boolean;
  limits: FactorySubscriptionLimit[];
  changes: FactorySubscriptionChange[];
  issues: FactorySubscriptionIssue[];
  amount: string;
  currency: string;
  updatedAt: string | null;
};

export type FactorySubscriptionsSnapshot = {
  generatedAt: string;
  summary: {
    total: number;
    active: number;
    trial: number;
    cancelled: number;
    pending: number;
    withUpgrade: number;
    withDowngrade: number;
    withPaymentIssues: number;
    withoutMonetizationClosed: number;
  };
  rows: FactorySubscriptionRow[];
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

function normalizeStatus(value: string): FactorySubscriptionStatus {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "active") return "active";
  if (normalized === "trial") return "trial";
  if (normalized === "cancelled" || normalized === "canceled") return "cancelled";
  return "pending";
}

function normalizeBillingState(subscription: Record<string, unknown> | null): FactoryBillingState {
  if (!subscription) {
    return "missing";
  }

  const status = String(subscription.status || subscription.state || "").trim().toLowerCase();
  const issue = Boolean(subscription.paymentIssue || subscription.warning || subscription.invoiceFailed);

  if (status === "failed") {
    return "failed";
  }

  if (issue) {
    return "warning";
  }

  return "ok";
}

function latestValue(values: Array<string | null | undefined>): string | null {
  const cleaned = values
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .sort()
    .reverse();

  return cleaned[0] || null;
}

function buildDefaultLimits(plan: string): FactorySubscriptionLimit[] {
  const normalized = String(plan || "").trim().toLowerCase();

  if (normalized === "pro") {
    return [
      { key: "users", label: "Usuarios", value: "20" },
      { key: "tenants", label: "Tenants", value: "1" },
      { key: "storage", label: "Almacenamiento", value: "50 GB" },
      { key: "automation", label: "Automatizaciones", value: "Avanzadas" },
    ];
  }

  if (normalized === "business") {
    return [
      { key: "users", label: "Usuarios", value: "50" },
      { key: "tenants", label: "Tenants", value: "1" },
      { key: "storage", label: "Almacenamiento", value: "150 GB" },
      { key: "automation", label: "Automatizaciones", value: "Completas" },
    ];
  }

  return [
    { key: "users", label: "Usuarios", value: "5" },
    { key: "tenants", label: "Tenants", value: "1" },
    { key: "storage", label: "Almacenamiento", value: "10 GB" },
    { key: "automation", label: "Automatizaciones", value: "Básicas" },
  ];
}

function readPlanLimits(clientId: string, plan: string): FactorySubscriptionLimit[] {
  const limitsJson = safeReadJson<Record<string, unknown> | null>(
    getRootPath("data", "saas", "plan-limits", clientId + ".json"),
    null
  );

  const rawLimits = Array.isArray(limitsJson?.limits)
    ? (limitsJson?.limits as Array<Record<string, unknown>>)
    : [];

  if (rawLimits.length === 0) {
    return buildDefaultLimits(plan);
  }

  return rawLimits.map((item, index) => ({
    key: String(item.key || "limit-" + index),
    label: String(item.label || item.key || "Límite"),
    value: String(item.value || ""),
  }));
}

function readPlanChanges(clientId: string): FactorySubscriptionChange[] {
  const sourceA = safeReadJson<Array<Record<string, unknown>>>(
    getRootPath("data", "saas", "subscription-changes", clientId + ".json"),
    []
  );

  const sourceB = safeReadJson<Array<Record<string, unknown>>>(
    getRootPath("data", "saas", "billing", "changes", clientId + ".json"),
    []
  );

  return [...sourceA, ...sourceB]
    .map((item, index) => {
      const typeRaw = String(item.type || item.changeType || "").trim().toLowerCase();
      const type = typeRaw === "downgrade" ? "downgrade" : "upgrade";

      return {
        id: String(item.id || clientId + "-change-" + index),
        type,
        fromPlan: String(item.fromPlan || item.previousPlan || ""),
        toPlan: String(item.toPlan || item.nextPlan || item.plan || ""),
        createdAt: String(item.createdAt || item.at || ""),
        detail: String(item.detail || item.summary || ""),
      } as FactorySubscriptionChange;
    })
    .filter((item) => item.toPlan.trim().length > 0)
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
}

function readPaymentIssues(clientId: string, subscription: Record<string, unknown> | null): FactorySubscriptionIssue[] {
  const billingIssues = safeReadJson<Array<Record<string, unknown>>>(
    getRootPath("data", "saas", "billing", "issues", clientId + ".json"),
    []
  );

  const issues = billingIssues.map((item, index) => ({
    id: String(item.id || clientId + "-issue-" + index),
    title: String(item.title || "Incidencia de cobro"),
    detail: String(item.detail || item.message || ""),
    createdAt: String(item.createdAt || item.at || ""),
    severity: (String(item.severity || "").trim().toLowerCase() === "danger" ? "danger" : "warn") as "warn" | "danger",
  }));

  if (subscription && Boolean(subscription.paymentIssue || subscription.warning || subscription.invoiceFailed)) {
    issues.unshift({
      id: clientId + "-issue-subscription",
      title: "Incidencia de cobro detectada",
      detail: String(subscription.warning || subscription.paymentIssue || subscription.invoiceFailed || "Revisar cobro del cliente."),
      createdAt: String(subscription.updatedAt || subscription.createdAt || ""),
      severity: Boolean(subscription.invoiceFailed) ? "danger" : "warn",
    });
  }

  return issues.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
}

function isMonetizationClosed(
  subscription: Record<string, unknown> | null,
  order: Record<string, unknown> | null,
  status: FactorySubscriptionStatus
): boolean {
  if (!subscription && !order) {
    return false;
  }

  if (status === "trial") {
    return false;
  }

  const paid = Boolean(subscription?.paid || subscription?.chargeCaptured || order?.paid || order?.chargeCaptured);
  const planExists = String(subscription?.plan || subscription?.planCode || order?.plan || "").trim().length > 0;
  const activeOrCancelled = status === "active" || status === "cancelled";

  return planExists && (paid || activeOrCancelled);
}

export function getFactorySubscriptionsSnapshot(): FactorySubscriptionsSnapshot {
  const clients = listTenantClientsIndex();

  const rows: FactorySubscriptionRow[] = clients.map((client) => {
    const subscription = safeReadJson<Record<string, unknown> | null>(
      getRootPath("data", "saas", "subscriptions", client.clientId + ".json"),
      null
    );

    const order = safeReadJson<Record<string, unknown> | null>(
      getRootPath("data", "saas", "orders", client.clientId + ".json"),
      null
    );

    const status = normalizeStatus(
      String(subscription?.status || subscription?.state || order?.status || "")
    );

    const plan =
      String(subscription?.plan || subscription?.planCode || order?.plan || order?.planCode || "starter").trim() ||
      "starter";

    const billingState = normalizeBillingState(subscription);
    const limits = readPlanLimits(client.clientId, plan);
    const changes = readPlanChanges(client.clientId);
    const issues = readPaymentIssues(client.clientId, subscription);
    const monetizationClosed = isMonetizationClosed(subscription, order, status);

    return {
      clientId: client.clientId,
      tenantId: client.tenantId,
      slug: client.slug,
      displayName: client.displayName,
      plan,
      status,
      billingState,
      monetizationClosed,
      limits,
      changes,
      issues,
      amount: String(subscription?.amount || order?.amount || "").trim(),
      currency: String(subscription?.currency || order?.currency || "EUR").trim() || "EUR",
      updatedAt: latestValue([
        String(subscription?.updatedAt || ""),
        String(order?.updatedAt || ""),
        String(order?.createdAt || ""),
      ]),
    };
  }).sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      total: rows.length,
      active: rows.filter((row) => row.status === "active").length,
      trial: rows.filter((row) => row.status === "trial").length,
      cancelled: rows.filter((row) => row.status === "cancelled").length,
      pending: rows.filter((row) => row.status === "pending").length,
      withUpgrade: rows.filter((row) => row.changes.some((change) => change.type === "upgrade")).length,
      withDowngrade: rows.filter((row) => row.changes.some((change) => change.type === "downgrade")).length,
      withPaymentIssues: rows.filter((row) => row.issues.length > 0 || row.billingState === "warning" || row.billingState === "failed").length,
      withoutMonetizationClosed: rows.filter((row) => !row.monetizationClosed).length,
    },
    rows,
  };
}