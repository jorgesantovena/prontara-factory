import { NextResponse, type NextRequest } from "next/server";
import { requireTenantSession } from "@/lib/saas/auth-session";
import { withPrisma, getPersistenceBackend } from "@/lib/persistence/db";
import { captureError } from "@/lib/observability/error-capture";

/**
 * Vistas guardadas por usuario+módulo (H10-D).
 * GET ?moduleKey=X        lista vistas del usuario en ese módulo
 * POST                     upsert (id opcional)
 * DELETE ?id=X             borra
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) return NextResponse.json({ ok: false, error: "Sesión inválida." }, { status: 401 });
    if (getPersistenceBackend() !== "postgres") return NextResponse.json({ ok: true, views: [] });
    const moduleKey = request.nextUrl.searchParams.get("moduleKey") || "";
    const views = await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        tenantSavedView: {
          findMany: (a: { where: Record<string, unknown>; orderBy: { esDefault: "desc" } }) => Promise<Array<Record<string, unknown>>>;
        };
      };
      return await c.tenantSavedView.findMany({
        where: { clientId: session.clientId, userEmail: session.email, ...(moduleKey ? { moduleKey } : {}) },
        orderBy: { esDefault: "desc" },
      });
    });
    return NextResponse.json({ ok: true, views: views || [] });
  } catch (e) {
    captureError(e, { scope: "/api/runtime/saved-views GET" });
    return NextResponse.json({ ok: false, error: "Error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) return NextResponse.json({ ok: false, error: "Sesión inválida." }, { status: 401 });
    if (getPersistenceBackend() !== "postgres") return NextResponse.json({ ok: false, error: "Postgres only" }, { status: 400 });
    const body = await request.json();
    const id = body?.id ? String(body.id) : null;
    const data = {
      moduleKey: String(body?.moduleKey || "").trim(),
      name: String(body?.name || "").trim(),
      configJson: body?.config || {},
      esDefault: Boolean(body?.esDefault),
    };
    if (!data.moduleKey || !data.name) {
      return NextResponse.json({ ok: false, error: "Faltan moduleKey y name." }, { status: 400 });
    }
    const view = await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        tenantSavedView: {
          create: (a: { data: Record<string, unknown> }) => Promise<Record<string, unknown>>;
          update: (a: { where: { id: string }; data: Record<string, unknown> }) => Promise<Record<string, unknown>>;
        };
      };
      if (id) return await c.tenantSavedView.update({ where: { id }, data });
      return await c.tenantSavedView.create({
        data: { ...data, tenantId: session.tenantId, clientId: session.clientId, userEmail: session.email },
      });
    });
    return NextResponse.json({ ok: true, view });
  } catch (e) {
    captureError(e, { scope: "/api/runtime/saved-views POST" });
    return NextResponse.json({ ok: false, error: "Error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) return NextResponse.json({ ok: false, error: "Sesión inválida." }, { status: 401 });
    const id = request.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ ok: false, error: "Falta id." }, { status: 400 });
    if (getPersistenceBackend() !== "postgres") return NextResponse.json({ ok: false, error: "Postgres only" }, { status: 400 });
    await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        tenantSavedView: {
          deleteMany: (a: { where: { id: string; userEmail: string; clientId: string } }) => Promise<unknown>;
        };
      };
      await c.tenantSavedView.deleteMany({ where: { id, userEmail: session.email, clientId: session.clientId } });
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    captureError(e, { scope: "/api/runtime/saved-views DELETE" });
    return NextResponse.json({ ok: false, error: "Error" }, { status: 500 });
  }
}
