export type TenantStatus = "active" | "inactive" | "draft";

export type TenantBranding = {
  displayName: string;
  sector?: string;
  businessType?: string;
  logoUrl?: string;
  accentColor?: string;
};

export type TenantPaths = {
  clientFilePath: string;
  runtimeConfigPath: string;
  dataPath: string;
  artifactsPath: string;
};

export type TenantDefinition = {
  tenantId: string;
  clientId: string;
  slug: string;
  displayName: string;
  sector?: string;
  businessType?: string;
  status: TenantStatus;
  branding: TenantBranding;
  paths: TenantPaths;
  updatedAt?: string;
};

export type ActiveTenantState = {
  tenantId: string | null;
  clientId: string | null;
  updatedAt: string;
};