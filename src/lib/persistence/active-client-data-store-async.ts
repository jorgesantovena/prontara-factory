/**
 * Wrapper async dual-mode (postgres | filesystem) sobre active-client-data-store.
 *
 * En postgres mode, los registros operativos del ERP por módulo se guardan
 * en la tabla `TenantModuleRecord` (campos: clientId, moduleKey, payload Json).
 * En filesystem mode delega a las funciones síncronas que escriben
 * `.prontara/data/<clientId>/<module>.json`.
 */
import { randomUUID } from "node:crypto";
import {
  listModuleRecords as fsList,
  saveModuleRecords as fsSave,
  createModuleRecord as fsCreate,
  updateModuleRecord as fsUpdate,
  deleteModuleRecord as fsDelete,
} from "@/lib/erp/active-client-data-store";
import { getActiveClientId } from "@/lib/factory/active-client-registry";
import { getPersistenceBackend, withPrisma } from "@/lib/persistence/db";
import { applySequenceToPayloadAsync } from "@/lib/persistence/sequence-counter-async";

type ModuleRow = {
  id: string;
  payloadJson: Record<string, string>;
};

function resolveClientId(clientId?: string): string {
  const explicit = String(clientId || "").trim();
  if (explicit) return explicit;
  const active = String(getActiveClientId() || "").trim();
  if (active) return active;
  throw new Error(
    "No se puede resolver el clientId para los datos operativos. Pasa clientId explícitamente.",
  );
}

function normalizeRow(payload: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(payload || {})) {
    out[k] = v == null ? "" : String(v);
  }
  return out;
}

export async function listModuleRecordsAsync(
  moduleKey: string,
  clientId?: string,
): Promise<Array<Record<string, string>>> {
  if (getPersistenceBackend() === "postgres") {
    const cid = resolveClientId(clientId);
    const rows = await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        tenantModuleRecord: {
          findMany: (a: {
            where: { clientId: string; moduleKey: string };
            orderBy: { createdAt: "desc" };
          }) => Promise<Array<ModuleRow & { createdAt: Date; updatedAt: Date }>>;
        };
      };
      return await c.tenantModuleRecord.findMany({
        where: { clientId: cid, moduleKey },
        orderBy: { createdAt: "desc" },
      });
    });
    return (rows || []).map((r) => ({ id: r.id, ...r.payloadJson }));
  }
  return fsList(moduleKey, clientId);
}

export async function saveModuleRecordsAsync(
  moduleKey: string,
  rows: Array<Record<string, unknown>>,
  clientId?: string,
): Promise<void> {
  if (getPersistenceBackend() === "postgres") {
    const cid = resolveClientId(clientId);
    await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        $transaction: (ops: unknown[]) => Promise<unknown>;
        tenantModuleRecord: {
          deleteMany: (a: { where: { clientId: string; moduleKey: string } }) => unknown;
          create: (a: { data: Record<string, unknown> }) => unknown;
        };
        tenant: {
          findUnique: (a: { where: { clientId: string }; select: { id: true } }) => Promise<{ id: string } | null>;
        };
      };
      const tenant = await c.tenant.findUnique({
        where: { clientId: cid },
        select: { id: true },
      });
      const tenantId = tenant?.id || cid;
      const ops: unknown[] = [
        c.tenantModuleRecord.deleteMany({ where: { clientId: cid, moduleKey } }),
      ];
      for (const r of rows) {
        const norm = normalizeRow(r);
        ops.push(
          c.tenantModuleRecord.create({
            data: {
              id: String(r.id || norm.id || randomUUID()),
              tenantId,
              clientId: cid,
              moduleKey,
              payloadJson: norm,
            },
          }),
        );
      }
      await c.$transaction(ops);
    });
    return;
  }
  fsSave(moduleKey, rows, clientId);
}

export async function createModuleRecordAsync(
  moduleKey: string,
  payload: Record<string, unknown>,
  clientId?: string,
): Promise<Record<string, string>> {
  const cid = resolveClientId(clientId);

  // SF-01: si el módulo tiene numeración correlativa configurada y el
  // payload no trae ya un número manual, reservamos uno antes de
  // persistir. Devuelve el payload enriquecido (o intacto si no aplica).
  const enrichedPayload = await applySequenceToPayloadAsync(moduleKey, payload, cid);

  if (getPersistenceBackend() === "postgres") {
    const now = new Date().toISOString();
    const created: Record<string, string> = {
      id: String(enrichedPayload.id || randomUUID()),
      createdAt: String(enrichedPayload.createdAt || now),
      updatedAt: now,
      ...normalizeRow(enrichedPayload),
    };
    await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        tenant: {
          findUnique: (a: { where: { clientId: string }; select: { id: true } }) => Promise<{ id: string } | null>;
        };
        tenantModuleRecord: {
          create: (a: { data: Record<string, unknown> }) => unknown;
        };
      };
      const tenant = await c.tenant.findUnique({
        where: { clientId: cid },
        select: { id: true },
      });
      await c.tenantModuleRecord.create({
        data: {
          id: created.id,
          tenantId: tenant?.id || cid,
          clientId: cid,
          moduleKey,
          payloadJson: created,
        },
      });
    });
    return created;
  }
  return fsCreate(moduleKey, enrichedPayload, clientId);
}

export async function updateModuleRecordAsync(
  moduleKey: string,
  recordId: string,
  payload: Record<string, unknown>,
  clientId?: string,
): Promise<Record<string, string>> {
  if (getPersistenceBackend() === "postgres") {
    const cid = resolveClientId(clientId);
    const existing = await listModuleRecordsAsync(moduleKey, cid);
    const idx = existing.findIndex((r) => String(r.id) === String(recordId));
    if (idx < 0) throw new Error("No existe el registro indicado.");
    const current = existing[idx];
    const next: Record<string, string> = {
      ...current,
      updatedAt: new Date().toISOString(),
    };
    for (const [k, v] of Object.entries(payload)) {
      if (k === "id" || k === "createdAt") continue;
      next[k] = v == null ? "" : String(v);
    }
    await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        tenantModuleRecord: {
          updateMany: (a: {
            where: { id: string; clientId: string; moduleKey: string };
            data: { payloadJson: Record<string, string> };
          }) => unknown;
        };
      };
      await c.tenantModuleRecord.updateMany({
        where: { id: String(recordId), clientId: cid, moduleKey },
        data: { payloadJson: next },
      });
    });
    return next;
  }
  return fsUpdate(moduleKey, recordId, payload, clientId);
}

export async function deleteModuleRecordAsync(
  moduleKey: string,
  recordId: string,
  clientId?: string,
): Promise<{ ok: true }> {
  if (getPersistenceBackend() === "postgres") {
    const cid = resolveClientId(clientId);
    await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        tenantModuleRecord: {
          deleteMany: (a: {
            where: { id: string; clientId: string; moduleKey: string };
          }) => unknown;
        };
      };
      await c.tenantModuleRecord.deleteMany({
        where: { id: String(recordId), clientId: cid, moduleKey },
      });
    });
    return { ok: true };
  }
  return fsDelete(moduleKey, recordId, clientId);
}
