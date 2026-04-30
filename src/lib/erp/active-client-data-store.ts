import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { resolveModuleDataFile } from "@/lib/erp/module-data-files";
import { getTenantDataRoot } from "@/lib/factory/tenant-context";
import { getActiveClientId } from "@/lib/factory/active-client-registry";
import { writeJsonAtomic } from "@/lib/saas/fs-atomic";

function ensureDirectory(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function resolveStoreClientId(clientId?: string): string {
  const explicitClientId = String(clientId || "").trim();
  if (explicitClientId) {
    return explicitClientId;
  }

  const activeClientId = String(getActiveClientId() || "").trim();
  if (activeClientId) {
    return activeClientId;
  }

  throw new Error(
    "No se ha podido resolver el clientId para los datos operativos. Pasa clientId explícitamente o define el cliente activo en data/factory/active-client.json."
  );
}

function getDataRootDir(clientId?: string): string {
  const resolvedClientId = resolveStoreClientId(clientId);
  const dirPath = getTenantDataRoot(resolvedClientId);
  ensureDirectory(dirPath);
  return dirPath;
}

function getModuleFilePath(moduleKey: string, clientId?: string): string {
  return path.join(getDataRootDir(clientId), resolveModuleDataFile(moduleKey));
}

function readJsonArraySafe(filePath: string): Array<Record<string, string>> {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeJsonArray(filePath: string, rows: Array<Record<string, string>>) {
  writeJsonAtomic(filePath, rows);
}

function normalizeRows(rows: Array<Record<string, unknown>>): Array<Record<string, string>> {
  return rows.map((row) => {
    const next: Record<string, string> = {};
    for (const [key, value] of Object.entries(row || {})) {
      next[key] = value == null ? "" : String(value);
    }
    return next;
  });
}

export function listModuleRecords(moduleKey: string, clientId?: string): Array<Record<string, string>> {
  return readJsonArraySafe(getModuleFilePath(moduleKey, clientId));
}

export function saveModuleRecords(
  moduleKey: string,
  rows: Array<Record<string, unknown>>,
  clientId?: string
) {
  writeJsonArray(getModuleFilePath(moduleKey, clientId), normalizeRows(rows));
}

export function createModuleRecord(
  moduleKey: string,
  payload: Record<string, unknown>,
  clientId?: string
): Record<string, string> {
  const rows = listModuleRecords(moduleKey, clientId);
  const now = new Date().toISOString();
  const created: Record<string, string> = {
    id: String(payload.id || randomUUID()),
    createdAt: String(payload.createdAt || now),
    updatedAt: now,
  };

  for (const [key, value] of Object.entries(payload)) {
    created[key] = value == null ? "" : String(value);
  }

  rows.unshift(created);
  saveModuleRecords(moduleKey, rows, clientId);
  return created;
}

export function updateModuleRecord(
  moduleKey: string,
  recordId: string,
  payload: Record<string, unknown>,
  clientId?: string
): Record<string, string> {
  const rows = listModuleRecords(moduleKey, clientId);
  const index = rows.findIndex((item) => String(item.id || "") === String(recordId || ""));

  if (index < 0) {
    throw new Error("No existe el registro indicado.");
  }

  const current = rows[index];
  const next: Record<string, string> = {
    ...current,
    updatedAt: new Date().toISOString(),
  };

  for (const [key, value] of Object.entries(payload)) {
    if (key === "id" || key === "createdAt") {
      continue;
    }
    next[key] = value == null ? "" : String(value);
  }

  rows[index] = next;
  saveModuleRecords(moduleKey, rows, clientId);
  return next;
}

export function deleteModuleRecord(
  moduleKey: string,
  recordId: string,
  clientId?: string
): { ok: true } {
  const rows = listModuleRecords(moduleKey, clientId);
  const next = rows.filter((item) => String(item.id || "") !== String(recordId || ""));

  if (next.length === rows.length) {
    throw new Error("No existe el registro indicado.");
  }

  saveModuleRecords(moduleKey, next, clientId);
  return { ok: true };
}