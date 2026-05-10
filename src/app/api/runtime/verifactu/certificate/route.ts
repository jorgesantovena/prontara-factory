import { NextResponse, type NextRequest } from "next/server";
import { requireTenantSession } from "@/lib/saas/auth-session";
import { withPrisma, getPersistenceBackend } from "@/lib/persistence/db";
import { encryptString } from "@/lib/saas/crypto-vault";
import { validateCertAndKey, inspectCertificate } from "@/lib/verticals/xmldsig";
import { captureError } from "@/lib/observability/error-capture";

/**
 * POST /api/runtime/verifactu/certificate (H6-VERIFACTU-SIGN)
 * Body: { certPem: string, keyPem: string, issuer?: string }
 *
 * Sube el certificado digital del tenant para firmar Verifactu. La
 * clave privada y el cert se cifran con crypto-vault antes de persistir.
 *
 * GET → devuelve metadata pública del cert actual (subject, validez)
 *      sin descifrar nada.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
    const certPem = String(body?.certPem || "").trim();
    const keyPem = String(body?.keyPem || "").trim();
    const issuer = String(body?.issuer || "otro").trim();

    if (!certPem.includes("BEGIN CERTIFICATE")) {
      return NextResponse.json({ ok: false, error: "certPem debe contener BEGIN/END CERTIFICATE." }, { status: 400 });
    }
    if (!keyPem.includes("PRIVATE KEY")) {
      return NextResponse.json({ ok: false, error: "keyPem debe contener BEGIN/END PRIVATE KEY." }, { status: 400 });
    }

    const validation = validateCertAndKey(certPem, keyPem);
    if (!validation.ok) {
      return NextResponse.json({ ok: false, error: validation.error }, { status: 400 });
    }

    const meta = inspectCertificate(certPem);

    await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        tenantCertificate: {
          upsert: (a: {
            where: { clientId: string };
            create: Record<string, unknown>;
            update: Record<string, unknown>;
          }) => Promise<unknown>;
        };
      };
      await c.tenantCertificate.upsert({
        where: { clientId: session.clientId },
        create: {
          tenantId: session.tenantId,
          clientId: session.clientId,
          issuer,
          certPem: encryptString(certPem),
          keyPem: encryptString(keyPem),
          subject: meta.subject || null,
          validFrom: meta.validFrom || null,
          validUntil: meta.validUntil || null,
        },
        update: {
          issuer,
          certPem: encryptString(certPem),
          keyPem: encryptString(keyPem),
          subject: meta.subject || null,
          validFrom: meta.validFrom || null,
          validUntil: meta.validUntil || null,
          uploadedAt: new Date(),
        },
      });
    });

    return NextResponse.json({
      ok: true,
      subject: meta.subject || null,
      validFrom: meta.validFrom || null,
      validUntil: meta.validUntil || null,
    });
  } catch (e) {
    captureError(e, { scope: "/api/runtime/verifactu/certificate POST" });
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) return NextResponse.json({ ok: false, error: "Sesión inválida." }, { status: 401 });
    if (getPersistenceBackend() !== "postgres") {
      return NextResponse.json({ ok: true, certificate: null });
    }
    const cert = await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        tenantCertificate: {
          findUnique: (a: { where: { clientId: string }; select: Record<string, true> }) => Promise<Record<string, unknown> | null>;
        };
      };
      return await c.tenantCertificate.findUnique({
        where: { clientId: session.clientId },
        select: { subject: true, issuer: true, validFrom: true, validUntil: true, uploadedAt: true },
      });
    });
    return NextResponse.json({ ok: true, certificate: cert || null });
  } catch (e) {
    captureError(e, { scope: "/api/runtime/verifactu/certificate GET" });
    return NextResponse.json({ ok: false, error: "Error" }, { status: 500 });
  }
}
