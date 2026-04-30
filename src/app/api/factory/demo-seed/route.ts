import { NextResponse, type NextRequest } from "next/server";
import { requireFactoryAdmin } from "@/lib/factory-chat/auth";
import { seedDemoDataForTenant } from "@/lib/factory/demo-seeder";
import { invalidateFactoryCaches } from "@/lib/saas/tenant-regeneration";

/**
 * POST /api/factory/demo-seed
 * Body: { clientId, mode?: 'merge'|'replace', modules?: string[] }
 */
export async function POST(request: NextRequest) {
  const admin = requireFactoryAdmin(request);
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "Se requiere sesión con rol admin en la Factory." },
      { status: 401 },
    );
  }

  let body: { clientId?: string; mode?: "merge" | "replace"; modules?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Body JSON inválido." },
      { status: 400 },
    );
  }

  if (!body.clientId) {
    return NextResponse.json(
      { ok: false, error: "Falta clientId." },
      { status: 400 },
    );
  }

  try {
    const result = seedDemoDataForTenant({
      clientId: body.clientId,
      mode: body.mode,
      modules: Array.isArray(body.modules) ? body.modules : undefined,
    });
    invalidateFactoryCaches();
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Error ejecutando seed.",
      },
      { status: 500 },
    );
  }
}
