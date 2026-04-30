import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { writeJsonAtomic } from "@/lib/saas/fs-atomic";
import type {
  EvolutionHistoryEntry,
  EvolutionRuntimeSnapshot,
} from "@/lib/saas/evolution-definition";

export type EvolutionSnapshot = {
  version: string;
  runtimeConfig: Record<string, unknown>;
  createdAt: string;
  notes?: string;
};

export type EvolutionState = {
  tenantId: string;
  clientId: string;
  slug: string;
  currentVersion: string;
  currentRuntimeConfig: Record<string, unknown>;
  history: EvolutionSnapshot[];
  createdAt: string;
  updatedAt: string;
};

function ensureDirectory(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function getProjectRoot(): string {
  return /*turbopackIgnore: true*/ process.cwd();
}

function getEvolutionRootDir(): string {
  const dirPath = path.join(getProjectRoot(), "data", "saas", "evolution");
  ensureDirectory(dirPath);
  return dirPath;
}

function normalizeClientId(clientId: string): string {
  const safeClientId = String(clientId || "").trim();
  if (!safeClientId) {
    throw new Error("Falta clientId para resolver evolution.");
  }

  return safeClientId;
}

function getTenantEvolutionDir(clientId: string): string {
  const dirPath = path.join(getEvolutionRootDir(), normalizeClientId(clientId));
  ensureDirectory(dirPath);
  return dirPath;
}

function getCurrentRuntimeConfigFilePath(clientId: string): string {
  return path.join(getTenantEvolutionDir(clientId), "current-runtime-config.json");
}

function getHistoryFilePath(clientId: string): string {
  return path.join(getTenantEvolutionDir(clientId), "history.json");
}

function readJsonSafe<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(filePath: string, value: unknown) {
  writeJsonAtomic(filePath, value);
}

function normalizeHistory(value: EvolutionSnapshot[] | null | undefined): EvolutionSnapshot[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item) => {
    return Boolean(
      item &&
      typeof item === "object" &&
      typeof item.version === "string" &&
      typeof item.createdAt === "string"
    );
  });
}

export function getCurrentRuntimeConfig(clientId: string): Record<string, unknown> | null {
  return readJsonSafe<Record<string, unknown>>(getCurrentRuntimeConfigFilePath(clientId));
}

export function getEvolutionHistory(clientId: string): EvolutionSnapshot[] {
  return normalizeHistory(readJsonSafe<EvolutionSnapshot[]>(getHistoryFilePath(clientId)));
}

export function getOrCreateEvolutionState(input: {
  tenantId: string;
  clientId: string;
  slug: string;
  runtimeConfig?: Record<string, unknown>;
  version?: string;
}): EvolutionState {
  const currentRuntimeConfigFilePath = getCurrentRuntimeConfigFilePath(input.clientId);
  const historyFilePath = getHistoryFilePath(input.clientId);

  const existingRuntimeConfig =
    readJsonSafe<Record<string, unknown>>(currentRuntimeConfigFilePath);

  const existingHistory =
    normalizeHistory(readJsonSafe<EvolutionSnapshot[]>(historyFilePath));

  const now = new Date().toISOString();
  const currentVersion = String(input.version || "v1").trim() || "v1";
  const currentRuntimeConfig = existingRuntimeConfig || input.runtimeConfig || {};

  if (!existingRuntimeConfig) {
    writeJson(currentRuntimeConfigFilePath, currentRuntimeConfig);
  }

  if (!fs.existsSync(historyFilePath)) {
    writeJson(historyFilePath, existingHistory);
  }

  return {
    tenantId: String(input.tenantId || "").trim(),
    clientId: normalizeClientId(input.clientId),
    slug: String(input.slug || "").trim(),
    currentVersion,
    currentRuntimeConfig,
    history: existingHistory,
    createdAt: existingHistory[existingHistory.length - 1]?.createdAt || now,
    updatedAt: now,
  };
}

export function saveEvolutionState(state: EvolutionState): EvolutionState {
  const normalized: EvolutionState = {
    ...state,
    clientId: normalizeClientId(state.clientId),
    tenantId: String(state.tenantId || "").trim(),
    slug: String(state.slug || "").trim(),
    currentVersion: String(state.currentVersion || "v1").trim() || "v1",
    currentRuntimeConfig:
      state.currentRuntimeConfig && typeof state.currentRuntimeConfig === "object"
        ? state.currentRuntimeConfig
        : {},
    history: normalizeHistory(state.history),
    updatedAt: new Date().toISOString(),
  };

  writeJson(
    getCurrentRuntimeConfigFilePath(normalized.clientId),
    normalized.currentRuntimeConfig
  );

  writeJson(
    getHistoryFilePath(normalized.clientId),
    normalized.history
  );

  return normalized;
}

export function applyEvolutionSnapshot(input: {
  tenantId: string;
  clientId: string;
  slug: string;
  version: string;
  runtimeConfig: Record<string, unknown>;
  notes?: string;
}): EvolutionState {
  const current = getOrCreateEvolutionState({
    tenantId: input.tenantId,
    clientId: input.clientId,
    slug: input.slug,
    runtimeConfig: input.runtimeConfig,
    version: input.version,
  });

  const snapshot: EvolutionSnapshot = {
    version: String(input.version || "").trim() || current.currentVersion,
    runtimeConfig:
      input.runtimeConfig && typeof input.runtimeConfig === "object"
        ? input.runtimeConfig
        : {},
    createdAt: new Date().toISOString(),
    notes: typeof input.notes === "string" && input.notes.trim()
      ? input.notes.trim()
      : undefined,
  };

  return saveEvolutionState({
    ...current,
    currentVersion: snapshot.version,
    currentRuntimeConfig: snapshot.runtimeConfig,
    history: [snapshot, ...current.history],
  });
}

export function rollbackEvolution(input: {
  tenantId: string;
  clientId: string;
  slug: string;
}): EvolutionState {
  const current = getOrCreateEvolutionState(input);

  if (current.history.length === 0) {
    throw new Error("No hay snapshots de evolución para hacer rollback.");
  }

  const [target, ...rest] = current.history;

  return saveEvolutionState({
    ...current,
    currentVersion: target.version,
    currentRuntimeConfig: target.runtimeConfig,
    history: rest,
  });
}

/* -----------------------------------------------------------------------------
 * Modern evolution API — used by evolution-engine.ts
 *
 * Stores a richer snapshot (EvolutionRuntimeSnapshot from evolution-definition)
 * alongside a history log of actions. Lives next to the legacy store so that
 * both worlds coexist while the runtime unifies.
 * ---------------------------------------------------------------------------*/

function getCurrentSnapshotFilePath(clientId: string): string {
  return path.join(getTenantEvolutionDir(clientId), "current-snapshot.json");
}

function getHistoryLogFilePath(clientId: string): string {
  return path.join(getTenantEvolutionDir(clientId), "history-log.json");
}

export function getEvolutionCurrentSnapshot(
  clientId: string
): EvolutionRuntimeSnapshot | null {
  return readJsonSafe<EvolutionRuntimeSnapshot>(getCurrentSnapshotFilePath(clientId));
}

export function saveEvolutionCurrentSnapshot(
  clientId: string,
  snapshot: EvolutionRuntimeSnapshot
): EvolutionRuntimeSnapshot {
  writeJsonAtomic(getCurrentSnapshotFilePath(clientId), snapshot);
  return snapshot;
}

function normalizeHistoryLog(
  value: EvolutionHistoryEntry[] | null | undefined
): EvolutionHistoryEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item) => {
    return Boolean(
      item &&
      typeof item === "object" &&
      typeof item.id === "string" &&
      typeof item.actionType === "string"
    );
  });
}

export function listEvolutionHistory(clientId: string): EvolutionHistoryEntry[] {
  return normalizeHistoryLog(
    readJsonSafe<EvolutionHistoryEntry[]>(getHistoryLogFilePath(clientId))
  );
}

export function appendEvolutionHistory(
  clientId: string,
  entry: Omit<EvolutionHistoryEntry, "id" | "createdAt"> & {
    id?: string;
    createdAt?: string;
  }
): EvolutionHistoryEntry {
  const history = listEvolutionHistory(clientId);
  const fullEntry: EvolutionHistoryEntry = {
    ...entry,
    id: entry.id || randomUUID(),
    createdAt: entry.createdAt || new Date().toISOString(),
  };

  const nextHistory = [fullEntry, ...history];
  writeJsonAtomic(getHistoryLogFilePath(clientId), nextHistory);
  return fullEntry;
}