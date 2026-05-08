import { NextResponse, type NextRequest } from "next/server";
import { requireTenantSession } from "@/lib/saas/auth-session";
import { withPrisma, getPersistenceBackend } from "@/lib/persistence/db";
import { captureError } from "@/lib/observability/error-capture";

/**
 * POST /api/runtime/messages/send (H3-FUNC-04)
 * Body: { toEmail?: string, subject?: string, body: string }
 *   - toEmail vacío = broadcast a todo el tenant.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) return NextResponse.json({ ok: false, error: "Sesión inválida." }, { status: 401 });
    if (getPersistenceBackend() !== "postgres") {
      return NextResponse.json({ ok: false, error: "Postgres only" }, { status: 400 });
    }
    const body = await request.json();
    const toEmail = String(body?.toEmail || "").trim() || null;
    const subject = String(body?.subject || "").trim() || null;
    const text = String(body?.body || "").trim();
    if (!text) return NextResponse.json({ ok: false, error: "Falta body." }, { status: 400 });
    if (text.length > 5000) {
      return NextResponse.json({ ok: false, error: "Mensaje demasiado largo (>5000)." }, { status: 400 });
    }

    const msg = await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        internalMessage: {
          create: (a: { data: Record<string, unknown> }) => Promise<Record<string, unknown>>;
        };
      };
      return await c.internalMessage.create({
        data: {
          tenantId: session.tenantId,
          clientId: session.clientId,
          fromEmail: session.email,
          toEmail,
          subject,
          body: text,
        },
      });
    });

    return NextResponse.json({ ok: true, message: msg });
  } catch (e) {
    captureError(e, { scope: "/api/runtime/messages/send" });
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}

/**
 * GET /api/runtime/messages/send → lista los últimos N mensajes (broadcast + privados).
 * Querystring: ?since=<ISO> para incremental.
 */
export async function GET(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) return NextResponse.json({ ok: false, error: "Sesión inválida." }, { status: 401 });
    if (getPersistenceBackend() !== "postgres") {
      return NextResponse.json({ ok: true, messages: [] });
    }
    const since = request.nextUrl.searchParams.get("since");
    const sinceDate = since ? new Date(since) : null;

    const messages = await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        internalMessage: {
          findMany: (a: {
            where: Record<string, unknown>;
            orderBy: { createdAt: "desc" };
            take: number;
          }) => Promise<Array<Record<string, unknown>>>;
        };
      };
      const where: Record<string, unknown> = {
        clientId: session.clientId,
        OR: [
          { toEmail: null }, // broadcast
          { toEmail: session.email }, // privados a mí
          { fromEmail: session.email }, // míos enviados
        ],
      };
      if (sinceDate && !isNaN(sinceDate.getTime())) {
        where.createdAt = { gt: sinceDate };
      }
      return await c.internalMessage.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 100,
      });
    });

    return NextResponse.json({ ok: true, messages });
  } catch (e) {
    captureError(e, { scope: "/api/runtime/messages/send GET" });
    return NextResponse.json({ ok: false, error: "Error" }, { status: 500 });
  }
}
