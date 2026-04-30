import { NextResponse, type NextRequest } from "next/server";
import { requireFactoryAdmin } from "@/lib/factory-chat/auth";
import { buildRetentionSnapshot, RETENTION_DEFAULTS } from "@/lib/factory/retention";

/**
 * GET /api/factory/retencion
 * Devuelve la vista previa (dry-run) de lo que se borraría con la
 * política por defecto.
 */
export async function GET(request: NextRequest) {
  const admin = requireFactoryAdmin(request);
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "Se requiere sesión con rol admin en la Factory." },
      { status: 401 },
    );
  }

  const snapshot = buildRetentionSnapshot({ dryRun: true });
  return NextResponse.json({ ok: true, snapshot });
}

/**
 * POST /api/factory/retencion
 * Body: { dryRun?: boolean, policy?: Partial<typeof RETENTION_DEFAULTS> }
 * Ejecuta el cleanup (o preview si dryRun=true).
 */
export async function POST(request: NextRequest) {
  const admin = requireFactoryAdmin(request);
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "Se requiere sesión con rol admin en la Factory." },
      { status: 401 },
    );
  }

  let body: {
    dryRun?: boolean;
    policy?: Partial<typeof RETENTION_DEFAULTS>;
  } = {};
  try {
    body = await request.json();
  } catch {
    // body vacío es válido — se aplica política por defecto
  }

  try {
    const snapshot = buildRetentionSnapshot({
      dryRun: Boolean(body.dryRun),
      policy: body.policy,
    });
    return NextResponse.json({ ok: true, snapshot });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Error ejecutando retención.",
      },
      { status: 500 },
    );
  }
}
