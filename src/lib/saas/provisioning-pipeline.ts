import type { NextRequest } from "next/server";
import { resolveRuntimeRequestContext } from "@/lib/saas/runtime-request-context";
import { provisionTenantAdminAccountFromRequest } from "@/lib/saas/account-provisioning";
import { buildActivationEmailFromRequest } from "@/lib/saas/activation-email-builder";
import { buildActivationPackageFromRequest } from "@/lib/saas/activation-package";
import { getOrCreateTrialState } from "@/lib/saas/trial-store";
import { getOrCreateOnboardingState } from "@/lib/saas/onboarding-store";
import { listTenantAccounts } from "@/lib/saas/account-store";
import {
  getProvisioningStateRecord,
  type ProvisioningStateRecord,
} from "@/lib/factory/provisioning-state-machine";

export type ProvisioningPipelineResult = {
  ok: boolean;
  source: string;
  requestedSlug: string | null;
  tenantId: string | null;
  clientId: string | null;
  slug: string | null;
  accountProvisioned: boolean;
  activationPackageReady: boolean;
  activationEmailReady: boolean;
  trialReady: boolean;
  onboardingReady: boolean;
  adminEmail: string | null;
  temporaryPassword: string | null;
};

export function runProvisioningPipelineFromRequest(
  request: NextRequest
): ProvisioningPipelineResult {
  const context = resolveRuntimeRequestContext(request);

  if (!context.ok || !context.tenant) {
    return {
      ok: false,
      source: context.source,
      requestedSlug: context.requestedSlug,
      tenantId: null,
      clientId: null,
      slug: null,
      accountProvisioned: false,
      activationPackageReady: false,
      activationEmailReady: false,
      trialReady: false,
      onboardingReady: false,
      adminEmail: null,
      temporaryPassword: null,
    };
  }

  const tenant = context.tenant;

  const accountResult = provisionTenantAdminAccountFromRequest(request);
  const emailResult = buildActivationEmailFromRequest(request);
  const packageResult = buildActivationPackageFromRequest(request);

  getOrCreateTrialState({
    tenantId: tenant.tenantId,
    clientId: tenant.clientId,
    slug: tenant.slug,
  });

  const accountId = accountResult.account?.id || "admin";
  getOrCreateOnboardingState({
    tenantId: tenant.tenantId,
    clientId: tenant.clientId,
    slug: tenant.slug,
    accountId,
  });

  return {
    ok: true,
    source: context.source,
    requestedSlug: context.requestedSlug,
    tenantId: tenant.tenantId,
    clientId: tenant.clientId,
    slug: tenant.slug,
    accountProvisioned: Boolean(accountResult.account),
    activationPackageReady: packageResult.ok,
    activationEmailReady: emailResult.ok,
    trialReady: true,
    onboardingReady: true,
    adminEmail: accountResult.account?.email || null,
    temporaryPassword: accountResult.account?.temporaryPassword || null,
  };
}

export type ProvisioningStatusSnapshot = {
  ok: boolean;
  source: string;
  requestedSlug: string | null;
  tenantId: string | null;
  clientId: string | null;
  slug: string | null;
  /** Current state as recorded by the state machine, if any. */
  state: string | null;
  hasAdminAccount: boolean;
  adminAccountCount: number;
  stateRecord: ProvisioningStateRecord | null;
};

/**
 * Read-only inspection of provisioning status. Does NOT mutate anything
 * (no creation, no retries). Use for dashboards and polling endpoints.
 */
export function inspectProvisioningStatusFromRequest(
  request: NextRequest
): ProvisioningStatusSnapshot {
  const context = resolveRuntimeRequestContext(request);

  if (!context.ok || !context.tenant) {
    return {
      ok: false,
      source: context.source,
      requestedSlug: context.requestedSlug,
      tenantId: null,
      clientId: null,
      slug: null,
      state: null,
      hasAdminAccount: false,
      adminAccountCount: 0,
      stateRecord: null,
    };
  }

  const tenant = context.tenant;
  const stateRecord = getProvisioningStateRecord(tenant.clientId);
  const accounts = listTenantAccounts(tenant.clientId);

  return {
    ok: true,
    source: context.source,
    requestedSlug: context.requestedSlug,
    tenantId: tenant.tenantId,
    clientId: tenant.clientId,
    slug: tenant.slug,
    state: stateRecord?.state || null,
    hasAdminAccount: accounts.length > 0,
    adminAccountCount: accounts.length,
    stateRecord,
  };
}