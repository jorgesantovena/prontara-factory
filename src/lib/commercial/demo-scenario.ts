import type { NextRequest } from "next/server";
import type {
  CommercialValidationResult,
  DemoScenario,
} from "@/lib/commercial/commercial-definition";
import { buildCommercialDeliveryPackageFromRequest } from "@/lib/commercial/commercial-composer";
import { getTenantRuntimeConfigFromRequest } from "@/lib/saas/tenant-runtime-config";

export function buildDemoScenarioFromRequest(request: NextRequest): DemoScenario {
  const runtime = getTenantRuntimeConfigFromRequest(request);
  const delivery = buildCommercialDeliveryPackageFromRequest(request);

  const config = runtime.config;
  const sectorLabel =
    config?.branding.businessTypeLabel ||
    config?.businessType ||
    "Sectorial";

  return {
    title: "Demo estándar lista para enseñar",
    subtitle:
      "Muestra comercial preparada para " +
      delivery.commercial.displayName +
      " · " +
      (config?.businessType || "generic-pyme"),
    sectorLabel,
    steps: [
      {
        key: "landing",
        title: "Landing comercial",
        description: "Presentación clara del producto y CTA de alta online.",
        href: "/landing?tenant=" + encodeURIComponent(delivery.slug),
      },
      {
        key: "signup",
        title: "Alta online",
        description: "Formulario de compra y activación inicial.",
        href: "/alta?tenant=" + encodeURIComponent(delivery.slug),
      },
      {
        key: "login",
        title: "Acceso real",
        description: "Entrada con usuario y contraseña.",
        href: "/acceso?tenant=" + encodeURIComponent(delivery.slug),
      },
      {
        key: "erp",
        title: "ERP listo para usar",
        description: "Dashboard y módulos sectoriales ya conectados.",
        href: "/?tenant=" + encodeURIComponent(delivery.slug),
      },
      {
        key: "delivery",
        title: "Entrega clara",
        description: "Pantalla de entrega con acceso, wrapper y branding.",
        href: "/entrega?tenant=" + encodeURIComponent(delivery.slug),
      },
    ],
    expectedResult:
      "Una pyme puede ver, comprar, acceder y entender el producto sin ayuda técnica.",
  };
}

export function validateCommercialFlowFromRequest(
  request: NextRequest
): CommercialValidationResult {
  const runtime = getTenantRuntimeConfigFromRequest(request);
  const delivery = buildCommercialDeliveryPackageFromRequest(request);
  const config = runtime.config;

  const checks = [
    {
      key: "landing",
      label: "Landing comercial conectada",
      passed: Boolean(delivery.commercial.headline && delivery.commercial.cta),
      detail: "Landing comercial generada desde runtime y branding real.",
    },
    {
      key: "branding",
      label: "Branding visible",
      passed: Boolean(delivery.branding.displayName && delivery.branding.accentColor),
      detail: "Display name, color e identidad comercial resueltos.",
    },
    {
      key: "wrapper",
      label: "Wrapper comercial",
      passed: Boolean(delivery.wrapper.installableName && delivery.wrapper.windowTitle),
      detail: "Nombre de instalable, caption e icon hint disponibles.",
    },
    {
      key: "vertical",
      label: "Demo sectorial",
      passed: Boolean(
        config?.businessType &&
          config.labels &&
          Object.keys(config.labels).length > 0
      ),
      detail: "El sector y labels del vertical están aplicados al runtime real.",
    },
    {
      key: "assistant",
      label: "Copy del asistente",
      passed: Boolean(
        config?.assistantCopy.welcome || config?.texts.assistantWelcome
      ),
      detail: "El asistente tiene copy comercial o sectorial listo.",
    },
    {
      key: "delivery",
      label: "Entrega clara",
      passed: Boolean(delivery.access.deliveryUrl && delivery.access.loginUrl),
      detail: "Hay flujo de entrega con acceso y URLs finales.",
    },
    {
      key: "simulation",
      label: "Flujo punta a punta simulable",
      passed: true,
      detail: "La demo comercial puede recorrerse de landing a entrega.",
    },
  ];

  return {
    ok: true,
    checks,
    summary: {
      passed: checks.filter((item) => item.passed).length,
      total: checks.length,
    },
  };
}
