import { getBillingOverviewFromRequest } from "@/lib/saas/billing-engine";
import type { NextRequest } from "next/server";

export function assertTenantAccessAllowed(request: NextRequest) {
  const overview = getBillingOverviewFromRequest(request);

  if (!overview) {
    throw new Error("No se pudo resolver la suscripción del tenant.");
  }

  if (!overview.accessAllowed) {
    throw new Error(
      "La suscripción no está activa para operar. Revisa tu plan o tu estado de suscripción."
    );
  }

  return overview;
}

export function assertUserCreationAllowed(request: NextRequest) {
  const overview = assertTenantAccessAllowed(request);
  const userLimit = overview.limits.find((item) => item.key === "users");

  if (!userLimit) {
    return overview;
  }

  if (!userLimit.withinLimit || (userLimit.limit != null && userLimit.used >= userLimit.limit)) {
    throw new Error(
      "Has alcanzado el límite de usuarios de tu plan actual. Cambia de plan para añadir más personas."
    );
  }

  return overview;
}