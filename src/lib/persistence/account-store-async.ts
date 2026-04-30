/**
 * Wrapper async dual-mode (postgres | filesystem) sobre account-store.
 *
 * Filosofía: las funciones existentes en `src/lib/saas/account-store.ts`
 * siguen siendo síncronas y operan sobre filesystem. Este módulo expone
 * versiones async que en `PRONTARA_PERSISTENCE=postgres` redirigen a
 * Postgres y en filesystem delegan a las funciones sync originales.
 *
 * Las APIs y libs nuevas deberían usar exclusivamente este wrapper. Los
 * callers existentes que usan account-store sync se migran gradualmente.
 */
import {
  createTenantAccount as fsCreateTenantAccount,
  findTenantAccountByCredentials as fsFindTenantAccountByCredentials,
  generateTemporaryPassword,
  getTenantAccountByEmail as fsGetTenantAccountByEmail,
  getTenantAccountById as fsGetTenantAccountById,
  getTenantAccountSnapshot as fsGetTenantAccountSnapshot,
  hashPassword,
  isScryptHash,
  listTenantAccounts as fsListTenantAccounts,
  saveTenantAccounts as fsSaveTenantAccounts,
  setTenantAccountPassword as fsSetTenantAccountPassword,
  upsertTenantAdminAccount as fsUpsertTenantAdminAccount,
  verifyPassword,
} from "@/lib/saas/account-store";
import type {
  TenantAccountRecord,
  TenantAccountRole,
  TenantAccountStatus,
  TenantAccountSnapshot,
} from "@/lib/saas/account-definition";
import { getPersistenceBackend, withPrisma } from "@/lib/persistence/db";

type PrismaTenantAccountRow = {
  id: string;
  tenantId: string;
  clientId: string;
  slug: string;
  email: string;
  fullName: string;
  role: string;
  status: string;
  passwordHash: string;
  temporaryPassword: string;
  mustChangePassword: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastProvisionedAt: Date | null;
};

function rowToRecord(row: PrismaTenantAccountRow): TenantAccountRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    clientId: row.clientId,
    slug: row.slug,
    email: row.email,
    fullName: row.fullName,
    role: row.role as TenantAccountRole,
    status: row.status as TenantAccountStatus,
    passwordHash: row.passwordHash,
    temporaryPassword: row.temporaryPassword || "",
    mustChangePassword: row.mustChangePassword,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    lastProvisionedAt: row.lastProvisionedAt
      ? row.lastProvisionedAt.toISOString()
      : undefined,
  };
}

function recordToRow(record: TenantAccountRecord) {
  return {
    id: record.id,
    tenantId: record.tenantId,
    clientId: record.clientId,
    slug: record.slug,
    email: record.email,
    fullName: record.fullName,
    role: record.role,
    status: record.status,
    passwordHash: record.passwordHash,
    temporaryPassword: record.temporaryPassword || "",
    mustChangePassword: record.mustChangePassword,
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
    lastProvisionedAt: record.lastProvisionedAt
      ? new Date(record.lastProvisionedAt)
      : null,
  };
}

export async function listTenantAccountsAsync(
  clientId: string,
): Promise<TenantAccountRecord[]> {
  if (getPersistenceBackend() === "postgres") {
    const rows = await withPrisma(async (prisma) => {
      return await (prisma as unknown as {
        tenantAccount: {
          findMany: (args: { where: { clientId: string }; orderBy: { createdAt: "asc" } }) => Promise<PrismaTenantAccountRow[]>;
        };
      }).tenantAccount.findMany({
        where: { clientId },
        orderBy: { createdAt: "asc" },
      });
    });
    return (rows || []).map(rowToRecord);
  }
  return fsListTenantAccounts(clientId);
}

export async function saveTenantAccountsAsync(
  clientId: string,
  rows: TenantAccountRecord[],
): Promise<void> {
  if (getPersistenceBackend() === "postgres") {
    await withPrisma(async (prisma) => {
      const client = prisma as unknown as {
        $transaction: (ops: unknown[]) => Promise<unknown>;
        tenantAccount: {
          deleteMany: (args: { where: { clientId: string } }) => unknown;
          create: (args: { data: ReturnType<typeof recordToRow> }) => unknown;
        };
      };
      const ops: unknown[] = [
        client.tenantAccount.deleteMany({ where: { clientId } }),
      ];
      for (const r of rows) {
        ops.push(client.tenantAccount.create({ data: recordToRow(r) }));
      }
      await client.$transaction(ops);
    });
    return;
  }
  fsSaveTenantAccounts(clientId, rows);
}

export async function upsertTenantAdminAccountAsync(input: {
  tenantId: string;
  clientId: string;
  slug: string;
  email: string;
  fullName: string;
  temporaryPassword: string;
  role?: "owner" | "admin";
}): Promise<TenantAccountRecord> {
  if (getPersistenceBackend() === "postgres") {
    const rows = await listTenantAccountsAsync(input.clientId);
    const existing = rows.find(
      (item) => item.role === "owner" || item.role === "admin",
    );
    const now = new Date().toISOString();
    if (existing) {
      const next: TenantAccountRecord = {
        ...existing,
        tenantId: input.tenantId,
        clientId: input.clientId,
        slug: input.slug,
        email: input.email.trim().toLowerCase(),
        fullName: input.fullName.trim(),
        role: input.role || existing.role || "owner",
        passwordHash: hashPassword(input.temporaryPassword),
        temporaryPassword: input.temporaryPassword,
        mustChangePassword: true,
        status: "active",
        updatedAt: now,
        lastProvisionedAt: now,
      };
      const updatedRows = rows.map((r) => (r.id === existing.id ? next : r));
      await saveTenantAccountsAsync(input.clientId, updatedRows);
      return next;
    }
    const created = fsCreateTenantAccount({
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
    await saveTenantAccountsAsync(input.clientId, [...rows, created]);
    return created;
  }
  return fsUpsertTenantAdminAccount(input);
}

export async function findTenantAccountByCredentialsAsync(input: {
  clientId: string;
  email: string;
  password: string;
}): Promise<TenantAccountRecord | null> {
  if (getPersistenceBackend() === "postgres") {
    const normalized = input.email.trim().toLowerCase();
    const rows = await listTenantAccountsAsync(input.clientId);
    const candidate = rows.find(
      (item) => item.email === normalized && item.status === "active",
    );
    if (!candidate) return null;
    const verification = verifyPassword(input.password, candidate.passwordHash);
    if (!verification.ok) return null;
    if (verification.needsRehash) {
      try {
        const migrated: TenantAccountRecord = {
          ...candidate,
          passwordHash: hashPassword(input.password),
          updatedAt: new Date().toISOString(),
        };
        const updatedRows = rows.map((r) =>
          r.id === candidate.id ? migrated : r,
        );
        await saveTenantAccountsAsync(input.clientId, updatedRows);
        return migrated;
      } catch {
        // ignore — auth ya pasó
      }
    }
    return candidate;
  }
  return fsFindTenantAccountByCredentials(input);
}

export async function getTenantAccountByIdAsync(input: {
  clientId: string;
  accountId: string;
}): Promise<TenantAccountRecord | null> {
  if (getPersistenceBackend() === "postgres") {
    const rows = await listTenantAccountsAsync(input.clientId);
    return rows.find((r) => r.id === input.accountId) || null;
  }
  return fsGetTenantAccountById(input);
}

export async function getTenantAccountByEmailAsync(input: {
  clientId: string;
  email: string;
}): Promise<TenantAccountRecord | null> {
  if (getPersistenceBackend() === "postgres") {
    const rows = await listTenantAccountsAsync(input.clientId);
    const normalized = input.email.trim().toLowerCase();
    return rows.find((r) => r.email === normalized) || null;
  }
  return fsGetTenantAccountByEmail(input);
}

export async function setTenantAccountPasswordAsync(input: {
  clientId: string;
  accountId: string;
  nextPassword: string;
  clearTemporaryPassword?: boolean;
}): Promise<TenantAccountRecord> {
  if (getPersistenceBackend() === "postgres") {
    const rows = await listTenantAccountsAsync(input.clientId);
    const idx = rows.findIndex((r) => r.id === input.accountId);
    if (idx < 0) throw new Error("No existe la cuenta indicada.");
    const current = rows[idx];
    const next: TenantAccountRecord = {
      ...current,
      passwordHash: hashPassword(input.nextPassword),
      temporaryPassword: input.clearTemporaryPassword
        ? ""
        : current.temporaryPassword,
      mustChangePassword: false,
      updatedAt: new Date().toISOString(),
    };
    const updatedRows = rows.slice();
    updatedRows[idx] = next;
    await saveTenantAccountsAsync(input.clientId, updatedRows);
    return next;
  }
  return fsSetTenantAccountPassword(input);
}

export async function getTenantAccountSnapshotAsync(input: {
  tenantId: string;
  clientId: string;
  slug: string;
}): Promise<TenantAccountSnapshot> {
  if (getPersistenceBackend() === "postgres") {
    const accounts = await listTenantAccountsAsync(input.clientId);
    return {
      tenantId: input.tenantId,
      clientId: input.clientId,
      slug: input.slug,
      hasAdminAccount: accounts.some(
        (a) => a.role === "owner" || a.role === "admin",
      ),
      accounts,
    };
  }
  return fsGetTenantAccountSnapshot(input);
}

// Re-export sync helpers que NO tocan filesystem (puramente computacionales).
export {
  generateTemporaryPassword,
  hashPassword,
  isScryptHash,
  verifyPassword,
};
