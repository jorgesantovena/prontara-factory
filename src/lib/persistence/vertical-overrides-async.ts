/**
 * Wrapper async sobre el store de overrides de verticales que enruta a
 * Postgres o filesystem según PRONTARA_PERSISTENCE.
 *
 * El registry de sector packs (sector-pack-registry.ts) lee overrides de
 * forma SÍNCRONA en cientos de sitios del codebase. Para evitar tener que
 * convertir todo a async, en modo Postgres mantenemos una caché in-memory
 * que se hidrata al arrancar y se invalida al escribir.
 */
import {
  readVerticalOverride as readVerticalOverrideFs,
  listVerticalOverrides as listVerticalOverridesFs,
  writeVerticalOverride as writeVerticalOverrideFs,
  deleteVerticalOverride as deleteVerticalOverrideFs,
  type WriteOverrideInput,
} from "@/lib/factory/sector-pack-override-store";
import type { SectorPackOverride } from "@/lib/factory/sector-pack-override-types";
import { getPersistenceBackend, withPrisma } from "@/lib/persistence/db";

let cachedOverrides: Map<string, SectorPackOverride> | null = null;
let cacheLoadedAt = 0;
const CACHE_TTL_MS = 30 * 1000; // 30s — relevante en serverless

async function ensureCache(): Promise<Map<string, SectorPackOverride>> {
  if (cachedOverrides && Date.now() - cacheLoadedAt < CACHE_TTL_MS) {
    return cachedOverrides;
  }
  const next = new Map<string, SectorPackOverride>();
  const rows = await withPrisma(async (prisma) =>
    prisma.verticalOverride.findMany(),
  );
  if (rows) {
    for (const row of rows) {
      next.set(row.packKey, row.payloadJson as SectorPackOverride);
    }
  }
  cachedOverrides = next;
  cacheLoadedAt = Date.now();
  return next;
}

function invalidateCache() {
  cachedOverrides = null;
  cacheLoadedAt = 0;
}

/**
 * Lee un override (sync). En modo Postgres usa la caché.
 * En modo filesystem va al store de ficheros.
 */
export function readVerticalOverrideHybrid(packKey: string): SectorPackOverride | null {
  if (getPersistenceBackend() === "filesystem") {
    return readVerticalOverrideFs(packKey);
  }
  // Postgres: caché ya hidratada en algún punto del lifecycle del proceso.
  if (!cachedOverrides) return null;
  return cachedOverrides.get(packKey) || null;
}

/**
 * Versión async que garantiza que la caché está hidratada (para usar en
 * APIs y el editor visual del Factory).
 */
export async function readVerticalOverrideAsync(packKey: string): Promise<SectorPackOverride | null> {
  if (getPersistenceBackend() === "filesystem") {
    return readVerticalOverrideFs(packKey);
  }
  const cache = await ensureCache();
  return cache.get(packKey) || null;
}

export async function listVerticalOverridesAsync(): Promise<SectorPackOverride[]> {
  if (getPersistenceBackend() === "filesystem") {
    return listVerticalOverridesFs();
  }
  const cache = await ensureCache();
  return Array.from(cache.values());
}

export async function writeVerticalOverrideAsync(
  input: WriteOverrideInput,
): Promise<SectorPackOverride> {
  if (getPersistenceBackend() === "filesystem") {
    return writeVerticalOverrideFs(input);
  }

  const merged: SectorPackOverride = {
    ...input.override,
    key: input.key.toLowerCase(),
    updatedAt: new Date().toISOString(),
    updatedBy: input.updatedBy || input.override.updatedBy || "unknown",
  };

  await withPrisma(async (prisma) => {
    await prisma.verticalOverride.upsert({
      where: { packKey: merged.key },
      create: {
        packKey: merged.key,
        payloadJson: merged as object,
        updatedBy: merged.updatedBy,
      },
      update: {
        payloadJson: merged as object,
        updatedBy: merged.updatedBy,
      },
    });
  });

  invalidateCache();
  return merged;
}

export async function deleteVerticalOverrideAsync(packKey: string): Promise<boolean> {
  if (getPersistenceBackend() === "filesystem") {
    return deleteVerticalOverrideFs(packKey);
  }
  const result = await withPrisma(async (prisma) => {
    try {
      await prisma.verticalOverride.delete({ where: { packKey: packKey.toLowerCase() } });
      return true;
    } catch {
      return false;
    }
  });
  invalidateCache();
  return Boolean(result);
}
