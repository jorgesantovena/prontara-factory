/**
 * Permisos granulares por rol + módulo + acción (H2-PERM).
 *
 * 6 acciones soportadas: view / create / edit / delete / approve / export.
 *
 * Defaults hardcoded por rol — el operador del tenant puede sobreescribir
 * por (rol, módulo) con TenantPermissionPolicy. Los defaults son el punto
 * de partida razonable para no obligar a configurar nada en los primeros
 * 1000 tenants.
 */

import { withPrisma, getPersistenceBackend } from "@/lib/persistence/db";

export type PermissionAction = "view" | "create" | "edit" | "delete" | "approve" | "export";

export const ALL_ACTIONS: PermissionAction[] = [
  "view", "create", "edit", "delete", "approve", "export",
];

/**
 * Defaults globales por rol. Si el tenant NO ha configurado nada para
 * (rol, módulo), se aplica esta tabla.
 */
const DEFAULTS: Record<string, PermissionAction[]> = {
  owner: ["view", "create", "edit", "delete", "approve", "export"],
  admin: ["view", "create", "edit", "delete", "approve", "export"],
  manager: ["view", "create", "edit", "approve", "export"],
  staff: ["view", "create", "edit"],
  clienteFinal: ["view"],
  docente: ["view", "create", "edit"],
  familia: ["view"],
  estudiante: ["view"],
};

/**
 * Verifica si un rol puede ejecutar una acción sobre un módulo. Lee
 * primero el override del tenant en TenantPermissionPolicy; si no
 * existe, cae al default global por rol.
 */
export async function canPerform(
  clientId: string,
  role: string,
  moduleKey: string,
  action: PermissionAction,
): Promise<boolean> {
  // 1. Override por tenant (si Postgres está disponible)
  if (getPersistenceBackend() === "postgres" && clientId) {
    try {
      const policy = await withPrisma(async (prisma) => {
        const c = prisma as unknown as {
          tenantPermissionPolicy: {
            findUnique: (a: {
              where: { clientId_role_moduleKey: { clientId: string; role: string; moduleKey: string } };
            }) => Promise<{ actionsCsv: string } | null>;
          };
        };
        return await c.tenantPermissionPolicy.findUnique({
          where: { clientId_role_moduleKey: { clientId, role, moduleKey } },
        });
      });
      if (policy) {
        const allowed = policy.actionsCsv.split(",").map((s) => s.trim());
        return allowed.includes(action);
      }
    } catch {
      // si falla la consulta, caemos al default — no bloqueamos al usuario
    }
  }

  // 2. Default global por rol
  const defaultsForRole = DEFAULTS[role] || [];
  return defaultsForRole.includes(action);
}

/**
 * Devuelve TODAS las políticas de un tenant para un rol dado, mezclando
 * overrides con defaults. Útil para la UI de configuración de permisos.
 */
export async function getEffectivePoliciesForRole(
  clientId: string,
  role: string,
  modules: string[],
): Promise<Array<{ moduleKey: string; actions: PermissionAction[]; isOverride: boolean }>> {
  const overrides = new Map<string, PermissionAction[]>();
  if (getPersistenceBackend() === "postgres" && clientId) {
    try {
      const rows = await withPrisma(async (prisma) => {
        const c = prisma as unknown as {
          tenantPermissionPolicy: {
            findMany: (a: { where: { clientId: string; role: string } }) => Promise<Array<{ moduleKey: string; actionsCsv: string }>>;
          };
        };
        return await c.tenantPermissionPolicy.findMany({
          where: { clientId, role },
        });
      });
      for (const r of rows || []) {
        overrides.set(
          r.moduleKey,
          r.actionsCsv.split(",").map((s) => s.trim() as PermissionAction),
        );
      }
    } catch {
      // ignore
    }
  }

  const defaultsForRole = DEFAULTS[role] || [];
  return modules.map((mk) => {
    const override = overrides.get(mk);
    return {
      moduleKey: mk,
      actions: override ?? defaultsForRole,
      isOverride: override !== undefined,
    };
  });
}

/**
 * Setea o quita un override. Si actions = null/empty, borra el override
 * (vuelve al default).
 */
export async function setPolicyOverride(
  tenantId: string,
  clientId: string,
  role: string,
  moduleKey: string,
  actions: PermissionAction[] | null,
): Promise<void> {
  if (getPersistenceBackend() !== "postgres") return;

  if (!actions || actions.length === 0) {
    await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        tenantPermissionPolicy: {
          deleteMany: (a: { where: { clientId: string; role: string; moduleKey: string } }) => Promise<unknown>;
        };
      };
      await c.tenantPermissionPolicy.deleteMany({
        where: { clientId, role, moduleKey },
      });
    });
    return;
  }

  await withPrisma(async (prisma) => {
    const c = prisma as unknown as {
      tenantPermissionPolicy: {
        upsert: (a: {
          where: { clientId_role_moduleKey: { clientId: string; role: string; moduleKey: string } };
          create: Record<string, unknown>;
          update: Record<string, unknown>;
        }) => Promise<unknown>;
      };
    };
    await c.tenantPermissionPolicy.upsert({
      where: { clientId_role_moduleKey: { clientId, role, moduleKey } },
      create: {
        tenantId,
        clientId,
        role,
        moduleKey,
        actionsCsv: actions.join(","),
      },
      update: {
        actionsCsv: actions.join(","),
      },
    });
  });
}
