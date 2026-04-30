export type ActivationGettingStartedStep = {
  order: number;
  title: string;
  description: string;
  href: string;
};

export type ActivationEmailContent = {
  to: string;
  subject: string;
  intro: string;
  loginEmail: string;
  temporaryPassword: string;
  accessUrl: string;
  mustChangePassword: boolean;
  supportText: string;
  gettingStartedSteps: ActivationGettingStartedStep[];
  plainTextBody: string;
};

export type ActivationPackage = {
  ok: boolean;
  overallStatus: "ok" | "warn" | "error";
  tenantId: string | null;
  clientId: string | null;
  slug: string | null;
  displayName: string | null;
  source: string;
  requestedSlug: string | null;
  readyToSend: boolean;
  email: ActivationEmailContent | null;
  provisioningSummary: {
    accountReady: boolean;
    runtimeReady: boolean;
    blueprintReady: boolean;
    onboardingReady: boolean;
  };
};