export type TenantAccountRole = "owner" | "admin" | "manager" | "staff";
export type TenantAccountStatus = "pending" | "active" | "disabled";

export type TenantAccountRecord = {
  id: string;
  tenantId: string;
  clientId: string;
  slug: string;
  email: string;
  fullName: string;
  role: TenantAccountRole;
  status: TenantAccountStatus;
  passwordHash: string;
  temporaryPassword: string;
  mustChangePassword: boolean;
  createdAt: string;
  updatedAt: string;
  lastProvisionedAt?: string;
};

export type TenantAccountSnapshot = {
  tenantId: string;
  clientId: string;
  slug: string;
  hasAdminAccount: boolean;
  accounts: TenantAccountRecord[];
};

export type TenantSessionUser = {
  accountId: string;
  tenantId: string;
  clientId: string;
  slug: string;
  email: string;
  fullName: string;
  role: TenantAccountRole;
  mustChangePassword: boolean;
};

export type TenantRoleOption = {
  value: TenantAccountRole;
  label: string;
  helper: string;
};

export const TENANT_ROLE_OPTIONS: TenantRoleOption[] = [
  {
    value: "owner",
    label: "Owner",
    helper: "Responsable principal del entorno.",
  },
  {
    value: "admin",
    label: "Admin",
    helper: "Puede gestionar configuración, equipo y operativa.",
  },
  {
    value: "manager",
    label: "Manager",
    helper: "Puede organizar trabajo y revisar actividad.",
  },
  {
    value: "staff",
    label: "Staff",
    helper: "Uso diario del ERP sin permisos avanzados.",
  },
];