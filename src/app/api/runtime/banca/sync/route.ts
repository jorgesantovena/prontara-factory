import { NextResponse, type NextRequest } from "next/server";
import { requireTenantSession } from "@/lib/saas/auth-session";
import { fetchMovements, persistMovements, autoMatchMovements, isPsd2Configured } from "@/lib/integrations/psd2";
import { captureError } from "@/lib/observability/error-capture";

/**
 * POST /api/runtime/banca/sync (H6-PSD2)
 *
 * Refresca los movimientos del banco del tenant vía PSD2 + intenta
 * matchear con facturas pendientes. Idempotente.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) return NextResponse.json({ ok: false, error: "Sesión inválida." }, { status: 401 });

    if (!isPsd2Configured()) {
      return NextResponse.json({ ok: false, error: "PSD2 no configurado todavía. Pendiente de contratar agregador." }, { status: 503 });
    }

    const fetchResult = await fetchMovements(session.clientId);
    if (!fetchResult.ok) {
      return NextResponse.json({ ok: false, error: "Fetch falló: " + fetchResult.reason }, { status: 500 });
    }

    const persisted = await persistMovements(session.clientId, session.tenantId, fetchResult.movements);
    const matched = await autoMatchMovements(session.clientId);

    return NextResponse.json({
      ok: true,
      fetched: fetchResult.movements.length,
      inserted: persisted.inserted,
      skipped: persisted.skipped,
      matched: matched.matched,
    });
  } catch (e) {
    captureError(e, { scope: "/api/runtime/banca/sync" });
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
