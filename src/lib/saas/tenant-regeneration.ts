/**
 * Regeneración "blanda" de un tenant por clientId (sin NextRequest).
 *
 * Pensado para que el chat de Factory cierre el loop "edité un vertical
 * o un fichero del repo → regenerame el tenant". Como las verticales viven
 * en código y Next.js/Turbopack recarga automáticamente en dev, la
 * regeneración en Prontara Factory consiste en:
 *
 *   1. Confirmar que el tenant existe en disco.
 *   2. Asegurar las estructuras asociadas idempotentes (trial, onboarding).
 *   3. Invalidar la caché en memoria del dashboard de Factory para que la
 *      siguiente lectura refleje los cambios.
 *   4. Devolver un snapshot de la operación (qué se tocó, qué quedó igual).
 *
 * No crea cuentas nuevas (el admin ya existe), no borra overrides manuales
 * de `data/saas/tenant-runtime-config/`, no corre comandos externos. Es
 * una operación segura llamable cuantas veces haga falta.
 */
import { resolveTenantByClientId } from "@/lib/saas/tenant-registry";
import { listTenantAccounts } from "@/lib/saas/account-store";
import { getOrCreateTrialState, type TrialState } from "@/lib/saas/trial-store";
import {
  getOrCreateOnboardingState,
  type OnboardingState,
} from "@/lib/saas/onboarding-store";
import { invalidateFactoryDashboardCache } from "@/lib/factory/factory-dashboard";

export type RegenerateTenantResult = {
  ok: boolean;
  clientId: string;
  tenantId: string;
  slug: string;
  displayName: string;
  firstAdminEmail: string | null;
  accountCount: number;
  trialState: {
    status: TrialState["status"];
    expiresAt: string;
  };
  onboarding: {
    accountId: string;
    stepsCompleted: number;
    stepsTotal: number;
  } | null;
  dashboardCacheInvalidated: boolean;
  notes: string[];
};

/**
 * Ejecuta la regeneración blanda. Lanza error si el clientId no existe.
 */
export function regenerateTenantByClientId(clientId: string): RegenerateTenantResult {
  const normalized = String(clientId || "").trim();
  if (!normalized) {
    throw new Error("Falta clientId.");
  }

  const tenant = resolveTenantByClientId(normalized);
  if (!tenant) {
    throw new Error("No existe el tenant con clientId '" + normalized + "'.");
  }

  const notes: string[] = [];

  // 1. Trial state — idempotente. Si ya existe no lo tocamos.
  const trial = getOrCreateTrialState({
    tenantId: tenant.tenantId,
    clientId: tenant.clientId,
    slug: tenant.slug,
  });

  // 2. Onboarding state — depende de tener una cuenta admin. Si no hay,
  //    avisamos pero no fallamos (el tenant puede estar aún sin admin).
  const accounts = listTenantAccounts(tenant.clientId);
  const firstAdmin =
    accounts.find((a) => a.role === "owner" && a.status === "active") ||
    accounts.find((a) => a.role === "admin" && a.status === "active") ||
    accounts[0] ||
    null;

  let onboarding: OnboardingState | null = null;
  if (firstAdmin) {
    onboarding = getOrCreateOnboardingState({
      tenantId: tenant.tenantId,
      clientId: tenant.clientId,
      slug: tenant.slug,
      accountId: firstAdmin.id,
    });
  } else {
    notes.push(
      "No hay cuentas en el tenant todavía. Se omite la inicialización de onboarding.",
    );
  }

  // 3. Invalidar caché en memoria del dashboard Factory para que la
  //    próxima carga refleje el estado fresco.
  invalidateFactoryDashboardCache();

  const stepsCompleted = onboarding
    ? onboarding.steps.filter((s) => s.completed).length
    : 0;
  const stepsTotal = onboarding ? onboarding.steps.length : 0;

  return {
    ok: true,
    clientId: tenant.clientId,
    tenantId: tenant.tenantId,
    slug: tenant.slug,
    displayName: tenant.displayName,
    firstAdminEmail: firstAdmin?.email || null,
    accountCount: accounts.length,
    trialState: {
      status: trial.status,
      expiresAt: trial.expiresAt,
    },
    onboarding: onboarding
      ? {
          accountId: onboarding.accountId,
          stepsCompleted,
          stepsTotal,
        }
      : null,
    dashboardCacheInvalidated: true,
    notes,
  };
}

/**
 * Invalida solo la caché en memoria del dashboard de Factory. Útil cuando
 * el chat acaba de modificar datos persistidos (verticales, cuentas,
 * estados) y quiere forzar un recalculo inmediato.
 */
export function invalidateFactoryCaches(): { invalidated: string[] } {
  invalidateFactoryDashboardCache();
  return { invalidated: ["factory-dashboard"] };
}
