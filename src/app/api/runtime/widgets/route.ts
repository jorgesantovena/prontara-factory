import { NextResponse, type NextRequest } from "next/server";
import { requireTenantSession } from "@/lib/saas/auth-session";
import { withPrisma, getPersistenceBackend } from "@/lib/persistence/db";
import { captureError } from "@/lib/observability/error-capture";

/**
 * CRUD de widgets del dashboard del tenant (H5-UX-02).
 *
 * GET    /api/runtime/widgets       lista
 * POST   /api/runtime/widgets       upsert (id opcional para update)
 * DELETE /api/runtime/widgets?id=X  borra
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALLOWED_KINDS = new Set(["kpi", "counter", "list", "chart"]);

export async function GET(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) return NextResponse.json({ ok: false, error: "Sesión inválida." }, { status: 401 });
    if (getPersistenceBackend() !== "postgres") {
      return NextResponse.json({ ok: true, widgets: [] });
    }
    const widgets = await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        tenantDashboardWidget: {
          findMany: (a: { where: { clientId: string }; orderBy: { position: "asc" } }) => Promise<Array<Record<string, unknown>>>;
        };
      };
      return await c.tenantDashboardWidget.findMany({
        where: { clientId: session.clientId },
        orderBy: { position: "asc" },
      });
    });
    return NextResponse.json({ ok: true, widgets: widgets || [] });
  } catch (e) {
    captureError(e, { scope: "/api/runtime/widgets GET" });
    return NextResponse.json({ ok: false, error: "Error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) return NextResponse.json({ ok: false, error: "Sesión inválida." }, { status: 401 });
    if (getPersistenceBackend() !== "postgres") {
      return NextResponse.json({ ok: false, error: "Postgres only" }, { status: 400 });
    }
    const body = await request.json();
    const id = body?.id ? String(body.id).trim() : null;
    const kind = String(body?.kind || "").trim();
    const config = (body?.config || {}) as Record<string, unknown>;
    const position = Number(body?.position || 0);

    if (!ALLOWED_KINDS.has(kind)) {
      return NextResponse.json({ ok: false, error: "kind inválido. Permitidos: " + [...ALLOWED_KINDS].join(", ") }, { status: 400 });
    }

    const widget = await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        tenantDashboardWidget: {
          create: (a: { data: Record<string, unknown> }) => Promise<Record<string, unknown>>;
          update: (a: { where: { id: string }; data: Record<string, unknown> }) => Promise<Record<string, unknown>>;
        };
      };
      if (id) {
        return await c.tenantDashboardWidget.update({
          where: { id },
          data: { kind, configJson: config, position },
        });
      }
      return await c.tenantDashboardWidget.create({
        data: {
          tenantId: session.tenantId,
          clientId: session.clientId,
          kind,
          configJson: config,
          position,
        },
      });
    });

    return NextResponse.json({ ok: true, widget });
  } catch (e) {
    captureError(e, { scope: "/api/runtime/widgets POST" });
    return NextResponse.json({ ok: false, error: "Error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) return NextResponse.json({ ok: false, error: "Sesión inválida." }, { status: 401 });
    if (getPersistenceBackend() !== "postgres") {
      return NextResponse.json({ ok: false, error: "Postgres only" }, { status: 400 });
    }
    const id = request.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ ok: false, error: "Falta id." }, { status: 400 });
    await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        tenantDashboardWidget: {
          deleteMany: (a: { where: { id: string; clientId: string } }) => Promise<unknown>;
        };
      };
      await c.tenantDashboardWidget.deleteMany({ where: { id, clientId: session.clientId } });
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    captureError(e, { scope: "/api/runtime/widgets DELETE" });
    return NextResponse.json({ ok: false, error: "Error" }, { status: 500 });
  }
}
