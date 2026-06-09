/**
 * TEST 19 (Pedro) — Seed bajo demanda de Niveles + Contratos.
 *
 * Respaldo manual (botón en Ajustes) del seed que ya corre solo al
 * entrar al vertical software-factory (ver el layout del vertical y
 * `ensureTest19Seed`). Idempotente: Niveles por clave compuesta;
 * Contratos solo si la tabla está vacía.
 *
 * POST /api/erp/seed-test19  →  { ok: true, niveles: N, contratos: M }
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantSession } from "@/lib/saas/auth-session";
import { ensureTest19Seed } from "@/lib/verticals/software-factory/ensure-test19-seed";
import { captureError } from "@/lib/observability/error-capture";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) return NextResponse.json({ ok: false, error: "Sesión inválida." }, { status: 401 });

    const res = await ensureTest19Seed(session.clientId);

    return NextResponse.json({
      ok: true,
      ...res,
      mensaje:
        res.niveles + " niveles creados (de 11 totales). " +
        res.contratos + " contratos creados (uno por cliente del tenant).",
    });
  } catch (e) {
    captureError(e, { scope: "/api/erp/seed-test19" });
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Error sembrando." }, { status: 500 });
  }
}
