import { NextRequest, NextResponse } from "next/server";
import { requireTenantSession } from "@/lib/saas/auth-session";
import { withPrisma } from "@/lib/persistence/db";
import { captureError } from "@/lib/observability/error-capture";
import { randomBytes } from "node:crypto";

/**
 * /api/runtime/sf/portal-access (H15-C #5)
 *
 * GET                                → lista los accesos activos
 * POST { clienteRefId, contactEmail, contactName, expiresInDays? } → genera magic token
 * DELETE ?id=                        → revoca
 *
 * El magic token se envía al cliente final por email (Resend). El cliente
 * usa /portal/<token> para ver sus tickets/proyectos sin login.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Access = {
  id: string;
  clienteRefId: string;
  magicToken: string;
  contactEmail: string;
  contactName: string;
  expiresAt: Date;
  lastSeenAt: Date | null;
  active: boolean;
  createdAt: Date;
};

function generateMagicToken(): string {
  return randomBytes(24).toString("base64url");
}

export async function GET(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) return NextResponse.json({ ok: false, error: "Sesión inválida." }, { status: 401 });

    const accesses = await withPrisma(async (prisma) => {
      const c = prisma as unknown as { clientPortalAccess: { findMany: (a: { where: { clientId: string; active: true }; orderBy: { createdAt: "desc" } }) => Promise<Access[]> } };
      return await c.clientPortalAccess.findMany({ where: { clientId: session.clientId, active: true }, orderBy: { createdAt: "desc" } });
    });
    return NextResponse.json({ ok: true, accesses });
  } catch (e) {
    captureError(e, { scope: "/portal-access GET" });
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) return NextResponse.json({ ok: false, error: "Sesión inválida." }, { status: 401 });

    const body = await request.json();
    const clienteRefId = String(body?.clienteRefId || "").trim();
    const contactEmail = String(body?.contactEmail || "").trim().toLowerCase();
    const contactName = String(body?.contactName || "").trim();
    const expiresInDays = parseInt(String(body?.expiresInDays || "365"), 10);

    if (!clienteRefId || !contactEmail) {
      return NextResponse.json({ ok: false, error: "Faltan clienteRefId, contactEmail." }, { status: 400 });
    }

    const magicToken = generateMagicToken();
    const expiresAt = new Date(Date.now() + expiresInDays * 86400_000);

    const access = await withPrisma(async (prisma) => {
      const c = prisma as unknown as { clientPortalAccess: { create: (a: { data: Record<string, unknown> }) => Promise<Access> } };
      return await c.clientPortalAccess.create({
        data: {
          tenantId: session.tenantId,
          clientId: session.clientId,
          clienteRefId, magicToken, contactEmail, contactName,
          expiresAt,
          createdBy: session.email,
        },
      });
    });

    const portalUrl =
      (process.env.PRONTARA_PUBLIC_BASE_URL || "http://localhost:3000") +
      "/portal/" + magicToken;

    return NextResponse.json({ ok: true, access, portalUrl });
  } catch (e) {
    captureError(e, { scope: "/portal-access POST" });
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
      const c = prisma as unknown as { clientPortalAccess: { updateMany: (a: { where: { id: string; clientId: string }; data: { active: false } }) => Promise<unknown> } };
      return await c.clientPortalAccess.updateMany({ where: { id, clientId: session.clientId }, data: { active: false } });
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    captureError(e, { scope: "/portal-access DELETE" });
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
