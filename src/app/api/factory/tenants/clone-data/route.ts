import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { withPrisma, getPersistenceBackend } from "@/lib/persistence/db";

/**
 * POST /api/factory/tenants/clone-data (H2-TPL)
 * Body: { fromClientId: string, toClientId: string, modules?: string[], replace?: boolean }
 *
 * Clona los registros del módulo `TenantModuleRecord` desde un tenant
 * plantilla a un tenant nuevo. Sirve como base de "plantillas
 * sectoriales clonables" que el operador usa en alta para que el
 * tenant nuevo no arranque vacío.
 *
 * Por defecto NO reemplaza — añade. Si `replace: true`, primero borra
 * los registros existentes en el tenant destino para los módulos
 * indicados.
 *
 * Si `modules` viene vacío, clona TODOS los módulos del tenant fuente.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    if (getPersistenceBackend() !== "postgres") {
      return NextResponse.json({ ok: false, error: "Solo Postgres." }, { status: 400 });
    }

    const body = await request.json();
    const fromClientId = String(body?.fromClientId || "").trim();
    const toClientId = String(body?.toClientId || "").trim();
    const modules: string[] = Array.isArray(body?.modules) ? body.modules : [];
    const replace = Boolean(body?.replace);

    if (!fromClientId || !toClientId) {
      return NextResponse.json(
        { ok: false, error: "Faltan fromClientId o toClientId." },
        { status: 400 },
      );
    }
    if (fromClientId === toClientId) {
      return NextResponse.json(
        { ok: false, error: "Los tenants origen y destino son iguales." },
        { status: 400 },
      );
    }

    const result = await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        tenant: {
          findUnique: (a: { where: { clientId: string }; select: { id: true } }) => Promise<{ id: string } | null>;
        };
        tenantModuleRecord: {
          findMany: (a: { where: Record<string, unknown> }) => Promise<Array<{ moduleKey: string; payloadJson: Record<string, unknown> }>>;
          create: (a: { data: Record<string, unknown> }) => Promise<unknown>;
          deleteMany: (a: { where: Record<string, unknown> }) => Promise<{ count: number }>;
        };
      };

      const targetTenant = await c.tenant.findUnique({
        where: { clientId: toClientId },
        select: { id: true },
      });
      if (!targetTenant) return { error: "Tenant destino no existe." };

      const whereSource: Record<string, unknown> = { clientId: fromClientId };
      if (modules.length > 0) whereSource.moduleKey = { in: modules };
      const sourceRecords = await c.tenantModuleRecord.findMany({ where: whereSource });

      // Replace si aplica
      let deleted = 0;
      if (replace) {
        const whereDel: Record<string, unknown> = { clientId: toClientId };
        if (modules.length > 0) whereDel.moduleKey = { in: modules };
        const r = await c.tenantModuleRecord.deleteMany({ where: whereDel });
        deleted = r.count || 0;
      }

      // Crear records nuevos en destino
      let creados = 0;
      for (const rec of sourceRecords) {
        try {
          await c.tenantModuleRecord.create({
            data: {
              id: randomUUID(),
              tenantId: targetTenant.id,
              clientId: toClientId,
              moduleKey: rec.moduleKey,
              payloadJson: rec.payloadJson,
            },
          });
          creados += 1;
        } catch {
          // ignore individual failures
        }
      }

      return {
        sourceCount: sourceRecords.length,
        deletedInTarget: deleted,
        createdInTarget: creados,
      };
    });

    if (!result || "error" in (result as Record<string, unknown>)) {
      const msg = (result as { error?: string })?.error || "Error desconocido.";
      return NextResponse.json({ ok: false, error: msg }, { status: 400 });
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Error" },
      { status: 500 },
    );
  }
}
