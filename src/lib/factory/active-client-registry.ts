import fs from "node:fs";
import path from "node:path";
import { writeJsonAtomic } from "@/lib/saas/fs-atomic";

export type ActiveClientState = {
  clientId: string | null;
  updatedAt: string;
};

function getProjectRoot(): string {
  return process.cwd();
}

function getRegistryPath(): string {
  return path.join(getProjectRoot(), "data", "factory", "active-client.json");
}

function getLegacyPath(): string {
  return path.join(getProjectRoot(), ".prontara", "current-client.txt");
}

function ensureDir(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

/**
 * One-shot migration: if the canonical registry file does not exist but the
 * legacy `.prontara/current-client.txt` file still lives on disk, read the
 * clientId from it, seed the JSON registry, and delete the legacy file.
 *
 * Called lazily from every read path. After the first successful call the
 * legacy file is gone and this becomes a no-op.
 */
function migrateLegacyRegistryIfNeeded(): void {
  const registryPath = getRegistryPath();
  if (fs.existsSync(registryPath)) {
    // Registry is canonical. If a stale legacy file still exists, drop it.
    const legacyPath = getLegacyPath();
    if (fs.existsSync(legacyPath)) {
      try { fs.unlinkSync(legacyPath); } catch { /* best effort */ }
    }
    return;
  }

  const legacyPath = getLegacyPath();
  if (!fs.existsSync(legacyPath)) {
    return;
  }

  try {
    const raw = fs.readFileSync(legacyPath, "utf8").trim();
    const clientId = raw && raw !== "" ? raw : null;

    ensureDir(registryPath);
    const migrated: ActiveClientState = {
      clientId,
      updatedAt: new Date().toISOString(),
    };
    writeJsonAtomic(registryPath, migrated);

    fs.unlinkSync(legacyPath);
  } catch {
    // If migration fails we leave the legacy file in place and fall back to
    // the empty state. A subsequent setActiveClientId call will rewrite the
    // registry cleanly.
  }
}

export function getActiveClientState(): ActiveClientState {
  migrateLegacyRegistryIfNeeded();

  const registryPath = getRegistryPath();

  if (!fs.existsSync(registryPath)) {
    return {
      clientId: null,
      updatedAt: new Date(0).toISOString(),
    };
  }

  const raw = fs.readFileSync(registryPath, "utf8").trim();
  if (!raw) {
    return {
      clientId: null,
      updatedAt: new Date(0).toISOString(),
    };
  }

  const parsed = JSON.parse(raw) as Partial<ActiveClientState>;

  return {
    clientId: typeof parsed.clientId === "string" && parsed.clientId.trim() !== "" ? parsed.clientId.trim() : null,
    updatedAt: typeof parsed.updatedAt === "string" && parsed.updatedAt.trim() !== "" ? parsed.updatedAt : new Date().toISOString(),
  };
}

export function getActiveClientId(): string | null {
  return getActiveClientState().clientId;
}

export function setActiveClientId(clientId: string): string {
  const normalized = clientId.trim();
  if (!normalized) {
    throw new Error("clientId cannot be empty");
  }

  const state: ActiveClientState = {
    clientId: normalized,
    updatedAt: new Date().toISOString(),
  };

  const registryPath = getRegistryPath();
  ensureDir(registryPath);
  writeJsonAtomic(registryPath, state);

  // Drop legacy file if it somehow reappeared.
  const legacyPath = getLegacyPath();
  if (fs.existsSync(legacyPath)) {
    try { fs.unlinkSync(legacyPath); } catch { /* best effort */ }
  }

  return normalized;
}

export function clearActiveClientId(): void {
  const state: ActiveClientState = {
    clientId: null,
    updatedAt: new Date().toISOString(),
  };

  const registryPath = getRegistryPath();
  ensureDir(registryPath);
  writeJsonAtomic(registryPath, state);

  const legacyPath = getLegacyPath();
  if (fs.existsSync(legacyPath)) {
    try { fs.unlinkSync(legacyPath); } catch { /* best effort */ }
  }
}
