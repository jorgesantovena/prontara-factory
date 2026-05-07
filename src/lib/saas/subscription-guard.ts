/**
 * Guard de suscripción activa.
 *
 * Bloquea las operaciones de escritura del runtime cuando el tenant tiene
 * la suscripción cancelada o pendiente de checkout. El catálogo de
 * estados "con acceso" ya lo define `getSubscriptionAccessAllowed` en
 * `billing-store.ts`; este módulo solo lo envuelve con contexto HTTP y
 * un mensaje operativo claro para el usuario.
 *
 * Complementa a `requireTenantSession` (F-01: valida identidad) y a
 * `plan-limits.ts` (F-13: aplica límites por recurso). Este guard
 * responde a la pregunta distinta de "¿este tenant puede seguir escribiendo
 * en su ERP hoy?".
 */

import type { TenantSessionUser } from "@/lib/saas/account-definition";
import {
  getOrCreateBillingSubscription,
  getSubscriptionAccessAllowed,
} from "@/lib/saas/billing-store";
import { getOrCreateBillingSubscriptionAsync } from "@/lib/persistence/billing-store-async";
import type { BillingSubscriptionRecord } from "@/lib/saas/billing-definition";

export type SubscriptionGuardOk = {
  allowed: true;
  record: BillingSubscriptionRecord;
};

export type SubscriptionGuardBlocked = {
  allowed: false;
  record: BillingSubscriptionRecord;
  reason: string;
  code: "SUBSCRIPTION_CANCELLED" | "SUBSCRIPTION_PENDING_CHECKOUT" | "SUBSCRIPTION_NO_ACCESS";
};

export type SubscriptionGuardResult = SubscriptionGuardOk | SubscriptionGuardBlocked;

function evaluateGuard(record: BillingSubscriptionRecord): SubscriptionGuardResult {
  if (getSubscriptionAccessAllowed(record)) {
    return { allowed: true, record };
  }

  if (record.status === "cancelled") {
    return {
      allowed: false,
      record,
      reason:
        "La suscripción de este tenant está cancelada. Reactívala desde /suscripcion para volver a trabajar con normalidad.",
      code: "SUBSCRIPTION_CANCELLED",
    };
  }

  if (record.status === "pending_checkout") {
    return {
      allowed: false,
      record,
      reason:
        "Hay un pago pendiente de confirmar. Completa la compra desde /suscripcion para recuperar el acceso.",
      code: "SUBSCRIPTION_PENDING_CHECKOUT",
    };
  }

  return {
    allowed: false,
    record,
    reason: "Tu suscripción no permite operar el ERP ahora mismo. Revisa /suscripcion.",
    code: "SUBSCRIPTION_NO_ACCESS",
  };
}

/**
 * Evalúa si un tenant tiene acceso activo al ERP. No lanza; devuelve un
 * resultado discriminado para que el endpoint decida el código HTTP.
 *
 * @deprecated Usa checkTenantSubscriptionAsync. Esta versión llama al store
 * sync que toca filesystem y rompe en serverless. Se mantiene solo para no
 * romper imports externos hasta que migren todos.
 */
export function checkTenantSubscription(session: TenantSessionUser): SubscriptionGuardResult {
  const record = getOrCreateBillingSubscription({
    tenantId: session.tenantId,
    clientId: session.clientId,
    slug: session.slug,
    displayName: session.fullName || session.email || session.slug,
  });
  return evaluateGuard(record);
}

/**
 * Versión async dual-mode (postgres | filesystem) — la que deben usar los
 * endpoints serverless (SF-15: el store sync hace mkdirSync en /var/task,
 * read-only en Vercel).
 */
export async function checkTenantSubscriptionAsync(
  session: TenantSessionUser,
): Promise<SubscriptionGuardResult> {
  const record = await getOrCreateBillingSubscriptionAsync({
    tenantId: session.tenantId,
    clientId: session.clientId,
    slug: session.slug,
    displayName: session.fullName || session.email || session.slug,
  });
  return evaluateGuard(record);
}
