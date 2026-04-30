/**
 * Wrapper async sobre leads-store que enruta a Postgres o filesystem según
 * PRONTARA_PERSISTENCE.
 *
 * Pattern: las APIs (que ya son async) llaman a estas funciones async. La
 * implementación filesystem llama a las funciones sync existentes; la
 * Postgres usa Prisma. La firma pública es idéntica para minimizar cambios
 * en consumidores.
 */
import {
  createLead as createLeadFs,
  listLeads as listLeadsFs,
  updateLeadStatus as updateLeadStatusFs,
  type CreateLeadInput,
  type LeadRecord,
  type LeadStatus,
} from "@/lib/saas/leads-store";
import { getPersistenceBackend, withPrisma } from "@/lib/persistence/db";

function rowToLead(row: {
  id: string;
  name: string;
  email: string;
  company: string;
  phone: string;
  message: string;
  sourceVertical: string | null;
  status: string;
  userAgent: string;
  ip: string;
  createdAt: Date;
  updatedAt: Date;
}): LeadRecord {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    company: row.company,
    phone: row.phone,
    message: row.message,
    sourceVertical: row.sourceVertical,
    status: (row.status as LeadStatus) || "new",
    userAgent: row.userAgent,
    ip: row.ip,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function createLeadAsync(input: CreateLeadInput): Promise<LeadRecord> {
  if (getPersistenceBackend() === "filesystem") {
    return createLeadFs(input);
  }

  // Postgres: replicamos la validación que hace el sync para no divergir.
  const localCreated = createLeadFs(input);
  const result = await withPrisma(async (prisma) =>
    prisma.lead.create({
      data: {
        id: localCreated.id,
        name: localCreated.name,
        email: localCreated.email,
        company: localCreated.company,
        phone: localCreated.phone,
        message: localCreated.message,
        sourceVertical: localCreated.sourceVertical,
        status: localCreated.status,
        userAgent: localCreated.userAgent,
        ip: localCreated.ip,
        createdAt: new Date(localCreated.createdAt),
        updatedAt: new Date(localCreated.updatedAt),
      },
    }),
  );
  return result ? rowToLead(result) : localCreated;
}

export async function listLeadsAsync(options: { limit?: number; status?: LeadStatus } = {}): Promise<LeadRecord[]> {
  if (getPersistenceBackend() === "filesystem") {
    return listLeadsFs(options);
  }

  const limit = Math.max(1, Math.min(options.limit || 100, 500));
  const result = await withPrisma(async (prisma) =>
    prisma.lead.findMany({
      where: options.status ? { status: options.status } : undefined,
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
  );
  return (result || []).map(rowToLead);
}

export async function updateLeadStatusAsync(
  id: string,
  status: LeadStatus,
): Promise<LeadRecord> {
  if (getPersistenceBackend() === "filesystem") {
    return updateLeadStatusFs(id, status);
  }

  const result = await withPrisma(async (prisma) =>
    prisma.lead.update({
      where: { id },
      data: { status, updatedAt: new Date() },
    }),
  );
  if (!result) {
    throw new Error("Lead no encontrado en Postgres.");
  }
  return rowToLead(result);
}
