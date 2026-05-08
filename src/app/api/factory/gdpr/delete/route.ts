import { NextResponse, type NextRequest } from "next/server";
import { withPrisma, getPersistenceBackend } from "@/lib/persistence/db";
import { captureError } from "@/lib/observability/error-capture";

/**
 * POST /api/factory/gdpr/delete (H3-GDPR-01)
 * Body: { clientId: string, confirm: "BORRAR-DEFINITIVAMENTE" }
 *
 * Borrado definitivo del tenant — ejercicio del derecho al olvido GDPR
 * (art. 17). Borra cascade vía Tenant.id (las relaciones tienen
 * onDelete: Cascade).
 *
 * Requiere doble confirmación:
 *   - Header `x-factory-secret`
 *   - Body { confirm: "BORRAR-DEFINITIVAMENTE" } (literal)
 *
 * Devuelve resumen de filas borradas. NO se puede deshacer.
 *
 * IMPORTANTE: si no quieres borrar todo, usa /anonymize. Esto borra
 * también historial de pagos y audit log — si tu jurisdicción exige
 * conservar contabilidad, NO uses esta opción y usa anonymize.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function checkOperator(request: NextRequest): boolean {
  const secret = String(process.env.FACTORY_OPERATOR_SECRET || "").trim();
  if (!secret) return true;
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
    const confirm = String(body?.confirm || "").trim();
    if (!clientId) return NextResponse.json({ ok: false, error: "Falta clientId." }, { status: 400 });
    if (confirm !== "BORRAR-DEFINITIVAMENTE") {
      return NextResponse.json(
        { ok: false, error: "Falta confirmación. Body debe incluir confirm: \"BORRAR-DEFINITIVAMENTE\"." },
        { status: 400 },
      );
    }

    const summary = await withPrisma(async (prisma) => {
      const c = prisma as unknown as Record<string, {
        findUnique?: (a: unknown) => Promise<unknown>;
        deleteMany?: (a: unknown) => Promise<{ count: number }>;
        delete?: (a: unknown) => Promise<unknown>;
      }>;

      const tenant = await c.tenant?.findUnique?.({ where: { clientId } }) as { id: string } | null;
      if (!tenant) return { error: "Tenant no encontrado." };
      const tenantId = tenant.id;

      // Borrar manualmente lo que no esté en cascade (audit, evolution, integrations).
      const counts: Record<string, number> = {};
      counts.records = (await c.tenantModuleRecord?.deleteMany?.({ where: { clientId } }))?.count || 0;
      counts.workflows = (await c.workflowRule?.deleteMany?.({ where: { clientId } }))?.count || 0;
      counts.customFields = (await c.tenantCustomField?.deleteMany?.({ where: { clientId } }))?.count || 0;
      counts.permissions = (await c.tenantPermissionPolicy?.deleteMany?.({ where: { clientId } }))?.count || 0;
      counts.reports = (await c.tenantReport?.deleteMany?.({ where: { clientId } }))?.count || 0;
      counts.verifactu = (await c.verifactuSubmission?.deleteMany?.({ where: { clientId } }))?.count || 0;
      counts.integrations = (await c.tenantIntegration?.deleteMany?.({ where: { clientId } }))?.count || 0;
      counts.messages = (await c.internalMessage?.deleteMany?.({ where: { clientId } }))?.count || 0;
      counts.logPolicy = (await c.tenantLogPolicy?.deleteMany?.({ where: { clientId } }))?.count || 0;
      counts.audits = (await c.auditEvent?.deleteMany?.({ where: { tenantId } }))?.count || 0;
      counts.notifications = (await c.factoryNotification?.deleteMany?.({
        where: { metadata: { path: ["clientId"], equals: clientId } },
      }))?.count || 0;

      // Borrar tenant — cascada hace el resto (accounts, billing, etc.)
      await c.tenant?.delete?.({ where: { clientId } });

      return { counts };
    });

    if (summary && "error" in summary) {
      return NextResponse.json({ ok: false, error: summary.error }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      clientId,
      ...summary,
      deletedAt: new Date().toISOString(),
    });
  } catch (e) {
    captureError(e, { scope: "/api/factory/gdpr/delete" });
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Error" },
      { status: 500 },
    );
  }
}
