/**
 * Wrapper async dual-mode (postgres | filesystem) sobre trial-store.
 */
import {
  getOrCreateTrialState as fsGetOrCreate,
  saveTrialState as fsSave,
  refreshTrialState as fsRefresh,
  isTrialAccessAllowed,
  type TrialState,
} from "@/lib/saas/trial-store";
import { getPersistenceBackend, withPrisma } from "@/lib/persistence/db";

type Row = {
  tenantId: string;
  clientId: string;
  slug: string;
  status: string;
  trialDays: number;
  daysRemaining: number;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
};

function rowToState(r: Row): TrialState {
  const now = Date.now();
  const expiresMs = r.expiresAt.getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  const remaining = expiresMs <= now ? 0 : Math.ceil((expiresMs - now) / dayMs);
  return {
    tenantId: r.tenantId,
    clientId: r.clientId,
    slug: r.slug,
    plan: "trial",
    status: remaining > 0 ? "active" : "expired",
    trialDays: r.trialDays,
    daysRemaining: remaining,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    expiresAt: r.expiresAt.toISOString(),
  };
}

export async function getOrCreateTrialStateAsync(input: {
  tenantId: string;
  clientId: string;
  slug: string;
}): Promise<TrialState> {
  if (getPersistenceBackend() === "postgres") {
    const result = await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        trialState: {
          findUnique: (a: { where: { clientId: string } }) => Promise<Row | null>;
          create: (a: { data: Omit<Row, "createdAt" | "updatedAt"> & { createdAt?: Date; updatedAt?: Date } }) => Promise<Row>;
        };
      };
      const existing = await c.trialState.findUnique({
        where: { clientId: input.clientId },
      });
      if (existing) return rowToState(existing);
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
      const created = await c.trialState.create({
        data: {
          tenantId: input.tenantId,
          clientId: input.clientId,
          slug: input.slug,
          status: "active",
          trialDays: 14,
          daysRemaining: 14,
          expiresAt,
        },
      });
      return rowToState(created);
    });
    if (!result) throw new Error("Postgres trialState fallback returned null");
    return result;
  }
  return fsGetOrCreate(input);
}

export async function saveTrialStateAsync(state: TrialState): Promise<TrialState> {
  if (getPersistenceBackend() === "postgres") {
    const result = await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        trialState: {
          upsert: (a: {
            where: { clientId: string };
            create: Record<string, unknown>;
            update: Record<string, unknown>;
          }) => Promise<Row>;
        };
      };
      const updated = await c.trialState.upsert({
        where: { clientId: state.clientId },
        create: {
          tenantId: state.tenantId,
          clientId: state.clientId,
          slug: state.slug,
          status: state.status,
          trialDays: state.trialDays,
          daysRemaining: state.daysRemaining,
          expiresAt: new Date(state.expiresAt),
        },
        update: {
          slug: state.slug,
          status: state.status,
          trialDays: state.trialDays,
          daysRemaining: state.daysRemaining,
          expiresAt: new Date(state.expiresAt),
        },
      });
      return rowToState(updated);
    });
    if (!result) throw new Error("Postgres trialState save returned null");
    return result;
  }
  return fsSave(state);
}

export async function refreshTrialStateAsync(input: {
  tenantId: string;
  clientId: string;
  slug: string;
}): Promise<TrialState> {
  const current = await getOrCreateTrialStateAsync(input);
  return saveTrialStateAsync(current);
}

export { isTrialAccessAllowed };
export type { TrialState };

// Fallback síncrono al backend filesystem para callers no migrados.
export const _internal = { fsRefresh };
