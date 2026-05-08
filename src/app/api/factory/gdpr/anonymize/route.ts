import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { withPrisma, getPersistenceBackend } from "@/lib/persistence/db";
import { captureError } from "@/lib/observability/error-capture";

/**
 * POST /api/factory/gdpr/anonymize (H3-GDPR-01)
 * Body: { clientId: string }
 *
 * Anonimiza datos PII del tenant manteniendo integridad referencial
 * (conserva contadores, métricas agregadas, audit log) — ejercicio del
 * derecho al olvido GDPR (art. 17) cuando NO se quiere borrar todo.
 *
 * Estrategia:
 *   - TenantAccount.email / fullName → sustituidos por hash
 *   - TenantAccount.passwordHash → string vacío (cuenta inutilizable)
 *   - Tenant.displayName → "anonymized-<short-hash>"
 *   - TenantModuleRecord.payloadJson → mantiene estructura, vacía
 *     campos comunes de PII: nombre, email, telefono, dni, cif, direccion
 *   - AuditEvent.actorEmail → null
 *   - AuditEvent.inputJson / resultJson → eliminados
 *
 * Auth: header `x-factory-secret`.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function checkOperator(request: NextRequest): boolean {
  const secret = String(process.env.FACTORY_OPERATOR_SECRET || "").trim();
  if (!secret) return true;
  return request.headers.get("x-factory-secret") === secret;
}

const PII_FIELDS = new Set([
  "nombre", "name",
  "email", "correo",
  "telefono", "phone", "tlf", "movil",
  "dni", "nif", "cif", "documento",
  "direccion", "address",
  "razonSocial",
]);

function shortHash(s: string): string {
  return createHash("sha256").update(s).digest("hex").slice(0, 12);
}

function anonymizePayload(p: unknown): unknown {
  if (!p || typeof p !== "object" || Array.isArray(p)) return p;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(p as Record<string, unknown>)) {
    if (PII_FIELDS.has(k.toLowerCase())) {
      out[k] = "—";
    } else {
      out[k] = v;
    }
  }
  return out;
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

    const summary = await withPrisma(async (prisma) => {
      const c = prisma as unknown as Record<string, {
        findMany?: (a: unknown) => Promise<unknown[]>;
        findUnique?: (a: unknown) => Promise<unknown>;
        update?: (a: unknown) => Promise<unknown>;
        updateMany?: (a: unknown) => Promise<{ count: number }>;
      }>;

      const tenant = await c.tenant?.findUnique?.({ where: { clientId } }) as { id: string } | null;
      if (!tenant) return { error: "Tenant no encontrado." };
      const tenantId = tenant.id;

      // 1. Accounts → hash + clear passwords
      const accounts = (await c.tenantAccount?.findMany?.({ where: { clientId } })) as Array<{ id: string; email: string }>;
      let accountsAnonymized = 0;
      for (const a of accounts || []) {
        await c.tenantAccount?.update?.({
          where: { id: a.id },
          data: {
            email: "anon-" + shortHash(a.email) + "@anonymized.invalid",
            fullName: "Anon-" + shortHash(a.email),
            passwordHash: "",
            temporaryPassword: null,
          },
        });
        accountsAnonymized += 1;
      }

      // 2. Tenant displayName
      await c.tenant?.update?.({
        where: { clientId },
        data: { displayName: "anonymized-" + shortHash(clientId) },
      });

      // 3. Module records — anonymizar PII en payload
      const records = (await c.tenantModuleRecord?.findMany?.({ where: { clientId } })) as Array<{ id: string; payloadJson: unknown }>;
      let recordsAnonymized = 0;
      for (const r of records || []) {
        await c.tenantModuleRecord?.update?.({
          where: { id: r.id },
          data: { payloadJson: anonymizePayload(r.payloadJson) },
        });
        recordsAnonymized += 1;
      }

      // 4. AuditEvent — limpiar PII
      const audits = await c.auditEvent?.updateMany?.({
        where: { tenantId },
        data: { actorEmail: null, inputJson: null, resultJson: null },
      });

      return {
        accountsAnonymized,
        recordsAnonymized,
        auditsAnonymized: audits?.count || 0,
      };
    });

    if (summary && "error" in summary) {
      return NextResponse.json({ ok: false, error: summary.error }, { status: 404 });
    }

    return NextResponse.json({ ok: true, ...summary, anonymizedAt: new Date().toISOString() });
  } catch (e) {
    captureError(e, { scope: "/api/factory/gdpr/anonymize" });
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Error" },
      { status: 500 },
    );
  }
}
