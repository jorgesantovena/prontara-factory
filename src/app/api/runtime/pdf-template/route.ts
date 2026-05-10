import { NextResponse, type NextRequest } from "next/server";
import { requireTenantSession } from "@/lib/saas/auth-session";
import { withPrisma, getPersistenceBackend } from "@/lib/persistence/db";
import { captureError } from "@/lib/observability/error-capture";

/**
 * Plantilla PDF personalizada del tenant (H6-PDF-EDITOR).
 * GET → lee la plantilla actual (o defaults)
 * POST → upsert
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEFAULTS = {
  logoUrl: "",
  primaryColor: "#1d4ed8",
  pieFactura: "",
  mensajePie: "Gracias por confiar en nosotros.",
  mostrarBancos: true,
  iban: "",
};

export async function GET(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) return NextResponse.json({ ok: false, error: "Sesión inválida." }, { status: 401 });
    if (getPersistenceBackend() !== "postgres") {
      return NextResponse.json({ ok: true, template: DEFAULTS });
    }
    const tpl = await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        tenantPdfTemplate: {
          findUnique: (a: { where: { clientId: string } }) => Promise<Record<string, unknown> | null>;
        };
      };
      return await c.tenantPdfTemplate.findUnique({ where: { clientId: session.clientId } });
    });
    return NextResponse.json({ ok: true, template: tpl || DEFAULTS });
  } catch (e) {
    captureError(e, { scope: "/api/runtime/pdf-template GET" });
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
    const data = {
      logoUrl: String(body?.logoUrl || "").trim(),
      primaryColor: String(body?.primaryColor || "#1d4ed8").trim(),
      pieFactura: String(body?.pieFactura || "").trim(),
      mensajePie: String(body?.mensajePie || "").trim(),
      mostrarBancos: Boolean(body?.mostrarBancos),
      iban: String(body?.iban || "").trim(),
    };
    const tpl = await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        tenantPdfTemplate: {
          upsert: (a: { where: { clientId: string }; create: Record<string, unknown>; update: Record<string, unknown> }) => Promise<Record<string, unknown>>;
        };
      };
      return await c.tenantPdfTemplate.upsert({
        where: { clientId: session.clientId },
        create: { tenantId: session.tenantId, clientId: session.clientId, ...data },
        update: data,
      });
    });
    return NextResponse.json({ ok: true, template: tpl });
  } catch (e) {
    captureError(e, { scope: "/api/runtime/pdf-template POST" });
    return NextResponse.json({ ok: false, error: "Error" }, { status: 500 });
  }
}
