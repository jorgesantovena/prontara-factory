import { NextResponse, type NextRequest } from "next/server";
import { requireTenantSession } from "@/lib/saas/auth-session";
import { suggestMapping, suggestModule } from "@/lib/import/smart-import";
import { resolveRequestTenantRuntimeAsync } from "@/lib/saas/request-tenant-runtime-async";
import { captureError } from "@/lib/observability/error-capture";

/**
 * POST /api/runtime/import/suggest (H6-IMPORT)
 * Body: { fileName: string, headers: string[], moduleKey?: string }
 *
 * Sugiere moduleKey si no viene + mapeo columna→fieldKey usando los
 * fields del módulo destino del tenant actual.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) return NextResponse.json({ ok: false, error: "Sesión inválida." }, { status: 401 });

    const body = await request.json();
    const fileName = String(body?.fileName || "");
    const headers: string[] = Array.isArray(body?.headers) ? body.headers : [];
    let moduleKey = String(body?.moduleKey || "").trim();

    if (headers.length === 0) {
      return NextResponse.json({ ok: false, error: "Faltan headers." }, { status: 400 });
    }

    let moduleConfidence = 1;
    if (!moduleKey) {
      const m = suggestModule(fileName, headers);
      moduleKey = m.moduleKey || "clientes";
      moduleConfidence = m.confidence;
    }

    // Resolver fields del módulo
    const runtime = await resolveRequestTenantRuntimeAsync(request);
    type FieldShape = { fieldKey?: string; key?: string; label?: string };
    const allFields = (runtime?.config?.fieldsByModule?.[moduleKey] || []) as FieldShape[];
    const fieldList = allFields.map((f) => ({
      fieldKey: String(f.fieldKey || f.key || ""),
      label: String(f.label || ""),
    })).filter((f) => f.fieldKey);

    const suggestion = suggestMapping(headers, fieldList);

    return NextResponse.json({
      ok: true,
      moduleKey,
      moduleConfidence,
      mapping: suggestion.mapping,
      mappingConfidence: suggestion.confidence,
      availableFields: fieldList,
    });
  } catch (e) {
    captureError(e, { scope: "/api/runtime/import/suggest" });
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
