/**
 * Implementación JSON del TenantDataStore. Respeta los contratos de
 * `docs/tenant-model.md` y usa los helpers atómicos de `fs-atomic.ts`
 * (cierre de F-03). No se usa cache: la única fuente de verdad es el disco.
 *
 * Layout:
 *   .prontara/data/<clientId>/<moduleKey>.json  →  { records: T[] }
 */

import fs from "node:fs";
import path from "node:path";
import { writeJsonAtomic } from "@/lib/saas/fs-atomic";
import type {
  ListOptions,
  TenantDataStore,
  TenantRecordBase,
} from "./tenant-data-store";

const PROJECT_ROOT = process.cwd();
const DATA_ROOT = path.join(PROJECT_ROOT, ".prontara", "data");

function moduleFile(clientId: string, moduleKey: string): string {
  if (!clientId || !/^[a-zA-Z0-9_-]+$/.test(clientId)) {
    throw new Error("clientId inválido");
  }
  if (!moduleKey || !/^[a-zA-Z0-9_-]+$/.test(moduleKey)) {
    throw new Error("moduleKey inválido");
  }
  return path.join(DATA_ROOT, clientId, moduleKey + ".json");
}

type FilePayload<T> = { records: T[] };

function readAll<T extends TenantRecordBase>(file: string): T[] {
  if (!fs.existsSync(file)) return [];
  const raw = fs.readFileSync(file, "utf8").trim();
  if (!raw) return [];
  const parsed = JSON.parse(raw) as FilePayload<T> | T[];
  if (Array.isArray(parsed)) return parsed;
  return Array.isArray(parsed.records) ? parsed.records : [];
}

function writeAll<T extends TenantRecordBase>(file: string, records: T[]): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const payload: FilePayload<T> = { records };
  writeJsonAtomic(file, payload);
}

function applyListOptions<T extends TenantRecordBase>(records: T[], options?: ListOptions): T[] {
  let out = records;

  if (options?.orderBy) {
    const { field, direction } = options.orderBy;
    out = [...out].sort((a, b) => {
      const av = a[field];
      const bv = b[field];
      if (av === bv) return 0;
      if (av === undefined || av === null) return 1;
      if (bv === undefined || bv === null) return -1;
      const cmp = av < bv ? -1 : 1;
      return direction === "desc" ? -cmp : cmp;
    });
  }

  if (options?.offset) out = out.slice(options.offset);
  if (options?.limit !== undefined) out = out.slice(0, options.limit);

  return out;
}

function generateId(): string {
  // cuid-like lightweight id. Suficiente para desarrollo; en Prisma lo cubre @default(cuid()).
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return "r" + ts + rand;
}

export class JsonFileTenantDataStore implements TenantDataStore {
  async list<T extends TenantRecordBase = TenantRecordBase>(
    clientId: string,
    moduleKey: string,
    options?: ListOptions,
  ): Promise<T[]> {
    const records = readAll<T>(moduleFile(clientId, moduleKey));
    return applyListOptions(records, options);
  }

  async get<T extends TenantRecordBase = TenantRecordBase>(
    clientId: string,
    moduleKey: string,
    id: string,
  ): Promise<T | null> {
    const records = readAll<T>(moduleFile(clientId, moduleKey));
    return records.find((r) => r.id === id) ?? null;
  }

  async create<T extends TenantRecordBase = TenantRecordBase>(
    clientId: string,
    moduleKey: string,
    record: Omit<T, "id" | "createdAt" | "updatedAt">,
  ): Promise<T> {
    const file = moduleFile(clientId, moduleKey);
    const records = readAll<T>(file);
    const now = new Date().toISOString();
    const created = {
      ...record,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    } as T;
    records.push(created);
    writeAll(file, records);
    return created;
  }

  async update<T extends TenantRecordBase = TenantRecordBase>(
    clientId: string,
    moduleKey: string,
    id: string,
    patch: Partial<Omit<T, "id" | "createdAt" | "updatedAt">>,
  ): Promise<T | null> {
    const file = moduleFile(clientId, moduleKey);
    const records = readAll<T>(file);
    const idx = records.findIndex((r) => r.id === id);
    if (idx === -1) return null;

    const current = records[idx];
    const next = {
      ...current,
      ...patch,
      id: current.id,
      createdAt: current.createdAt,
      updatedAt: new Date().toISOString(),
    } as T;
    records[idx] = next;
    writeAll(file, records);
    return next;
  }

  async remove(clientId: string, moduleKey: string, id: string): Promise<boolean> {
    const file = moduleFile(clientId, moduleKey);
    const records = readAll(file);
    const filtered = records.filter((r) => r.id !== id);
    if (filtered.length === records.length) return false;
    writeAll(file, filtered);
    return true;
  }

  async dropTenant(clientId: string): Promise<void> {
    if (!clientId || !/^[a-zA-Z0-9_-]+$/.test(clientId)) {
      throw new Error("clientId inválido");
    }
    const dir = path.join(DATA_ROOT, clientId);
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
}
