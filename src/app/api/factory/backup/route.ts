import { NextResponse, type NextRequest } from "next/server";
import { withPrisma, getPersistenceBackend } from "@/lib/persistence/db";
import { s3PutObject, getS3ConfigFromEnv } from "@/lib/storage/s3-put";
import { captureError } from "@/lib/observability/error-capture";

/**
 * POST /api/factory/backup (H4-BACKUP)
 * Body: { clientId: string }
 *
 * Genera el bundle JSON del tenant (mismo formato que GDPR export) y
 * lo sube a S3 si las env vars están configuradas. Si no lo están,
 * devuelve el bundle directamente como descarga.
 *
 * Auth: header `x-factory-secret` (mismo patrón que GDPR endpoints).
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
    if (!clientId) return NextResponse.json({ ok: false, error: "Falta clientId." }, { status: 400 });

    // Construir bundle (similar a GDPR export — extraído inline por
    // simplicidad, mismo shape).
    const bundle = await withPrisma(async (prisma) => {
      const c = prisma as unknown as Record<string, {
        findMany?: (a: unknown) => Promise<unknown[]>;
        findUnique?: (a: unknown) => Promise<unknown>;
      }>;
      const tenant = await c.tenant?.findUnique?.({ where: { clientId } });
      const records = await c.tenantModuleRecord?.findMany?.({ where: { clientId } });
      const workflows = await c.workflowRule?.findMany?.({ where: { clientId } });
      const customFields = await c.tenantCustomField?.findMany?.({ where: { clientId } });
      const reports = await c.tenantReport?.findMany?.({ where: { clientId } });
      const verifactu = await c.verifactuSubmission?.findMany?.({ where: { clientId } });
      return {
        backupAt: new Date().toISOString(),
        clientId,
        tenant,
        moduleRecords: records || [],
        workflows: workflows || [],
        customFields: customFields || [],
        reports: reports || [],
        verifactuSubmissions: verifactu || [],
      };
    });

    const bundleJson = JSON.stringify(bundle, null, 2);
    const sizeKb = Math.round(Buffer.byteLength(bundleJson, "utf8") / 1024);

    const s3 = getS3ConfigFromEnv();
    if (!s3) {
      // Sin S3 — devolvemos el bundle como descarga directa
      return new Response(bundleJson, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": "attachment; filename=\"" + clientId + "-backup-" + Date.now() + ".json\"",
        },
      });
    }

    const key = "backups/" + clientId + "/" + new Date().toISOString().slice(0, 10) + "/" + Date.now() + ".json";
    const result = await s3PutObject(key, bundleJson, "application/json");

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: "S3 PUT falló: " + (result.reason === "not_configured" ? "no configurado" : (result.error || "")) },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      clientId,
      key: result.key,
      url: result.url,
      sizeKb,
      backedUpAt: bundle?.backupAt || new Date().toISOString(),
    });
  } catch (e) {
    captureError(e, { scope: "/api/factory/backup" });
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
