import {
  getOrCreateBillingSubscription,
  getPlanDefinition,
} from "@/lib/saas/billing-store";
import { listModuleRecords } from "@/lib/erp/active-client-data-store";
import { listTenantAccounts } from "@/lib/saas/account-store";
import type {
  BillingLimitValue,
  BillingPlanDefinition,
  BillingUsageSnapshot,
} from "@/lib/saas/billing-definition";

/**
 * Plan limits enforcer.
 *
 * `billing-engine` already computes limits for the UI, but nothing in the
 * write path refuses a request when the limit is exceeded. This module is
 * the single place that answers:
 *
 *   "Can this tenant create one more record of type X?"
 *
 * All ERP write endpoints should consult `assertCanCreateOne()` before
 * persisting a new record. If the plan is over quota, we throw a typed
 * error that the routes translate into an HTTP 402 (Payment Required).
 */

export type PlanResource = "users" | "clientes" | "facturasMes" | "documentos";

export class PlanLimitError extends Error {
  readonly resource: PlanResource;
  readonly limit: BillingLimitValue;
  readonly used: number;
  readonly planKey: string;

  constructor(input: {
    resource: PlanResource;
    limit: BillingLimitValue;
    used: number;
    planKey: string;
  }) {
    super(
      "El plan " +
        input.planKey +
        " ha alcanzado el límite de " +
        input.resource +
        " (" +
        input.used +
        "/" +
        (input.limit ?? "∞") +
        "). Actualiza la suscripción para continuar."
    );
    this.name = "PlanLimitError";
    this.resource = input.resource;
    this.limit = input.limit;
    this.used = input.used;
    this.planKey = input.planKey;
  }
}

function getCurrentMonthPrefix(now = new Date()) {
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return year + "-" + month;
}

function safeList(moduleKey: string, clientId: string) {
  try {
    return listModuleRecords(moduleKey, clientId) as Array<Record<string, string>>;
  } catch {
    return [];
  }
}

export function buildUsageSnapshot(clientId: string): BillingUsageSnapshot {
  const users = listTenantAccounts(clientId).length;
  const clientes = safeList("clientes", clientId).length;
  const documentos = safeList("documentos", clientId).length;
  const facturas = safeList("facturacion", clientId);
  const prefix = getCurrentMonthPrefix();

  const facturasMes = facturas.filter((item) => {
    const fecha = String(item.fechaEmision || item.createdAt || "");
    return fecha.startsWith(prefix);
  }).length;

  return { users, clientes, facturasMes, documentos };
}

function getPlanLimit(plan: BillingPlanDefinition, resource: PlanResource): BillingLimitValue {
  switch (resource) {
    case "users":
      return plan.includedUsers;
    case "clientes":
      return plan.includedClientes;
    case "facturasMes":
      return plan.includedFacturasMes;
    case "documentos":
      return plan.includedDocumentos;
  }
}

function getUsage(snapshot: BillingUsageSnapshot, resource: PlanResource): number {
  switch (resource) {
    case "users":
      return snapshot.users;
    case "clientes":
      return snapshot.clientes;
    case "facturasMes":
      return snapshot.facturasMes;
    case "documentos":
      return snapshot.documentos;
  }
}

/**
 * Map an ERP module key to the plan resource that bounds it. Modules that
 * do not consume quota (e.g. ajustes, proyectos) return `null` and are
 * allowed unconditionally.
 */
export function mapModuleToPlanResource(moduleKey: string): PlanResource | null {
  switch (moduleKey) {
    case "clientes":
    case "crm":
      return "clientes";
    case "facturacion":
      return "facturasMes";
    case "documentos":
      return "documentos";
    default:
      return null;
  }
}

/**
 * Returns the current subscription's plan key, without creating heavy side
 * effects (still creates a default trial row if none exists, matching the
 * behaviour of the rest of the billing flow).
 */
function getCurrentPlan(clientId: string): BillingPlanDefinition {
  const subscription = getOrCreateBillingSubscription({
    tenantId: clientId,
    clientId,
    slug: clientId,
    displayName: clientId,
  });
  return getPlanDefinition(subscription.currentPlanKey);
}

/**
 * Returns `{ ok, reason }` without throwing, so callers can decide how to
 * respond (UI warning vs hard block).
 */
export function canCreateOne(
  clientId: string,
  resource: PlanResource
): { ok: boolean; used: number; limit: BillingLimitValue; planKey: string } {
  const plan = getCurrentPlan(clientId);
  const limit = getPlanLimit(plan, resource);
  const usage = buildUsageSnapshot(clientId);
  const used = getUsage(usage, resource);

  if (limit == null) {
    return { ok: true, used, limit, planKey: plan.key };
  }

  return { ok: used < limit, used, limit, planKey: plan.key };
}

/**
 * Throws `PlanLimitError` if the tenant cannot create another record of the
 * given resource under its current plan.
 */
export function assertCanCreateOne(clientId: string, resource: PlanResource): void {
  const check = canCreateOne(clientId, resource);
  if (!check.ok) {
    throw new PlanLimitError({
      resource,
      limit: check.limit,
      used: check.used,
      planKey: check.planKey,
    });
  }
}
