import { NextResponse, type NextRequest } from "next/server";
import { requireFactoryAdmin } from "@/lib/factory-chat/auth";
import { readRecentAuditEntriesAsync } from "@/lib/persistence/factory-chat-audit-async";

/**
 * GET /api/factory/auditoria
 * Query params:
 *   ?limit=100
 *   ?tool=write_repo_file
 *   ?accountId=... (no lo usamos en UI pero expuesto)
 *   ?conversationId=...
 *   ?lookbackDays=14
 */
export async function GET(request: NextRequest) {
  const admin = requireFactoryAdmin(request);
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "Se requiere sesión con rol admin en la Factory." },
      { status: 401 },
    );
  }

  const sp = request.nextUrl.searchParams;
  const limitRaw = Number(sp.get("limit") || "100");
  const lookbackRaw = Number(sp.get("lookbackDays") || "14");

  const entries = await readRecentAuditEntriesAsync({
    limit: Number.isFinite(limitRaw) ? Math.max(1, Math.min(limitRaw, 500)) : 100,
    lookbackDays: Number.isFinite(lookbackRaw) ? Math.max(1, Math.min(lookbackRaw, 90)) : 14,
    tool: sp.get("tool") || undefined,
    accountId: sp.get("accountId") || undefined,
    conversationId: sp.get("conversationId") || undefined,
  });

  return NextResponse.json({ ok: true, entries });
}
