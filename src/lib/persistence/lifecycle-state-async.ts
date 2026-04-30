/**
 * Wrapper async dual-mode (postgres | filesystem) sobre el estado de
 * lifecycle (qué eventos ya se enviaron a qué tenant). Es lo único que
 * persiste el evaluator: las reglas y el catálogo siguen viviendo en el
 * código sync.
 *
 * En postgres usa la tabla `LifecycleState` (con sentJson Json).
 * En filesystem delega a las funciones síncronas que leen/escriben
 * `data/saas/lifecycle/<clientId>.json`.
 */
import {
  readLifecycleState as fsRead,
  recordLifecycleSent as fsRecord,
  type LifecycleSentRecord,
  type LifecycleTenantState,
} from "@/lib/saas/lifecycle-evaluator";
import type { LifecycleEventKey } from "@/lib/saas/lifecycle-catalog";
import { getPersistenceBackend, withPrisma } from "@/lib/persistence/db";

type Row = {
  tenantId: string;
  clientId: string;
  sentJson: unknown;
  updatedAt: Date;
};

function rowToState(r: Row): LifecycleTenantState {
  const sent = Array.isArray(r.sentJson)
    ? (r.sentJson as LifecycleSentRecord[])
    : [];
  return {
    clientId: r.clientId,
    sent,
    updatedAt: r.updatedAt.toISOString(),
  };
}

export async function readLifecycleStateAsync(
  clientId: string,
): Promise<LifecycleTenantState> {
  if (getPersistenceBackend() === "postgres") {
    const row = await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        lifecycleState: {
          findUnique: (a: { where: { clientId: string } }) => Promise<Row | null>;
        };
      };
      return await c.lifecycleState.findUnique({ where: { clientId } });
    });
    if (!row) {
      return { clientId, sent: [], updatedAt: new Date(0).toISOString() };
    }
    return rowToState(row);
  }
  return fsRead(clientId);
}

export async function recordLifecycleSentAsync(input: {
  tenantId: string;
  clientId: string;
  event: LifecycleEventKey;
  recipient: string;
}): Promise<LifecycleTenantState> {
  if (getPersistenceBackend() === "postgres") {
    const current = await readLifecycleStateAsync(input.clientId);
    const nextSent: LifecycleSentRecord[] = [
      ...current.sent,
      {
        event: input.event,
        sentAt: new Date().toISOString(),
        recipient: input.recipient,
      },
    ];
    await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        lifecycleState: {
          upsert: (a: {
            where: { clientId: string };
            create: Record<string, unknown>;
            update: Record<string, unknown>;
          }) => unknown;
        };
      };
      await c.lifecycleState.upsert({
        where: { clientId: input.clientId },
        create: {
          tenantId: input.tenantId,
          clientId: input.clientId,
          sentJson: nextSent,
        },
        update: { sentJson: nextSent },
      });
    });
    return {
      clientId: input.clientId,
      sent: nextSent,
      updatedAt: new Date().toISOString(),
    };
  }
  return fsRecord({
    clientId: input.clientId,
    event: input.event,
    recipient: input.recipient,
  });
}

export type { LifecycleTenantState, LifecycleSentRecord };
