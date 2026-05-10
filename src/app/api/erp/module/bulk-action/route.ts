import { NextResponse, type NextRequest } from "next/server";
import { requireTenantSession } from "@/lib/saas/auth-session";
import {
  deleteModuleRecordAsync,
  updateModuleRecordAsync,
  listModuleRecordsAsync,
} from "@/lib/persistence/active-client-data-store-async";
import { canPerform } from "@/lib/saas/permission-checker";
import { captureError } from "@/lib/observability/error-capture";

/**
 * POST /api/erp/module/bulk-action (H7-C6)
 * Body: { moduleKey, ids: string[], action: "delete" | "update", patch?: Record<string, unknown> }
 *
 * Aplica una acción a varios registros del módulo en una sola llamada.
 *   - delete: borra cada uno (chequea permiso "delete")
 *   - update: aplica patch a cada uno (chequea permiso "edit")
 *
 * Devuelve { affected, failed, errors }.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) return NextResponse.json({ ok: false, error: "Sesión inválida." }, { status: 401 });

    const body = await request.json();
    const moduleKey = String(body?.moduleKey || "").trim();
    const ids: string[] = Array.isArray(body?.ids) ? body.ids.map(String) : [];
    const action = String(body?.action || "").trim();
    const patch = body?.patch && typeof body.patch === "object" ? body.patch as Record<string, unknown> : null;

    if (!moduleKey || ids.length === 0 || !action) {
      return NextResponse.json({ ok: false, error: "Faltan moduleKey, ids o action." }, { status: 400 });
    }
    if (ids.length > 500) {
      return NextResponse.json({ ok: false, error: "Máximo 500 IDs por llamada." }, { status: 400 });
    }

    const requiredAction = action === "delete" ? "delete" : "edit";
    const allowed = await canPerform(session.clientId, session.role, moduleKey, requiredAction);
    if (!allowed) {
      return NextResponse.json({
        ok: false,
        error: "Tu rol no tiene permiso para " + requiredAction + " en " + moduleKey + ".",
        code: "PERMISSION_DENIED",
      }, { status: 403 });
    }

    let affected = 0;
    let failed = 0;
    const errors: string[] = [];

    if (action === "delete") {
      for (const id of ids) {
        try {
          await deleteModuleRecordAsync(moduleKey, id, session.clientId);
          affected += 1;
        } catch (err) {
          failed += 1;
          if (errors.length < 20) errors.push(err instanceof Error ? err.message : String(err));
        }
      }
    } else if (action === "update" && patch) {
      const rows = await listModuleRecordsAsync(moduleKey, session.clientId);
      for (const id of ids) {
        const existing = rows.find((r) => String(r.id) === id);
        if (!existing) { failed += 1; continue; }
        try {
          await updateModuleRecordAsync(moduleKey, id, { ...existing, ...patch } as Record<string, string>, session.clientId);
          affected += 1;
        } catch (err) {
          failed += 1;
          if (errors.length < 20) errors.push(err instanceof Error ? err.message : String(err));
        }
      }
    } else {
      return NextResponse.json({ ok: false, error: "action no soportada o patch faltante." }, { status: 400 });
    }

    return NextResponse.json({ ok: true, affected, failed, errors });
  } catch (e) {
    captureError(e, { scope: "/api/erp/module/bulk-action" });
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
