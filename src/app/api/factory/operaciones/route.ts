import { NextResponse, type NextRequest } from "next/server";
import { requireFactoryAdmin } from "@/lib/factory-chat/auth";
import { getOperationsSnapshot } from "@/lib/factory/operations-snapshot";

/**
 * GET /api/factory/operaciones
 * Devuelve el snapshot consolidado para el panel operativo.
 */
export async function GET(request: NextRequest) {
  const admin = requireFactoryAdmin(request);
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "Se requiere sesión con rol admin en la Factory." },
      { status: 401 },
    );
  }

  try {
    const snapshot = getOperationsSnapshot();
    return NextResponse.json({ ok: true, snapshot });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Error construyendo snapshot.",
      },
      { status: 500 },
    );
  }
}
