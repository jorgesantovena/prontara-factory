import type { NextRequest } from "next/server";
import { resolveRuntimeRequestContext } from "@/lib/saas/runtime-request-context";
import { inspectTenantAccountsFromRequest } from "@/lib/saas/account-provisioning";
import { buildActivationEmailFromRequest } from "@/lib/saas/activation-email-builder";

export type ActivationPackage = {
  ok: boolean;
  source: string;
  requestedSlug: string | null;
  tenantId: string | null;
  clientId: string | null;
  slug: string | null;
  displayName: string | null;
  loginUrl: string | null;
  admin: {
    email: string | null;
    fullName: string | null;
    temporaryPassword: string | null;
  };
  branding: Record<string, unknown> | null;
  runtimeConfig: Record<string, unknown> | null;
  email: {
    subject: string;
    previewText: string;
    html: string;
    text: string;
  } | null;
};

function buildLoginUrl(slug: string | null): string | null {
  const safeSlug = String(slug || "").trim();
  return safeSlug ? "/login?tenant=" + encodeURIComponent(safeSlug) : null;
}

export function buildActivationPackageFromRequest(
  request: NextRequest
): ActivationPackage {
  const context = resolveRuntimeRequestContext(request);
  const accountInfo = inspectTenantAccountsFromRequest(request);
  const email = buildActivationEmailFromRequest(request);

  if (!context.ok || !context.tenant) {
    return {
      ok: false,
      source: context.source,
      requestedSlug: context.requestedSlug,
      tenantId: null,
      clientId: null,
      slug: null,
      displayName: null,
      loginUrl: null,
      admin: {
        email: null,
        fullName: null,
        temporaryPassword: null,
      },
      branding: null,
      runtimeConfig: null,
      email: null,
    };
  }

  const tenant = context.tenant;
  const displayName =
    context.branding?.displayName ||
    context.config?.displayName ||
    tenant.displayName;

  return {
    ok: true,
    source: context.source,
    requestedSlug: context.requestedSlug,
    tenantId: tenant.tenantId,
    clientId: tenant.clientId,
    slug: tenant.slug,
    displayName,
    loginUrl: buildLoginUrl(tenant.slug),
    admin: {
      email: accountInfo.account?.email || null,
      fullName: accountInfo.account?.fullName || null,
      temporaryPassword: accountInfo.account?.temporaryPassword || null,
    },
    branding: context.branding ? { ...context.branding } : null,
    runtimeConfig: context.config ? { ...context.config } : null,
    email: email.ok
      ? {
          subject: email.subject,
          previewText: email.previewText,
          html: email.html,
          text: email.text,
        }
      : null,
  };
}