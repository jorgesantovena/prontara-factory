import { NextResponse, type NextRequest } from "next/server";
import { requireTenantSession } from "@/lib/saas/auth-session";
import { withPrisma, getPersistenceBackend } from "@/lib/persistence/db";

/**
 * CRUD de campos personalizados del tenant (DEV-CF).
 * GET    /api/runtime/custom-fields                lista
 * POST   /api/runtime/custom-fields                crea
 * DELETE /api/runtime/custom-fields?id=X           borra
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALLOWED_KINDS = new Set([
  "text", "email", "tel", "textarea", "date", "number", "money", "status",
]);

export async function GET(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) return NextResponse.json({ ok: false, error: "Sesión inválida." }, { status: 401 });
    if (getPersistenceBackend() !== "postgres") {
      return NextResponse.json({ ok: false, error: "Solo Postgres." }, { status: 400 });
    }

    const fields = await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        tenantCustomField: {
          findMany: (a: {
            where: { clientId: string };
            orderBy: { position: "asc" };
          }) => Promise<Array<Record<string, unknown>>>;
        };
      };
      return await c.tenantCustomField.findMany({
        where: { clientId: session.clientId },
        orderBy: { position: "asc" },
      });
    });
    return NextResponse.json({ ok: true, fields: fields || [] });
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
    const moduleKey = String(body?.moduleKey || "").trim();
    const fieldKey = String(body?.fieldKey || "").trim();
    const label = String(body?.label || "").trim();
    const kind = String(body?.kind || "text").trim();
    const required = Boolean(body?.required);
    const placeholder = String(body?.placeholder || "").trim() || null;
    const options = Array.isArray(body?.options) ? body.options : null;
    const position = Number(body?.position || 100);

    if (!moduleKey || !fieldKey || !label) {
      return NextResponse.json(
        { ok: false, error: "Faltan moduleKey, fieldKey o label." },
        { status: 400 },
      );
    }
    if (!ALLOWED_KINDS.has(kind)) {
      return NextResponse.json(
        { ok: false, error: "kind inválido. Permitidos: " + [...ALLOWED_KINDS].join(", ") },
        { status: 400 },
      );
    }
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(fieldKey)) {
      return NextResponse.json(
        { ok: false, error: "fieldKey debe ser identificador válido (a-z, 0-9, _)." },
        { status: 400 },
      );
    }

    const field = await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        tenantCustomField: {
          upsert: (a: {
            where: { clientId_moduleKey_fieldKey: { clientId: string; moduleKey: string; fieldKey: string } };
            create: Record<string, unknown>;
            update: Record<string, unknown>;
          }) => Promise<Record<string, unknown>>;
        };
      };
      return await c.tenantCustomField.upsert({
        where: {
          clientId_moduleKey_fieldKey: {
            clientId: session.clientId,
            moduleKey,
            fieldKey,
          },
        },
        create: {
          tenantId: session.tenantId,
          clientId: session.clientId,
          moduleKey,
          fieldKey,
          label,
          kind,
          required,
          placeholder,
          optionsJson: options,
          position,
        },
        update: {
          label,
          kind,
          required,
          placeholder,
          optionsJson: options,
          position,
        },
      });
    });

    return NextResponse.json({ ok: true, field });
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
    if (!id) {
      return NextResponse.json({ ok: false, error: "Falta id." }, { status: 400 });
    }
    await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        tenantCustomField: {
          deleteMany: (a: { where: { id: string; clientId: string } }) => Promise<unknown>;
        };
      };
      await c.tenantCustomField.deleteMany({
        where: { id, clientId: session.clientId },
      });
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
