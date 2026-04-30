export type CommercialLandingRule = {
  key: string;
  label: string;
  description: string;
  instruction: string;
};

export type CommercialLandingPackage = {
  displayName: string;
  shortName: string;
  sector: string;
  businessType: string;
  accentColor: string;
  headline: string;
  subheadline: string;
  bullets: string[];
  cta: string;
  trustPoints: string[];
  demoLabel: string;
  loginLabel: string;
  installableName: string;
  wrapperWindowTitle: string;
  iconHint: string;
  logoHint: string;
  /**
   * Reglas sectoriales con guías de mensaje para la landing. Resueltas
   * desde TenantRuntimeConfig.landingRules (que vienen del pack sectorial
   * con posibles overrides del tenant).
   */
  landingRules: CommercialLandingRule[];
};

export type CommercialDeliveryPackage = {
  tenantId: string;
  clientId: string;
  slug: string;
  displayName: string;
  branding: {
    displayName: string;
    shortName: string;
    accentColor: string;
    logoHint: string;
    tone: string;
  };
  wrapper: {
    appName: string;
    installableName: string;
    executableName: string;
    desktopCaption: string;
    iconHint: string;
    windowTitle: string;
    accentColor: string;
    deliveryMode: string;
  };
  access: {
    accessUrl: string;
    loginUrl: string;
    firstUseUrl: string;
    deliveryUrl: string;
  };
  commercial: CommercialLandingPackage;
};

export type DemoScenarioStep = {
  key: string;
  title: string;
  description: string;
  href: string;
};

export type DemoScenario = {
  title: string;
  subtitle: string;
  sectorLabel: string;
  steps: DemoScenarioStep[];
  expectedResult: string;
};

export type CommercialValidationResult = {
  ok: boolean;
  checks: Array<{
    key: string;
    label: string;
    passed: boolean;
    detail: string;
  }>;
  summary: {
    passed: number;
    total: number;
  };
};