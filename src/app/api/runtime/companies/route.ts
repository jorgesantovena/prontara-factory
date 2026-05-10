import { NextResponse, type NextRequest } from "next/server";
import { requireTenantSession } from "@/lib/saas/auth-session";
import { withPrisma, getPersistenceBackend } from "@/lib/persistence/db";
import { captureError } from "@/lib/observability/error-capture";

/**
 * Multi-empresa interna del tenant (H7-C4).
 * GET    /api/runtime/companies        lista
 * POST   /api/runtime/companies        upsert (id opcional)
 * DELETE /api/runtime/companies?id=X   borra
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) return NextResponse.json({ ok: false, error: "Sesión inválida." }, { status: 401 });
    if (getPersistenceBackend() !== "postgres") {
      return NextResponse.json({ ok: true, companies: [] });
    }
    const companies = await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        tenantCompany: {
          findMany: (a: { where: { clientId: string }; orderBy: { esEmisorPorDefecto: "desc" } }) => Promise<Array<Record<string, unknown>>>;
        };
      };
      return await c.tenantCompany.findMany({ where: { clientId: session.clientId }, orderBy: { esEmisorPorDefecto: "desc" } });
    });
    return NextResponse.json({ ok: true, companies: companies || [] });
  } catch (e) {
    captureError(e, { scope: "/api/runtime/companies GET" });
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
    if (getPersistenceBackend() !== "postgres") {
      return NextResponse.json({ ok: false, error: "Postgres only" }, { status: 400 });
    }
    const body = await request.json();
    const id = body?.id ? String(body.id).trim() : null;
    const data = {
      razonSocial: String(body?.razonSocial || "").trim(),
      cif: String(body?.cif || "").trim(),
      iban: body?.iban ? String(body.iban).trim() : null,
      direccion: body?.direccion ? String(body.direccion).trim() : null,
      email: body?.email ? String(body.email).trim() : null,
      telefono: body?.telefono ? String(body.telefono).trim() : null,
      esEmisorPorDefecto: Boolean(body?.esEmisorPorDefecto),
      estado: String(body?.estado || "activa").trim(),
    };
    if (!data.razonSocial || !data.cif) {
      return NextResponse.json({ ok: false, error: "razonSocial y cif son obligatorios." }, { status: 400 });
    }

    const company = await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        tenantCompany: {
          create: (a: { data: Record<string, unknown> }) => Promise<Record<string, unknown>>;
          update: (a: { where: { id: string }; data: Record<string, unknown> }) => Promise<Record<string, unknown>>;
          updateMany: (a: { where: { clientId: string; id?: { not: string } }; data: Record<string, unknown> }) => Promise<unknown>;
        };
      };
      // Si esEmisorPorDefecto=true, marcar todas las demás como false
      if (data.esEmisorPorDefecto) {
        await c.tenantCompany.updateMany({
          where: { clientId: session.clientId, ...(id ? { id: { not: id } } : {}) },
          data: { esEmisorPorDefecto: false },
        });
      }
      if (id) {
        return await c.tenantCompany.update({ where: { id }, data });
      }
      return await c.tenantCompany.create({
        data: { ...data, tenantId: session.tenantId, clientId: session.clientId },
      });
    });
    return NextResponse.json({ ok: true, company });
  } catch (e) {
    captureError(e, { scope: "/api/runtime/companies POST" });
    return NextResponse.json({ ok: false, error: "Error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) return NextResponse.json({ ok: false, error: "Sesión inválida." }, { status: 401 });
    const id = request.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ ok: false, error: "Falta id." }, { status: 400 });
    if (getPersistenceBackend() !== "postgres") {
      return NextResponse.json({ ok: false, error: "Postgres only" }, { status: 400 });
    }
    await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        tenantCompany: {
          deleteMany: (a: { where: { id: string; clientId: string } }) => Promise<unknown>;
        };
      };
      await c.tenantCompany.deleteMany({ where: { id, clientId: session.clientId } });
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    captureError(e, { scope: "/api/runtime/companies DELETE" });
    return NextResponse.json({ ok: false, error: "Error" }, { status: 500 });
  }
}
