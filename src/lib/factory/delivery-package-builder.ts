import type { NextRequest } from "next/server";
import { resolveRuntimeRequestContext } from "@/lib/saas/runtime-request-context";
import { buildSectorPackPreviewFromRequest } from "@/lib/factory/sector-pack-resolver";
import { resolveBusinessBlueprintFromRequest } from "@/lib/factory/blueprint-resolver";
import type { DeliveryBrandingAsset, DeliveryPackage, DeliveryStep, DeliveryWrapperProfile } from "@/lib/factory/delivery-package-definition";

function slugify(value: string): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function pascalCase(value: string): string {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join("");
}

function buildTenantAwareHref(pathname: string, slug: string | null) {
  if (!slug) {
    return pathname;
  }

  const separator = pathname.includes("?") ? "&" : "?";
  return pathname + separator + "tenant=" + encodeURIComponent(slug);
}

function resolveDisplayName(request: NextRequest) {
  const context = resolveRuntimeRequestContext(request);
  const blueprint = resolveBusinessBlueprintFromRequest(request);

  return {
    context,
    blueprint,
    displayName:
      context.branding?.displayName ||
      context.config?.displayName ||
      context.tenant?.displayName ||
      blueprint?.branding.displayName ||
      "Prontara",
  };
}

function buildWrapperProfile(input: {
  displayName: string;
  slug: string | null;
  accentColor: string;
  iconHint: string;
}): DeliveryWrapperProfile {
  const appName = input.displayName;
  const normalizedSlug = slugify(input.slug || input.displayName || "prontara");
  const executableStem = pascalCase(input.displayName || normalizedSlug || "Prontara");
  const installableName = executableStem + "-Setup";
  const executableName = executableStem + ".exe";

  return {
    appName,
    installableName,
    executableName,
    bundleId: "com.prontara." + normalizedSlug,
    desktopCaption: appName + " Desktop",
    iconHint: input.iconHint,
    accentColor: input.accentColor,
    windowTitle: appName,
    deliveryMode: "desktop-wrapper",
  };
}

function buildBrandingAssets(input: {
  displayName: string;
  accentColor: string;
  logoHint: string;
  slug: string | null;
}): DeliveryBrandingAsset[] {
  return [
    {
      kind: "logo",
      label: "Logo comercial",
      value: input.logoHint,
    },
    {
      kind: "icon",
      label: "Icono del instalable",
      value: "Icono para " + input.displayName + " con tono " + input.accentColor,
    },
    {
      kind: "splash",
      label: "Pantalla de bienvenida",
      value: "Splash simple para " + input.displayName,
    },
    {
      kind: "favicon",
      label: "Favicon / icono web",
      value: "Versión reducida del icono de " + input.displayName,
    },
  ];
}

function buildDeliverySteps(slug: string | null): DeliveryStep[] {
  return [
    {
      order: 1,
      title: "Recibir acceso",
      description: "El cliente recibe email de acceso y, si procede, enlace del wrapper.",
    },
    {
      order: 2,
      title: "Entrar por web o wrapper",
      description: "Puede entrar desde navegador o desde el acceso de escritorio preparado para su marca.",
    },
    {
      order: 3,
      title: "Cambiar contraseña",
      description: "Primer paso de seguridad al arrancar.",
    },
    {
      order: 4,
      title: "Empezar a trabajar",
      description: "Panel de arranque, menú claro y primeros pasos listos para el día 1.",
    },
  ];
}

export function buildDeliveryPackageFromRequest(request: NextRequest): DeliveryPackage {
  const { context, blueprint, displayName } = resolveDisplayName(request);
  const packPreview = buildSectorPackPreviewFromRequest(request);

  const accentColor =
    context.branding?.accentColor ||
    packPreview.resolvedPack.pack?.branding.accentColor ||
    "#111827";

  const logoHint =
    String(
      context.branding?.logoUrl ||
      packPreview.resolvedPack.pack?.branding.logoHint ||
      "logo limpio y profesional"
    ).trim();

  const slug = context.tenant?.slug || null;
  const wrapper = buildWrapperProfile({
    displayName,
    slug,
    accentColor,
    iconHint: logoHint,
  });

  const brandingAssets = buildBrandingAssets({
    displayName,
    accentColor,
    logoHint,
    slug,
  });

  const deliverySteps = buildDeliverySteps(slug);

  const commercialNotes = [
    "La entrega ya puede enseñarse con nombre e identidad por cliente.",
    "El acceso web sigue siendo la base, pero la percepción mejora con un wrapper con marca.",
    "Esto ayuda a cerrar demos y pruebas con una imagen más sólida.",
  ];

  return {
    ok: true,
    tenantId: context.tenant?.tenantId || null,
    clientId: context.tenant?.clientId || null,
    slug,
    displayName,
    requestedSlug: context.requestedSlug,
    source: context.source,
    wrapper,
    brandingAssets,
    deliverySteps,
    commercialNotes,
    downloadInfo: {
      webUrl: buildTenantAwareHref("/acceso", slug),
      desktopLabel: wrapper.installableName,
      desktopAvailable: true,
      desktopStatusText:
        "Wrapper preparado a nivel de entrega comercial. Falta solo enlazar con empaquetado real si se quiere distribuir como instalable.",
    },
  };
}