import type { NextRequest } from "next/server";
import type { TenantDefinition } from "@/lib/saas/tenant-definition";
import {
  listDiskTenants,
  resolveActiveTenant,
} from "@/lib/saas/tenant-registry";

export type TenantResolutionSource =
  | "query"
  | "header"
  | "active-fallback"
  | "not-found";

export type TenantResolutionResult = {
  ok: boolean;
  source: TenantResolutionSource;
  requestedSlug: string | null;
  tenant: TenantDefinition | null;
};

function normalizeSlug(value: string): string {
  return String(value || "").trim().toLowerCase();
}

export function resolveTenantBySlug(slug: string): TenantDefinition | null {
  const normalized = normalizeSlug(slug);
  if (!normalized) {
    return null;
  }

  const tenants = listDiskTenants();
  return tenants.find((item) => normalizeSlug(item.slug) === normalized) || null;
}

export function resolveTenantFromRequest(
  request?: NextRequest | null
): TenantResolutionResult {
  const querySlug = normalizeSlug(
    String(request?.nextUrl?.searchParams?.get("tenant") || "")
  );

  if (querySlug) {
    const tenant = resolveTenantBySlug(querySlug);
    return {
      ok: tenant !== null,
      source: tenant ? "query" : "not-found",
      requestedSlug: querySlug,
      tenant,
    };
  }

  const headerSlug = normalizeSlug(
    String(request?.headers?.get?.("x-tenant-slug") || "")
  );

  if (headerSlug) {
    const tenant = resolveTenantBySlug(headerSlug);
    return {
      ok: tenant !== null,
      source: tenant ? "header" : "not-found",
      requestedSlug: headerSlug,
      tenant,
    };
  }

  const activeTenant = resolveActiveTenant();

  return {
    ok: activeTenant !== null,
    source: activeTenant ? "active-fallback" : "not-found",
    requestedSlug: null,
    tenant: activeTenant,
  };
}