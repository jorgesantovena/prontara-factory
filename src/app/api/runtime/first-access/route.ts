import { NextResponse, type NextRequest } from "next/server";
import { verifyFirstAccessToken } from "@/lib/saas/first-access-token";
import {
  getTenantAccountByIdAsync,
  setTenantAccountPasswordAsync,
} from "@/lib/persistence/account-store-async";
import { createLogger } from "@/lib/observability/logger";
import {
  consumeRateLimit,
  getClientIp,
} from "@/lib/saas/rate-limiter";

const log = createLogger("first-access");

// Rate limit del endpoint (SEC-2): 10 intentos por IP cada 15 minutos.
// Más permisivo que login porque es legítimo que un usuario pulse el
// botón varias veces (typo en password, conexión inestable). Suficiente
// para frenar brute force con tokens robados.
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX = 10;

/**
 * POST /api/runtime/first-access
 *   Body: { token: string, password: string }
 *
 * Permite al usuario que recibió un email de bienvenida con token HMAC
 * (en lugar de password temporal) establecer SU PROPIA contraseña sin
 * pasar por login previo.
 *
 * Validaciones:
 *   - Token HMAC firmado y NO caducado.
 *   - El accountId del token corresponde a una cuenta que aún no tiene
 *     password establecida por el usuario (mustChangePassword=true).
 *   - Password mínimo 8 chars.
 *
 * El token es single-use IMPLÍCITO: tras establecer password,
 * mustChangePassword pasa a false, y el mismo token aplicado de nuevo
 * dará 410 Gone.
 */
export async function POST(request: NextRequest) {
  // Rate limit por IP. Aplicamos ANTES de parsear body / validar token
  // para que un atacante no pueda agotar CPU mandando JSON gigante o
  // tokens malformados de forma masiva.
  const ip = getClientIp(request.headers);
  const rl = consumeRateLimit({
    key: "first-access:" + ip,
    limit: RATE_LIMIT_MAX,
    windowMs: RATE_LIMIT_WINDOW_MS,
  });
  if (!rl.allowed) {
    log.warn("rate limit exceeded", { ip, retryAfter: rl.retryAfterSeconds });
    return NextResponse.json(
      {
        ok: false,
        error:
          "Demasiados intentos desde tu IP. Espera " +
          Math.ceil(rl.retryAfterSeconds / 60) +
          " minutos antes de probar de nuevo.",
      },
      {
        status: 429,
        headers: { "Retry-After": String(rl.retryAfterSeconds) },
      },
    );
  }

  let body: { token?: string; password?: string };
  try {
    body = (await request.json()) as { token?: string; password?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "Body JSON inválido." }, { status: 400 });
  }

  const token = String(body.token || "").trim();
  const password = String(body.password || "").trim();

  if (!token) {
    return NextResponse.json({ ok: false, error: "Falta token." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json(
      { ok: false, error: "La contraseña debe tener al menos 8 caracteres." },
      { status: 400 },
    );
  }

  const payload = verifyFirstAccessToken(token);
  if (!payload) {
    log.warn("token inválido o caducado");
    return NextResponse.json(
      {
        ok: false,
        error: "El enlace ha caducado o no es válido. Pídele a tu operador que te envíe uno nuevo.",
      },
      { status: 401 },
    );
  }

  try {
    const account = await getTenantAccountByIdAsync({
      clientId: payload.clientId,
      accountId: payload.accountId,
    });
    if (!account) {
      return NextResponse.json(
        { ok: false, error: "Cuenta no encontrada." },
        { status: 404 },
      );
    }

    // Single-use implícito: si el usuario ya estableció su password (es decir,
    // el flag mustChangePassword es false), el token ya cumplió su función.
    if (!account.mustChangePassword) {
      log.warn("token reutilizado", {
        accountId: payload.accountId,
        clientId: payload.clientId,
      });
      return NextResponse.json(
        {
          ok: false,
          error:
            "Este enlace ya se ha usado. Si necesitas restablecer tu contraseña, ve a /recuperar.",
        },
        { status: 410 }, // Gone
      );
    }

    // Verificar coherencia email
    if (String(account.email || "").toLowerCase() !== payload.email.toLowerCase()) {
      log.warn("token email mismatch", {
        accountId: payload.accountId,
        clientId: payload.clientId,
      });
      return NextResponse.json(
        { ok: false, error: "Token inválido (email no coincide)." },
        { status: 401 },
      );
    }

    // Update: nueva password + clear temporary + quitar mustChangePassword
    await setTenantAccountPasswordAsync({
      clientId: payload.clientId,
      accountId: payload.accountId,
      nextPassword: password,
      clearTemporaryPassword: true,
    });

    log.info("first-access password set", {
      accountId: payload.accountId,
      clientId: payload.clientId,
      email: payload.email,
    });

    return NextResponse.json({
      ok: true,
      message: "Contraseña establecida. Ya puedes iniciar sesión normalmente.",
      slug: account.slug,
    });
  } catch (err) {
    log.error("first-access internal error", {
      error: err instanceof Error ? err.message : String(err),
      accountId: payload.accountId,
      clientId: payload.clientId,
    });
    return NextResponse.json(
      { ok: false, error: "Error interno. Intenta de nuevo en un momento." },
      { status: 500 },
    );
  }
}
