export type ProvisioningStepStatus = "ok" | "warn" | "error" | "pending";

export type ProvisioningStep = {
  key: string;
  label: string;
  status: ProvisioningStepStatus;
  detail: string;
};

export type TenantAccessPayload = {
  ready: boolean;
  accessUrl: string;
  loginEmail: string;
  temporaryPassword: string;
  mustChangePassword: boolean;
  displayName: string;
  emailSubject: string;
  emailIntro: string;
};

export type TenantProvisioningSnapshot = {
  ok: boolean;
  overallStatus: "ok" | "warn" | "error";
  tenantId: string | null;
  clientId: string | null;
  slug: string | null;
  displayName: string | null;
  source: string;
  requestedSlug: string | null;
  steps: ProvisioningStep[];
  access: TenantAccessPayload | null;
};