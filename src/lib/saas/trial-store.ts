import fs from "node:fs";
import path from "node:path";
import { writeJsonAtomic } from "@/lib/saas/fs-atomic";

export type TrialState = {
  tenantId: string;
  clientId: string;
  slug: string;
  plan: "trial";
  status: "active" | "expired";
  trialDays: number;
  daysRemaining: number;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
};

function ensureDirectory(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function getProjectRoot(): string {
  return /*turbopackIgnore: true*/ process.cwd();
}

function getTrialRootDir(): string {
  const dirPath = path.join(getProjectRoot(), "data", "saas", "trial");
  ensureDirectory(dirPath);
  return dirPath;
}

function normalizeClientId(clientId: string): string {
  const safeClientId = String(clientId || "").trim();
  if (!safeClientId) {
    throw new Error("Falta clientId para resolver el estado de trial.");
  }

  return safeClientId;
}

function getTrialFilePath(clientId: string): string {
  return path.join(getTrialRootDir(), normalizeClientId(clientId) + ".json");
}

function addDays(base: Date, days: number) {
  const next = new Date(base.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

function getDaysRemaining(expiresAt: string): number {
  const expiresMs = new Date(expiresAt).getTime();
  const nowMs = Date.now();

  if (!Number.isFinite(expiresMs)) {
    return 0;
  }

  const diffMs = expiresMs - nowMs;
  const dayMs = 24 * 60 * 60 * 1000;

  return diffMs <= 0 ? 0 : Math.ceil(diffMs / dayMs);
}

function normalizeTrialState(value: TrialState): TrialState {
  const daysRemaining = getDaysRemaining(value.expiresAt);

  return {
    ...value,
    status: daysRemaining > 0 ? "active" : "expired",
    daysRemaining,
  };
}

function readTrialStateSafe(filePath: string): TrialState | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw) as TrialState;
    return normalizeTrialState(parsed);
  } catch {
    return null;
  }
}

function writeTrialState(filePath: string, value: TrialState) {
  writeJsonAtomic(filePath, value);
}

export function getOrCreateTrialState(input: {
  tenantId: string;
  clientId: string;
  slug: string;
}): TrialState {
  const filePath = getTrialFilePath(input.clientId);
  const existing = readTrialStateSafe(filePath);

  if (existing) {
    return existing;
  }

  const now = new Date();
  const expiresAt = addDays(now, 14).toISOString();

  const created: TrialState = {
    tenantId: input.tenantId,
    clientId: normalizeClientId(input.clientId),
    slug: String(input.slug || "").trim(),
    plan: "trial",
    status: "active",
    trialDays: 14,
    daysRemaining: 14,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    expiresAt,
  };

  writeTrialState(filePath, created);
  return created;
}

export function saveTrialState(state: TrialState): TrialState {
  const normalized: TrialState = normalizeTrialState({
    ...state,
    clientId: normalizeClientId(state.clientId),
    slug: String(state.slug || "").trim(),
    updatedAt: new Date().toISOString(),
  });

  writeTrialState(getTrialFilePath(normalized.clientId), normalized);
  return normalized;
}

export function refreshTrialState(input: {
  tenantId: string;
  clientId: string;
  slug: string;
}): TrialState {
  const current = getOrCreateTrialState(input);
  return saveTrialState(current);
}

export function isTrialAccessAllowed(state: TrialState): boolean {
  return normalizeTrialState(state).status === "active";
}