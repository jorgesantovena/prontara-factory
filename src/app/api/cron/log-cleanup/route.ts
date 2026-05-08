import { NextResponse, type NextRequest } from "next/server";
import { withPrisma, getPersistenceBackend } from "@/lib/persistence/db";
import { captureError } from "@/lib/observability/error-capture";
import { createLogger } from "@/lib/observability/logger";

/**
 * GET /api/cron/log-cleanup (H3-GDPR-02)
 *
 * Borra logs antiguos según TenantLogPolicy.retentionDays (default 365).
 * Aplica a: AuditEvent y FactoryNotification.
 *
 * Pensado para Vercel Cron diario. Auth via CRON_SECRET (igual que tick).
 *
 * Para tenants sin policy explícita, usa 365 días.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const DEFAULT_RETENTION_DAYS = 365;

export async function GET(request: NextRequest) {
  const secret = String(process.env.CRON_SECRET || "").trim();
  if (secret) {
    const auth = request.headers.get("authorization") || "";
    if (auth !== "Bearer " + secret) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
  }

  if (getPersistenceBackend() !== "postgres") {
    return NextResponse.json({ ok: false, error: "Postgres only" }, { status: 400 });
  }

  const log = createLogger("log-cleanup");
  try {
    const summary = await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        tenantLogPolicy: {
          findMany: () => Promise<Array<{ tenantId: string; clientId: string; retentionDays: number }>>;
        };
      };
      const policies = await c.tenantLogPolicy.findMany();
      const policyMap = new Map(policies.map((p) => [p.tenantId, p.retentionDays]));

      // Para cada policy específica, borrar logs > retentionDays
      let auditDeleted = 0;
      let notifDeleted = 0;

      for (const [tenantId, days] of policyMap.entries()) {
        const a = await (prisma as unknown as {
          $executeRawUnsafe: (sql: string, ...args: unknown[]) => Promise<number>;
        }).$executeRawUnsafe(
          `DELETE FROM "AuditEvent" WHERE "tenantId" = $1 AND "createdAt" < NOW() - ($2 || ' days')::interval`,
          tenantId, String(days),
        );
        auditDeleted += Number(a) || 0;
      }

      // Default global: borrar AuditEvent sin tenantId match con > 365 días
      const aGlobal = await (prisma as unknown as {
        $executeRawUnsafe: (sql: string, ...args: unknown[]) => Promise<number>;
      }).$executeRawUnsafe(
        `DELETE FROM "AuditEvent"
         WHERE "createdAt" < NOW() - ($1 || ' days')::interval
         AND ("tenantId" IS NULL OR "tenantId" NOT IN (SELECT "tenantId" FROM "TenantLogPolicy"))`,
        String(DEFAULT_RETENTION_DAYS),
      );
      auditDeleted += Number(aGlobal) || 0;

      // Notifications: solo expirar las leídas > retentionDays
      const n = await (prisma as unknown as {
        $executeRawUnsafe: (sql: string, ...args: unknown[]) => Promise<number>;
      }).$executeRawUnsafe(
        `DELETE FROM "FactoryNotification"
         WHERE "readAt" IS NOT NULL
         AND "createdAt" < NOW() - ($1 || ' days')::interval`,
        String(DEFAULT_RETENTION_DAYS),
      );
      notifDeleted = Number(n) || 0;

      return { auditDeleted, notifDeleted, policiesApplied: policies.length };
    });

    const auditDeleted = summary?.auditDeleted ?? 0;
    const notifDeleted = summary?.notifDeleted ?? 0;
    const policiesApplied = summary?.policiesApplied ?? 0;
    log.info("log-cleanup done", { auditDeleted, notifDeleted, policiesApplied });

    return NextResponse.json({
      ok: true,
      auditDeleted,
      notifDeleted,
      policiesApplied,
      at: new Date().toISOString(),
    });
  } catch (e) {
    captureError(e, { scope: "/api/cron/log-cleanup" });
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "cleanup error" },
      { status: 500 },
    );
  }
}
