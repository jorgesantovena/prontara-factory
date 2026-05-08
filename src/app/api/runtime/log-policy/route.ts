import { NextResponse, type NextRequest } from "next/server";
import { requireTenantSession } from "@/lib/saas/auth-session";
import { withPrisma, getPersistenceBackend } from "@/lib/persistence/db";
import { captureError } from "@/lib/observability/error-capture";

/**
 * Política de retención de logs por tenant (H3-GDPR-02).
 *
 * GET  /api/runtime/log-policy           lee la actual (o defaults)
 * POST /api/runtime/log-policy           upsert { retentionDays }
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MIN_DAYS = 30;
const MAX_DAYS = 3650;
const DEFAULT_DAYS = 365;

export async function GET(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) return NextResponse.json({ ok: false, error: "Sesión inválida." }, { status: 401 });
    if (getPersistenceBackend() !== "postgres") {
      return NextResponse.json({ ok: true, retentionDays: DEFAULT_DAYS, source: "default" });
    }
    const policy = await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        tenantLogPolicy: {
          findUnique: (a: { where: { clientId: string } }) => Promise<{ retentionDays: number } | null>;
        };
      };
      return await c.tenantLogPolicy.findUnique({ where: { clientId: session.clientId } });
    });
    return NextResponse.json({
      ok: true,
      retentionDays: policy?.retentionDays || DEFAULT_DAYS,
      source: policy ? "tenant" : "default",
    });
  } catch (e) {
    captureError(e, { scope: "/api/runtime/log-policy GET" });
    return NextResponse.json({ ok: false, error: "Error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) return NextResponse.json({ ok: false, error: "Sesión inválida." }, { status: 401 });
    if (session.role !== "owner" && session.role !== "admin") {
      return NextResponse.json({ ok: false, error: "Solo owner / admin pueden cambiar retención." }, { status: 403 });
    }
    if (getPersistenceBackend() !== "postgres") {
      return NextResponse.json({ ok: false, error: "Postgres only" }, { status: 400 });
    }
    const body = await request.json();
    const days = Number(body?.retentionDays);
    if (!Number.isFinite(days) || days < MIN_DAYS || days > MAX_DAYS) {
      return NextResponse.json(
        { ok: false, error: "retentionDays debe estar entre " + MIN_DAYS + " y " + MAX_DAYS + "." },
        { status: 400 },
      );
    }
    const policy = await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        tenantLogPolicy: {
          upsert: (a: {
            where: { clientId: string };
            create: Record<string, unknown>;
            update: Record<string, unknown>;
          }) => Promise<{ retentionDays: number }>;
        };
      };
      return await c.tenantLogPolicy.upsert({
        where: { clientId: session.clientId },
        create: { tenantId: session.tenantId, clientId: session.clientId, retentionDays: days },
        update: { retentionDays: days },
      });
    });
    return NextResponse.json({ ok: true, retentionDays: policy?.retentionDays ?? days });
  } catch (e) {
    captureError(e, { scope: "/api/runtime/log-policy POST" });
    return NextResponse.json({ ok: false, error: "Error" }, { status: 500 });
  }
}
