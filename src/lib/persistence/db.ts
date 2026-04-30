/**
 * Cliente Prisma singleton para persistencia en Postgres.
 *
 * Solo se inicializa cuando PRONTARA_PERSISTENCE === "postgres". Si el modo
 * es "filesystem" (default), getPrismaClient() devuelve null y los stores
 * caen a su rama de ficheros.
 *
 * En Next.js dev el módulo se recarga continuamente con HMR — guardamos el
 * cliente en globalThis para no abrir conexiones a Postgres en cada reload.
 */
import type { PrismaClient } from "@prisma/client";

const PERSISTENCE = (
  process.env.PRONTARA_PERSISTENCE || "filesystem"
).toLowerCase();

export type PersistenceBackend = "filesystem" | "postgres";

export function getPersistenceBackend(): PersistenceBackend {
  return PERSISTENCE === "postgres" ? "postgres" : "filesystem";
}

declare global {
  // eslint-disable-next-line no-var
  var __prontaraPrisma: PrismaClient | undefined;
}

export function getPrismaClient(): PrismaClient | null {
  if (getPersistenceBackend() !== "postgres") return null;

  if (!globalThis.__prontaraPrisma) {
    // require dinámico para que el bundle no incluya Prisma cuando se usa
    // filesystem (evita que falle el build sin DATABASE_URL).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaClient } = require("@prisma/client") as {
      PrismaClient: new () => PrismaClient;
    };
    globalThis.__prontaraPrisma = new PrismaClient();
  }
  return globalThis.__prontaraPrisma;
}

/**
 * Helper para ejecutar código solo si Postgres está activo. Devuelve el
 * resultado de la callback o null si no hay backend Postgres.
 */
export async function withPrisma<T>(
  fn: (prisma: PrismaClient) => Promise<T>,
): Promise<T | null> {
  const prisma = getPrismaClient();
  if (!prisma) return null;
  return await fn(prisma);
}

/**
 * Versión sync para queries síncronas (la mayoría de stores actuales son
 * sync sobre filesystem; las operaciones Postgres son async pero algunos
 * helpers son llamados en contexts que esperan sync — usamos withPrisma async
 * en esos casos).
 */
export function getPrismaOrThrow(): PrismaClient {
  const prisma = getPrismaClient();
  if (!prisma) {
    throw new Error(
      "Prisma no está disponible. Verifica que PRONTARA_PERSISTENCE=postgres y que DATABASE_URL está configurada.",
    );
  }
  return prisma;
}
