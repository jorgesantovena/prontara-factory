/**
 * Numeración correlativa por tenant + año (SF-01).
 *
 * Helper dual-mode (postgres | filesystem):
 *   - postgres: upsert atómico sobre TenantSequenceCounter con increment.
 *     Garantiza exactly-once incluso bajo concurrencia (Postgres serializa
 *     el INSERT ... ON CONFLICT DO UPDATE bajo el unique compuesto).
 *   - filesystem: lee/escribe `.prontara/data/<clientId>/__sequences.json`.
 *     En local no hay concurrencia real, así que un read-modify-write basta.
 *
 * El número final se renderiza como `${prefix}-${year}-${num.padStart(3,'0')}`
 * (ej: FAC-2026-001). Si el caller pasa un número manualmente al crear el
 * registro, se respeta y NO se reserva nada en el contador (compatibilidad
 * con datos demo y migraciones manuales).
 *
 * Mapping fijo moduleKey -> secuencia en SEQUENCE_BY_MODULE_KEY. En el
 * futuro se puede mover a configuración por vertical en el sector pack o
 * en TenantRuntimeConfig si distintos tenants necesitan prefijos
 * personalizados (ej. FAC-DEN, FAC-SF).
 */

import { randomUUID } from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import { getPersistenceBackend, withPrisma } from "@/lib/persistence/db";

export type SequenceKey = "facturas" | "presupuestos" | "justificantes";

export interface SequenceConfig {
  /** Clave canónica en TenantSequenceCounter.sequenceKey */
  sequenceKey: SequenceKey;
  /** Prefijo visible (FAC, PRES, JUS) */
  prefix: string;
  /** Campo del payload del módulo donde se inyecta el número generado */
  targetField: string;
}

/**
 * moduleKey (cómo se llama el módulo del ERP genérico) → cómo se numera.
 * Si un módulo no aparece aquí, no se le aplica numeración automática.
 */
export const SEQUENCE_BY_MODULE_KEY: Record<string, SequenceConfig> = {
  facturacion: { sequenceKey: "facturas", prefix: "FAC", targetField: "numero" },
  presupuestos: { sequenceKey: "presupuestos", prefix: "PRES", targetField: "numero" },
  justificantes: { sequenceKey: "justificantes", prefix: "JUS", targetField: "numero" },
};

export interface SequenceAllocation {
  /** Número entero correlativo (1, 2, 3, ...) dentro del tenant+año */
  number: number;
  /** Número formateado listo para guardar (ej. "FAC-2026-001") */
  formatted: string;
  prefix: string;
  year: number;
  sequenceKey: SequenceKey;
}

const DEFAULT_PAD = 3;

export function formatSequenceNumber(
  prefix: string,
  year: number,
  number: number,
  pad: number = DEFAULT_PAD,
): string {
  const padded = String(number).padStart(pad, "0");
  return prefix + "-" + year + "-" + padded;
}

/**
 * Reserva el siguiente número correlativo para (clientId, sequenceKey, year).
 *
 * En postgres mode hace un upsert atómico con increment: si la fila no
 * existe la crea con lastNumber=1, si existe la incrementa. En ambos
 * casos devuelve el valor final.
 *
 * En filesystem mode lee/modifica/escribe un JSON local. No es atómico
 * pero en dev no hay concurrencia.
 *
 * Si Postgres no está disponible (PRONTARA_PERSISTENCE != "postgres") se
 * usa el modo filesystem.
 */
export async function allocateNextSequenceNumberAsync(
  clientId: string,
  sequenceKey: SequenceKey,
  prefix: string,
  options?: { year?: number; pad?: number },
): Promise<SequenceAllocation> {
  const cid = String(clientId || "").trim();
  if (!cid) {
    throw new Error("allocateNextSequenceNumberAsync: clientId vacío.");
  }
  const year = options?.year ?? new Date().getFullYear();
  const pad = options?.pad ?? DEFAULT_PAD;

  let nextNumber: number;
  if (getPersistenceBackend() === "postgres") {
    nextNumber = await allocateInPostgresAsync(cid, sequenceKey, year, prefix);
  } else {
    nextNumber = allocateInFilesystem(cid, sequenceKey, year);
  }

  return {
    number: nextNumber,
    formatted: formatSequenceNumber(prefix, year, nextNumber, pad),
    prefix,
    year,
    sequenceKey,
  };
}

/**
 * Aplica numeración automática a un payload si el moduleKey está en el
 * mapping. Si el targetField del payload ya trae valor (el usuario lo
 * escribió a mano), se respeta intacto.
 *
 * Esta función es la que llama el data-store cuando se crea un registro
 * nuevo, antes de persistirlo.
 */
export async function applySequenceToPayloadAsync(
  moduleKey: string,
  payload: Record<string, unknown>,
  clientId: string,
): Promise<Record<string, unknown>> {
  const config = SEQUENCE_BY_MODULE_KEY[moduleKey];
  if (!config) return payload;

  const existingValue = String(payload?.[config.targetField] ?? "").trim();
  if (existingValue) {
    // El usuario o un script lo está poniendo a mano: respetar.
    return payload;
  }

  const allocation = await allocateNextSequenceNumberAsync(
    clientId,
    config.sequenceKey,
    config.prefix,
  );
  return { ...payload, [config.targetField]: allocation.formatted };
}

/**
 * Devuelve el último número usado (sin reservar uno nuevo). Útil para
 * dashboards o auditorías. Si no existe contador, devuelve 0.
 */
export async function peekLastSequenceNumberAsync(
  clientId: string,
  sequenceKey: SequenceKey,
  year: number = new Date().getFullYear(),
): Promise<number> {
  const cid = String(clientId || "").trim();
  if (!cid) return 0;

  if (getPersistenceBackend() === "postgres") {
    const result = await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        tenantSequenceCounter: {
          findUnique: (args: {
            where: {
              clientId_sequenceKey_year: {
                clientId: string;
                sequenceKey: string;
                year: number;
              };
            };
            select: { lastNumber: true };
          }) => Promise<{ lastNumber: number } | null>;
        };
      };
      return await c.tenantSequenceCounter.findUnique({
        where: {
          clientId_sequenceKey_year: { clientId: cid, sequenceKey, year },
        },
        select: { lastNumber: true },
      });
    });
    return result?.lastNumber ?? 0;
  }

  const counters = readFilesystemCounters(cid);
  const compositeKey = sequenceKey + ":" + year;
  return counters[compositeKey] ?? 0;
}

// ---------------------------------------------------------------------------
// Implementaciones por backend
// ---------------------------------------------------------------------------

async function allocateInPostgresAsync(
  clientId: string,
  sequenceKey: SequenceKey,
  year: number,
  prefix: string,
): Promise<number> {
  const result = await withPrisma(async (prisma) => {
    const c = prisma as unknown as {
      tenant: {
        findUnique: (args: {
          where: { clientId: string };
          select: { id: true };
        }) => Promise<{ id: string } | null>;
      };
      tenantSequenceCounter: {
        upsert: (args: {
          where: {
            clientId_sequenceKey_year: {
              clientId: string;
              sequenceKey: string;
              year: number;
            };
          };
          create: {
            id: string;
            tenantId: string;
            clientId: string;
            sequenceKey: string;
            year: number;
            prefix: string;
            lastNumber: number;
          };
          update: { lastNumber: { increment: number } };
          select: { lastNumber: true };
        }) => Promise<{ lastNumber: number }>;
      };
    };

    const tenant = await c.tenant.findUnique({
      where: { clientId },
      select: { id: true },
    });
    const tenantId = tenant?.id || clientId;

    const upserted = await c.tenantSequenceCounter.upsert({
      where: {
        clientId_sequenceKey_year: { clientId, sequenceKey, year },
      },
      create: {
        id: randomUUID(),
        tenantId,
        clientId,
        sequenceKey,
        year,
        prefix,
        lastNumber: 1,
      },
      update: { lastNumber: { increment: 1 } },
      select: { lastNumber: true },
    });
    return upserted.lastNumber;
  });

  if (typeof result !== "number") {
    throw new Error(
      "No se pudo reservar número de secuencia (Postgres no devolvió valor).",
    );
  }
  return result;
}

function getFilesystemSequencesPath(clientId: string): string {
  const dataRoot = process.env.PRONTARA_DATA_DIR || ".prontara/data";
  const tenantDir = path.isAbsolute(dataRoot)
    ? path.join(dataRoot, clientId)
    : path.join(process.cwd(), dataRoot, clientId);
  return path.join(tenantDir, "__sequences.json");
}

function readFilesystemCounters(clientId: string): Record<string, number> {
  const file = getFilesystemSequencesPath(clientId);
  if (!fs.existsSync(file)) return {};
  try {
    const raw = fs.readFileSync(file, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const out: Record<string, number> = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
      }
      return out;
    }
    return {};
  } catch {
    return {};
  }
}

function writeFilesystemCounters(
  clientId: string,
  counters: Record<string, number>,
): void {
  const file = getFilesystemSequencesPath(clientId);
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(counters, null, 2), "utf8");
}

function allocateInFilesystem(
  clientId: string,
  sequenceKey: SequenceKey,
  year: number,
): number {
  const counters = readFilesystemCounters(clientId);
  const compositeKey = sequenceKey + ":" + year;
  const next = (counters[compositeKey] || 0) + 1;
  counters[compositeKey] = next;
  writeFilesystemCounters(clientId, counters);
  return next;
}
