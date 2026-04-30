import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import type { TenantSessionUser } from "@/lib/saas/account-definition";

export const SAAS_SESSION_COOKIE = "prontara_session";

type SessionPayload = TenantSessionUser & {
  issuedAt: string;
  expiresAt: string;
};

/**
 * TTL de la sesión. El token lleva expiresAt en el payload firmado, así
 * que aunque alguien capture el token y lo envíe desde otro sitio, dejará
 * de funcionar después de este periodo. La cookie usa el mismo valor como
 * maxAge para que el navegador también lo respete.
 */
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 días

const DEV_FALLBACK_SECRET = "prontara-local-session-secret";
let devFallbackWarned = false;

function isProduction() {
  return process.env.NODE_ENV === "production";
}

function getSessionSecret() {
  const secret = process.env.PRONTARA_SESSION_SECRET;
  if (secret && secret.trim().length >= 32) {
    return secret;
  }

  if (isProduction()) {
    throw new Error(
      "PRONTARA_SESSION_SECRET is required in production and must be at least 32 characters."
    );
  }

  if (secret && secret.trim().length > 0) {
    if (!devFallbackWarned) {
      devFallbackWarned = true;
      console.warn(
        "[auth-session] PRONTARA_SESSION_SECRET is set but shorter than 32 chars. Using it in dev only."
      );
    }
    return secret;
  }

  if (!devFallbackWarned) {
    devFallbackWarned = true;
    console.warn(
      "[auth-session] PRONTARA_SESSION_SECRET is not set. Falling back to insecure dev secret. Do NOT use in production."
    );
  }

  return DEV_FALLBACK_SECRET;
}

function cookieSecureFlag() {
  return isProduction();
}

function encodeBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signPayload(value: string) {
  return createHmac("sha256", getSessionSecret()).update(value).digest("base64url");
}

export function createSessionToken(user: TenantSessionUser): string {
  const now = Date.now();
  const payload: SessionPayload = {
    ...user,
    issuedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + SESSION_TTL_SECONDS * 1000).toISOString(),
  };

  const encoded = encodeBase64Url(JSON.stringify(payload));
  const signature = signPayload(encoded);
  return encoded + "." + signature;
}

export function readSessionToken(token: string | undefined | null): TenantSessionUser | null {
  const raw = String(token || "").trim();
  if (!raw || !raw.includes(".")) {
    return null;
  }

  const [encoded, signature] = raw.split(".");
  if (!encoded || !signature) {
    return null;
  }

  const expected = signPayload(encoded);

  try {
    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);

    if (
      signatureBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(signatureBuffer, expectedBuffer)
    ) {
      return null;
    }

    const parsed = JSON.parse(decodeBase64Url(encoded)) as SessionPayload;

    // Validar expiración. Tokens antiguos sin expiresAt (firmados antes
    // de esta versión) se dan por válidos durante 7 días desde issuedAt
    // para no desconectar a usuarios existentes en el upgrade.
    const now = Date.now();
    const expiresAt = parsed.expiresAt
      ? Date.parse(parsed.expiresAt)
      : parsed.issuedAt
        ? Date.parse(parsed.issuedAt) + SESSION_TTL_SECONDS * 1000
        : 0;
    if (!Number.isFinite(expiresAt) || expiresAt <= now) {
      return null;
    }

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
  } catch {
    return null;
  }
}

export function getSessionFromRequest(request: NextRequest): TenantSessionUser | null {
  const token = request.cookies.get(SAAS_SESSION_COOKIE)?.value;
  return readSessionToken(token);
}

export function attachSessionCookie(response: NextResponse, user: TenantSessionUser) {
  const token = createSessionToken(user);

  response.cookies.set({
    name: SAAS_SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecureFlag(),
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: SAAS_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecureFlag(),
    path: "/",
    maxAge: 0,
  });
}

export function requestMatchesTenantSession(
  request: NextRequest,
  session: TenantSessionUser | null
): boolean {
  if (!session) {
    return false;
  }

  const sessionSlug = session.slug.trim().toLowerCase();
  const sessionClientId = String(session.clientId || "").trim().toLowerCase();

  const querySlug = String(
    request.nextUrl.searchParams.get("tenant") || ""
  ).trim().toLowerCase();
  const headerSlug = String(
    request.headers.get("x-tenant-slug") || ""
  ).trim().toLowerCase();
  const headerClient = String(
    request.headers.get("x-client-id") || ""
  ).trim().toLowerCase();

  if (querySlug && querySlug !== sessionSlug) {
    return false;
  }
  if (headerSlug && headerSlug !== sessionSlug) {
    return false;
  }
  if (headerClient && sessionClientId && headerClient !== sessionClientId) {
    return false;
  }

  return true;
}

/**
 * Resolves the authenticated tenant session from the request and guarantees
 * that the tenant identity comes from the signed session cookie — never from
 * the query string or unsigned headers. This is the only trusted way to know
 * "which tenant is this request operating on" inside ERP routes.
 *
 * Returns `null` if there is no valid session, or if the request is trying to
 * address a tenant different from the one in the signed session.
 */
export function requireTenantSession(request: NextRequest): TenantSessionUser | null {
  const session = getSessionFromRequest(request);
  if (!session) {
    return null;
  }

  if (!requestMatchesTenantSession(request, session)) {
    return null;
  }

  return session;
}