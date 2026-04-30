/**
 * Tokens firmados para recuperación de contraseña.
 *
 * Mismo patrón que activation-link.ts pero con TTL más corto (12 horas) y
 * payload distinto: ata el token a (clientId, accountId, email) para
 * que un token capturado no sirva para otra cuenta.
 *
 * El secreto usa PRONTARA_SESSION_SECRET (o el de activación como
 * fallback) para no añadir más variables de entorno.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export type PasswordResetTokenPayload = {
  clientId: string;
  accountId: string;
  email: string;
  expiresAt: number;
  nonce: string;
};

const DEFAULT_TTL_SECONDS = 12 * 60 * 60; // 12 horas

function getSecret(): string {
  const secret =
    process.env.PRONTARA_SESSION_SECRET ||
    process.env.PRONTARA_ACTIVATION_SECRET ||
    "";
  if (secret && secret.trim().length >= 32) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "PRONTARA_SESSION_SECRET es obligatoria en producción (≥32 chars).",
    );
  }
  return secret || "prontara-local-password-reset-dev-only";
}

function b64urlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function b64urlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(value: string): string {
  return createHmac("sha256", getSecret()).update(value).digest("base64url");
}

export function createPasswordResetToken(input: {
  clientId: string;
  accountId: string;
  email: string;
  ttlSeconds?: number;
}): { token: string; expiresAt: number } {
  const ttl = Math.max(60, input.ttlSeconds || DEFAULT_TTL_SECONDS);
  const expiresAt = Date.now() + ttl * 1000;
  const payload: PasswordResetTokenPayload = {
    clientId: String(input.clientId || "").trim(),
    accountId: String(input.accountId || "").trim(),
    email: String(input.email || "").trim().toLowerCase(),
    expiresAt,
    nonce: Math.random().toString(36).slice(2, 10) + Date.now().toString(36),
  };
  const encoded = b64urlEncode(JSON.stringify(payload));
  const signature = sign(encoded);
  return { token: encoded + "." + signature, expiresAt };
}

export type VerifyPasswordResetTokenResult =
  | { ok: true; payload: PasswordResetTokenPayload }
  | { ok: false; reason: "malformed" | "bad-signature" | "expired" };

export function verifyPasswordResetToken(token: string): VerifyPasswordResetTokenResult {
  const raw = String(token || "").trim();
  if (!raw || !raw.includes(".")) return { ok: false, reason: "malformed" };

  const [encoded, signature] = raw.split(".");
  if (!encoded || !signature) return { ok: false, reason: "malformed" };

  let expected: string;
  try {
    expected = sign(encoded);
  } catch {
    return { ok: false, reason: "bad-signature" };
  }

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return { ok: false, reason: "bad-signature" };
  }

  let payload: PasswordResetTokenPayload;
  try {
    payload = JSON.parse(b64urlDecode(encoded)) as PasswordResetTokenPayload;
  } catch {
    return { ok: false, reason: "malformed" };
  }

  if (
    !payload ||
    typeof payload.clientId !== "string" ||
    typeof payload.accountId !== "string" ||
    typeof payload.email !== "string" ||
    typeof payload.expiresAt !== "number"
  ) {
    return { ok: false, reason: "malformed" };
  }

  if (payload.expiresAt <= Date.now()) {
    return { ok: false, reason: "expired" };
  }

  return { ok: true, payload };
}

export function buildPasswordResetUrl(input: {
  baseUrl?: string;
  slug: string;
  token: string;
}): string {
  const base = (input.baseUrl || "").replace(/\/+$/, "");
  const params = new URLSearchParams();
  params.set("token", input.token);
  if (input.slug) params.set("tenant", input.slug);
  return base + "/restablecer?" + params.toString();
}
