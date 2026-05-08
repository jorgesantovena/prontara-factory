/**
 * Cache LRU en memoria con TTL (H3-ARQ-02).
 *
 * Para datos calientes que cambian poco: tenant-config, sector-pack
 * resolved, runtime-context. Evita golpear Postgres en cada request.
 *
 * Scope: single Node process. En Vercel cada función serverless tiene
 * su propio Map vivo durante la vida del lambda warm. Cuando se
 * reinicia, el cache se pierde — eso es OK, no es fuente de verdad.
 *
 * Estrategia: LRU clásico con `Map` (Map de JavaScript ya mantiene
 * orden de inserción → al reinsertar movemos al final, al evictar
 * sacamos el primero). TTL es separado por entry.
 */

type Entry<T> = { value: T; expiresAt: number };

export type MemoryCacheOptions = {
  /** Capacidad máxima de entradas. Default 500. */
  maxEntries?: number;
  /** TTL por defecto en ms. Default 5 min. */
  defaultTtlMs?: number;
};

export class MemoryCache<T = unknown> {
  private readonly maxEntries: number;
  private readonly defaultTtlMs: number;
  private readonly map = new Map<string, Entry<T>>();

  constructor(options: MemoryCacheOptions = {}) {
    this.maxEntries = options.maxEntries ?? 500;
    this.defaultTtlMs = options.defaultTtlMs ?? 5 * 60 * 1000;
  }

  get(key: string): T | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.map.delete(key);
      return undefined;
    }
    // LRU touch: re-insert para mover al final
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T, ttlMs?: number): void {
    const ttl = ttlMs ?? this.defaultTtlMs;
    const entry: Entry<T> = { value, expiresAt: Date.now() + ttl };
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.maxEntries) {
      // Evict el más antiguo (primero del Map)
      const firstKey = this.map.keys().next().value;
      if (firstKey !== undefined) this.map.delete(firstKey);
    }
    this.map.set(key, entry);
  }

  delete(key: string): boolean {
    return this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }

  size(): number {
    return this.map.size;
  }

  /**
   * Get-or-compute: si la clave existe y no ha expirado, devuelve.
   * Si no, llama a `compute()`, lo guarda y lo devuelve. Compute puede
   * ser async — el cache solo guarda el valor resuelto.
   */
  async getOrSet(
    key: string,
    compute: () => Promise<T>,
    ttlMs?: number,
  ): Promise<T> {
    const cached = this.get(key);
    if (cached !== undefined) return cached;
    const value = await compute();
    this.set(key, value, ttlMs);
    return value;
  }
}

// Caches singleton compartidos por toda la app.
// Cada uno tiene un namespace distinto para no colisionar.

/** Tenant config resuelto (sector pack + custom fields + permissions). */
export const tenantConfigCache = new MemoryCache<unknown>({
  maxEntries: 500,
  defaultTtlMs: 5 * 60 * 1000, // 5 min
});

/** Resolved sector packs (los packs base raramente cambian). */
export const sectorPackCache = new MemoryCache<unknown>({
  maxEntries: 50,
  defaultTtlMs: 30 * 60 * 1000, // 30 min
});

/** Permission policies resueltas por (clientId, role). */
export const permissionCache = new MemoryCache<unknown>({
  maxEntries: 1000,
  defaultTtlMs: 5 * 60 * 1000,
});

/**
 * Invalida cualquier entrada que contenga el clientId — útil tras
 * mutar custom fields, permission policies, integration config, etc.
 */
export function invalidateCachesForClient(clientId: string): void {
  for (const cache of [tenantConfigCache, sectorPackCache, permissionCache]) {
    // Map no tiene API de "delete by predicate" — iteramos copia.
    const all = Array.from((cache as unknown as { map: Map<string, unknown> }).map.keys());
    for (const k of all) {
      if (k.includes(clientId)) cache.delete(k);
    }
  }
}
