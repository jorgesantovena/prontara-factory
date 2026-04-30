import { randomBytes } from "node:crypto";
import { resolveRuntimeRequestContext } from "@/lib/saas/runtime-request-context";
import { upsertTenantAdminAccount, getTenantAccountSnapshot } from "@/lib/saas/account-store";
import type { TenantAccountRecord, TenantAccountSnapshot } from "@/lib/saas/account-definition";
import type { NextRequest } from "next/server";

export type TenantAccountProvisionResult = {
  ok: boolean;
  source: string;
  requestedSlug: string | null;
  account: TenantAccountRecord | null;
  snapshot: TenantAccountSnapshot | null;
};

function makeTemporaryPassword() {
  const token = randomBytes(6).toString("hex");
  return "Prontara-" + token;
}

function buildDefaultEmail(displayName: string, slug: string): string {
  const normalized = String(displayName || slug || "admin")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".");
  return "admin@" + normalized.replace(/^\.+|\.+$/g, "") + ".local";
}

function buildDefaultFullName(displayName: string): string {
  return "Administrador " + String(displayName || "Prontara").trim();
}

export function provisionTenantAdminAccountFromRequest(
  request: NextRequest
): TenantAccountProvisionResult {
  const context = resolveRuntimeRequestContext(request);

  if (!context.ok || !context.tenant) {
    return {
      ok: false,
      source: context.source,
      requestedSlug: context.requestedSlug,
      account: null,
      snapshot: null,
    };
  }

  const tenant = context.tenant;
  const displayName = context.branding?.displayName || context.config?.displayName || tenant.displayName;

  const account = upsertTenantAdminAccount({
    tenantId: tenant.tenantId,
    clientId: tenant.clientId,
    slug: tenant.slug,
    email: buildDefaultEmail(displayName, tenant.slug),
    fullName: buildDefaultFullName(displayName),
    temporaryPassword: makeTemporaryPassword(),
  });

  const snapshot = getTenantAccountSnapshot({
    tenantId: tenant.tenantId,
    clientId: tenant.clientId,
    slug: tenant.slug,
  });

  return {
    ok: true,
    source: context.source,
    requestedSlug: context.requestedSlug,
    account,
    snapshot,
  };
}

export function inspectTenantAccountsFromRequest(
  request: NextRequest
): TenantAccountProvisionResult {
  const context = resolveRuntimeRequestContext(request);

  if (!context.ok || !context.tenant) {
    return {
      ok: false,
      source: context.source,
      requestedSlug: context.requestedSlug,
      account: null,
      snapshot: null,
    };
  }

  const tenant = context.tenant;
  const snapshot = getTenantAccountSnapshot({
    tenantId: tenant.tenantId,
    clientId: tenant.clientId,
    slug: tenant.slug,
  });

  const account =
    snapshot.accounts.find((item) => item.role === "owner" || item.role === "admin") || null;

  return {
    ok: true,
    source: context.source,
    requestedSlug: context.requestedSlug,
    account,
    snapshot,
  };
}