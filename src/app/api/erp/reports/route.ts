import { NextResponse, type NextRequest } from "next/server";
import { requireTenantSession } from "@/lib/saas/auth-session";
import { withPrisma, getPersistenceBackend } from "@/lib/persistence/db";
import { runReport, type ReportDefinition } from "@/lib/saas/report-engine";

/**
 * CRUD + ejecución de reportes guardados (DEV-REP).
 *
 * GET    /api/erp/reports                lista reportes guardados
 * POST   /api/erp/reports                crea/actualiza reporte
 * DELETE /api/erp/reports?id=X           borra
 * GET    /api/erp/reports?run=ID         ejecuta y devuelve datos
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) return NextResponse.json({ ok: false, error: "Sesión inválida." }, { status: 401 });
    if (getPersistenceBackend() !== "postgres") {
      return NextResponse.json({ ok: false, error: "Solo Postgres." }, { status: 400 });
    }

    const runId = String(request.nextUrl.searchParams.get("run") || "").trim();

    if (runId) {
      // Ejecutar reporte
      const report = await withPrisma(async (prisma) => {
        const c = prisma as unknown as {
          tenantReport: {
            findFirst: (a: { where: { id: string; clientId: string } }) => Promise<Record<string, unknown> | null>;
          };
        };
        return await c.tenantReport.findFirst({
          where: { id: runId, clientId: session.clientId },
        });
      });
      if (!report) {
        return NextResponse.json({ ok: false, error: "Reporte no encontrado." }, { status: 404 });
      }
      const def: ReportDefinition = {
        moduleKey: String(report.moduleKey),
        columns: Array.isArray(report.columnsJson) ? (report.columnsJson as string[]) : [],
        filters: Array.isArray(report.filtersJson) ? (report.filtersJson as ReportDefinition["filters"]) : [],
        groupBy: (report.groupBy as string) || null,
      };
      const result = await runReport(session.clientId, def);
      return NextResponse.json({
        ok: true,
        report: {
          id: report.id,
          name: report.name,
          description: report.description,
          moduleKey: report.moduleKey,
          chartType: report.chartType,
        },
        ...result,
      });
    }

    // Listar
    const reports = await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        tenantReport: {
          findMany: (a: { where: { clientId: string }; orderBy: { createdAt: "desc" } }) => Promise<Array<Record<string, unknown>>>;
        };
      };
      return await c.tenantReport.findMany({
        where: { clientId: session.clientId },
        orderBy: { createdAt: "desc" },
      });
    });
    return NextResponse.json({ ok: true, reports: reports || [] });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) return NextResponse.json({ ok: false, error: "Sesión inválida." }, { status: 401 });
    if (getPersistenceBackend() !== "postgres") {
      return NextResponse.json({ ok: false, error: "Solo Postgres." }, { status: 400 });
    }

    const body = await request.json();
    const name = String(body?.name || "").trim();
    const description = String(body?.description || "").trim() || null;
    const moduleKey = String(body?.moduleKey || "").trim();
    const columns = Array.isArray(body?.columns) ? body.columns : [];
    const filters = Array.isArray(body?.filters) ? body.filters : [];
    const groupBy = String(body?.groupBy || "").trim() || null;
    const chartType = String(body?.chartType || "none").trim();

    if (!name || !moduleKey) {
      return NextResponse.json(
        { ok: false, error: "Faltan name o moduleKey." },
        { status: 400 },
      );
    }

    const report = await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        tenantReport: {
          create: (a: { data: Record<string, unknown> }) => Promise<Record<string, unknown>>;
        };
      };
      return await c.tenantReport.create({
        data: {
          tenantId: session.tenantId,
          clientId: session.clientId,
          name,
          description,
          moduleKey,
          columnsJson: columns,
          filtersJson: filters,
          groupBy,
          chartType,
        },
      });
    });
    return NextResponse.json({ ok: true, report });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) return NextResponse.json({ ok: false, error: "Sesión inválida." }, { status: 401 });
    if (getPersistenceBackend() !== "postgres") {
      return NextResponse.json({ ok: false, error: "Solo Postgres." }, { status: 400 });
    }

    const id = String(request.nextUrl.searchParams.get("id") || "").trim();
    if (!id) return NextResponse.json({ ok: false, error: "Falta id." }, { status: 400 });
    await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        tenantReport: {
          deleteMany: (a: { where: { id: string; clientId: string } }) => Promise<unknown>;
        };
      };
      await c.tenantReport.deleteMany({
        where: { id, clientId: session.clientId },
      });
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
