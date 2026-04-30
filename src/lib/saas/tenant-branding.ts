import { resolveActiveTenant } from "@/lib/saas/tenant-registry";

export type TenantBrandingConfig = {
  tenantId: string;
  clientId: string;
  slug: string;
  displayName: string;
  sector?: string;
  businessType?: string;
  logoUrl?: string;
  accentColor?: string;
  iconUrl?: string;
  appName: string;
  shortName: string;
  available: {
    logoUrl: boolean;
    iconUrl: boolean;
    accentColor: boolean;
  };
  source: {
    fromTenantBranding: boolean;
    fromClientJson: boolean;
  };
};

type BrandingShape = Record<string, unknown>;

function buildShortName(displayName: string): string {
  const parts = String(displayName || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) return "PR";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function getBrandingValue(branding: BrandingShape | undefined, key: string): string | undefined {
  const value = branding?.[key];
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export function resolveActiveTenantBranding(): TenantBrandingConfig | null {
  const tenant = resolveActiveTenant();
  if (!tenant) {
    return null;
  }

  const branding =
    tenant.branding && typeof tenant.branding === "object"
      ? (tenant.branding as BrandingShape)
      : undefined;

  const displayName =
    getBrandingValue(branding, "displayName") ||
    getBrandingValue(branding, "companyName") ||
    tenant.displayName;

  const sector =
    getBrandingValue(branding, "sector") ||
    tenant.sector;

  const businessType =
    getBrandingValue(branding, "businessType") ||
    tenant.businessType;

  const logoUrl =
    getBrandingValue(branding, "logoUrl");

  const accentColor =
    getBrandingValue(branding, "accentColor") ||
    getBrandingValue(branding, "primaryColor");

  const iconUrl =
    getBrandingValue(branding, "iconUrl");

  return {
    tenantId: tenant.tenantId,
    clientId: tenant.clientId,
    slug: tenant.slug,
    displayName,
    sector,
    businessType,
    logoUrl,
    accentColor,
    iconUrl,
    appName: displayName,
    shortName: buildShortName(displayName),
    available: {
      logoUrl: Boolean(logoUrl),
      iconUrl: Boolean(iconUrl),
      accentColor: Boolean(accentColor),
    },
    source: {
      fromTenantBranding: Boolean(branding),
      fromClientJson: false,
    },
  };
}