import { NextRequest, NextResponse } from "next/server";
import { withPrisma } from "@/lib/persistence/db";
import { createModuleRecordAsync, listModuleRecordsAsync } from "@/lib/persistence/active-client-data-store-async";
import { captureError } from "@/lib/observability/error-capture";

/**
 * GET /api/cron/recurring-invoices-run (H15-C #2)
 *
 * Cada día a las 06:00 escanea los planes recurrentes activos cuyo
 * `nextRunAt <= now` y emite una factura por cada uno. Tras emitir,
 * avanza `nextRunAt += frecuenciaMeses meses` y graba `lastRunAt`.
 *
 * Auth: header X-CRON-SECRET o ?secret=
 *
 * Schedule recomendado en vercel.json:
 *   { "path": "/api/cron/recurring-invoices-run", "schedule": "0 6 * * *" }
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

type Plan = {
  id: string;
  tenantId: string;
  clientId: string;
  clienteRefId: string;
  proyectoRefId: string | null;
  concepto: string;
  importe: string;
  frecuenciaMeses: number;
  diaCorte: number;
  nextRunAt: Date;
};

function addMonths(date: Date, n: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

export async function GET(request: NextRequest) {
  const secret = String(process.env.CRON_SECRET || "").trim();
  const header = request.headers.get("X-CRON-SECRET") || request.nextUrl.searchParams.get("secret") || "";
  if (secret && header !== secret) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  try {
    const now = new Date();
    const dueRaw = await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        recurringInvoice: {
          findMany: (a: { where: { activo: true; nextRunAt: { lte: Date } } }) => Promise<Plan[]>;
          update: (a: { where: { id: string }; data: Record<string, unknown> }) => Promise<unknown>;
        };
      };
      return await c.recurringInvoice.findMany({ where: { activo: true, nextRunAt: { lte: now } } });
    });
    const due: Plan[] = dueRaw || [];

    let emitted = 0;
    let errors = 0;

    for (const plan of due) {
      try {
        // Resolver nombre cliente desde TenantModuleRecord
        const clientes = (await listModuleRecordsAsync("clientes", plan.clientId)) as Array<Record<string, string>>;
        const cliente = clientes.find((c) => c.id === plan.clienteRefId);
        const clienteNombre = cliente?.nombre || cliente?.razonSocial || "Cliente";

        await createModuleRecordAsync("facturacion", {
          cliente: clienteNombre,
          concepto: plan.concepto,
          importe: plan.importe,
          estado: "emitida",
          fechaEmision: now.toISOString().slice(0, 10),
          notas: "Generada automáticamente por plan recurrente " + plan.id.slice(0, 8),
          recurringPlanId: plan.id,
        }, plan.clientId);

        // Avanzar nextRunAt
        await withPrisma(async (prisma) => {
          const c = prisma as unknown as { recurringInvoice: { update: (a: { where: { id: string }; data: Record<string, unknown> }) => Promise<unknown> } };
          return await c.recurringInvoice.update({
            where: { id: plan.id },
            data: {
              lastRunAt: now,
              nextRunAt: addMonths(plan.nextRunAt, plan.frecuenciaMeses),
            },
          });
        });
        emitted++;
      } catch (e) {
        captureError(e, { scope: "recurring-invoices-run", tags: { planId: plan.id } });
        errors++;
      }
    }

    return NextResponse.json({ ok: true, emitted, errors, totalDue: due.length, ranAt: now.toISOString() });
  } catch (e) {
    captureError(e, { scope: "/cron/recurring-invoices-run" });
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
