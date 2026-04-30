import { NextResponse, type NextRequest } from "next/server";
import { requireFactoryAdmin } from "@/lib/factory-chat/auth";
import { restoreBackupSnapshotTool } from "@/lib/factory-chat/write-tools";

/**
 * POST /api/factory/auditoria/restore
 * Body: { backupRef }
 *
 * Restaura un snapshot creado por write_repo_file / patch_repo_file.
 * Pasa por withAudit igual que si se invocase desde el chat, así la
 * restauración también queda auditada.
 */
export async function POST(request: NextRequest) {
  const admin = requireFactoryAdmin(request);
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "Se requiere sesión con rol admin en la Factory." },
      { status: 401 },
    );
  }

  let body: { backupRef?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Body JSON inválido." },
      { status: 400 },
    );
  }

  try {
    const result = await restoreBackupSnapshotTool(
      { backupRef: body.backupRef },
      {
        accountId: admin.accountId,
        email: admin.email,
        // No viene de una conversación concreta — usamos un id sintético.
        conversationId: "audit-ui-restore",
      },
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Error restaurando.",
      },
      { status: 500 },
    );
  }
}
