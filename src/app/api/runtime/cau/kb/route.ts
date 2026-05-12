import { NextRequest, NextResponse } from "next/server";
import { requireTenantSession } from "@/lib/saas/auth-session";
import { withPrisma } from "@/lib/persistence/db";
import { captureError } from "@/lib/observability/error-capture";

/**
 * /api/runtime/cau/kb (H15-B) — Base de conocimiento del CAU.
 *
 * GET ?q=...&categoria=...&aplicacion=...   → busca KB entries
 * POST { titulo, sintoma, solucion, categoria?, aplicacion?, ticketRefId?, tags? }
 *      → crea entry (típicamente desde una "Convertir en KB" cuando se cierra ticket)
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type KbEntry = {
  id: string;
  titulo: string;
  sintoma: string;
  solucion: string;
  categoria: string | null;
  aplicacion: string | null;
  ticketRefId: string | null;
  tags: string[];
  views: number;
  authorEmail: string;
  createdAt: Date;
};

export async function GET(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) return NextResponse.json({ ok: false, error: "Sesión inválida." }, { status: 401 });

    const q = String(request.nextUrl.searchParams.get("q") || "").trim().toLowerCase();
    const categoria = String(request.nextUrl.searchParams.get("categoria") || "").trim();
    const aplicacion = String(request.nextUrl.searchParams.get("aplicacion") || "").trim();

    const where: Record<string, unknown> = { clientId: session.clientId };
    if (categoria) where.categoria = categoria;
    if (aplicacion) where.aplicacion = aplicacion;

    const entries = await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        cauKbEntry: {
          findMany: (a: { where: Record<string, unknown>; orderBy: { createdAt: "desc" }; take: number }) => Promise<KbEntry[]>;
        };
      };
      return await c.cauKbEntry.findMany({ where, orderBy: { createdAt: "desc" }, take: 200 });
    });

    // Filtro full-text en memoria (suficiente para volúmenes de KB típicos).
    const rows = entries || [];
    const filtered = q
      ? rows.filter((e) =>
          (e.titulo + " " + e.sintoma + " " + e.solucion + " " + (e.tags || []).join(" "))
            .toLowerCase().includes(q),
        )
      : rows;

    return NextResponse.json({ ok: true, entries: filtered });
  } catch (e) {
    captureError(e, { scope: "/api/runtime/cau/kb GET" });
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) return NextResponse.json({ ok: false, error: "Sesión inválida." }, { status: 401 });

    const body = await request.json();
    const titulo = String(body?.titulo || "").trim();
    const sintoma = String(body?.sintoma || "").trim();
    const solucion = String(body?.solucion || "").trim();

    if (!titulo || !sintoma || !solucion) {
      return NextResponse.json({ ok: false, error: "Faltan: titulo, sintoma, solucion." }, { status: 400 });
    }

    const entry = await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        cauKbEntry: {
          create: (a: { data: Record<string, unknown> }) => Promise<KbEntry>;
        };
      };
      return await c.cauKbEntry.create({
        data: {
          tenantId: session.tenantId,
          clientId: session.clientId,
          titulo, sintoma, solucion,
          categoria: body?.categoria || null,
          aplicacion: body?.aplicacion || null,
          ticketRefId: body?.ticketRefId || null,
          tags: Array.isArray(body?.tags) ? body.tags : [],
          authorEmail: session.email,
        },
      });
    });

    return NextResponse.json({ ok: true, entry });
  } catch (e) {
    captureError(e, { scope: "/api/runtime/cau/kb POST" });
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
