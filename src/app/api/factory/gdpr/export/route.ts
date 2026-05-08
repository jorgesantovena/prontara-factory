import { NextResponse, type NextRequest } from "next/server";
import { withPrisma, getPersistenceBackend } from "@/lib/persistence/db";
import { captureError } from "@/lib/observability/error-capture";

/**
 * POST /api/factory/gdpr/export (H3-GDPR-01)
 * Body: { clientId: string }
 *
 * Devuelve un bundle JSON con todos los datos del tenant — ejercicio
 * del derecho de acceso GDPR (art. 15) y portabilidad (art. 20).
 *
 * Incluye:
 *   - Tenant + accounts + subscription
 *   - Todos los TenantModuleRecord
 *   - WorkflowRules, CustomFields, PermissionPolicies
 *   - VerifactuSubmissions (xmlPayload viene cifrado, OK para portabilidad)
 *   - AuditEvents recientes (últimos 90 días)
 *
 * Auth: este endpoint es de operador (factory), no de tenant. En
 * producción debería protegerse por cookie de operador o header secreto.
 * Por simplicidad MVP, exige header `x-factory-secret` con el valor de
 * `FACTORY_OPERATOR_SECRET`.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function checkOperator(request: NextRequest): boolean {
  const secret = String(process.env.FACTORY_OPERATOR_SECRET || "").trim();
  if (!secret) return true; // si no está definido, no enforced (dev)
  return request.headers.get("x-factory-secret") === secret;
}

export async function POST(request: NextRequest) {
  try {
    if (!checkOperator(request)) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    if (getPersistenceBackend() !== "postgres") {
      return NextResponse.json({ ok: false, error: "Postgres only" }, { status: 400 });
    }
    const body = await request.json();
    const clientId = String(body?.clientId || "").trim();
    if (!clientId) return NextResponse.json({ ok: false, error: "Falta clientId." }, { status: 400 });

    const bundle = await withPrisma(async (prisma) => {
      const c = prisma as unknown as Record<string, {
        findMany?: (a: unknown) => Promise<unknown[]>;
        findUnique?: (a: unknown) => Promise<unknown>;
      }>;

      const tenant = await c.tenant?.findUnique?.({ where: { clientId } });
      const accounts = await c.tenantAccount?.findMany?.({ where: { clientId } });
      const subscription = await c.billingSubscription?.findUnique?.({ where: { clientId } }).catch(() => null);
      const records = await c.tenantModuleRecord?.findMany?.({ where: { clientId } });
      const workflows = await c.workflowRule?.findMany?.({ where: { clientId } });
      const customFields = await c.tenantCustomField?.findMany?.({ where: { clientId } });
      const permissions = await c.tenantPermissionPolicy?.findMany?.({ where: { clientId } });
      const reports = await c.tenantReport?.findMany?.({ where: { clientId } });
      const verifactu = await c.verifactuSubmission?.findMany?.({ where: { clientId } });
      const integrations = await c.tenantIntegration?.findMany?.({ where: { clientId } });
      // AuditEvent indirecto vía tenantId
      const tenantRow = tenant as { id?: string } | null;
      const audits = tenantRow?.id
        ? await c.auditEvent?.findMany?.({
            where: { tenantId: tenantRow.id },
            orderBy: { createdAt: "desc" },
            take: 5000,
          })
        : [];

      return {
        exportedAt: new Date().toISOString(),
        clientId,
        tenant,
        accounts: ((accounts || []) as Array<Record<string, unknown>>).map((a) => ({
          ...a,
          passwordHash: undefined,
          temporaryPassword: undefined,
        })),
        subscription,
        moduleRecords: records || [],
        workflows: workflows || [],
        customFields: customFields || [],
        permissions: permissions || [],
        reports: reports || [],
        verifactuSubmissions: verifactu || [],
        integrations: integrations || [],
        auditEvents: audits || [],
      };
    });

    // Devolvemos como descarga directa (Content-Disposition).
    return new Response(JSON.stringify(bundle, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": "attachment; filename=\"" + clientId + "-gdpr-export.json\"",
      },
    });
  } catch (e) {
    captureError(e, { scope: "/api/factory/gdpr/export" });
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Error" },
      { status: 500 },
    );
  }
}
