import { NextResponse, type NextRequest } from "next/server";
import { requireTenantSession } from "@/lib/saas/auth-session";
import { withPrisma, getPersistenceBackend } from "@/lib/persistence/db";
import { captureError } from "@/lib/observability/error-capture";

/**
 * GET /api/erp/record-timeline?moduleKey=X&recordId=Y (H10-B)
 *
 * Devuelve eventos del audit log que afectaron al registro indicado.
 * Best-effort: filtra por tenantId + buscando recordId en touchedPaths.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) return NextResponse.json({ ok: false, error: "Sesión inválida." }, { status: 401 });
    if (getPersistenceBackend() !== "postgres") return NextResponse.json({ ok: true, events: [] });
    const moduleKey = request.nextUrl.searchParams.get("moduleKey") || "";
    const recordId = request.nextUrl.searchParams.get("recordId") || "";
    if (!recordId) return NextResponse.json({ ok: false, error: "Falta recordId." }, { status: 400 });

    const events = await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        auditEvent: {
          findMany: (a: { where: Record<string, unknown>; orderBy: { createdAt: "desc" }; take: number }) => Promise<Array<Record<string, unknown>>>;
        };
      };
      return await c.auditEvent.findMany({
        where: {
          tenantId: session.tenantId,
          OR: [
            { touchedPaths: { has: recordId } },
            { touchedPaths: { has: moduleKey + ":" + recordId } },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
    });
    return NextResponse.json({ ok: true, events: events || [] });
  } catch (e) {
    captureError(e, { scope: "/api/erp/record-timeline" });
    return NextResponse.json({ ok: false, error: "Error" }, { status: 500 });
  }
}
