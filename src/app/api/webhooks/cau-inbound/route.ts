import { NextRequest, NextResponse } from "next/server";
import { withPrisma } from "@/lib/persistence/db";
import { createModuleRecordAsync, listModuleRecordsAsync } from "@/lib/persistence/active-client-data-store-async";
import { captureError } from "@/lib/observability/error-capture";

/**
 * POST /api/webhooks/cau-inbound (H15-C #9)
 *
 * Webhook compatible con Resend Inbound o Mailgun parsed-email.
 * Recibe un email entrante y crea un ticket CAU automáticamente.
 *
 * Formato esperado (Resend Inbound):
 *   { to: "delca@cau.tudominio.com", from: "user@delca.es",
 *     subject: "Error al guardar pedido", text: "...", html: "...",
 *     headers: { "Message-ID": "..." } }
 *
 * Identificación del cliente:
 *   - Parsea el local-part del destinatario ("delca").
 *   - Busca un CauInboundMapping con aliasLocal=delca.
 *   - Si existe, usa esa config (clientId, defaultSeveridad, defaultAplicacion).
 *   - Si no, devuelve 404 (configurar primero en /ajustes/cau-inbound).
 *
 * Auth: secret en query o header. En Resend se configura como signing
 * secret en su panel.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type InboundEmail = {
  to: string;
  from: string;
  subject: string;
  text: string;
  html?: string;
  headers?: Record<string, string>;
};

export async function POST(request: NextRequest) {
  try {
    // Auth — secreto compartido configurado en Resend
    const expectedSecret = String(process.env.CAU_INBOUND_SECRET || "").trim();
    if (expectedSecret) {
      const got = request.headers.get("x-inbound-secret") || request.nextUrl.searchParams.get("secret") || "";
      if (got !== expectedSecret) {
        return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
      }
    }

    const body = (await request.json()) as InboundEmail;
    const to = String(body.to || "").toLowerCase().trim();
    const from = String(body.from || "").toLowerCase().trim();
    const subject = String(body.subject || "(sin asunto)").trim();
    const text = String(body.text || body.html || "").trim();

    if (!to || !from) {
      return NextResponse.json({ ok: false, error: "Faltan to/from" }, { status: 400 });
    }

    // local-part antes de @
    const aliasLocal = to.split("@")[0].trim();
    if (!aliasLocal) {
      return NextResponse.json({ ok: false, error: "Email destino inválido" }, { status: 400 });
    }

    // Resolver tenant y cliente desde el mapping
    const mapping = await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        cauInboundMapping: { findFirst: (a: { where: { aliasLocal: string; active: true } }) => Promise<{ tenantId: string; clientId: string; clienteRefId: string; defaultSeveridad: string; defaultAplicacion: string | null } | null> };
      };
      return await c.cauInboundMapping.findFirst({ where: { aliasLocal, active: true } });
    });

    if (!mapping) {
      return NextResponse.json({ ok: false, error: "Alias no configurado: " + aliasLocal }, { status: 404 });
    }

    // Identificar nombre del cliente
    const clientes = (await listModuleRecordsAsync("clientes", mapping.clientId)) as Array<Record<string, string>>;
    const cliente = clientes.find((c) => c.id === mapping.clienteRefId);
    const clienteNombre = cliente?.nombre || cliente?.razonSocial || from.split("@")[1] || "Cliente";

    // Crear ticket en CAU
    const ticket = await createModuleRecordAsync("cau", {
      asunto: subject,
      cliente: clienteNombre,
      aplicacion: mapping.defaultAplicacion || "",
      severidad: mapping.defaultSeveridad || "media",
      urgencia: "normal",
      estado: "nuevo",
      descripcion: text.slice(0, 5000),
      origen: "email",
      emailRemitente: from,
      createdAt: new Date().toISOString(),
    }, mapping.clientId);

    return NextResponse.json({ ok: true, ticketId: ticket.id });
  } catch (e) {
    captureError(e, { scope: "/webhooks/cau-inbound" });
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
