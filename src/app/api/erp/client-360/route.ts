import { NextRequest, NextResponse } from "next/server";
import { getClient360Snapshot } from "@/lib/erp/client-360";
import { requireTenantSession } from "@/lib/saas/auth-session";

export async function GET(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) {
      return NextResponse.json(
        { ok: false, error: "Sesión no válida o tenant no autorizado." },
        { status: 401 }
      );
    }

    const clientName = String(request.nextUrl.searchParams.get("client") || "").trim();

    if (!clientName) {
      return NextResponse.json(
        { ok: false, error: "Falta el parámetro client." },
        { status: 400 }
      );
    }

    const snapshot = getClient360Snapshot(clientName, session.clientId);

    return NextResponse.json({
      ok: true,
      snapshot,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Error cargando cliente 360.",
      },
      { status: 500 }
    );
  }
}