/**
 * Resolver de custom fields (DEV-CF).
 *
 * Lee los campos personalizados del tenant desde la tabla
 * TenantCustomField y los devuelve en formato compatible con
 * SectorPackField. Se aplican en runtime al config del tenant
 * DESPUÉS de los core modules — los custom fields son los de mayor
 * prioridad (override total del pack si coincide moduleKey+fieldKey).
 *
 * Solo opera en modo Postgres. En filesystem devuelve [].
 */
import { withPrisma, getPersistenceBackend } from "@/lib/persistence/db";
import type { SectorPackField } from "@/lib/factory/sector-pack-definition";

type DbCustomField = {
  moduleKey: string;
  fieldKey: string;
  label: string;
  kind: string;
  required: boolean;
  placeholder: string | null;
  optionsJson: unknown;
  position: number;
};

export async function getCustomFieldsAsync(clientId: string): Promise<SectorPackField[]> {
  if (getPersistenceBackend() !== "postgres") return [];
  if (!clientId) return [];

  const rows = await withPrisma(async (prisma) => {
    const c = prisma as unknown as {
      tenantCustomField: {
        findMany: (a: {
          where: { clientId: string };
          orderBy: { position: "asc" };
        }) => Promise<DbCustomField[]>;
      };
    };
    return await c.tenantCustomField.findMany({
      where: { clientId },
      orderBy: { position: "asc" },
    });
  });

  return ((rows as DbCustomField[]) || []).map((r) => {
    const optionsRaw = r.optionsJson;
    const options = Array.isArray(optionsRaw)
      ? (optionsRaw as Array<{ value: string; label: string }>)
      : undefined;
    return {
      moduleKey: r.moduleKey,
      fieldKey: r.fieldKey,
      label: r.label,
      kind: r.kind as SectorPackField["kind"],
      required: r.required,
      placeholder: r.placeholder || undefined,
      options: options && options.length > 0 ? options : undefined,
    };
  });
}

/**
 * Aplica los custom fields al config del tenant. Si un custom field
 * tiene mismo moduleKey+fieldKey que uno del pack, REEMPLAZA al del
 * pack (override total). Si es nuevo, se añade.
 */
export function applyCustomFieldsToConfig<T extends {
  fieldsByModule: Record<string, SectorPackField[]>;
}>(config: T, customFields: SectorPackField[]): T {
  for (const cf of customFields) {
    if (!config.fieldsByModule[cf.moduleKey]) {
      config.fieldsByModule[cf.moduleKey] = [];
    }
    const arr = config.fieldsByModule[cf.moduleKey];
    const existingIdx = arr.findIndex((f) => f.fieldKey === cf.fieldKey);
    if (existingIdx >= 0) {
      arr[existingIdx] = cf;
    } else {
      arr.push(cf);
    }
  }
  return config;
}
