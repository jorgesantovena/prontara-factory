/**
 * Verificación de sesión Prontara compatible con el Edge Runtime de Next.js.
 *
 * El módulo `auth-session.ts` original usa `node:crypto` (createHmac,
 * timingSafeEqual, Buffer). Eso NO funciona en middleware.ts, que corre
 * en Edge Runtime y solo dispone de Web Crypto API. Aquí re-implementamos
 * la misma verificación HMAC-SHA256 con Web Crypto + base64url manual.
 *
 * Es la MISMA firma — los tokens emitidos por createSessionToken() en
 * Node se validan correctamente aquí en Edge. La SHA256 + el secreto son
 * idénticos; solo cambia la API de runtime.
 */
import type { TenantSessionUser } from "@/lib/saas/account-definition";

export const SAAS_SESSION_COOKIE = "prontara_session";

const DEV_FALLBACK_SECRET = "prontara-local-session-secret";

function getSessionSecret(): string {
  const secret = process.env.PRONTARA_SESSION_SECRET;
  if (secret && secret.trim().length >= 32) return secret;
  if (process.env.NODE_ENV === "production") {
    // En producción debe estar; si no, falla cerrado (no validar nada).
    throw new Error(
      "PRONTARA_SESSION_SECRET is required in production and must be at least 32 characters.",
    );
  }
  if (secret && secret.trim().length > 0) return secret;
  return DEV_FALLBACK_SECRET;
}

// ─── base64url helpers (Edge no tiene Buffer) ─────────────────────────

function base64UrlDecode(input: string): string {
  // Convertir base64url a base64 estándar
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  // atob da binary string; lo convertimos a UTF-8.
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  // btoa devuelve base64 estándar; lo pasamos a base64url.
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// ─── HMAC-SHA256 con Web Crypto ────────────────────────────────────────

let cachedKey: CryptoKey | null = null;
let cachedKeySecret: string | null = null;

async function getHmacKey(): Promise<CryptoKey> {
  const secret = getSessionSecret();
  if (cachedKey && cachedKeySecret === secret) return cachedKey;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  cachedKey = key;
  cachedKeySecret = secret;
  return key;
}

async function signPayload(value: string): Promise<string> {
  const key = await getHmacKey();
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return bytesToBase64Url(new Uint8Array(sig));
}

/**
 * Comparación constante en tiempo (timing-safe). Necesaria para no filtrar
 * info sobre el HMAC esperado a través del side-channel del tiempo.
 */
function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Lee y valida un token de sesión Prontara en Edge Runtime.
 * Devuelve la sesión decodificada si es válida, o null si:
 *   - El token está vacío o malformado
 *   - La firma HMAC no coincide
 *   - El token está caducado (expiresAt <= ahora)
 *   - El payload no se puede deserializar
 */
export async function verifySessionTokenEdge(
  token: string | undefined | null,
): Promise<TenantSessionUser | null> {
  const raw = String(token || "").trim();
  if (!raw || !raw.includes(".")) return null;

  const dotIndex = raw.indexOf(".");
  const encoded = raw.slice(0, dotIndex);
  const signature = raw.slice(dotIndex + 1);
  if (!encoded || !signature) return null;

  let expected: string;
  try {
    expected = await signPayload(encoded);
  } catch {
    return null;
  }

  if (!timingSafeEqualString(signature, expected)) return null;

  let parsed: TenantSessionUser & { issuedAt?: string; expiresAt?: string };
  try {
    parsed = JSON.parse(base64UrlDecode(encoded));
  } catch {
    return null;
  }

  // Validación de expiración (mismo TTL que el módulo Node).
  const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 días
  const now = Date.now();
  const expiresAt = parsed.expiresAt
    ? Date.parse(parsed.expiresAt)
    : parsed.issuedAt
      ? Date.parse(parsed.issuedAt) + SESSION_TTL_SECONDS * 1000
      : 0;
  if (!Number.isFinite(expiresAt) || expiresAt <= now) return null;

  return {
    accountId: parsed.accountId,
    tenantId: parsed.tenantId,
    clientId: parsed.clientId,
    slug: parsed.slug,
    email: parsed.email,
    fullName: parsed.fullName,
    role: parsed.role,
    mustChangePassword: Boolean(parsed.mustChangePassword),
  };
}

/**
 * Atajo: devuelve true si el token corresponde a una sesión válida con
 * rol admin u owner. Es lo que el middleware usa para dejar pasar
 * /api/factory/*.
 */
export async function isFactoryAdminFromCookieEdge(
  token: string | undefined | null,
): Promise<boolean> {
  const session = await verifySessionTokenEdge(token);
  if (!session) return false;
  return session.role === "admin" || session.role === "owner";
}
