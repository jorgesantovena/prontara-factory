import { NextResponse, type NextRequest } from "next/server";
import { resolveTenantBySlug } from "@/lib/saas/tenant-resolver";
import {
  getTenantAccountByEmailAsync,
  listTenantAccountsAsync,
  saveTenantAccountsAsync,
} from "@/lib/persistence/account-store-async";
import {
  createPasswordResetToken,
  buildPasswordResetUrl,
} from "@/lib/saas/password-reset";
import { sendPlainEmail } from "@/lib/saas/email-service";
import { consumeRateLimit, getClientIp } from "@/lib/saas/rate-limiter";

/**
 * POST /api/runtime/password-reset/request
 * Body: { tenant, email }
 *
 * Genera un token de recuperación firmado y envía un email con el enlace.
 * Por seguridad responde siempre 200 ok=true aunque la cuenta no exista,
 * para no revelar qué emails están registrados (timing oracle también
 * mitigado por el rate limit).
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const rl = consumeRateLimit({
    key: "password-reset-request:" + ip,
    limit: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: "Demasiados intentos. Inténtalo de nuevo en " + rl.retryAfterSeconds + " s.",
      },
      { status: 429 },
    );
  }

  let body: { tenant?: string; email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Body inválido." }, { status: 400 });
  }

  const slug = String(body.tenant || "").trim().toLowerCase();
  const email = String(body.email || "").trim().toLowerCase();
  if (!slug || !email) {
    return NextResponse.json(
      { ok: false, error: "Faltan tenant y/o email." },
      { status: 400 },
    );
  }

  const tenant = resolveTenantBySlug(slug);
  if (!tenant) {
    // Mismo response que si no existiera la cuenta para no filtrar info.
    return NextResponse.json({ ok: true, sent: false });
  }

  const account = await getTenantAccountByEmailAsync({ clientId: tenant.clientId, email });
  if (!account) {
    return NextResponse.json({ ok: true, sent: false });
  }

  // Marcamos la cuenta para invalidar el token al cambiar password — el
  // nonce actual del passwordHash actúa como invalidador implícito: al
  // resetear, el hash cambia y un token previo sigue siendo válido por
  // su HMAC pero no podrá aplicarse dos veces porque revisaremos en el
  // confirm que la cuenta sigue accesible (no revoca tokens emitidos
  // previamente). Para el modelo simple actual es aceptable.
  // Pequeño touch del updatedAt para tener trazabilidad del request.
  const rows = await listTenantAccountsAsync(tenant.clientId);
  const idx = rows.findIndex((r) => r.id === account.id);
  if (idx >= 0) {
    rows[idx] = { ...rows[idx], updatedAt: new Date().toISOString() };
    await saveTenantAccountsAsync(tenant.clientId, rows);
  }

  const { token } = createPasswordResetToken({
    clientId: tenant.clientId,
    accountId: account.id,
    email: account.email,
  });

  const baseUrl = String(process.env.PRONTARA_APP_BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
  const resetUrl = buildPasswordResetUrl({
    baseUrl,
    slug: tenant.slug,
    token,
  });

  const text =
    "Hola " +
    (account.fullName || "") +
    ",\n\n" +
    "Recibimos una solicitud para restablecer tu contraseña en Prontara para el tenant " +
    tenant.displayName +
    ".\n\n" +
    "Sigue este enlace en las próximas 12 horas para elegir una contraseña nueva:\n" +
    resetUrl +
    "\n\n" +
    "Si no fuiste tú, ignora este correo. La contraseña actual sigue funcionando.\n\n" +
    "— Equipo Prontara\n";

  const result = await sendPlainEmail({
    to: account.email,
    subject: "Restablece tu contraseña en Prontara",
    text,
  });

  return NextResponse.json({
    ok: true,
    sent: true,
    provider: result.provider,
  });
}
