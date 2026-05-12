import { NextRequest, NextResponse } from "next/server";
import { withPrisma } from "@/lib/persistence/db";
import { listModuleRecordsAsync, updateModuleRecordAsync } from "@/lib/persistence/active-client-data-store-async";
import { captureError } from "@/lib/observability/error-capture";

/**
 * POST /api/runtime/sf/proposal-sign (H15-C #8)
 *
 * Body: { proposalId, clientId, signerEmail, signerName, signatureSvg }
 *
 * Endpoint público (sin auth — el firmante accede vía magic token desde
 * el email). Guarda la firma + marca la propuesta como "firmado" + opcional
 * disparar conversión a proyecto.
 *
 * Para verificar identidad del firmante: el caller debe haber sido
 * validado por un token único del email — el endpoint recibe el
 * `proposalId` y `signerEmail` que debían matchear con la metadata
 * de la propuesta (presupuesto.contactoEmail).
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const proposalId = String(body?.proposalId || "").trim();
    const clientId = String(body?.clientId || "").trim();
    const signerEmail = String(body?.signerEmail || "").trim().toLowerCase();
    const signerName = String(body?.signerName || "").trim();
    const signatureSvg = String(body?.signatureSvg || "").trim();

    if (!proposalId || !clientId || !signerEmail || !signerName || !signatureSvg) {
      return NextResponse.json({ ok: false, error: "Faltan campos obligatorios." }, { status: 400 });
    }

    // Verificar que la propuesta existe en ese tenant y que el firmante
    // coincide con el contactoEmail registrado (control mínimo).
    const proposals = (await listModuleRecordsAsync("presupuestos", clientId)) as Array<Record<string, string>>;
    const proposal = proposals.find((p) => p.id === proposalId);
    if (!proposal) {
      return NextResponse.json({ ok: false, error: "Propuesta no encontrada." }, { status: 404 });
    }
    const expectedEmail = String(proposal.contactoEmail || proposal.email || "").toLowerCase().trim();
    if (expectedEmail && expectedEmail !== signerEmail) {
      return NextResponse.json({ ok: false, error: "Email del firmante no coincide con el de la propuesta." }, { status: 403 });
    }

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || null;
    const userAgent = request.headers.get("user-agent") || null;

    const signature = await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        proposalSignature: { create: (a: { data: Record<string, unknown> }) => Promise<{ id: string; signedAt: Date }> };
        tenant: { findUnique: (a: { where: { clientId: string } }) => Promise<{ id: string } | null> };
      };
      const tenant = await c.tenant.findUnique({ where: { clientId } });
      const tenantId = tenant?.id || clientId;
      return await c.proposalSignature.create({
        data: {
          tenantId, clientId,
          proposalRefId: proposalId,
          signerEmail, signerName, signatureSvg,
          signedIp: ip, signedUserAgent: userAgent,
        },
      });
    });

    if (!signature) {
      return NextResponse.json({ ok: false, error: "No se pudo registrar la firma." }, { status: 500 });
    }

    // Marca la propuesta como firmada
    await updateModuleRecordAsync("presupuestos", proposalId, {
      ...proposal,
      estado: "firmado",
      fechaFirma: signature.signedAt.toISOString().slice(0, 10),
      firmadoPor: signerName + " <" + signerEmail + ">",
    }, clientId);

    return NextResponse.json({ ok: true, signatureId: signature.id, signedAt: signature.signedAt });
  } catch (e) {
    captureError(e, { scope: "/proposal-sign" });
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
