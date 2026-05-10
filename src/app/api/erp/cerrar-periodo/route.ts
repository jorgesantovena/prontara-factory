import { NextResponse, type NextRequest } from "next/server";
import { requireTenantSession } from "@/lib/saas/auth-session";
import { withPrisma, getPersistenceBackend } from "@/lib/persistence/db";
import { captureError } from "@/lib/observability/error-capture";

/**
 * H8-C9 — Cerrar / abrir / consultar periodos.
 *
 * GET /api/erp/cerrar-periodo                    → lista periodos cerrados del tenant
 * POST /api/erp/cerrar-periodo  { ejercicio, mes }  → cierra el periodo
 * DELETE /api/erp/cerrar-periodo?ejercicio=...&mes=... → reabre
 *
 * Una vez cerrado, el resto del sistema debe consultar isPeriodClosed()
 * antes de permitir editar facturas / actividades de ese periodo.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) return NextResponse.json({ ok: false, error: "Sesión inválida." }, { status: 401 });
    if (getPersistenceBackend() !== "postgres") {
      return NextResponse.json({ ok: true, periodos: [] });
    }
    const periodos = await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        tenantClosedPeriod: {
          findMany: (a: { where: { clientId: string }; orderBy: Array<Record<string, "desc">> }) => Promise<Array<Record<string, unknown>>>;
        };
      };
      return await c.tenantClosedPeriod.findMany({
        where: { clientId: session.clientId },
        orderBy: [{ ejercicio: "desc" }, { mes: "desc" }],
      });
    });
    return NextResponse.json({ ok: true, periodos: periodos || [] });
  } catch (e) {
    captureError(e, { scope: "/api/erp/cerrar-periodo GET" });
    return NextResponse.json({ ok: false, error: "Error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) return NextResponse.json({ ok: false, error: "Sesión inválida." }, { status: 401 });
    if (session.role !== "owner" && session.role !== "admin") {
      return NextResponse.json({ ok: false, error: "Solo owner / admin pueden cerrar periodos." }, { status: 403 });
    }
    if (getPersistenceBackend() !== "postgres") {
      return NextResponse.json({ ok: false, error: "Postgres only" }, { status: 400 });
    }
    const body = await request.json();
    const ejercicio = Number(body?.ejercicio);
    const mes = Number(body?.mes);
    const notas = body?.notas ? String(body.notas).trim() : null;
    if (!Number.isFinite(ejercicio) || ejercicio < 2000 || ejercicio > 2100) {
      return NextResponse.json({ ok: false, error: "ejercicio inválido." }, { status: 400 });
    }
    if (!Number.isFinite(mes) || mes < 1 || mes > 12) {
      return NextResponse.json({ ok: false, error: "mes debe estar entre 1 y 12." }, { status: 400 });
    }

    const cierre = await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        tenantClosedPeriod: {
          create: (a: { data: Record<string, unknown> }) => Promise<Record<string, unknown>>;
        };
      };
      return await c.tenantClosedPeriod.create({
        data: {
          tenantId: session.tenantId,
          clientId: session.clientId,
          ejercicio,
          mes,
          cerradoPor: session.email,
          notas,
        },
      });
    });
    return NextResponse.json({ ok: true, cierre });
  } catch (e) {
    captureError(e, { scope: "/api/erp/cerrar-periodo POST" });
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) return NextResponse.json({ ok: false, error: "Sesión inválida." }, { status: 401 });
    if (session.role !== "owner") {
      return NextResponse.json({ ok: false, error: "Solo owner puede reabrir." }, { status: 403 });
    }
    if (getPersistenceBackend() !== "postgres") {
      return NextResponse.json({ ok: false, error: "Postgres only" }, { status: 400 });
    }
    const sp = request.nextUrl.searchParams;
    const ejercicio = Number(sp.get("ejercicio"));
    const mes = Number(sp.get("mes"));
    if (!Number.isFinite(ejercicio) || !Number.isFinite(mes)) {
      return NextResponse.json({ ok: false, error: "Faltan ejercicio y mes." }, { status: 400 });
    }
    await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        tenantClosedPeriod: {
          deleteMany: (a: { where: { clientId: string; ejercicio: number; mes: number } }) => Promise<unknown>;
        };
      };
      await c.tenantClosedPeriod.deleteMany({ where: { clientId: session.clientId, ejercicio, mes } });
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    captureError(e, { scope: "/api/erp/cerrar-periodo DELETE" });
    return NextResponse.json({ ok: false, error: "Error" }, { status: 500 });
  }
}
