import { NextResponse, type NextRequest } from "next/server";
import {
  hashPassword,
  listTenantAccountsAsync,
  saveTenantAccountsAsync,
} from "@/lib/persistence/account-store-async";
import { verifyPasswordResetToken } from "@/lib/saas/password-reset";
import { consumeRateLimit, getClientIp } from "@/lib/saas/rate-limiter";

/**
 * POST /api/runtime/password-reset/confirm
 * Body: { token, newPassword }
 *
 * Verifica el token firmado, valida la contraseña nueva y la guarda
 * hasheada con scrypt. Limpia mustChangePassword. La sesión actual del
 * usuario (si la había) sigue siendo válida — no fuerza logout para no
 * dejarte fuera tras cambiar password.
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const rl = consumeRateLimit({
    key: "password-reset-confirm:" + ip,
    limit: 10,
    windowMs: 60 * 60 * 1000,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, error: "Demasiados intentos. Espera " + rl.retryAfterSeconds + " s." },
      { status: 429 },
    );
  }

  let body: { token?: string; newPassword?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Body inválido." }, { status: 400 });
  }

  const token = String(body.token || "").trim();
  const newPassword = String(body.newPassword || "");
  if (!token) {
    return NextResponse.json({ ok: false, error: "Falta token." }, { status: 400 });
  }
  if (newPassword.length < 8) {
    return NextResponse.json(
      { ok: false, error: "La contraseña debe tener al menos 8 caracteres." },
      { status: 400 },
    );
  }

  const verification = verifyPasswordResetToken(token);
  if (!verification.ok) {
    const reasonText =
      verification.reason === "expired"
        ? "El enlace ha caducado. Pide uno nuevo."
        : "Enlace de recuperación no válido.";
    return NextResponse.json({ ok: false, error: reasonText }, { status: 400 });
  }

  const { payload } = verification;
  const rows = await listTenantAccountsAsync(payload.clientId);
  const idx = rows.findIndex((r) => r.id === payload.accountId);
  if (idx < 0) {
    return NextResponse.json(
      { ok: false, error: "Cuenta no encontrada." },
      { status: 404 },
    );
  }

  const account = rows[idx];
  // Sanity: el email del payload debe coincidir con el de la cuenta — sino
  // alguien intenta usar un token forjado contra otra cuenta del mismo tenant.
  if (account.email.toLowerCase() !== payload.email.toLowerCase()) {
    return NextResponse.json(
      { ok: false, error: "El enlace no corresponde a esta cuenta." },
      { status: 400 },
    );
  }

  if (account.status === "disabled") {
    return NextResponse.json(
      { ok: false, error: "Cuenta deshabilitada. Contacta con soporte." },
      { status: 403 },
    );
  }

  rows[idx] = {
    ...account,
    passwordHash: hashPassword(newPassword),
    temporaryPassword: "",
    mustChangePassword: false,
    updatedAt: new Date().toISOString(),
  };
  await saveTenantAccountsAsync(payload.clientId, rows);

  return NextResponse.json({ ok: true, slug: rows[idx].slug });
}
