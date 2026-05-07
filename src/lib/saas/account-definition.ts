/**
 * Roles soportados por las cuentas del runtime del tenant.
 *
 * - owner / admin / manager / staff: roles operativos internos del tenant.
 * - clienteFinal (SF-11): rol restringido — cliente del tenant ve SOLO
 *   sus propios justificantes. Filtrado por match `fullName == cliente`.
 * - docente / familia / estudiante (SCHOOL-07): roles del vertical
 *   colegio para portales diferenciados. Filtrado:
 *     - docente: ve clases/calificaciones/horarios donde `docente == fullName`
 *     - familia: ve alumnos/recibos/comunicaciones donde `cliente|familia == fullName`
 *     - estudiante: ve sus propias calificaciones/asistencia donde `alumno == fullName`
 */
export type TenantAccountRole =
  | "owner"
  | "admin"
  | "manager"
  | "staff"
  | "clienteFinal"
  | "docente"
  | "familia"
  | "estudiante";
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