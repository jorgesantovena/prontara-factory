import { NextResponse, type NextRequest } from "next/server";
import { createTenantFromAlta } from "@/lib/saas/tenant-creation";
import { sendPlainEmail } from "@/lib/saas/email-service";
import { consumeRateLimit, getClientIp } from "@/lib/saas/rate-limiter";
import { generateContractPdf } from "@/lib/saas/contract-generator";
import { getPlanDefinition } from "@/lib/saas/billing-store";
import type { BillingPlanKey } from "@/lib/saas/billing-definition";
import { createNotificationAsync } from "@/lib/persistence/factory-notifications-store-async";

/**
 * POST /api/factory/tenants/create
 * Endpoint público (sin auth) que crea un tenant desde el formulario /alta.
 *
 * Rate-limit: 5 altas por IP por hora para evitar abuso.
 *
 * Body: { companyName, contactName, email, phone?, desiredSlug?, sector,
 * businessType, companySize? }
 *
 * Devuelve {ok, slug, adminEmail, activationUrl}. NO devuelve la
 * temporaryPassword en el response — la mandamos por email para que el
 * navegador del visitante no la tenga en pantalla. Si el email no se puede
 * mandar (no Resend configurado), la dejamos en outbox y avisamos.
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const rl = consumeRateLimit({
    key: "tenant-create:" + ip,
    limit: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Demasiados intentos desde esta IP. Espera " +
          rl.retryAfterSeconds +
          " segundos.",
      },
      { status: 429 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Body JSON inválido." },
      { status: 400 },
    );
  }

  const result = await createTenantFromAlta({
    companyName: String(body.companyName || ""),
    contactName: String(body.contactName || ""),
    email: String(body.email || ""),
    phone: typeof body.phone === "string" ? body.phone : undefined,
    desiredSlug: typeof body.desiredSlug === "string" ? body.desiredSlug : undefined,
    sector: String(body.sector || ""),
    businessType: String(body.businessType || ""),
    companySize: typeof body.companySize === "string" ? body.companySize : undefined,
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: result.errors?.join(" ") || "Datos no válidos.",
        validationErrors: result.errors,
      },
      { status: 400 },
    );
  }

  // Enviar email de bienvenida con credenciales temporales.
  const baseUrl = String(process.env.PRONTARA_APP_BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
  const text =
    "Hola " +
    result.displayName +
    ",\n\n" +
    "Tu entorno Prontara ya está activo. Estos son tus datos para entrar:\n\n" +
    "  URL:      " +
    result.activationUrl +
    "\n" +
    "  Email:    " +
    result.adminEmail +
    "\n" +
    "  Password: " +
    result.temporaryPassword +
    "\n\n" +
    "Tienes 14 días de prueba gratuita. Tu trial termina el " +
    new Date(result.trialExpiresAt).toLocaleDateString("es") +
    ".\n\n" +
    "Al entrar te pediremos que cambies la contraseña por una propia.\n\n" +
    "Cualquier duda escríbenos a este mismo email.\n\n" +
    "— Equipo Prontara\n" +
    baseUrl;

  // Generar el contrato PDF a adjuntar.
  // Por defecto usamos el plan en función del businessType seleccionado en el alta.
  // Como en este endpoint el alta es trial inicial, generamos un contrato base
  // del plan trial; en el flujo real de pago Stripe, el webhook activará el plan
  // pagado y al activarPaidPlan se podrá regenerar y reenviar el contrato del
  // plan correcto.
  const planForContract: BillingPlanKey = "trial";
  const plan = getPlanDefinition(planForContract);
  let contractAttachment: { filename: string; content: Buffer; contentType: string } | undefined;
  try {
    const pdfBuffer = await generateContractPdf({
      clientId: result.clientId,
      customerName: String(body.contactName || ""),
      customerEmail: result.adminEmail,
      customerCompany: String(body.companyName || result.displayName),
      planKey: planForContract,
      setupAmountCents: plan.setupFeeCents,
      monthlySupportCentsPerUser: plan.supportMonthlyCentsPerUser ?? 0,
    });
    contractAttachment = {
      filename: "Contrato-Prontara-" + result.slug + ".pdf",
      content: pdfBuffer,
      contentType: "application/pdf",
    };
  } catch (err) {
    // Si fallara la generación, no bloqueamos el alta — log y seguimos sin adjunto.
    console.error("[tenants/create] generateContractPdf falló:", err);
  }

  const emailResult = await sendPlainEmail({
    to: result.adminEmail,
    subject: "Bienvenido a Prontara — credenciales de acceso",
    text,
    attachments: contractAttachment ? [contractAttachment] : undefined,
  });

  // Notificación interna para el operador — no bloqueamos el alta si esto falla.
  try {
    await createNotificationAsync({
      type: "alta_created",
      title: "Nueva alta: " + result.displayName,
      message:
        "Cliente " +
        result.displayName +
        " (" +
        result.adminEmail +
        ") ha completado el alta. Trial vence el " +
        new Date(result.trialExpiresAt).toLocaleDateString("es") +
        ". Email de bienvenida " +
        (emailResult.ok && emailResult.provider === "resend"
          ? "enviado por Resend."
          : "guardado en outbox (no había Resend configurado)."),
      metadata: {
        clientId: result.clientId,
        slug: result.slug,
        adminEmail: result.adminEmail,
        trialExpiresAt: result.trialExpiresAt,
        emailProvider: emailResult.provider,
      },
    });
  } catch (err) {
    console.error("[tenants/create] createNotificationAsync falló:", err);
  }

  return NextResponse.json({
    ok: true,
    clientId: result.clientId,
    slug: result.slug,
    displayName: result.displayName,
    adminEmail: result.adminEmail,
    activationUrl: result.activationUrl,
    trialExpiresAt: result.trialExpiresAt,
    emailDelivery: {
      provider: emailResult.provider,
      sent: emailResult.ok && emailResult.provider === "resend",
      detail: emailResult.detail,
    },
    // Solo se incluye si NO se mandó por Resend real — para que el
    // operador pueda comunicarse manualmente con el cliente. En producción
    // con Resend configurado, este campo NO va en el response.
    temporaryPasswordIfNotEmailed:
      emailResult.provider === "resend" && emailResult.ok
        ? null
        : result.temporaryPassword,
  });
}
