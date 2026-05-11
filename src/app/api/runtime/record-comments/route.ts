import { NextResponse, type NextRequest } from "next/server";
import { requireTenantSession } from "@/lib/saas/auth-session";
import { withPrisma, getPersistenceBackend } from "@/lib/persistence/db";
import { captureError } from "@/lib/observability/error-capture";

/**
 * Comentarios por registro (H10-F).
 * GET ?moduleKey=X&recordId=Y    lista comentarios
 * POST                            { moduleKey, recordId, body, parentId? }  añade
 * DELETE ?id=X                    borra (solo autor)
 *
 * Las menciones @user@email se extraen automáticamente del body.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MENTION_REGEX = /@([\w.+-]+@[\w.-]+\.[a-z]{2,})/gi;

export async function GET(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) return NextResponse.json({ ok: false, error: "Sesión inválida." }, { status: 401 });
    if (getPersistenceBackend() !== "postgres") return NextResponse.json({ ok: true, comments: [] });
    const moduleKey = request.nextUrl.searchParams.get("moduleKey") || "";
    const recordId = request.nextUrl.searchParams.get("recordId") || "";
    if (!moduleKey || !recordId) return NextResponse.json({ ok: false, error: "Faltan moduleKey y recordId." }, { status: 400 });
    const comments = await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        tenantRecordComment: {
          findMany: (a: { where: Record<string, unknown>; orderBy: { createdAt: "asc" } }) => Promise<Array<Record<string, unknown>>>;
        };
      };
      return await c.tenantRecordComment.findMany({
        where: { clientId: session.clientId, moduleKey, recordId },
        orderBy: { createdAt: "asc" },
      });
    });
    return NextResponse.json({ ok: true, comments: comments || [] });
  } catch (e) {
    captureError(e, { scope: "/api/runtime/record-comments GET" });
    return NextResponse.json({ ok: false, error: "Error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) return NextResponse.json({ ok: false, error: "Sesión inválida." }, { status: 401 });
    if (getPersistenceBackend() !== "postgres") return NextResponse.json({ ok: false, error: "Postgres only" }, { status: 400 });
    const body = await request.json();
    const moduleKey = String(body?.moduleKey || "").trim();
    const recordId = String(body?.recordId || "").trim();
    const text = String(body?.body || "").trim();
    const parentId = body?.parentId ? String(body.parentId) : null;
    if (!moduleKey || !recordId || !text) {
      return NextResponse.json({ ok: false, error: "Faltan moduleKey, recordId o body." }, { status: 400 });
    }
    const mentions = Array.from(text.matchAll(MENTION_REGEX)).map((m) => m[1]);

    const comment = await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        tenantRecordComment: {
          create: (a: { data: Record<string, unknown> }) => Promise<Record<string, unknown>>;
        };
      };
      return await c.tenantRecordComment.create({
        data: {
          tenantId: session.tenantId,
          clientId: session.clientId,
          moduleKey,
          recordId,
          authorEmail: session.email,
          body: text,
          mentions,
          parentId,
        },
      });
    });

    // TODO: enviar notificación a cada mention (pendiente de notification dispatcher)

    return NextResponse.json({ ok: true, comment });
  } catch (e) {
    captureError(e, { scope: "/api/runtime/record-comments POST" });
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
        tenantRecordComment: {
          deleteMany: (a: { where: { id: string; authorEmail: string; clientId: string } }) => Promise<unknown>;
        };
      };
      await c.tenantRecordComment.deleteMany({ where: { id, authorEmail: session.email, clientId: session.clientId } });
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    captureError(e, { scope: "/api/runtime/record-comments DELETE" });
    return NextResponse.json({ ok: false, error: "Error" }, { status: 500 });
  }
}
