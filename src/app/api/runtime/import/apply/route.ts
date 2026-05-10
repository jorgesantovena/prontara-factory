import { NextResponse, type NextRequest } from "next/server";
import { requireTenantSession } from "@/lib/saas/auth-session";
import { applyMapping, type ImportRow } from "@/lib/import/smart-import";
import { createModuleRecordAsync } from "@/lib/persistence/active-client-data-store-async";
import { captureError } from "@/lib/observability/error-capture";

/**
 * POST /api/runtime/import/apply (H6-IMPORT)
 * Body: { moduleKey, rows: ImportRow[], mapping: Record<col, fieldKey> }
 *
 * Aplica el mapeo y crea los registros en lote. Devuelve resumen
 * { created, failed, errors }.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) return NextResponse.json({ ok: false, error: "Sesión inválida." }, { status: 401 });

    const body = await request.json();
    const moduleKey = String(body?.moduleKey || "").trim();
    const rows: ImportRow[] = Array.isArray(body?.rows) ? body.rows : [];
    const mapping = (body?.mapping || {}) as Record<string, string>;

    if (!moduleKey) return NextResponse.json({ ok: false, error: "Falta moduleKey." }, { status: 400 });
    if (rows.length === 0) return NextResponse.json({ ok: false, error: "Sin filas." }, { status: 400 });
    if (rows.length > 5000) return NextResponse.json({ ok: false, error: "Máximo 5000 filas por import." }, { status: 400 });

    const mappedRecords = applyMapping(rows, mapping);

    let created = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const rec of mappedRecords) {
      try {
        await createModuleRecordAsync(moduleKey, rec, session.clientId);
        created += 1;
      } catch (err) {
        failed += 1;
        if (errors.length < 20) {
          errors.push(err instanceof Error ? err.message : String(err));
        }
      }
    }

    return NextResponse.json({ ok: true, created, failed, errors, moduleKey });
  } catch (e) {
    captureError(e, { scope: "/api/runtime/import/apply" });
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
