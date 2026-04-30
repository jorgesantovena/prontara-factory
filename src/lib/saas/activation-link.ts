import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signed, time-limited activation links.
 *
 * Before: the activation email contained plaintext credentials and a naked
 * login URL. Anyone with an intercepted email could log in forever.
 *
 * Now: the activation email contains a signed token that:
 *   - is bound to a specific (clientId, email) pair
 *   - expires after `ACTIVATION_TTL_SECONDS` (default: 7 days)
 *   - cannot be forged without the `PRONTARA_ACTIVATION_SECRET` (falls back to
 *     the session secret if not set, so deployments only need one secret).
 *
 * Token format (base64url):  <payloadB64>.<hmacB64>
 * Payload JSON: { clientId, email, expiresAt, nonce }
 */

export type ActivationTokenPayload = {
  clientId: string;
  email: string;
  expiresAt: number; // unix ms
  nonce: string;
};

const DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60;

function getActivationSecret(): string {
  const secret =
    process.env.PRONTARA_ACTIVATION_SECRET ||
    process.env.PRONTARA_SESSION_SECRET ||
    "";

  if (secret && secret.trim().length >= 32) {
    return secret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "PRONTARA_ACTIVATION_SECRET (or PRONTARA_SESSION_SECRET) is required in production (≥32 chars)."
    );
  }

  return secret || "prontara-local-activation-secret-dev-only";
}

function b64urlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function b64urlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(value: string): string {
  return createHmac("sha256", getActivationSecret()).update(value).digest("base64url");
}

export type CreateActivationTokenInput = {
  clientId: string;
  email: string;
  ttlSeconds?: number;
};

export function createActivationToken(input: CreateActivationTokenInput): {
  token: string;
  expiresAt: number;
} {
  const ttlSeconds = Math.max(60, input.ttlSeconds || DEFAULT_TTL_SECONDS);
  const expiresAt = Date.now() + ttlSeconds * 1000;
  const payload: ActivationTokenPayload = {
    clientId: String(input.clientId || "").trim(),
    email: String(input.email || "").trim().toLowerCase(),
    expiresAt,
    nonce: Math.random().toString(36).slice(2, 10) + Date.now().toString(36),
  };

  const encoded = b64urlEncode(JSON.stringify(payload));
  const signature = sign(encoded);
  return {
    token: encoded + "." + signature,
    expiresAt,
  };
}

export type VerifyActivationTokenResult =
  | { ok: true; payload: ActivationTokenPayload }
  | { ok: false; reason: "malformed" | "bad-signature" | "expired" };

export function verifyActivationToken(token: string): VerifyActivationTokenResult {
  const raw = String(token || "").trim();
  if (!raw || !raw.includes(".")) {
    return { ok: false, reason: "malformed" };
  }

  const [encoded, signature] = raw.split(".");
  if (!encoded || !signature) {
    return { ok: false, reason: "malformed" };
  }

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

  let payload: ActivationTokenPayload;
  try {
    payload = JSON.parse(b64urlDecode(encoded)) as ActivationTokenPayload;
  } catch {
    return { ok: false, reason: "malformed" };
  }

  if (
    typeof payload !== "object" ||
    !payload ||
    typeof payload.clientId !== "string" ||
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

export function buildActivationUrl(input: {
  baseUrl?: string;
  slug: string;
  token: string;
}): string {
  const base = (input.baseUrl || "").replace(/\/+$/, "");
  const slug = String(input.slug || "").trim();
  const params = new URLSearchParams();
  params.set("activation", input.token);
  if (slug) {
    params.set("tenant", slug);
  }
  return (base || "") + "/activate?" + params.toString();
}
