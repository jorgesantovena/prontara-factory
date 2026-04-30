import { NextResponse, type NextRequest } from "next/server";
import { requireFactoryAdmin } from "@/lib/factory-chat/auth";
import type { LeadStatus } from "@/lib/saas/leads-store";
import {
  listLeadsAsync,
  updateLeadStatusAsync,
} from "@/lib/persistence/leads-store-async";

export async function GET(request: NextRequest) {
  const admin = requireFactoryAdmin(request);
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "Se requiere sesión con rol admin en la Factory." },
      { status: 401 },
    );
  }
  const leads = await listLeadsAsync({ limit: 200 });
  return NextResponse.json({ ok: true, leads });
}

export async function PATCH(request: NextRequest) {
  const admin = requireFactoryAdmin(request);
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "Se requiere sesión con rol admin en la Factory." },
      { status: 401 },
    );
  }
  let body: { id?: string; status?: LeadStatus };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Body inválido." }, { status: 400 });
  }
  if (!body.id || !body.status) {
    return NextResponse.json({ ok: false, error: "Falta id o status." }, { status: 400 });
  }
  try {
    const lead = await updateLeadStatusAsync(body.id, body.status);
    return NextResponse.json({ ok: true, lead });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Error actualizando." },
      { status: 400 },
    );
  }
}
