import { NextResponse, type NextRequest } from "next/server";
import { requireFactoryAdmin } from "@/lib/factory-chat/auth";
import {
  previewLifecycle,
  runLifecycle,
} from "@/lib/saas/lifecycle-runner";
import { listAllLifecycleState } from "@/lib/saas/lifecycle-evaluator";

/**
 * GET /api/factory/lifecycle
 * Devuelve pending events (dry-run) y el historial de lifecycle por tenant.
 */
export async function GET(request: NextRequest) {
  const admin = requireFactoryAdmin(request);
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "Se requiere sesión con rol admin en la Factory." },
      { status: 401 },
    );
  }

  const preview = previewLifecycle();
  const history = listAllLifecycleState();

  return NextResponse.json({
    ok: true,
    preview,
    history,
  });
}

/**
 * POST /api/factory/lifecycle
 * Body: { dryRun?: boolean }
 * Ejecuta el runner. Si dryRun=true solo devuelve el plan sin enviar ni
 * registrar nada.
 */
export async function POST(request: NextRequest) {
  const admin = requireFactoryAdmin(request);
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "Se requiere sesión con rol admin en la Factory." },
      { status: 401 },
    );
  }

  let body: { dryRun?: boolean } = {};
  try {
    body = await request.json();
  } catch {
    // body vacío es válido
  }

  try {
    const result = await runLifecycle({ dryRun: Boolean(body.dryRun) });
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Error ejecutando lifecycle.",
      },
      { status: 500 },
    );
  }
}
