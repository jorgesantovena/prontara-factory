import { NextResponse, type NextRequest } from "next/server";
import { requireFactoryAdmin } from "@/lib/factory-chat/auth";
import {
  readBillingSubscription,
  setSupportConfig,
} from "@/lib/saas/billing-store";
import { invalidateFactoryCaches } from "@/lib/saas/tenant-regeneration";

type RouteContext = { params: Promise<{ clientId: string }> };

/**
 * GET /api/factory/client/[clientId]/support
 * Devuelve la configuración actual de soporte del tenant.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const admin = requireFactoryAdmin(request);
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "Se requiere sesión con rol admin." },
      { status: 401 },
    );
  }

  const { clientId } = await context.params;
  const sub = readBillingSubscription(clientId);
  if (!sub) {
    return NextResponse.json(
      { ok: false, error: "No hay suscripción para este tenant." },
      { status: 404 },
    );
  }

  return NextResponse.json({
    ok: true,
    supportActive: sub.supportActive,
    concurrentUsersBilled: sub.concurrentUsersBilled,
    currentPlanKey: sub.currentPlanKey,
  });
}

/**
 * PATCH /api/factory/client/[clientId]/support
 * Body: { supportActive?: boolean, concurrentUsersBilled?: number }
 * Actualiza la configuración de soporte.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const admin = requireFactoryAdmin(request);
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "Se requiere sesión con rol admin." },
      { status: 401 },
    );
  }

  const { clientId } = await context.params;
  let body: { supportActive?: boolean; concurrentUsersBilled?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Body JSON inválido." },
      { status: 400 },
    );
  }

  try {
    const updated = setSupportConfig({
      clientId,
      supportActive: body.supportActive,
      concurrentUsersBilled: body.concurrentUsersBilled,
    });
    invalidateFactoryCaches();
    return NextResponse.json({
      ok: true,
      supportActive: updated.supportActive,
      concurrentUsersBilled: updated.concurrentUsersBilled,
      currentPlanKey: updated.currentPlanKey,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Error actualizando soporte.",
      },
      { status: 500 },
    );
  }
}
