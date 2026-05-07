import { NextResponse, type NextRequest } from "next/server";
import { requireTenantSession } from "@/lib/saas/auth-session";
import { withPrisma, getPersistenceBackend } from "@/lib/persistence/db";

/**
 * CRUD de reglas de workflow del tenant (DEV-WF).
 * GET    /api/erp/workflows                -> lista
 * POST   /api/erp/workflows                -> crea
 * DELETE /api/erp/workflows?id=X           -> borra
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Sesión inválida." }, { status: 401 });
}

function postgresOnlyError() {
  return NextResponse.json(
    { ok: false, error: "Workflows solo opera en modo Postgres." },
    { status: 400 },
  );
}

export async function GET(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) return unauthorized();
    if (getPersistenceBackend() !== "postgres") return postgresOnlyError();

    const rules = await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        workflowRule: {
          findMany: (a: {
            where: { clientId: string };
            orderBy: { createdAt: "desc" };
          }) => Promise<Array<Record<string, unknown>>>;
        };
      };
      return await c.workflowRule.findMany({
        where: { clientId: session.clientId },
        orderBy: { createdAt: "desc" },
      });
    });

    return NextResponse.json({ ok: true, rules: rules || [] });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) return unauthorized();
    if (getPersistenceBackend() !== "postgres") return postgresOnlyError();

    const body = await request.json();
    const name = String(body?.name || "").trim();
    const triggerModule = String(body?.triggerModule || "").trim();
    const triggerEstado = String(body?.triggerEstado || "").trim() || null;
    const actionType = String(body?.actionType || "").trim();
    const actionPayload = body?.actionPayload || {};
    const enabled = body?.enabled !== false;

    if (!name || !triggerModule || !actionType) {
      return NextResponse.json(
        { ok: false, error: "Faltan campos: name, triggerModule, actionType." },
        { status: 400 },
      );
    }
    if (!["notify", "createTask", "setEstado"].includes(actionType)) {
      return NextResponse.json(
        { ok: false, error: "actionType debe ser notify | createTask | setEstado." },
        { status: 400 },
      );
    }

    const rule = await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        workflowRule: {
          create: (a: { data: Record<string, unknown> }) => Promise<Record<string, unknown>>;
        };
      };
      return await c.workflowRule.create({
        data: {
          tenantId: session.tenantId,
          clientId: session.clientId,
          name,
          triggerModule,
          triggerEstado,
          actionType,
          actionPayload,
          enabled,
        },
      });
    });

    return NextResponse.json({ ok: true, rule });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Error" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) return unauthorized();
    if (getPersistenceBackend() !== "postgres") return postgresOnlyError();

    const id = String(request.nextUrl.searchParams.get("id") || "").trim();
    if (!id) {
      return NextResponse.json({ ok: false, error: "Falta id." }, { status: 400 });
    }

    await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        workflowRule: {
          deleteMany: (a: { where: { id: string; clientId: string } }) => Promise<unknown>;
        };
      };
      await c.workflowRule.deleteMany({
        where: { id, clientId: session.clientId },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Error" },
      { status: 500 },
    );
  }
}
