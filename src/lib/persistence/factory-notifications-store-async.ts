/**
 * Wrapper async sobre factory-notifications-store que enruta a Postgres o
 * filesystem según `PRONTARA_PERSISTENCE`.
 *
 * Mismo patrón que leads-store-async: las APIs son async, llaman aquí, y
 * según el backend la implementación delega en el sync de filesystem o en
 * Prisma.
 */
import {
  createNotification as createNotificationFs,
  listNotifications as listNotificationsFs,
  countUnreadNotifications as countUnreadFs,
  markNotificationRead as markNotificationReadFs,
  markAllNotificationsRead as markAllReadFs,
  type CreateNotificationInput,
  type FactoryNotification,
  type FactoryNotificationSeverity,
  type FactoryNotificationType,
  type ListNotificationsOptions,
} from "@/lib/saas/factory-notifications-store";
import { getPersistenceBackend, withPrisma } from "@/lib/persistence/db";

type DbRow = {
  id: string;
  type: string;
  severity: string;
  title: string;
  message: string;
  metadata: unknown;
  readAt: Date | null;
  createdAt: Date;
};

function rowToNotification(row: DbRow): FactoryNotification {
  return {
    id: row.id,
    type: (row.type as FactoryNotificationType) || "manual",
    severity: (row.severity as FactoryNotificationSeverity) || "info",
    title: row.title,
    message: row.message,
    metadata:
      row.metadata && typeof row.metadata === "object"
        ? (row.metadata as Record<string, unknown>)
        : null,
    readAt: row.readAt ? row.readAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function createNotificationAsync(
  input: CreateNotificationInput,
): Promise<FactoryNotification> {
  if (getPersistenceBackend() === "filesystem") {
    return createNotificationFs(input);
  }

  // Postgres: pre-creamos en memoria con la lógica de validación y luego
  // persistimos con Prisma. Si Prisma falla, devolvemos el fallback fs
  // como backup (equivalente al patrón de leads-store-async).
  const local = createNotificationFs(input);
  const result = await withPrisma(async (prisma) =>
    prisma.factoryNotification.create({
      data: {
        id: local.id,
        type: local.type,
        severity: local.severity,
        title: local.title,
        message: local.message,
        metadata: local.metadata === null ? undefined : (local.metadata as object),
        readAt: local.readAt ? new Date(local.readAt) : null,
        createdAt: new Date(local.createdAt),
      },
    }),
  );
  return result ? rowToNotification(result as DbRow) : local;
}

export async function listNotificationsAsync(
  options: ListNotificationsOptions = {},
): Promise<FactoryNotification[]> {
  if (getPersistenceBackend() === "filesystem") {
    return listNotificationsFs(options);
  }

  const limit = Math.max(1, Math.min(options.limit || 100, 500));
  const result = await withPrisma(async (prisma) =>
    prisma.factoryNotification.findMany({
      where: options.unreadOnly ? { readAt: null } : undefined,
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
  );
  return ((result as DbRow[]) || []).map(rowToNotification);
}

export async function countUnreadNotificationsAsync(): Promise<number> {
  if (getPersistenceBackend() === "filesystem") {
    return countUnreadFs();
  }

  const result = await withPrisma(async (prisma) =>
    prisma.factoryNotification.count({
      where: { readAt: null },
    }),
  );
  return Number(result || 0);
}

export async function markNotificationReadAsync(
  id: string,
): Promise<FactoryNotification> {
  if (getPersistenceBackend() === "filesystem") {
    return markNotificationReadFs(id);
  }

  const result = await withPrisma(async (prisma) =>
    prisma.factoryNotification.update({
      where: { id },
      data: { readAt: new Date() },
    }),
  );
  if (!result) {
    throw new Error("Notificación no encontrada.");
  }
  return rowToNotification(result as DbRow);
}

export async function markAllNotificationsReadAsync(): Promise<number> {
  if (getPersistenceBackend() === "filesystem") {
    return markAllReadFs();
  }

  const result = await withPrisma(async (prisma) =>
    prisma.factoryNotification.updateMany({
      where: { readAt: null },
      data: { readAt: new Date() },
    }),
  );
  return Number((result as { count?: number } | null)?.count || 0);
}
