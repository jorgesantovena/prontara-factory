import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireFactoryAdmin } from "@/lib/factory-chat/auth";
import { createConversation, listConversations } from "@/lib/factory-chat/storage";

/**
 * GET /api/factory/chat/conversations
 * Lista las conversaciones del usuario autenticado, ordenadas por updatedAt desc.
 */
export async function GET(request: NextRequest) {
  const admin = requireFactoryAdmin(request);
  if (!admin) return unauthorized();
  try {
    return NextResponse.json({ ok: true, conversations: listConversations(admin.accountId) });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Error listando conversaciones." },
      { status: 500 },
    );
  }
}

/**
 * POST /api/factory/chat/conversations
 * Crea una conversación nueva vacía. Devuelve el meta recién creado.
 */
export async function POST(request: NextRequest) {
  const admin = requireFactoryAdmin(request);
  if (!admin) return unauthorized();
  try {
    const body = (await request.json().catch(() => ({}))) as { title?: string };
    const meta = createConversation(admin.accountId, body.title);
    return NextResponse.json({ ok: true, meta });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Error creando conversación." },
      { status: 500 },
    );
  }
}

function unauthorized() {
  return NextResponse.json(
    { ok: false, error: "Se requiere sesión con rol admin en la Factory." },
    { status: 401 },
  );
}
