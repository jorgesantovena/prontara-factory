import type { ActivationPackage } from "@/lib/saas/activation-package";

export type SignupSimulateInput = {
  companyName: string;
  contactName: string;
  email: string;
  phone?: string;
  slug: string;
  sector?: string;
  businessType?: string;
  companySize?: string;
};

export type SignupSimulateValidation = {
  ok: boolean;
  errors: string[];
  normalizedSlug: string;
};

export type SignupSimulateResult = {
  ok: boolean;
  requestedSlug: string | null;
  normalizedSlug: string | null;
  validationErrors: string[];
  tenantMatched: boolean;
  provisioningTriggered: boolean;
  activationPackage: ActivationPackage | null;
  message: string;
};