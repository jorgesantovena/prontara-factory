import { NextRequest, NextResponse } from "next/server";
import { requireTenantSession } from "@/lib/saas/auth-session";
import { withPrisma } from "@/lib/persistence/db";
import { captureError } from "@/lib/observability/error-capture";

/**
 * /api/runtime/sf/recurring-invoices (H15-C #2)
 *
 * GET     → lista planes recurrentes del tenant
 * POST    → crea un plan
 * PATCH   → actualiza (pausar/reactivar/cambiar día)
 * DELETE  → borra (?id=)
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Plan = {
  id: string;
  clienteRefId: string;
  proyectoRefId: string | null;
  concepto: string;
  importe: string;
  frecuenciaMeses: number;
  diaCorte: number;
  nextRunAt: Date;
  lastRunAt: Date | null;
  activo: boolean;
  notasInternas: string | null;
  createdBy: string;
  createdAt: Date;
};

function computeNextRun(frecuenciaMeses: number, diaCorte: number): Date {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), Math.min(diaCorte, 28));
  if (next <= now) next.setMonth(next.getMonth() + frecuenciaMeses);
  return next;
}

export async function GET(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) return NextResponse.json({ ok: false, error: "Sesión inválida." }, { status: 401 });

    const plans = await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        recurringInvoice: { findMany: (a: { where: { clientId: string }; orderBy: { nextRunAt: "asc" } }) => Promise<Plan[]> };
      };
      return await c.recurringInvoice.findMany({ where: { clientId: session.clientId }, orderBy: { nextRunAt: "asc" } });
    });

    return NextResponse.json({ ok: true, plans });
  } catch (e) {
    captureError(e, { scope: "/recurring-invoices GET" });
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) return NextResponse.json({ ok: false, error: "Sesión inválida." }, { status: 401 });

    const body = await request.json();
    const clienteRefId = String(body?.clienteRefId || "").trim();
    const concepto = String(body?.concepto || "").trim();
    const importe = String(body?.importe || "").trim();
    const frecuenciaMeses = parseInt(String(body?.frecuenciaMeses || "1"), 10);
    const diaCorte = parseInt(String(body?.diaCorte || "1"), 10);

    if (!clienteRefId || !concepto || !importe) {
      return NextResponse.json({ ok: false, error: "Faltan: clienteRefId, concepto, importe." }, { status: 400 });
    }

    const plan = await withPrisma(async (prisma) => {
      const c = prisma as unknown as { recurringInvoice: { create: (a: { data: Record<string, unknown> }) => Promise<Plan> } };
      return await c.recurringInvoice.create({
        data: {
          tenantId: session.tenantId,
          clientId: session.clientId,
          clienteRefId,
          proyectoRefId: body?.proyectoRefId || null,
          concepto,
          importe,
          frecuenciaMeses: Math.max(1, Math.min(12, frecuenciaMeses)),
          diaCorte: Math.max(1, Math.min(28, diaCorte)),
          nextRunAt: computeNextRun(frecuenciaMeses, diaCorte),
          notasInternas: body?.notasInternas || null,
          createdBy: session.email,
        },
      });
    });

    return NextResponse.json({ ok: true, plan });
  } catch (e) {
    captureError(e, { scope: "/recurring-invoices POST" });
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) return NextResponse.json({ ok: false, error: "Sesión inválida." }, { status: 401 });

    const body = await request.json();
    const id = String(body?.id || "").trim();
    if (!id) return NextResponse.json({ ok: false, error: "Falta id." }, { status: 400 });

    const data: Record<string, unknown> = {};
    if (typeof body?.activo === "boolean") data.activo = body.activo;
    if (body?.concepto) data.concepto = String(body.concepto);
    if (body?.importe) data.importe = String(body.importe);
    if (body?.diaCorte) data.diaCorte = Math.max(1, Math.min(28, parseInt(String(body.diaCorte), 10)));
    if (body?.frecuenciaMeses) data.frecuenciaMeses = Math.max(1, Math.min(12, parseInt(String(body.frecuenciaMeses), 10)));
    if (body?.notasInternas !== undefined) data.notasInternas = body.notasInternas;

    const plan = await withPrisma(async (prisma) => {
      const c = prisma as unknown as { recurringInvoice: { update: (a: { where: { id: string; clientId: string }; data: Record<string, unknown> }) => Promise<Plan> } };
      return await c.recurringInvoice.update({ where: { id, clientId: session.clientId } as { id: string; clientId: string }, data });
    });

    return NextResponse.json({ ok: true, plan });
  } catch (e) {
    captureError(e, { scope: "/recurring-invoices PATCH" });
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) return NextResponse.json({ ok: false, error: "Sesión inválida." }, { status: 401 });

    const id = String(request.nextUrl.searchParams.get("id") || "").trim();
    if (!id) return NextResponse.json({ ok: false, error: "Falta id." }, { status: 400 });

    await withPrisma(async (prisma) => {
      const c = prisma as unknown as { recurringInvoice: { deleteMany: (a: { where: { id: string; clientId: string } }) => Promise<unknown> } };
      return await c.recurringInvoice.deleteMany({ where: { id, clientId: session.clientId } });
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    captureError(e, { scope: "/recurring-invoices DELETE" });
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
