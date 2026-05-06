import type { NextRequest } from "next/server";
import { resolveRuntimeRequestContext } from "@/lib/saas/runtime-request-context";
import { resolveBusinessBlueprintFromRequest } from "@/lib/factory/blueprint-resolver";
import { buildSectorPackPreviewFromRequest } from "@/lib/factory/sector-pack-resolver";
import { getDashboardSnapshot } from "@/lib/erp/dashboard-metrics";
import { getStartupReadiness } from "@/lib/erp/startup-readiness";

export type DemoPresentationHero = {
  eyebrow: string;
  headline: string;
  subheadline: string;
  primaryCtaLabel: string;
  primaryCtaHref: string;
  secondaryCtaLabel: string;
  secondaryCtaHref: string;
};

export type DemoPresentationProof = {
  key: string;
  label: string;
  value: string;
  helper: string;
};

export type DemoPresentationFeature = {
  title: string;
  description: string;
};

export type DemoPresentationSection = {
  title: string;
  description: string;
  bullets: string[];
};

export type DemoPresentationBranding = {
  displayName: string;
  shortName: string;
  accentColor: string;
  sector?: string;
  businessType?: string;
  logoHint?: string;
};

export type DemoPresentationResult = {
  ok: boolean;
  tenantId: string | null;
  clientId: string | null;
  slug: string | null;
  displayName: string | null;
  source: string;
  requestedSlug: string | null;
  branding: DemoPresentationBranding;
  hero: DemoPresentationHero;
  proof: DemoPresentationProof[];
  features: DemoPresentationFeature[];
  sections: DemoPresentationSection[];
  startup: {
    score: number;
    statusLabel: string;
    headline: string;
    summary: string;
  };
  commercialCopy: {
    oneLiner: string;
    forWho: string;
    whyNow: string;
    closing: string;
  };
  links: {
    alta: string;
    acceso: string;
    entorno: string;
    suscripcion: string;
    packs: string;
  };
};

function normalizeHexColor(value: string | undefined | null): string {
  const raw = String(value || "").trim();
  return raw || "#111827";
}

function buildTenantAwareHref(pathname: string, slug: string | null) {
  if (!slug) {
    return pathname;
  }

  const separator = pathname.includes("?") ? "&" : "?";
  return pathname + separator + "tenant=" + encodeURIComponent(slug);
}

function buildHero(input: {
  displayName: string;
  sector?: string;
  businessType?: string;
  slug: string | null;
  packHeadline?: string;
  packSubheadline?: string;
  packCta?: string;
}): DemoPresentationHero {
  const sectorText = input.sector || input.businessType || "tu sector";
  const headline =
    input.packHeadline ||
    ("ERP online claro para " + sectorText + " y equipos pequeños");
  const subheadline =
    input.packSubheadline ||
    "Prontara te deja clientes, propuestas, facturas, documentos y arranque listos para trabajar sin complejidad innecesaria.";

  return {
    eyebrow: input.displayName,
    headline,
    subheadline,
    primaryCtaLabel: input.packCta || "Probar alta online",
    primaryCtaHref: buildTenantAwareHref("/alta", input.slug),
    secondaryCtaLabel: "Ver entorno",
    secondaryCtaHref: buildTenantAwareHref("/", input.slug),
  };
}

export async function buildDemoPresentationFromRequest(
  request: NextRequest
): Promise<DemoPresentationResult> {
  const context = resolveRuntimeRequestContext(request);
  const blueprint = resolveBusinessBlueprintFromRequest(request);
  const packPreview = buildSectorPackPreviewFromRequest(request);
  const dashboard = await getDashboardSnapshot();
  const startup = getStartupReadiness(dashboard);

  const displayName =
    context.branding?.displayName ||
    context.config?.displayName ||
    context.tenant?.displayName ||
    "Prontara";

  const sector =
    context.branding?.sector ||
    blueprint?.sector ||
    packPreview.resolvedPack.pack?.sector;

  const businessType =
    context.branding?.businessType ||
    blueprint?.businessType ||
    packPreview.resolvedPack.pack?.businessType;

  const accentColor =
    normalizeHexColor(
      context.branding?.accentColor ||
      packPreview.resolvedPack.pack?.branding.accentColor
    );

  const shortName =
    context.branding?.shortName ||
    displayName.slice(0, 2).toUpperCase();

  const hero = buildHero({
    displayName,
    sector,
    businessType,
    slug: context.tenant?.slug || null,
    packHeadline: packPreview.resolvedPack.pack?.landing.headline,
    packSubheadline: packPreview.resolvedPack.pack?.landing.subheadline,
    packCta: packPreview.resolvedPack.pack?.landing.cta,
  });

  const proof: DemoPresentationProof[] = [
    {
      key: "arranque",
      label: "Arranque",
      value: startup.statusLabel,
      helper: startup.summary,
    },
    {
      key: "score",
      label: "Preparación",
      value: String(startup.score) + "/100",
      helper: "Nivel de preparación del entorno para empezar a trabajar.",
    },
    {
      key: "modulos",
      label: "Módulos base",
      value: String(blueprint?.modules.length || packPreview.resolvedPack.pack?.modules.length || 0),
      helper: "Base operativa inicial del ERP.",
    },
    {
      key: "pack",
      label: "Pack sectorial",
      value: packPreview.resolvedPack.pack?.label || "Base genérica",
      helper: "Presentación y copy adaptados al sector.",
    },
  ];

  const packBullets = packPreview.resolvedPack.pack?.landing.bullets || [
    "Todo online y listo para trabajar",
    "Uso claro para equipos pequeños",
    "Más simple que un ERP tradicional",
  ];

  const features: DemoPresentationFeature[] = [
    {
      title: "Arranque claro desde el minuto 1",
      description: "El cliente entra y ve por dónde empezar sin formación larga ni lenguaje técnico.",
    },
    {
      title: "Base operativa real",
      description: "Clientes, presupuestos, facturas, documentos y entorno de trabajo ya conectados.",
    },
    {
      title: "Presentación sectorial lista para enseñar",
      description: "Cada pack sectorial puede enseñarse con copy, branding y narrativa más coherentes.",
    },
    {
      title: "Puente entre landing y producto",
      description: "La demo comercial ya no está aislada: enlaza con alta, acceso y entorno real.",
    },
  ];

  const sections: DemoPresentationSection[] = [
    {
      title: "Qué resuelve",
      description: "Prontara busca que una pyme pequeña pueda trabajar ordenada sin entrar en un ERP pesado.",
      bullets: packBullets,
    },
    {
      title: "Para quién encaja mejor",
      description:
        "Especialmente útil para negocios pequeños que necesitan claridad, rapidez y una herramienta online fácil de adoptar.",
      bullets: [
        "Empresas de 4 a 20 empleados",
        "Equipos sin perfil técnico avanzado",
        "Negocios que quieren empezar rápido y sin implantaciones largas",
      ],
    },
    {
      title: "Qué se puede enseñar en una demo",
      description:
        "La presentación ya puede conectar el discurso comercial con lo que luego ve el cliente dentro del ERP.",
      bullets: [
        "Landing y mensaje sectorial",
        "Alta simulada del cliente",
        "Acceso al entorno",
        "Dashboard de arranque y módulos base",
      ],
    },
  ];

  const oneLiner =
    packPreview.resolvedPack.pack?.landing.headline ||
    "ERP online claro, rápido y listo para trabajar.";
  const forWho =
    "Pensado para pymes pequeñas que necesitan orden sin complejidad innecesaria.";
  const whyNow =
    "Porque el salto no está solo en vender software, sino en hacer que el cliente pueda empezar a trabajar desde el primer día.";
  const closing =
    "La demo ya puede enseñar una historia completa: mensaje comercial, alta, acceso y entorno útil.";

  return {
    ok: true,
    tenantId: context.tenant?.tenantId || null,
    clientId: context.tenant?.clientId || null,
    slug: context.tenant?.slug || null,
    displayName,
    source: context.source,
    requestedSlug: context.requestedSlug,
    branding: {
      displayName,
      shortName,
      accentColor,
      sector,
      businessType,
      logoHint: context.branding?.logoUrl || packPreview.resolvedPack.pack?.branding.logoHint,
    },
    hero,
    proof,
    features,
    sections,
    startup: {
      score: startup.score,
      statusLabel: startup.statusLabel,
      headline: startup.headline,
      summary: startup.summary,
    },
    commercialCopy: {
      oneLiner,
      forWho,
      whyNow,
      closing,
    },
    links: {
      alta: buildTenantAwareHref("/alta", context.tenant?.slug || null),
      acceso: buildTenantAwareHref("/acceso", context.tenant?.slug || null),
      entorno: buildTenantAwareHref("/", context.tenant?.slug || null),
      suscripcion: buildTenantAwareHref("/suscripcion", context.tenant?.slug || null),
      packs: "/packs-sectoriales",
    },
  };
}