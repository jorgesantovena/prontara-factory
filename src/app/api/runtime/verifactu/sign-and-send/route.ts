import { NextResponse, type NextRequest } from "next/server";
import { requireTenantSession } from "@/lib/saas/auth-session";
import { withPrisma, getPersistenceBackend } from "@/lib/persistence/db";
import { decryptString, encryptString } from "@/lib/saas/crypto-vault";
import { signXmlEnveloped } from "@/lib/verticals/xmldsig";
import { sendToAeat, getAeatEndpoint } from "@/lib/verticals/verifactu-aeat-client";
import { captureError } from "@/lib/observability/error-capture";

/**
 * POST /api/runtime/verifactu/sign-and-send (H6-VERIFACTU-SIGN)
 * Body: { submissionId: string }
 *
 * Toma una VerifactuSubmission en status="prepared", descifra el XML,
 * descifra el certificado del tenant, firma con XML-DSig y manda al
 * endpoint AEAT.
 *
 * Endpoint AEAT:
 *   - Sandbox por defecto (https://prewww1.aeat.es/...)
 *   - Producción si VERIFACTU_PROD=true (https://www1.agenciatributaria.gob.es/...)
 *
 * El XML firmado y la respuesta AEAT (con CSV/huella) se persisten,
 * y el status pasa a "sent" o "error".
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;
// Constantes de endpoint movidas a `lib/verticals/verifactu-aeat-client`
// junto con la lógica SOAP+mTLS (H14-C).

export async function POST(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) return NextResponse.json({ ok: false, error: "Sesión inválida." }, { status: 401 });
    if (getPersistenceBackend() !== "postgres") {
      return NextResponse.json({ ok: false, error: "Postgres only" }, { status: 400 });
    }

    const body = await request.json();
    const submissionId = String(body?.submissionId || "").trim();
    if (!submissionId) return NextResponse.json({ ok: false, error: "Falta submissionId." }, { status: 400 });

    const result = await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        verifactuSubmission: {
          findUnique: (a: { where: { id: string } }) => Promise<{ id: string; clientId: string; xmlPayload: string; status: string } | null>;
          update: (a: { where: { id: string }; data: Record<string, unknown> }) => Promise<unknown>;
        };
        tenantCertificate: {
          findUnique: (a: { where: { clientId: string } }) => Promise<{ certPem: string; keyPem: string } | null>;
        };
      };
      const submission = await c.verifactuSubmission.findUnique({ where: { id: submissionId } });
      if (!submission) return { error: "Submission no encontrada." };
      if (submission.clientId !== session.clientId) return { error: "Submission de otro tenant." };
      if (submission.status === "sent") return { error: "Ya enviada." };

      const certRow = await c.tenantCertificate.findUnique({ where: { clientId: session.clientId } });
      if (!certRow) return { error: "No has subido el certificado digital. Súbelo primero en /ajustes/certificado." };

      // Descifrar
      const xmlPlain = decryptString(submission.xmlPayload);
      const certPem = decryptString(certRow.certPem);
      const keyPem = decryptString(certRow.keyPem);

      // Firmar
      let signedXml: string;
      try {
        signedXml = signXmlEnveloped(xmlPlain, keyPem, certPem);
      } catch (err) {
        await c.verifactuSubmission.update({
          where: { id: submissionId },
          data: { status: "error", errorMsg: "Firma falló: " + (err instanceof Error ? err.message : String(err)) },
        });
        return { error: "Firma XML-DSig falló. Verifica que el certificado y la clave coincidan." };
      }

      // H14-C: envío AEAT vía cliente dedicado con SOAP envelope + mTLS.
      const sendResult = await sendToAeat({
        signedXml,
        certPem,
        keyPem,
        keyPassphrase: process.env.VERIFACTU_CERT_PASSWORD || undefined,
      });
      const aeatResponse = sendResult.rawResponse;
      const csvHuella = sendResult.csvHuella;
      const aeatStatus: "sent" | "rejected" | "error" = sendResult.status;

      const errorMsg = sendResult.errorMsg
        ? sendResult.errorMsg + (sendResult.errorCode ? " [" + sendResult.errorCode + "]" : "")
        : (aeatStatus !== "sent" ? aeatResponse.slice(0, 1000) : null);

      await c.verifactuSubmission.update({
        where: { id: submissionId },
        data: {
          status: aeatStatus,
          xmlPayload: encryptString(signedXml),
          csvHuella: csvHuella ? encryptString(csvHuella) : null,
          sentAt: aeatStatus === "sent" ? new Date() : null,
          errorMsg,
        },
      });

      return {
        ok: aeatStatus === "sent",
        status: aeatStatus,
        csvHuella,
        environment: String(process.env.VERIFACTU_PROD || "").trim() === "true" ? "production" : "sandbox",
        endpoint: getAeatEndpoint(),
        errorMsg,
      };
    });

    if (result && "error" in result) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }
    return NextResponse.json(result || { ok: true });
  } catch (e) {
    captureError(e, { scope: "/api/runtime/verifactu/sign-and-send" });
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
