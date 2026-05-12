import { NextRequest, NextResponse } from "next/server";
import { requireTenantSession } from "@/lib/saas/auth-session";
import { withPrisma } from "@/lib/persistence/db";
import { captureError } from "@/lib/observability/error-capture";

/**
 * /api/runtime/sf/milestones (H15-C #6)
 *
 * GET ?projectId=...    → hitos de un proyecto
 * POST                  → crear hito
 * PATCH                 → actualizar (completar, cambiar fecha, etc.)
 * DELETE ?id=           → borrar
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Milestone = {
  id: string;
  proyectoRefId: string;
  titulo: string;
  descripcion: string | null;
  fechaObjetivo: Date;
  fechaCompletado: Date | null;
  pesoPct: number;
  estado: string;
  disparaFactura: boolean;
  orden: number;
};

export async function GET(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) return NextResponse.json({ ok: false, error: "Sesión inválida." }, { status: 401 });

    const projectId = String(request.nextUrl.searchParams.get("projectId") || "").trim();
    if (!projectId) return NextResponse.json({ ok: false, error: "Falta projectId." }, { status: 400 });

    const milestones = await withPrisma(async (prisma) => {
      const c = prisma as unknown as { projectMilestone: { findMany: (a: { where: { clientId: string; proyectoRefId: string }; orderBy: { orden: "asc" } }) => Promise<Milestone[]> } };
      return await c.projectMilestone.findMany({
        where: { clientId: session.clientId, proyectoRefId: projectId },
        orderBy: { orden: "asc" },
      });
    });

    return NextResponse.json({ ok: true, milestones });
  } catch (e) {
    captureError(e, { scope: "/milestones GET" });
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) return NextResponse.json({ ok: false, error: "Sesión inválida." }, { status: 401 });

    const body = await request.json();
    const projectId = String(body?.projectId || "").trim();
    const titulo = String(body?.titulo || "").trim();
    const fechaObjetivo = body?.fechaObjetivo ? new Date(body.fechaObjetivo) : null;

    if (!projectId || !titulo || !fechaObjetivo) {
      return NextResponse.json({ ok: false, error: "Faltan: projectId, titulo, fechaObjetivo." }, { status: 400 });
    }

    const milestone = await withPrisma(async (prisma) => {
      const c = prisma as unknown as { projectMilestone: { create: (a: { data: Record<string, unknown> }) => Promise<Milestone> } };
      return await c.projectMilestone.create({
        data: {
          tenantId: session.tenantId,
          clientId: session.clientId,
          proyectoRefId: projectId,
          titulo,
          descripcion: body?.descripcion || null,
          fechaObjetivo,
          pesoPct: parseInt(String(body?.pesoPct || "0"), 10),
          orden: parseInt(String(body?.orden || "0"), 10),
          disparaFactura: Boolean(body?.disparaFactura),
          estado: "pendiente",
        },
      });
    });

    return NextResponse.json({ ok: true, milestone });
  } catch (e) {
    captureError(e, { scope: "/milestones POST" });
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
    if (body?.titulo) data.titulo = body.titulo;
    if (body?.descripcion !== undefined) data.descripcion = body.descripcion;
    if (body?.fechaObjetivo) data.fechaObjetivo = new Date(body.fechaObjetivo);
    if (body?.pesoPct !== undefined) data.pesoPct = parseInt(String(body.pesoPct), 10);
    if (body?.orden !== undefined) data.orden = parseInt(String(body.orden), 10);
    if (body?.estado) {
      data.estado = body.estado;
      if (body.estado === "completado") data.fechaCompletado = new Date();
      if (body.estado !== "completado") data.fechaCompletado = null;
    }

    const milestone = await withPrisma(async (prisma) => {
      const c = prisma as unknown as { projectMilestone: { update: (a: { where: { id: string; clientId: string }; data: Record<string, unknown> }) => Promise<Milestone> } };
      return await c.projectMilestone.update({ where: { id, clientId: session.clientId } as { id: string; clientId: string }, data });
    });

    return NextResponse.json({ ok: true, milestone });
  } catch (e) {
    captureError(e, { scope: "/milestones PATCH" });
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
      const c = prisma as unknown as { projectMilestone: { deleteMany: (a: { where: { id: string; clientId: string } }) => Promise<unknown> } };
      return await c.projectMilestone.deleteMany({ where: { id, clientId: session.clientId } });
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    captureError(e, { scope: "/milestones DELETE" });
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
