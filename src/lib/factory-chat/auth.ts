/**
 * Guard de acceso al chat de Factory.
 *
 * Acepta sesión runtime con rol admin. La Factory no tiene hoy un sistema
 * de auth propio distinto del runtime; usamos el mismo. Si en el futuro
 * se añade un auth Factory específico, este guard es el único punto que
 * tocar.
 */

import type { NextRequest } from "next/server";
import { requireTenantSession } from "@/lib/saas/auth-session";
import type { TenantSessionUser } from "@/lib/saas/account-definition";

export type FactoryAdminSession = {
  accountId: string;
  email: string;
  fullName: string;
};

export function requireFactoryAdmin(request: NextRequest): FactoryAdminSession | null {
  const session: TenantSessionUser | null = requireTenantSession(request);
  if (!session) return null;
  if (session.role !== "admin" && session.role !== "owner") return null;
  return {
    accountId: session.accountId,
    email: session.email,
    fullName: session.fullName,
  };
}
