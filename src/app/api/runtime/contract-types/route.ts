import { NextResponse, type NextRequest } from "next/server";
import { requireTenantSession } from "@/lib/saas/auth-session";
import { withPrisma, getPersistenceBackend } from "@/lib/persistence/db";
import { captureError } from "@/lib/observability/error-capture";

/**
 * H8-S1 — Tipos de contrato de mantenimiento (estilo SISPYME).
 * GET    /api/runtime/contract-types          lista
 * POST   /api/runtime/contract-types          upsert (id opcional para update)
 * DELETE /api/runtime/contract-types?id=X     borra
 *
 * tarifasPorTipoServicio: objeto { "Análisis, Consulting": 75, "Programación": 61, ... }
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) return NextResponse.json({ ok: false, error: "Sesión inválida." }, { status: 401 });
    if (getPersistenceBackend() !== "postgres") return NextResponse.json({ ok: true, contracts: [] });
    const contracts = await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        tenantContractType: {
          findMany: (a: { where: { clientId: string }; orderBy: { codigo: "asc" } }) => Promise<Array<Record<string, unknown>>>;
        };
      };
      return await c.tenantContractType.findMany({ where: { clientId: session.clientId }, orderBy: { codigo: "asc" } });
    });
    return NextResponse.json({ ok: true, contracts: contracts || [] });
  } catch (e) {
    captureError(e, { scope: "/api/runtime/contract-types GET" });
    return NextResponse.json({ ok: false, error: "Error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) return NextResponse.json({ ok: false, error: "Sesión inválida." }, { status: 401 });
    if (session.role !== "owner" && session.role !== "admin") {
      return NextResponse.json({ ok: false, error: "Solo owner / admin." }, { status: 403 });
    }
    if (getPersistenceBackend() !== "postgres") return NextResponse.json({ ok: false, error: "Postgres only" }, { status: 400 });

    const body = await request.json();
    const id = body?.id ? String(body.id).trim() : null;
    const data = {
      codigo: String(body?.codigo || "").trim(),
      nombre: String(body?.nombre || "").trim(),
      llamadasPermitidasMes: Number(body?.llamadasPermitidasMes || 0),
      precioExcesoLlamada: Number(body?.precioExcesoLlamada || 0),
      cambiosUrgPermitidos: Number(body?.cambiosUrgPermitidos || 0),
      precioCambioNorUrg: Number(body?.precioCambioNorUrg || 0),
      precioCambioUrgMU: Number(body?.precioCambioUrgMU || 0),
      recargoFueraHorarioPct: Number(body?.recargoFueraHorarioPct || 0),
      horasContratadas: Number(body?.horasContratadas || 0),
      periodicidadHoras: String(body?.periodicidadHoras || "ANUAL"),
      desplPrecioFijo: Number(body?.desplPrecioFijo || 0),
      desplPrecioKm: Number(body?.desplPrecioKm || 0),
      tarifasPorTipoServicio: (body?.tarifasPorTipoServicio || {}) as Record<string, number>,
      estado: String(body?.estado || "activo"),
      notas: body?.notas ? String(body.notas).trim() : null,
    };
    if (!data.codigo || !data.nombre) {
      return NextResponse.json({ ok: false, error: "codigo y nombre son obligatorios." }, { status: 400 });
    }

    const contract = await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        tenantContractType: {
          create: (a: { data: Record<string, unknown> }) => Promise<Record<string, unknown>>;
          update: (a: { where: { id: string }; data: Record<string, unknown> }) => Promise<Record<string, unknown>>;
        };
      };
      if (id) return await c.tenantContractType.update({ where: { id }, data });
      return await c.tenantContractType.create({
        data: { ...data, tenantId: session.tenantId, clientId: session.clientId },
      });
    });
    return NextResponse.json({ ok: true, contract });
  } catch (e) {
    captureError(e, { scope: "/api/runtime/contract-types POST" });
    return NextResponse.json({ ok: false, error: "Error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) return NextResponse.json({ ok: false, error: "Sesión inválida." }, { status: 401 });
    const id = request.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ ok: false, error: "Falta id." }, { status: 400 });
    if (getPersistenceBackend() !== "postgres") return NextResponse.json({ ok: false, error: "Postgres only" }, { status: 400 });
    await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        tenantContractType: {
          deleteMany: (a: { where: { id: string; clientId: string } }) => Promise<unknown>;
        };
      };
      await c.tenantContractType.deleteMany({ where: { id, clientId: session.clientId } });
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    captureError(e, { scope: "/api/runtime/contract-types DELETE" });
    return NextResponse.json({ ok: false, error: "Error" }, { status: 500 });
  }
}
