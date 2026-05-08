import { NextResponse, type NextRequest } from "next/server";
import { requireTenantSession } from "@/lib/saas/auth-session";
import { withPrisma, getPersistenceBackend } from "@/lib/persistence/db";
import { captureError } from "@/lib/observability/error-capture";

/**
 * POST /api/runtime/workflows/approve (H4-WF-PRO)
 * Body: { ruleId, triggerRecordId, stepIndex, decision: "approve"|"reject", comment? }
 *
 * Registra la decisión sobre un paso. La regla debe haber sido emitida
 * con un actionPayload extendido que incluya `steps[]` con
 * `requiresApprovalFrom: <role[]>`.
 *
 * El motor procesa los próximos steps en la siguiente tick de cron
 * (o al recibir esta aprobación si todas las requeridas están listas).
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
    const ruleId = String(body?.ruleId || "").trim();
    const triggerRecordId = String(body?.triggerRecordId || "").trim();
    const stepIndex = Number(body?.stepIndex);
    const decision = String(body?.decision || "").trim();
    const comment = String(body?.comment || "").trim() || null;

    if (!ruleId || !triggerRecordId || !Number.isFinite(stepIndex)) {
      return NextResponse.json({ ok: false, error: "Faltan ruleId, triggerRecordId o stepIndex." }, { status: 400 });
    }
    if (decision !== "approve" && decision !== "reject") {
      return NextResponse.json({ ok: false, error: "decision debe ser approve o reject." }, { status: 400 });
    }

    const approval = await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        workflowApproval: {
          create: (a: { data: Record<string, unknown> }) => Promise<Record<string, unknown>>;
        };
      };
      return await c.workflowApproval.create({
        data: {
          ruleId,
          tenantId: session.tenantId,
          clientId: session.clientId,
          triggerRecordId,
          stepIndex,
          decidedBy: session.email,
          decision,
          comment,
        },
      });
    });

    return NextResponse.json({ ok: true, approval });
  } catch (e) {
    captureError(e, { scope: "/api/runtime/workflows/approve" });
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}

/**
 * GET /api/runtime/workflows/approve?triggerRecordId=X — lista decisiones
 * registradas para un disparador concreto.
 */
export async function GET(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) return NextResponse.json({ ok: false, error: "Sesión inválida." }, { status: 401 });
    if (getPersistenceBackend() !== "postgres") {
      return NextResponse.json({ ok: true, approvals: [] });
    }
    const triggerRecordId = request.nextUrl.searchParams.get("triggerRecordId") || "";
    if (!triggerRecordId) {
      return NextResponse.json({ ok: false, error: "Falta triggerRecordId." }, { status: 400 });
    }
    const approvals = await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        workflowApproval: {
          findMany: (a: { where: Record<string, unknown>; orderBy: { createdAt: "asc" } }) => Promise<Array<Record<string, unknown>>>;
        };
      };
      return await c.workflowApproval.findMany({
        where: { clientId: session.clientId, triggerRecordId },
        orderBy: { createdAt: "asc" },
      });
    });
    return NextResponse.json({ ok: true, approvals: approvals || [] });
  } catch (e) {
    captureError(e, { scope: "/api/runtime/workflows/approve GET" });
    return NextResponse.json({ ok: false, error: "Error" }, { status: 500 });
  }
}
