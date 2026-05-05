import { NextResponse, type NextRequest } from "next/server";
import { requireFactoryAdmin } from "@/lib/factory-chat/auth";
import {
  hardReprovisionTenant,
  type HardReprovisionInput,
} from "@/lib/factory/tenant-hard-provisioning";

/**
 * POST /api/factory/hard-provisioning
 * Body: HardReprovisionInput (clientId obligatorio).
 *
 * Solo admins de Factory. Requiere clientId.
 * El `temporaryPassword` que pueda devolver nunca se loggea en auditoría;
 * se entrega solo en la respuesta al operador.
 */
export async function POST(request: NextRequest) {
  const admin = requireFactoryAdmin(request);
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "Se requiere sesión con rol admin en la Factory." },
      { status: 401 },
    );
  }

  let body: HardReprovisionInput;
  try {
    body = (await request.json()) as HardReprovisionInput;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Body JSON inválido." },
      { status: 400 },
    );
  }

  if (!body.clientId) {
    return NextResponse.json(
      { ok: false, error: "Falta clientId." },
      { status: 400 },
    );
  }

  try {
    const result = await hardReprovisionTenant({
      clientId: body.clientId,
      resetAdminPassword: Boolean(body.resetAdminPassword),
      seedDemo: body.seedDemo,
      adminEmail: body.adminEmail,
      adminFullName: body.adminFullName,
      reason:
        body.reason || "Reprovisión duro solicitada desde Factory por " + admin.email,
    });
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Error ejecutando hard-provisioning.",
      },
      { status: 500 },
    );
  }
}
