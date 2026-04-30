import type { NextRequest } from "next/server";
import { getSessionFromRequest } from "@/lib/saas/auth-session";
import { resolveRuntimeRequestContext } from "@/lib/saas/runtime-request-context";
import { listModuleRecords } from "@/lib/erp/active-client-data-store";
import { listTenantAccounts } from "@/lib/saas/account-store";
import {
  activatePaidPlan,
  getBillingCatalog,
  getOrCreateBillingSubscription,
  getPlanDefinition,
  getSubscriptionAccessAllowed,
  isStripeCheckoutConfigured,
  scheduleSubscriptionCancel,
  setBillingCheckoutIntent,
} from "@/lib/saas/billing-store";
import type {
  BillingLimitCheck,
  BillingOverview,
  BillingPlanKey,
  BillingUsageSnapshot,
} from "@/lib/saas/billing-definition";
import { createStripeCheckoutSession, resolveStripeCheckoutSession } from "@/lib/saas/billing-stripe";

type BillingScope = {
  tenantId: string;
  clientId: string;
  slug: string;
  displayName: string;
  billingEmail: string;
};

function resolveBillingScope(request: NextRequest): BillingScope | null {
  const session = getSessionFromRequest(request);
  if (session) {
    return {
      tenantId: session.tenantId,
      clientId: session.clientId,
      slug: session.slug,
      displayName: session.fullName,
      billingEmail: session.email,
    };
  }

  const context = resolveRuntimeRequestContext(request);
  if (!context.ok || !context.tenant) {
    return null;
  }

  return {
    tenantId: context.tenant.tenantId,
    clientId: context.tenant.clientId,
    slug: context.tenant.slug,
    displayName:
      context.branding?.displayName ||
      context.config?.displayName ||
      context.tenant.displayName,
    billingEmail:
      String(request.nextUrl.searchParams.get("email") || "").trim() ||
      "billing@" + context.tenant.slug + ".local",
  };
}

function safeList(moduleKey: string, clientId: string): Array<Record<string, string>> {
  try {
    return listModuleRecords(moduleKey, clientId) as Array<Record<string, string>>;
  } catch {
    return [];
  }
}

function getCurrentMonthPrefix() {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return year + "-" + month;
}

function buildUsage(clientId: string): BillingUsageSnapshot {
  const users = listTenantAccounts(clientId).length;
  const clientes = safeList("clientes", clientId).length;
  const documentos = safeList("documentos", clientId).length;
  const facturas = safeList("facturacion", clientId);
  const prefix = getCurrentMonthPrefix();

  const facturasMes = facturas.filter((item) => {
    const fecha = String(item.fechaEmision || item.createdAt || "");
    return fecha.startsWith(prefix);
  }).length;

  return {
    users,
    clientes,
    facturasMes,
    documentos,
  };
}

function checkLimit(
  label: string,
  key: "users" | "clientes" | "facturasMes" | "documentos",
  used: number,
  limit: number | null
): BillingLimitCheck {
  return {
    key,
    label,
    used,
    limit,
    withinLimit: limit == null ? true : used <= limit,
  };
}

export function getBillingOverviewFromRequest(request: NextRequest): BillingOverview | null {
  const scope = resolveBillingScope(request);
  if (!scope) {
    return null;
  }

  const catalog = getBillingCatalog();
  const subscription = getOrCreateBillingSubscription(scope);
  const currentPlan = getPlanDefinition(subscription.currentPlanKey);
  const usage = buildUsage(scope.clientId);

  const limits: BillingLimitCheck[] = [
    checkLimit("Usuarios", "users", usage.users, currentPlan.includedUsers),
    checkLimit("Clientes", "clientes", usage.clientes, currentPlan.includedClientes),
    checkLimit("Facturas del mes", "facturasMes", usage.facturasMes, currentPlan.includedFacturasMes),
    checkLimit("Documentos", "documentos", usage.documentos, currentPlan.includedDocumentos),
  ];

  return {
    tenantId: scope.tenantId,
    clientId: scope.clientId,
    slug: scope.slug,
    displayName: scope.displayName,
    catalog,
    subscription,
    currentPlan,
    usage,
    limits,
    accessAllowed: getSubscriptionAccessAllowed(subscription),
    checkoutConfigured: isStripeCheckoutConfigured(),
    canUpgrade: currentPlan.key !== "premium" && subscription.status !== "cancelled",
    canDowngrade: currentPlan.key !== "trial" && subscription.status !== "cancelled",
    canCancel:
      subscription.currentPlanKey !== "trial" &&
      subscription.status !== "cancelled" &&
      subscription.status !== "scheduled_cancel",
  };
}

export async function createBillingCheckoutFromRequest(
  request: NextRequest,
  nextPlanKey: BillingPlanKey
) {
  const scope = resolveBillingScope(request);
  if (!scope) {
    return null;
  }

  const checkout = await createStripeCheckoutSession({
    slug: scope.slug,
    email: scope.billingEmail,
    planKey: nextPlanKey,
    metadata: {
      tenantId: scope.tenantId,
      clientId: scope.clientId,
    },
  });

  setBillingCheckoutIntent({
    ...scope,
    intent: {
      sessionId: checkout.id,
      planKey: nextPlanKey,
      createdAt: new Date().toISOString(),
      mode: "checkout",
      successUrl: checkout.successUrl,
      cancelUrl: checkout.cancelUrl,
    },
  });

  return checkout;
}

export async function confirmBillingCheckoutFromRequest(
  request: NextRequest,
  sessionId: string
) {
  const scope = resolveBillingScope(request);
  if (!scope) {
    return null;
  }

  const resolved = await resolveStripeCheckoutSession(sessionId);
  const subscription = getOrCreateBillingSubscription(scope);

  const intendedPlan =
    (subscription.lastCheckoutIntent?.planKey ||
      String(request.nextUrl.searchParams.get("planKey") || "").trim()) as BillingPlanKey;

  if (!resolved.paid) {
    return {
      ok: false,
      detail: resolved.statusText,
      overview: getBillingOverviewFromRequest(request),
    };
  }

  if (!intendedPlan || intendedPlan === "trial") {
    throw new Error("No se pudo resolver el plan comprado.");
  }

  activatePaidPlan({
    ...scope,
    planKey: intendedPlan,
    stripeCheckoutSessionId: resolved.sessionId,
    stripeCustomerId: resolved.customerId,
    stripeSubscriptionId: resolved.subscriptionId,
    amountTotalCents: resolved.amountTotalCents,
  });

  return {
    ok: true,
    detail: resolved.statusText,
    overview: getBillingOverviewFromRequest(request),
  };
}

export function cancelPlanFromRequest(request: NextRequest) {
  const scope = resolveBillingScope(request);
  if (!scope) {
    return null;
  }

  scheduleSubscriptionCancel(scope);
  return getBillingOverviewFromRequest(request);
}