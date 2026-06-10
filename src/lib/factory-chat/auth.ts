/**
 * Guard de acceso a la Factory (chat y rutas factory que lo usan).
 *
 * SEGURIDAD (auditoría 2026-06) — No basta el rol admin/owner: cada tenant
 * crea su cuenta principal como `owner`, así que el rol por sí solo dejaría
 * entrar a cualquier cliente final. Exigimos además, si está configurada,
 * que el email esté en la lista blanca de operadores `FACTORY_OPERATOR_EMAILS`
 * (misma que aplica el proxy). Esta es la segunda barrera (defensa en
 * profundidad) por si el proxy se bypasseara.
 *
 * Si `FACTORY_OPERATOR_EMAILS` no está definida, se cae al comportamiento
 * anterior (solo rol) para no bloquear la Factory por accidente.
 */

import type { NextRequest } from "next/server";
import { requireTenantSession } from "@/lib/saas/auth-session";
import type { TenantSessionUser } from "@/lib/saas/account-definition";

export type FactoryAdminSession = {
  accountId: string;
  email: string;
  fullName: string;
};

function isOperatorEmail(email: string): boolean {
  const allowlist = String(process.env.FACTORY_OPERATOR_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (allowlist.length === 0) return true; // no configurada → fallback a solo-rol
  return allowlist.includes(String(email || "").trim().toLowerCase());
}

export function requireFactoryAdmin(request: NextRequest): FactoryAdminSession | null {
  const session: TenantSessionUser | null = requireTenantSession(request);
  if (!session) return null;
  if (session.role !== "admin" && session.role !== "owner") return null;
  if (!isOperatorEmail(session.email)) return null;
  return {
    accountId: session.accountId,
    email: session.email,
    fullName: session.fullName,
  };
}
