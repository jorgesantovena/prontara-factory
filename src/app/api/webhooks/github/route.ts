import { NextRequest, NextResponse } from "next/server";
import { withPrisma } from "@/lib/persistence/db";
import { createModuleRecordAsync } from "@/lib/persistence/active-client-data-store-async";
import { captureError } from "@/lib/observability/error-capture";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * POST /api/webhooks/github (H15-C #10)
 *
 * Webhook receiver de GitHub. Valida firma HMAC con el secret guardado
 * en GithubInstallation.webhookSecret. Procesa eventos:
 *
 *   - push           → si hay #TICKET-123 en commit message, añade nota al ticket
 *   - pull_request   → opened/closed/merged → nota en ticket (si #TICKET en title)
 *   - issues         → opened → crea ticket CAU (categoría=bug)
 *
 * Headers GitHub:
 *   X-GitHub-Event: push|pull_request|issues
 *   X-Hub-Signature-256: sha256=...
 *   X-GitHub-Delivery: <uuid>
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function verifySignature(body: string, signatureHeader: string, secret: string): boolean {
  if (!signatureHeader.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  const provided = signatureHeader.slice(7);
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
  } catch { return false; }
}

function extractTicketRefs(text: string): string[] {
  const refs = text.match(/#TICKET-[a-z0-9]{6,}/gi) || [];
  return refs.map((r) => r.replace(/^#TICKET-/i, ""));
}

export async function POST(request: NextRequest) {
  try {
    const event = request.headers.get("x-github-event") || "";
    const signatureHeader = request.headers.get("x-hub-signature-256") || "";
    const installationIdRaw = request.headers.get("x-github-hook-installation-target-id") || "";

    const bodyText = await request.text();
    const payload = JSON.parse(bodyText);

    // Identificar installation
    const installationId = String(payload?.installation?.id || installationIdRaw || "");
    if (!installationId) {
      return NextResponse.json({ ok: false, error: "Missing installation id" }, { status: 400 });
    }

    const install = await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        githubInstallation: { findFirst: (a: { where: { installationId: string; active: true } }) => Promise<{ tenantId: string; clientId: string; webhookSecret: string } | null> };
      };
      return await c.githubInstallation.findFirst({ where: { installationId, active: true } });
    });
    if (!install) {
      return NextResponse.json({ ok: false, error: "Installation not registered" }, { status: 404 });
    }

    // Verificar firma HMAC
    if (!verifySignature(bodyText, signatureHeader, install.webhookSecret)) {
      return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 401 });
    }

    // Procesar evento
    if (event === "push") {
      const commits = (payload?.commits || []) as Array<{ id: string; message: string; author: { name: string; email: string }; url: string }>;
      for (const commit of commits) {
        const refs = extractTicketRefs(commit.message);
        if (refs.length === 0) continue;
        // TODO: vincular commit a ticket vía nota interna en CauTicketReply
        // Por ahora solo log.
        console.log("[github push]", commit.id, "refs:", refs);
      }
    } else if (event === "issues" && payload?.action === "opened") {
      const issue = payload.issue;
      await createModuleRecordAsync("cau", {
        asunto: issue.title,
        descripcion: issue.body || "",
        severidad: "media",
        urgencia: "normal",
        estado: "nuevo",
        origen: "github",
        externalRef: issue.html_url,
      }, install.clientId);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    captureError(e, { scope: "/webhooks/github" });
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
