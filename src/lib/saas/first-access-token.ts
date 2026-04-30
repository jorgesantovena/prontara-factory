/**
 * Token de primer acceso (single-use, expiración 48h).
 *
 * Sustituye al envío de password temporal por email. El flujo nuevo:
 *
 *   1. Tras alta, generamos un token HMAC con { accountId, email, exp }.
 *   2. El email incluye una URL: /primer-acceso?token=XXX.
 *   3. El usuario hace click, llega a la página, establece su contraseña.
 *   4. Al hacer submit, el token se valida + se marca como usado.
 *   5. Token usado o caducado → 401 con instrucciones de pedir nuevo enlace.
 *
 * Beneficios respecto al flujo anterior:
 *   - Si el email cae en manos equivocadas Y el cliente no actúa, el token
 *     caduca solo (48h).
 *   - Imposible reutilizar el mismo token (single-use marcado en DB).
 *   - El cliente elige su contraseña desde el principio (no hay password
 *     que el operador conozca).
 */
import { createHmac, timingSafeEqual } from "node:crypto";

const DEV_FALLBACK_SECRET = "prontara-local-first-access-secret";
const TOKEN_TTL_MS = 1000 * 60 * 60 * 48; // 48 horas

export type FirstAccessPayload = {
  accountId: string;
  clientId: string;
  email: string;
  /** ms epoch en el que el token caduca */
  exp: number;
};

function getSecret(): string {
  // Reusamos el secreto de activación si está; si no, uno propio.
  const v =
    String(process.env.PRONTARA_ACTIVATION_SECRET || "").trim() ||
    String(process.env.PRONTARA_SESSION_SECRET || "").trim();
  if (v.length >= 32) return v;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "PRONTARA_ACTIVATION_SECRET (o SESSION_SECRET) ≥32 chars es obligatorio en producción.",
    );
  }
  return DEV_FALLBACK_SECRET;
}

function b64url(value: string | Buffer): string {
  return Buffer.from(typeof value === "string" ? value : value.toString("binary"), "utf8")
    .toString("base64url");
}

function b64urlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

/**
 * Genera un token first-access para un nuevo usuario tras alta.
 * El token caduca a las 48h.
 */
export function signFirstAccessToken(input: {
  accountId: string;
  clientId: string;
  email: string;
}): string {
  const payload: FirstAccessPayload = {
    accountId: input.accountId,
    clientId: input.clientId,
    email: input.email,
    exp: Date.now() + TOKEN_TTL_MS,
  };
  const encoded = b64url(JSON.stringify(payload));
  const signature = sign(encoded);
  return encoded + "." + signature;
}

/**
 * Verifica un token first-access. Devuelve el payload si:
 *   - La firma HMAC es válida
 *   - No ha caducado
 * Devuelve null si cualquiera falla.
 *
 * NOTA: la verificación de "single-use" no se hace aquí. El caller debe
 * comprobar contra la DB si el accountId YA tiene contraseña establecida
 * por el usuario (en cuyo caso el token ya se usó). Esto evita una tabla
 * extra de "tokens consumidos".
 */
export function verifyFirstAccessToken(token: string): FirstAccessPayload | null {
  if (!token || !token.includes(".")) return null;
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;

  let expected: string;
  try {
    expected = sign(encoded);
  } catch {
    return null;
  }

  try {
    const sigBuf = Buffer.from(signature, "base64url");
    const expBuf = Buffer.from(expected, "base64url");
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }
  } catch {
    return null;
  }

  let parsed: FirstAccessPayload;
  try {
    parsed = JSON.parse(b64urlDecode(encoded)) as FirstAccessPayload;
  } catch {
    return null;
  }

  if (!parsed.exp || Date.now() > parsed.exp) return null;
  if (!parsed.accountId || !parsed.email) return null;

  return parsed;
}
