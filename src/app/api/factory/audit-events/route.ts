import { NextResponse, type NextRequest } from "next/server";
import { withPrisma, getPersistenceBackend } from "@/lib/persistence/db";
import { captureError } from "@/lib/observability/error-capture";

/**
 * GET /api/factory/audit-events (H4-AUDIT-VIEW)
 *
 * Lista AuditEvent con paginación y filtros básicos. Auth via
 * x-factory-secret.
 *
 * Querystring:
 *   tool=string         — filtrar por nombre de tool
 *   actor=string        — filtrar por actorEmail (LIKE)
 *   tenantId=string     — filtrar por tenantId
 *   limit=number        — máximo 200 (default 50)
 *   offset=number       — offset para paginar
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function checkOperator(request: NextRequest): boolean {
  const secret = String(process.env.FACTORY_OPERATOR_SECRET || "").trim();
  if (!secret) return true;
  return request.headers.get("x-factory-secret") === secret;
}

export async function GET(request: NextRequest) {
  try {
    if (!checkOperator(request)) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    if (getPersistenceBackend() !== "postgres") {
      return NextResponse.json({ ok: true, events: [], total: 0 });
    }
    const sp = request.nextUrl.searchParams;
    const tool = sp.get("tool") || undefined;
    const actor = sp.get("actor") || undefined;
    const tenantId = sp.get("tenantId") || undefined;
    const limit = Math.min(200, Math.max(1, Number(sp.get("limit")) || 50));
    const offset = Math.max(0, Number(sp.get("offset")) || 0);

    const where: Record<string, unknown> = {};
    if (tool) where.tool = tool;
    if (actor) where.actorEmail = { contains: actor, mode: "insensitive" };
    if (tenantId) where.tenantId = tenantId;

    const result = await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        auditEvent: {
          findMany: (a: { where: Record<string, unknown>; orderBy: { createdAt: "desc" }; take: number; skip: number }) => Promise<Array<Record<string, unknown>>>;
          count: (a: { where: Record<string, unknown> }) => Promise<number>;
        };
      };
      const [events, total] = await Promise.all([
        c.auditEvent.findMany({ where, orderBy: { createdAt: "desc" }, take: limit, skip: offset }),
        c.auditEvent.count({ where }),
      ]);
      return { events, total };
    });

    return NextResponse.json({
      ok: true,
      events: result?.events || [],
      total: result?.total || 0,
      limit,
      offset,
    });
  } catch (e) {
    captureError(e, { scope: "/api/factory/audit-events" });
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
