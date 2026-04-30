/**
 * TenantDataStore — interfaz de persistencia por tenant.
 *
 * Cierra la arquitectura del hallazgo F-06. Toda lectura y escritura de datos
 * operativos de un tenant pasa por esta interfaz. Hoy hay dos implementaciones
 * seleccionables por la variable de entorno `PERSISTENCE_BACKEND`:
 *
 *   - `json` (default): `JsonFileTenantDataStore` escribe en
 *     `.prontara/data/<clientId>/<module>.json` con los helpers atómicos de
 *     `src/lib/saas/fs-atomic.ts`.
 *   - `prisma`: `PrismaTenantDataStore` usa `@prisma/client` contra la base
 *     de datos descrita en `prisma/schema.prisma`. Requiere `DATABASE_URL`
 *     y migraciones aplicadas.
 *
 * El flag permite migrar dominio a dominio (ver
 * `docs/persistence-migration-plan.md`) sin reescribir los call sites.
 * Los consumidores solo importan `getTenantDataStore()`.
 */

import type { PrismaTenantDataStore } from "./prisma-tenant-data-store";
import type { JsonFileTenantDataStore } from "./json-tenant-data-store";

export type TenantRecordBase = {
  id: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
};

export type ListOptions = {
  limit?: number;
  offset?: number;
  orderBy?: { field: string; direction: "asc" | "desc" };
};

export interface TenantDataStore {
  /**
   * Listar registros de un módulo para un tenant. Obligatorio pasar clientId
   * (ya validado contra la sesión firmada en la capa que invoca esto).
   */
  list<T extends TenantRecordBase = TenantRecordBase>(
    clientId: string,
    moduleKey: string,
    options?: ListOptions,
  ): Promise<T[]>;

  get<T extends TenantRecordBase = TenantRecordBase>(
    clientId: string,
    moduleKey: string,
    id: string,
  ): Promise<T | null>;

  create<T extends TenantRecordBase = TenantRecordBase>(
    clientId: string,
    moduleKey: string,
    record: Omit<T, "id" | "createdAt" | "updatedAt">,
  ): Promise<T>;

  update<T extends TenantRecordBase = TenantRecordBase>(
    clientId: string,
    moduleKey: string,
    id: string,
    patch: Partial<Omit<T, "id" | "createdAt" | "updatedAt">>,
  ): Promise<T | null>;

  remove(clientId: string, moduleKey: string, id: string): Promise<boolean>;

  /**
   * Borrar todo el dataset de un tenant. Usado en rollback de provisioning
   * y en `clearActiveClientId`. Escritura poco frecuente, batch.
   */
  dropTenant(clientId: string): Promise<void>;
}

export type PersistenceBackend = "json" | "prisma";

function resolveBackend(): PersistenceBackend {
  const raw = (process.env.PERSISTENCE_BACKEND || "").trim().toLowerCase();
  if (raw === "prisma") return "prisma";
  return "json";
}

let cached: TenantDataStore | null = null;

/**
 * Devuelve la única instancia del store para el proceso. El backend se
 * resuelve en el primer acceso; cambiar la env requiere reiniciar el proceso.
 *
 * Async para permitir la carga perezosa de `@prisma/client` solo cuando
 * `PERSISTENCE_BACKEND=prisma`. En el camino caliente, el caché evita el
 * await repetido.
 */
export async function getTenantDataStore(): Promise<TenantDataStore> {
  if (cached) return cached;

  const backend = resolveBackend();
  if (backend === "prisma") {
    // Import dinámico para que el bundle JSON no cargue @prisma/client si no
    // está activado el flag. En sandbox sin DATABASE_URL, esta ruta no se usa.
    const mod = await import("./prisma-tenant-data-store") as { PrismaTenantDataStore: new () => PrismaTenantDataStore };
    cached = new mod.PrismaTenantDataStore();
    return cached;
  }

  const mod = await import("./json-tenant-data-store") as { JsonFileTenantDataStore: new () => JsonFileTenantDataStore };
  cached = new mod.JsonFileTenantDataStore();
  return cached;
}

/**
 * Variante síncrona: solo sirve si ya se ha llamado al menos una vez a
 * `getTenantDataStore` y cacheado el backend. Si no, lanza. Útil en caminos
 * calientes donde no queremos volver a pagar el await.
 */
export function getTenantDataStoreSync(): TenantDataStore {
  if (!cached) {
    throw new Error(
      "TenantDataStore no inicializado. Llama a getTenantDataStore() al arrancar el request.",
    );
  }
  return cached;
}

/**
 * Solo para tests. Permite inyectar un mock limpio y olvidarse del caché.
 */
export function __setTenantDataStoreForTests(store: TenantDataStore | null): void {
  cached = store;
}
