import { NextRequest, NextResponse } from "next/server";
import {
  createModuleRecordAsync,
  deleteModuleRecordAsync,
  listModuleRecordsAsync,
  updateModuleRecordAsync,
} from "@/lib/persistence/active-client-data-store-async";
import { requireTenantSession } from "@/lib/saas/auth-session";
import {
  assertCanCreateOne,
  mapModuleToPlanResource,
  PlanLimitError,
} from "@/lib/saas/plan-limits";
import { checkTenantSubscription } from "@/lib/saas/subscription-guard";

function unauthorized() {
  return NextResponse.json(
    { ok: false, error: "Sesión no válida o tenant no autorizado." },
    { status: 401 }
  );
}

export async function GET(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) {
      return unauthorized();
    }

    const moduleKey = String(request.nextUrl.searchParams.get("module") || "").trim();

    if (!moduleKey) {
      return NextResponse.json(
        { ok: false, error: "Falta el parámetro module." },
        { status: 400 }
      );
    }

    const rows = await listModuleRecordsAsync(moduleKey, session.clientId);

    return NextResponse.json({
      ok: true,
      module: moduleKey,
      rows,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Error cargando módulo.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) {
      return unauthorized();
    }

    const body = await request.json();
    const moduleKey = String(body?.module || "").trim();
    const mode = String(body?.mode || "create").trim();

    if (!moduleKey) {
      return NextResponse.json(
        { ok: false, error: "Falta module." },
        { status: 400 }
      );
    }

    // Bloqueo de escritura si la suscripción no está activa. Aplica a
    // create/edit/delete; las lecturas siguen funcionando para que el
    // tenant pueda consultar sus datos aunque esté cancelled.
    if (mode === "create" || mode === "edit" || mode === "delete") {
      const subscription = checkTenantSubscription(session);
      if (!subscription.allowed) {
        return NextResponse.json(
          {
            ok: false,
            error: subscription.reason,
            code: subscription.code,
            subscriptionStatus: subscription.record.status,
          },
          { status: 403 }
        );
      }
    }

    const tenant = session.clientId;

    if (mode === "create") {
      const resource = mapModuleToPlanResource(moduleKey);
      if (resource) {
        try {
          await assertCanCreateOne(tenant, resource);
        } catch (error) {
          if (error instanceof PlanLimitError) {
            return NextResponse.json(
              {
                ok: false,
                error: error.message,
                code: "PLAN_LIMIT_REACHED",
                resource: error.resource,
                used: error.used,
                limit: error.limit,
                planKey: error.planKey,
              },
              { status: 402 }
            );
          }
          throw error;
        }
      }

      const created = await createModuleRecordAsync(moduleKey, body?.payload || {}, tenant);
      return NextResponse.json({ ok: true, row: created });
    }

    if (mode === "edit") {
      const recordId = String(body?.recordId || "").trim();
      if (!recordId) {
        return NextResponse.json(
          { ok: false, error: "Falta recordId." },
          { status: 400 }
        );
      }

      const updated = await updateModuleRecordAsync(moduleKey, recordId, body?.payload || {}, tenant);
      return NextResponse.json({ ok: true, row: updated });
    }

    if (mode === "delete") {
      const recordId = String(body?.recordId || "").trim();
      if (!recordId) {
        return NextResponse.json(
          { ok: false, error: "Falta recordId." },
          { status: 400 }
        );
      }

      await deleteModuleRecordAsync(moduleKey, recordId, tenant);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json(
      { ok: false, error: "Modo no soportado." },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Error guardando módulo.",
      },
      { status: 500 }
    );
  }
}