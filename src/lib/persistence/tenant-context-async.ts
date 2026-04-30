/**
 * Wrapper async dual-mode (postgres | filesystem) sobre tenant-context.
 *
 * En postgres mode, lee la lista de tenants y la definición desde la tabla
 * `Tenant` (campo `definition` Json). En filesystem mode delega a las
 * funciones síncronas originales que leen `.prontara/clients/<id>.json`.
 *
 * Estos wrappers no sustituyen a los sync (que se siguen usando en muchas
 * partes del código). Se usan en los puntos críticos del runtime:
 * resolución de tenant en login, dashboard, alta, etc.
 */
import {
  getTenantDefinition as fsGetTenantDefinition,
  listTenantIds as fsListTenantIds,
  type TenantDefinition,
} from "@/lib/factory/tenant-context";
import { getPersistenceBackend, withPrisma } from "@/lib/persistence/db";

type TenantRow = {
  clientId: string;
  definition: unknown;
  status: string;
};

export async function listTenantIdsAsync(): Promise<string[]> {
  if (getPersistenceBackend() === "postgres") {
    const result = await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        tenant: {
          findMany: (a: {
            select: { clientId: true };
            orderBy: { clientId: "asc" };
          }) => Promise<Array<{ clientId: string }>>;
        };
      };
      return await c.tenant.findMany({
        select: { clientId: true },
        orderBy: { clientId: "asc" },
      });
    });
    return (result || []).map((r) => r.clientId).filter(Boolean);
  }
  return fsListTenantIds();
}

export async function getTenantDefinitionAsync(
  clientId: string,
): Promise<TenantDefinition> {
  if (getPersistenceBackend() === "postgres") {
    const row = await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        tenant: {
          findUnique: (a: {
            where: { clientId: string };
            select: { clientId: true; definition: true; status: true };
          }) => Promise<TenantRow | null>;
        };
      };
      return await c.tenant.findUnique({
        where: { clientId },
        select: { clientId: true, definition: true, status: true },
      });
    });
    if (!row) {
      throw new Error("Tenant not found in Postgres: " + clientId);
    }
    // El campo definition es un JSON con todo el contenido del tenant
    // (clientId, displayName, sector, businessType, branding, modules, etc.)
    const def = (row.definition as TenantDefinition) || ({} as TenantDefinition);
    return def;
  }
  return fsGetTenantDefinition(clientId);
}

export async function getTenantDefinitionSafeAsync(
  clientId: string,
): Promise<TenantDefinition | null> {
  try {
    return await getTenantDefinitionAsync(clientId);
  } catch {
    return null;
  }
}
