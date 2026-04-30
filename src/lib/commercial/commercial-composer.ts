import type { NextRequest } from "next/server";
import type {
  CommercialDeliveryPackage,
  CommercialLandingPackage,
} from "@/lib/commercial/commercial-definition";
import { getTenantRuntimeConfigFromRequest } from "@/lib/saas/tenant-runtime-config";

function buildBaseUrl() {
  const envUrl = String(process.env.APP_BASE_URL || "").trim();
  return envUrl || "http://localhost:3000";
}

function buildFallbackBullets(businessType: string) {
  return [
    "ERP online listo para trabajar desde el primer día",
    "Flujo simple para equipos pequeños sin perfil técnico",
    "Compra, alta, acceso y uso conectados en el mismo sistema",
    "Vertical " + businessType + " preparado para enseñar y vender",
  ];
}

function buildTrustPoints(displayName: string) {
  return [
    displayName + " está preparado para uso 100 % online.",
    "Acceso por tenant, usuario y contraseña.",
    "Entrega clara con entorno listo para trabajar.",
    "Base SaaS preparada para evolución, branding y verticalización.",
  ];
}

export function buildCommercialLandingPackageFromRequest(
  request: NextRequest
): CommercialLandingPackage {
  const runtime = getTenantRuntimeConfigFromRequest(request);
  const config = runtime.config;

  if (!config) {
    const displayName = "Prontara";
    return {
      displayName,
      shortName: "PR",
      sector: "general",
      businessType: "generic-pyme",
      accentColor: "#111827",
      headline: "Gestiona tu negocio con " + displayName,
      subheadline: "ERP online claro para pequeñas empresas.",
      bullets: buildFallbackBullets("generic-pyme"),
      cta: "Empieza ahora",
      trustPoints: buildTrustPoints(displayName),
      demoLabel: "Ver demo sectorial",
      loginLabel: "Acceder al ERP",
      installableName: displayName + "-Setup",
      wrapperWindowTitle: displayName,
      iconHint: "logo limpio y profesional",
      logoHint: "logo limpio y profesional",
      landingRules: [],
    };
  }

  const displayName = config.displayName || "Prontara";
  const shortName = config.shortName || "PR";
  const sector = config.sector || "general";
  const businessType = config.businessType || "generic-pyme";
  const accentColor = config.branding.accentColor || "#111827";
  const logoHint = config.branding.logoHint || "logo limpio y profesional";
  const landing = config.landing;

  return {
    displayName,
    shortName,
    sector,
    businessType,
    accentColor,
    headline:
      landing.headline ||
      config.texts.welcomeHeadline ||
      ("Gestiona tu negocio con " + displayName),
    subheadline:
      landing.subheadline ||
      config.texts.welcomeSubheadline ||
      "ERP online claro para pequeñas empresas.",
    bullets:
      landing.bullets && landing.bullets.length > 0
        ? landing.bullets
        : buildFallbackBullets(businessType),
    cta: landing.cta || "Empieza ahora",
    trustPoints: buildTrustPoints(displayName),
    demoLabel: "Ver demo sectorial",
    loginLabel: "Acceder al ERP",
    installableName: displayName.replace(/\s+/g, "") + "-Setup",
    wrapperWindowTitle: displayName,
    iconHint: logoHint,
    logoHint,
    landingRules: (config.landingRules || []).map((rule) => ({
      key: rule.key,
      label: rule.label,
      description: rule.description,
      instruction: rule.instruction,
    })),
  };
}

export function buildCommercialDeliveryPackageFromRequest(
  request: NextRequest
): CommercialDeliveryPackage {
  const runtime = getTenantRuntimeConfigFromRequest(request);
  const config = runtime.config;
  const tenant =
    String(request.nextUrl.searchParams.get("tenant") || "").trim() ||
    "default";
  const baseUrl = buildBaseUrl();
  const commercial = buildCommercialLandingPackageFromRequest(request);

  const wrapper = (config && config.wrapper) || {
    appName: commercial.displayName,
    installableName: commercial.installableName,
    executableName: commercial.shortName + ".exe",
    desktopCaption: commercial.displayName + " Desktop",
    iconHint: commercial.iconHint,
    windowTitle: commercial.wrapperWindowTitle,
    accentColor: commercial.accentColor,
    deliveryMode: "desktop-wrapper" as const,
    bundleId: "com.prontara." + (commercial.shortName || "app").toLowerCase(),
  };

  return {
    tenantId: tenant,
    clientId: tenant,
    slug: tenant,
    displayName: commercial.displayName,
    branding: {
      displayName: config?.branding.displayName || commercial.displayName,
      shortName: config?.branding.shortName || commercial.shortName,
      accentColor: config?.branding.accentColor || commercial.accentColor,
      logoHint: config?.branding.logoHint || commercial.logoHint,
      tone: config?.branding.tone || "professional",
    },
    wrapper,
    access: {
      accessUrl: baseUrl + "/acceso?tenant=" + encodeURIComponent(tenant),
      loginUrl: baseUrl + "/acceso?tenant=" + encodeURIComponent(tenant),
      firstUseUrl: baseUrl + "/primer-acceso?tenant=" + encodeURIComponent(tenant),
      deliveryUrl: baseUrl + "/entrega?tenant=" + encodeURIComponent(tenant),
    },
    commercial,
  };
}
