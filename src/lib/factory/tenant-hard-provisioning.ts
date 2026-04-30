/**
 * Provisioning "duro" de un tenant: cierra el pipeline end-to-end para un
 * clientId existente.
 *
 * Diferencias con `regenerateTenantByClientId` (regeneración blanda):
 *   - Crea la cuenta admin si falta (la blanda asume que ya existe).
 *   - Genera un password temporal nuevo SOLO en creación (no resetea uno
 *     existente a menos que se pase `resetAdminPassword: true`).
 *   - Opcionalmente siembra la demoData del vertical (`seedDemo: 'merge' | 'replace'`).
 *   - Registra una transición explícita en la máquina de estados de
 *     provisioning (`access_ready` con reason `hard-reprovision`).
 *   - Invalida la caché del dashboard Factory.
 *
 * Seguro de disparar repetidamente — sin flags destructivos, la segunda y
 * tercera ejecución son no-ops funcionales (solo actualizan timestamps).
 *
 * Lo que NO hace:
 *   - No envía emails reales (el activation email queda construido pero
 *     no pasa por el mail-outbox salvo que lifecycle lo active).
 *   - No corre provisioning.run completo (ese sí requiere contexto request
 *     y lo evitamos aquí — el chat no tiene request del tenant target).
 */
import { randomBytes } from "node:crypto";
import {
  createTenantAccount,
  listTenantAccounts,
  saveTenantAccounts,
  hashPassword,
  getTenantAccountSnapshot,
} from "@/lib/saas/account-store";
import type {
  TenantAccountRecord,
  TenantAccountSnapshot,
} from "@/lib/saas/account-definition";
import { resolveTenantByClientId } from "@/lib/saas/tenant-registry";
import { getOrCreateTrialState, type TrialState } from "@/lib/saas/trial-store";
import {
  getOrCreateOnboardingState,
  type OnboardingState,
} from "@/lib/saas/onboarding-store";
import {
  recordProvisioningTransition,
  type ProvisioningState,
} from "@/lib/factory/provisioning-state-machine";
import { invalidateFactoryDashboardCache } from "@/lib/factory/factory-dashboard";
import { seedDemoDataForTenant, type DemoSeedMode } from "@/lib/factory/demo-seeder";

export type HardReprovisionInput = {
  clientId: string;
  /**
   * Si true Y existe admin, le regenera el password temporal (destructivo —
   * el admin pierde sus credenciales actuales). Por defecto false: los
   * admins existentes no se tocan.
   */
  resetAdminPassword?: boolean;
  /**
   * Si se indica, materializa demoData del vertical en los ficheros del
   * tenant. 'merge' añade solo nuevos, 'replace' sobrescribe.
   */
  seedDemo?: DemoSeedMode;
  /**
   * Email explícito para el admin creado de cero. Si no se pasa se
   * construye uno por defecto a partir del slug del tenant.
   */
  adminEmail?: string;
  /** Full name para el admin creado de cero. */
  adminFullName?: string;
  /**
   * Motivo de la reprovisión para el historial. Se incluye en la
   * transición de la state machine y en el audit log del chat.
   */
  reason?: string;
};

export type HardReprovisionStepResult = {
  step: string;
  ok: boolean;
  detail: string;
};

export type HardReprovisionResult = {
  ok: boolean;
  clientId: string;
  tenantId: string;
  slug: string;
  displayName: string;
  steps: HardReprovisionStepResult[];
  accountAfter: TenantAccountSnapshot | null;
  adminEmail: string | null;
  /**
   * Si se generó un password temporal nuevo (creación del admin o reset
   * explícito), aparece aquí para que el operador lo comunique al cliente.
   * Es sensible — solo se devuelve en la respuesta, no se audita en texto.
   */
  temporaryPassword: string | null;
  trialState: {
    status: TrialState["status"];
    expiresAt: string;
  };
  onboarding: {
    accountId: string;
    stepsCompleted: number;
    stepsTotal: number;
  } | null;
  seedSummary: {
    mode: DemoSeedMode;
    modulesProcessed: number;
    totalInserted: number;
    totalSkipped: number;
  } | null;
  newState: ProvisioningState;
};

function makeTemporaryPassword(): string {
  return "Prontara-" + randomBytes(6).toString("hex");
}

function buildDefaultEmail(displayName: string, slug: string): string {
  const base = (displayName || slug || "admin")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".");
  return "admin@" + base.replace(/^\.+|\.+$/g, "") + ".local";
}

export function hardReprovisionTenant(input: HardReprovisionInput): HardReprovisionResult {
  const clientId = String(input.clientId || "").trim();
  if (!clientId) throw new Error("Falta clientId.");

  const tenant = resolveTenantByClientId(clientId);
  if (!tenant) {
    throw new Error("No existe el tenant con clientId '" + clientId + "'.");
  }

  const steps: HardReprovisionStepResult[] = [];
  let temporaryPassword: string | null = null;

  // 1. Cuenta admin — crear si falta, preservar si existe (salvo reset explícito)
  const existing = listTenantAccounts(clientId);
  const existingAdmin = existing.find(
    (a) => (a.role === "owner" || a.role === "admin") && a.status === "active",
  );

  let adminRecord: TenantAccountRecord | null = existingAdmin || null;

  if (!existingAdmin) {
    const displayName = input.adminFullName || "Administrador " + tenant.displayName;
    const email = input.adminEmail || buildDefaultEmail(tenant.displayName, tenant.slug);
    const tempPwd = makeTemporaryPassword();
    adminRecord = createTenantAccount({
      tenantId: tenant.tenantId,
      clientId: tenant.clientId,
      slug: tenant.slug,
      email,
      fullName: displayName,
      role: "owner",
      status: "active",
      temporaryPassword: tempPwd,
      mustChangePassword: true,
    });
    temporaryPassword = tempPwd;
    steps.push({
      step: "admin",
      ok: true,
      detail: "Cuenta admin creada (" + email + ").",
    });
  } else if (input.resetAdminPassword) {
    const tempPwd = makeTemporaryPassword();
    const rows = listTenantAccounts(clientId);
    const idx = rows.findIndex((r) => r.id === existingAdmin.id);
    if (idx >= 0) {
      const now = new Date().toISOString();
      rows[idx] = {
        ...rows[idx],
        passwordHash: hashPassword(tempPwd),
        temporaryPassword: tempPwd,
        mustChangePassword: true,
        updatedAt: now,
        lastProvisionedAt: now,
      };
      saveTenantAccounts(clientId, rows);
      adminRecord = rows[idx];
    }
    temporaryPassword = tempPwd;
    steps.push({
      step: "admin",
      ok: true,
      detail: "Password del admin regenerado (" + existingAdmin.email + ").",
    });
  } else {
    steps.push({
      step: "admin",
      ok: true,
      detail: "Admin ya existía (" + existingAdmin.email + "). Password preservado.",
    });
  }

  // 2. Trial state — idempotente
  const trial = getOrCreateTrialState({
    tenantId: tenant.tenantId,
    clientId: tenant.clientId,
    slug: tenant.slug,
  });
  steps.push({
    step: "trial",
    ok: true,
    detail: "Trial " + trial.status + " hasta " + trial.expiresAt + ".",
  });

  // 3. Onboarding state — depende de tener admin
  let onboarding: OnboardingState | null = null;
  if (adminRecord) {
    onboarding = getOrCreateOnboardingState({
      tenantId: tenant.tenantId,
      clientId: tenant.clientId,
      slug: tenant.slug,
      accountId: adminRecord.id,
    });
    steps.push({
      step: "onboarding",
      ok: true,
      detail: "Onboarding asegurado para accountId=" + adminRecord.id + ".",
    });
  } else {
    steps.push({
      step: "onboarding",
      ok: false,
      detail: "No se pudo inicializar onboarding porque no hay cuenta admin.",
    });
  }

  // 4. Demo seed opcional
  let seedSummary: HardReprovisionResult["seedSummary"] = null;
  if (input.seedDemo) {
    try {
      const result = seedDemoDataForTenant({
        clientId: tenant.clientId,
        mode: input.seedDemo,
      });
      seedSummary = {
        mode: result.mode,
        modulesProcessed: result.modulesProcessed.length,
        totalInserted: result.totalInserted,
        totalSkipped: result.totalSkipped,
      };
      steps.push({
        step: "demo",
        ok: true,
        detail:
          "Demo " +
          result.mode +
          ": +" +
          result.totalInserted +
          " filas en " +
          result.modulesProcessed.length +
          " módulos (" +
          result.totalSkipped +
          " duplicadas).",
      });
    } catch (err) {
      steps.push({
        step: "demo",
        ok: false,
        detail: "No se pudo sembrar demo: " + (err instanceof Error ? err.message : "error"),
      });
    }
  }

  // 5. State machine — marcamos access_ready con force (la blanda no toca)
  const newState: ProvisioningState = "access_ready";
  try {
    recordProvisioningTransition({
      clientId: tenant.clientId,
      to: newState,
      reason: {
        code: "hard-reprovision",
        message: input.reason || "Reprovisión duro manual desde Factory.",
      },
      metadata: {
        resetAdminPassword: Boolean(input.resetAdminPassword),
        seedDemo: input.seedDemo || null,
      },
      allowForced: true,
    });
    steps.push({
      step: "state-machine",
      ok: true,
      detail: "Transición a access_ready registrada.",
    });
  } catch (err) {
    steps.push({
      step: "state-machine",
      ok: false,
      detail:
        "No se pudo registrar transición: " + (err instanceof Error ? err.message : "error"),
    });
  }

  // 6. Invalidar caché
  invalidateFactoryDashboardCache();
  steps.push({
    step: "cache",
    ok: true,
    detail: "Caché del dashboard Factory invalidada.",
  });

  const accountAfter = getTenantAccountSnapshot({
    tenantId: tenant.tenantId,
    clientId: tenant.clientId,
    slug: tenant.slug,
  });

  return {
    ok: steps.every((s) => s.ok),
    clientId: tenant.clientId,
    tenantId: tenant.tenantId,
    slug: tenant.slug,
    displayName: tenant.displayName,
    steps,
    accountAfter,
    adminEmail: adminRecord?.email || null,
    temporaryPassword,
    trialState: {
      status: trial.status,
      expiresAt: trial.expiresAt,
    },
    onboarding: onboarding
      ? {
          accountId: onboarding.accountId,
          stepsCompleted: onboarding.steps.filter((s) => s.completed).length,
          stepsTotal: onboarding.steps.length,
        }
      : null,
    seedSummary,
    newState,
  };
}
