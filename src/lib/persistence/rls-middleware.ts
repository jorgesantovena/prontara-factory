/**
 * RLS · helper para sesiones tenant-scoped (ARQ-10).
 *
 * Si activas RLS (ver `prisma/rls-optin/01-enable-rls.sql` y
 * `docs/rls-setup.md`), Postgres bloqueará cualquier query que NO
 * tenga `app.tenant_id` seteado a un clientId válido.
 *
 * Este módulo expone el helper `withTenantTransaction(clientId, fn)`
 * que envuelve un bloque de queries en una transacción Prisma con
 * `SET LOCAL app.tenant_id`. La sesión bypassa RLS si el rol DB es
 * `prontara_admin` (Factory ops cross-tenant).
 *
 * NO es necesario para operar Prontara hoy. El código existente puede
 * ignorar este módulo. Solo cuando RLS esté activada y un nuevo
 * endpoint quiera proteger un flujo tenant-scoped, debería usar este
 * helper en vez de llamar directamente a `withPrisma`.
 *
 * Uso:
 *
 *   import { withTenantTransaction } from "@/lib/persistence/rls-middleware";
 *
 *   const accounts = await withTenantTransaction(clientId, async (tx) => {
 *     return tx.tenantAccount.findMany();
 *   });
 *   // ↑ findMany NO necesita "where: { clientId }" — RLS lo añade.
 */
import { withPrisma } from "./db";
import type { PrismaClient } from "@prisma/client";

/**
 * Tipo de la transacción Prisma (sin los métodos prohibidos en
 * transacciones interactivas como $transaction, $connect, etc.).
 */
type TenantTx = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

/**
 * Ejecuta un bloque dentro de una transacción Prisma con la variable
 * de sesión `app.tenant_id` fijada. Las policies RLS la usarán para
 * filtrar filas.
 *
 * Si Postgres NO está activo (modo filesystem), devuelve null.
 *
 * IMPORTANTE: NO uses esta función con un rol BYPASSRLS si lo que
 * quieres es escalar privilegios — la variable se setea pero el rol
 * la ignora. Para operaciones cross-tenant del Factory usa una
 * conexión separada con rol `prontara_admin`.
 */
export async function withTenantTransaction<T>(
  clientId: string,
  fn: (tx: TenantTx) => Promise<T>,
): Promise<T | null> {
  if (!clientId || typeof clientId !== "string") {
    throw new Error("withTenantTransaction requiere un clientId no vacío.");
  }
  // Sanity check anti-injection: clientId solo puede contener
  // [a-zA-Z0-9_-]. Si llega algo más, abortamos antes de ejecutar SQL.
  if (!/^[A-Za-z0-9_-]+$/.test(clientId)) {
    throw new Error("clientId con caracteres inválidos: " + JSON.stringify(clientId));
  }

  return withPrisma(async (prisma) => {
    return prisma.$transaction(async (tx) => {
      // SET LOCAL: el valor solo aplica a la transacción actual.
      // current_setting('app.tenant_id', true) lo leerán las policies RLS.
      // Usamos $executeRawUnsafe porque el nombre de la setting va inline,
      // pero el clientId va parametrizado para prevenir inyección.
      await tx.$executeRawUnsafe(
        "SELECT set_config('app.tenant_id', $1, true)",
        clientId,
      );
      return fn(tx as unknown as TenantTx);
    });
  });
}
