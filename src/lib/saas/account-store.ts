import fs from "node:fs";
import path from "node:path";
import {
  createHash,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import type {
  TenantAccountRecord,
  TenantAccountSnapshot,
  TenantAccountRole,
  TenantAccountStatus,
} from "@/lib/saas/account-definition";
import { writeJsonAtomic } from "@/lib/saas/fs-atomic";

function ensureDirectory(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function getProjectRoot(): string {
  return /*turbopackIgnore: true*/ process.cwd();
}

function getAccountsRootDir(): string {
  const dirPath = path.join(getProjectRoot(), "data", "saas", "accounts");
  ensureDirectory(dirPath);
  return dirPath;
}

function normalizeClientId(clientId: string): string {
  const safeClientId = String(clientId || "").trim();
  if (!safeClientId) {
    throw new Error("Falta clientId para resolver cuentas del tenant.");
  }

  return safeClientId;
}

function getTenantAccountsFilePath(clientId: string): string {
  return path.join(getAccountsRootDir(), normalizeClientId(clientId) + ".json");
}

function readJsonArraySafe(filePath: string): TenantAccountRecord[] {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed as TenantAccountRecord[];
  } catch {
    return [];
  }
}

function writeJsonArray(filePath: string, rows: TenantAccountRecord[]) {
  writeJsonAtomic(filePath, rows);
}

/*
 * Password hashing uses Node's built-in scrypt, which is:
 *   - memory-hard (defeats GPU/ASIC attacks, unlike SHA-256)
 *   - salted per-password (defeats rainbow tables)
 *   - available without external dependencies (Node >= 10)
 *
 * Stored format: "scrypt$N$r$p$saltBase64$hashBase64" (version 1).
 * Legacy format: 64-char SHA-256 hex digest — still accepted for login so
 * existing accounts keep working, then lazily upgraded to scrypt.
 */
const SCRYPT_N = 16384; // CPU/memory cost
const SCRYPT_R = 8;     // block size
const SCRYPT_P = 1;     // parallelization
const SCRYPT_KEYLEN = 64;
const SCRYPT_SALT_BYTES = 16;
const SCRYPT_PREFIX = "scrypt$";

export function isScryptHash(value: string): boolean {
  return typeof value === "string" && value.startsWith(SCRYPT_PREFIX);
}

/**
 * Hashes a plaintext password using scrypt. This is the only function that
 * should be used for new passwords.
 */
export function hashPassword(value: string): string {
  const plain = String(value || "");
  const salt = randomBytes(SCRYPT_SALT_BYTES);
  const derived = scryptSync(plain, salt, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  return (
    SCRYPT_PREFIX +
    SCRYPT_N +
    "$" +
    SCRYPT_R +
    "$" +
    SCRYPT_P +
    "$" +
    salt.toString("base64") +
    "$" +
    derived.toString("base64")
  );
}

/**
 * Legacy SHA-256 hash, kept only to compare against old account records that
 * were created before we migrated to scrypt. Callers MUST NOT use this for
 * new passwords — they should call hashPassword() instead.
 */
export function legacySha256Hash(value: string): string {
  return createHash("sha256").update(String(value || "")).digest("hex");
}

function verifyScryptHash(plain: string, stored: string): boolean {
  // stored = "scrypt$N$r$p$saltB64$hashB64"
  const parts = stored.slice(SCRYPT_PREFIX.length).split("$");
  if (parts.length !== 5) {
    return false;
  }

  const [nStr, rStr, pStr, saltB64, hashB64] = parts;
  const N = Number(nStr);
  const r = Number(rStr);
  const p = Number(pStr);
  if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) {
    return false;
  }

  try {
    const salt = Buffer.from(saltB64, "base64");
    const expected = Buffer.from(hashB64, "base64");
    const derived = scryptSync(plain, salt, expected.length, { N, r, p });
    if (derived.length !== expected.length) {
      return false;
    }
    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

/**
 * Verifies a plaintext password against a stored hash. Supports:
 *   - scrypt hashes (current format)
 *   - legacy SHA-256 hex digests (for accounts created before the migration)
 *
 * Returns `{ ok, needsRehash }` so callers can transparently upgrade legacy
 * accounts to scrypt on a successful login.
 */
export function verifyPassword(
  plain: string,
  storedHash: string
): { ok: boolean; needsRehash: boolean } {
  const pwd = String(plain || "");
  const hash = String(storedHash || "");

  if (!hash) {
    return { ok: false, needsRehash: false };
  }

  if (isScryptHash(hash)) {
    return { ok: verifyScryptHash(pwd, hash), needsRehash: false };
  }

  // Legacy path: 64-char hex SHA-256.
  const legacy = legacySha256Hash(pwd);
  if (legacy.length === hash.length && legacy === hash) {
    return { ok: true, needsRehash: true };
  }

  return { ok: false, needsRehash: false };
}

export function generateTemporaryPassword(): string {
  return "Prontara-" + randomBytes(6).toString("hex");
}

export function listTenantAccounts(clientId: string): TenantAccountRecord[] {
  const filePath = getTenantAccountsFilePath(clientId);
  const rows = readJsonArraySafe(filePath);

  return rows.sort((a, b) => {
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

export function saveTenantAccounts(clientId: string, rows: TenantAccountRecord[]) {
  const filePath = getTenantAccountsFilePath(clientId);
  writeJsonArray(filePath, rows);
}

export function createTenantAccount(input: {
  tenantId: string;
  clientId: string;
  slug: string;
  email: string;
  fullName: string;
  role: TenantAccountRole;
  status: TenantAccountStatus;
  temporaryPassword: string;
  mustChangePassword: boolean;
}): TenantAccountRecord {
  const now = new Date().toISOString();

  return {
    id: randomUUID(),
    tenantId: input.tenantId,
    clientId: input.clientId,
    slug: input.slug,
    email: input.email.trim().toLowerCase(),
    fullName: input.fullName.trim(),
    role: input.role,
    status: input.status,
    passwordHash: hashPassword(input.temporaryPassword),
    temporaryPassword: input.temporaryPassword,
    mustChangePassword: input.mustChangePassword,
    createdAt: now,
    updatedAt: now,
    lastProvisionedAt: now,
  };
}

export function upsertTenantAdminAccount(input: {
  tenantId: string;
  clientId: string;
  slug: string;
  email: string;
  fullName: string;
  temporaryPassword: string;
  role?: "owner" | "admin";
}): TenantAccountRecord {
  const rows = listTenantAccounts(input.clientId);
  const now = new Date().toISOString();

  const existingIndex = rows.findIndex(
    (item) => item.role === "owner" || item.role === "admin"
  );

  if (existingIndex >= 0) {
    const current = rows[existingIndex];
    const next: TenantAccountRecord = {
      ...current,
      tenantId: input.tenantId,
      clientId: input.clientId,
      slug: input.slug,
      email: input.email.trim().toLowerCase(),
      fullName: input.fullName.trim(),
      role: input.role || current.role || "owner",
      passwordHash: hashPassword(input.temporaryPassword),
      temporaryPassword: input.temporaryPassword,
      mustChangePassword: true,
      status: "active",
      updatedAt: now,
      lastProvisionedAt: now,
    };

    rows[existingIndex] = next;
    saveTenantAccounts(input.clientId, rows);
    return next;
  }

  const created = createTenantAccount({
    tenantId: input.tenantId,
    clientId: input.clientId,
    slug: input.slug,
    email: input.email,
    fullName: input.fullName,
    role: input.role || "owner",
    status: "active",
    temporaryPassword: input.temporaryPassword,
    mustChangePassword: true,
  });

  rows.push(created);
  saveTenantAccounts(input.clientId, rows);
  return created;
}

export function createTenantMemberAccount(input: {
  tenantId: string;
  clientId: string;
  slug: string;
  email: string;
  fullName: string;
  role: TenantAccountRole;
}): TenantAccountRecord {
  const rows = listTenantAccounts(input.clientId);
  const normalizedEmail = input.email.trim().toLowerCase();

  if (rows.some((item) => item.email === normalizedEmail)) {
    throw new Error("Ya existe una cuenta con ese email en este tenant.");
  }

  const temporaryPassword = generateTemporaryPassword();
  const created = createTenantAccount({
    tenantId: input.tenantId,
    clientId: input.clientId,
    slug: input.slug,
    email: normalizedEmail,
    fullName: input.fullName,
    role: input.role,
    status: "active",
    temporaryPassword,
    mustChangePassword: true,
  });

  rows.push(created);
  saveTenantAccounts(input.clientId, rows);
  return created;
}

export function updateTenantAccountRole(input: {
  clientId: string;
  accountId: string;
  role: TenantAccountRole;
}): TenantAccountRecord {
  const rows = listTenantAccounts(input.clientId);
  const index = rows.findIndex((item) => item.id === input.accountId);

  if (index < 0) {
    throw new Error("No existe la cuenta indicada.");
  }

  const current = rows[index];
  const next: TenantAccountRecord = {
    ...current,
    role: input.role,
    updatedAt: new Date().toISOString(),
  };

  rows[index] = next;
  saveTenantAccounts(input.clientId, rows);
  return next;
}

export function setTenantAccountPassword(input: {
  clientId: string;
  accountId: string;
  nextPassword: string;
  clearTemporaryPassword?: boolean;
}): TenantAccountRecord {
  const rows = listTenantAccounts(input.clientId);
  const index = rows.findIndex((item) => item.id === input.accountId);

  if (index < 0) {
    throw new Error("No existe la cuenta indicada.");
  }

  const current = rows[index];
  const next: TenantAccountRecord = {
    ...current,
    passwordHash: hashPassword(input.nextPassword),
    temporaryPassword: input.clearTemporaryPassword ? "" : current.temporaryPassword,
    mustChangePassword: false,
    updatedAt: new Date().toISOString(),
  };

  rows[index] = next;
  saveTenantAccounts(input.clientId, rows);
  return next;
}

export function findTenantAccountByCredentials(input: {
  clientId: string;
  email: string;
  password: string;
}): TenantAccountRecord | null {
  const rows = listTenantAccounts(input.clientId);
  const normalizedEmail = input.email.trim().toLowerCase();

  const candidate = rows.find(
    (item) => item.email === normalizedEmail && item.status === "active"
  );

  if (!candidate) {
    return null;
  }

  const verification = verifyPassword(input.password, candidate.passwordHash);
  if (!verification.ok) {
    return null;
  }

  // Lazy migration: if the stored hash is still in the legacy SHA-256 format
  // but the password matched, upgrade it to bcrypt on the fly so that future
  // logins use the stronger hash. This is best-effort — if the upgrade fails
  // we still return the authenticated record rather than rejecting a valid
  // login because of a filesystem hiccup.
  if (verification.needsRehash) {
    try {
      const index = rows.findIndex((item) => item.id === candidate.id);
      if (index >= 0) {
        const migrated: TenantAccountRecord = {
          ...rows[index],
          passwordHash: hashPassword(input.password),
          updatedAt: new Date().toISOString(),
        };
        rows[index] = migrated;
        saveTenantAccounts(input.clientId, rows);
        return migrated;
      }
    } catch {
      // Swallow migration errors — the authentication itself already succeeded.
    }
  }

  return candidate;
}

export function getTenantAccountById(input: {
  clientId: string;
  accountId: string;
}): TenantAccountRecord | null {
  const rows = listTenantAccounts(input.clientId);
  return rows.find((item) => item.id === input.accountId) || null;
}

export function getTenantAccountByEmail(input: {
  clientId: string;
  email: string;
}): TenantAccountRecord | null {
  const rows = listTenantAccounts(input.clientId);
  const normalizedEmail = input.email.trim().toLowerCase();
  return rows.find((item) => item.email === normalizedEmail) || null;
}

export function getTenantAccountSnapshot(input: {
  tenantId: string;
  clientId: string;
  slug: string;
}): TenantAccountSnapshot {
  const accounts = listTenantAccounts(input.clientId);

  return {
    tenantId: input.tenantId,
    clientId: input.clientId,
    slug: input.slug,
    hasAdminAccount: accounts.some((item) => item.role === "owner" || item.role === "admin"),
    accounts,
  };
}