import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireFactoryAdmin } from "@/lib/factory-chat/auth";
import {
  deleteConversation,
  readConversation,
  renameConversation,
} from "@/lib/factory-chat/storage";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/factory/chat/conversations/[id]
 * Devuelve la conversación completa (meta + mensajes).
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const admin = requireFactoryAdmin(request);
  if (!admin) return unauthorized();
  const { id } = await context.params;
  const conv = readConversation(admin.accountId, id);
  if (!conv) {
    return NextResponse.json(
      { ok: false, error: "Conversación no encontrada." },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true, conversation: conv });
}

/**
 * PATCH /api/factory/chat/conversations/[id]
 * Renombra la conversación. Body: { title }.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const admin = requireFactoryAdmin(request);
  if (!admin) return unauthorized();
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { title?: string };
  const meta = renameConversation(admin.accountId, id, body.title || "");
  if (!meta) {
    return NextResponse.json(
      { ok: false, error: "Conversación no encontrada." },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true, meta });
}

/**
 * DELETE /api/factory/chat/conversations/[id]
 * Elimina la conversación del índice y borra su fichero JSONL.
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const admin = requireFactoryAdmin(request);
  if (!admin) return unauthorized();
  const { id } = await context.params;
  const removed = deleteConversation(admin.accountId, id);
  return NextResponse.json({ ok: removed });
}

function unauthorized() {
  return NextResponse.json(
    { ok: false, error: "Se requiere sesión con rol admin en la Factory." },
    { status: 401 },
  );
}
