import { NextRequest, NextResponse } from "next/server";
import { requireTenantSession } from "@/lib/saas/auth-session";
import { listModuleRecordsAsync, createModuleRecordAsync, updateModuleRecordAsync } from "@/lib/persistence/active-client-data-store-async";
import { captureError } from "@/lib/observability/error-capture";

/**
 * POST /api/runtime/sf/convert-proposal (H15-C #1)
 * Body: { proposalId: string }
 *
 * Convierte una propuesta (presupuesto) en proyecto:
 *   1. Carga la propuesta y verifica que esté en estado "aceptado".
 *   2. Crea un proyecto nuevo con datos heredados:
 *      - cliente = propuesta.cliente
 *      - nombre = propuesta.concepto (o asunto)
 *      - fechaInicio = hoy
 *      - estado = "activo"
 *      - importe contratado (de propuesta.importe) → bolsa de horas/contrato
 *   3. Marca la propuesta como "convertida" + guarda projectRefId.
 *   4. Devuelve el id del proyecto creado.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) return NextResponse.json({ ok: false, error: "Sesión inválida." }, { status: 401 });

    const body = await request.json();
    const proposalId = String(body?.proposalId || "").trim();
    if (!proposalId) return NextResponse.json({ ok: false, error: "Falta proposalId." }, { status: 400 });

    const proposals = (await listModuleRecordsAsync("presupuestos", session.clientId)) as Array<Record<string, string>>;
    const proposal = proposals.find((p) => p.id === proposalId);
    if (!proposal) return NextResponse.json({ ok: false, error: "Propuesta no encontrada." }, { status: 404 });

    const estado = String(proposal.estado || "").toLowerCase();
    if (estado !== "aceptado" && estado !== "firmado" && estado !== "ganado") {
      return NextResponse.json({
        ok: false,
        error: "Solo se convierten propuestas en estado aceptado/firmado/ganado. Estado actual: " + estado,
      }, { status: 400 });
    }
    if (proposal.projectRefId) {
      return NextResponse.json({
        ok: false,
        error: "Esta propuesta ya se convirtió en proyecto (id: " + proposal.projectRefId + ").",
        projectRefId: proposal.projectRefId,
      }, { status: 400 });
    }

    // Crear proyecto heredando datos
    const today = new Date().toISOString().slice(0, 10);
    const projectPayload: Record<string, string> = {
      nombre: String(proposal.concepto || proposal.asunto || "Proyecto sin nombre"),
      cliente: String(proposal.cliente || ""),
      responsable: session.email,
      estado: "activo",
      fechaInicio: today,
      facturable: "si",
      importeContratado: String(proposal.importe || ""),
      notas: "Convertido desde propuesta " + (proposal.numero || proposalId.slice(0, 8)),
      proposalRefId: proposalId,
    };

    const project = await createModuleRecordAsync("proyectos", projectPayload, session.clientId);

    // Marcar propuesta como convertida + guardar projectRefId
    await updateModuleRecordAsync("presupuestos", proposalId, {
      ...proposal,
      estado: "convertida",
      projectRefId: project.id,
      convertedAt: new Date().toISOString(),
    }, session.clientId);

    return NextResponse.json({
      ok: true,
      projectRefId: project.id,
      project,
    });
  } catch (e) {
    captureError(e, { scope: "/api/runtime/sf/convert-proposal" });
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
