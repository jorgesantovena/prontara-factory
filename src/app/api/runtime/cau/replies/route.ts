import { NextRequest, NextResponse } from "next/server";
import { requireTenantSession } from "@/lib/saas/auth-session";
import { withPrisma } from "@/lib/persistence/db";
import { captureError } from "@/lib/observability/error-capture";

/**
 * /api/runtime/cau/replies (H15-B)
 *
 * GET ?ticketId=...     → lista todos los replies del ticket (cronológico)
 * POST { ticketId, body, internal? }  → añade un reply del agente
 *
 * Si el reply es el primero del ticket (firstResponseAt == null), lo
 * marca en el TenantModuleRecord para tracking SLA.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ReplyRow = {
  id: string;
  ticketId: string;
  authorEmail: string;
  authorRole: string;
  body: string;
  internal: boolean;
  attachments: string[];
  createdAt: Date;
};

export async function GET(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) return NextResponse.json({ ok: false, error: "Sesión inválida." }, { status: 401 });

    const ticketId = String(request.nextUrl.searchParams.get("ticketId") || "").trim();
    if (!ticketId) return NextResponse.json({ ok: false, error: "Falta ticketId." }, { status: 400 });

    const replies = await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        cauTicketReply: {
          findMany: (a: { where: { clientId: string; ticketId: string }; orderBy: { createdAt: "asc" } }) => Promise<ReplyRow[]>;
        };
      };
      return await c.cauTicketReply.findMany({
        where: { clientId: session.clientId, ticketId },
        orderBy: { createdAt: "asc" },
      });
    });

    return NextResponse.json({ ok: true, replies });
  } catch (e) {
    captureError(e, { scope: "/api/runtime/cau/replies GET" });
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) return NextResponse.json({ ok: false, error: "Sesión inválida." }, { status: 401 });

    const body = await request.json();
    const ticketId = String(body?.ticketId || "").trim();
    const text = String(body?.body || "").trim();
    const internal = Boolean(body?.internal);
    const attachments: string[] = Array.isArray(body?.attachments) ? body.attachments : [];

    if (!ticketId || !text) {
      return NextResponse.json({ ok: false, error: "Faltan campos: ticketId, body." }, { status: 400 });
    }

    const reply = await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        cauTicketReply: {
          create: (a: { data: Record<string, unknown> }) => Promise<ReplyRow>;
        };
        tenantModuleRecord: {
          findFirst: (a: { where: { id: string; clientId: string; moduleKey: "cau" } }) => Promise<{ id: string; data: Record<string, unknown> } | null>;
          update: (a: { where: { id: string }; data: { data: Record<string, unknown> } }) => Promise<unknown>;
        };
      };

      const reply = await c.cauTicketReply.create({
        data: {
          tenantId: session.tenantId,
          clientId: session.clientId,
          ticketId,
          authorEmail: session.email,
          authorRole: "agente",
          body: text,
          internal,
          attachments,
        },
      });

      // Si es el primer reply del agente (no interno) y no había
      // firstResponseAt en el ticket, lo marca para tracking SLA.
      if (!internal) {
        const ticket = await c.tenantModuleRecord.findFirst({
          where: { id: ticketId, clientId: session.clientId, moduleKey: "cau" },
        });
        if (ticket && !ticket.data?.firstResponseAt) {
          await c.tenantModuleRecord.update({
            where: { id: ticketId },
            data: {
              data: {
                ...ticket.data,
                firstResponseAt: new Date().toISOString(),
              },
            },
          });
        }
      }

      return reply;
    });

    return NextResponse.json({ ok: true, reply });
  } catch (e) {
    captureError(e, { scope: "/api/runtime/cau/replies POST" });
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
