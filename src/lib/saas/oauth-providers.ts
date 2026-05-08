/**
 * OAuth2 helpers para SSO con Google y Microsoft (H2-SSO).
 *
 * Implementación manual sin NextAuth (evita una dependencia gigante).
 * Compatible con el flujo authorization_code estándar.
 *
 * Configuración por env vars:
 *   GOOGLE_OAUTH_CLIENT_ID
 *   GOOGLE_OAUTH_CLIENT_SECRET
 *   MICROSOFT_OAUTH_CLIENT_ID
 *   MICROSOFT_OAUTH_CLIENT_SECRET
 *   PRONTARA_PUBLIC_BASE_URL (ya existe)
 *
 * Si una credencial falta, el endpoint de start devuelve error claro.
 */

import { randomBytes } from "node:crypto";

export type OAuthProvider = "google" | "microsoft";

type ProviderConfig = {
  authUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scope: string;
  clientId: string;
  clientSecret: string;
};

function getProviderConfig(provider: OAuthProvider): ProviderConfig | null {
  if (provider === "google") {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    if (!clientId || !clientSecret) return null;
    return {
      authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      userInfoUrl: "https://openidconnect.googleapis.com/v1/userinfo",
      scope: "openid email profile",
      clientId,
      clientSecret,
    };
  }
  if (provider === "microsoft") {
    const clientId = process.env.MICROSOFT_OAUTH_CLIENT_ID;
    const clientSecret = process.env.MICROSOFT_OAUTH_CLIENT_SECRET;
    if (!clientId || !clientSecret) return null;
    return {
      authUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
      tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      userInfoUrl: "https://graph.microsoft.com/oidc/userinfo",
      scope: "openid email profile",
      clientId,
      clientSecret,
    };
  }
  return null;
}

function getBaseUrl(): string {
  return (
    process.env.PRONTARA_PUBLIC_BASE_URL ||
    process.env.PRONTARA_APP_BASE_URL ||
    "https://app.prontara.com"
  );
}

export type OAuthStateData = {
  provider: OAuthProvider;
  /** slug del tenant — necesario para resolver el tenant en el callback */
  tenantSlug: string;
  /** nonce aleatorio para protección CSRF */
  nonce: string;
};

/**
 * Crea la URL de inicio del flujo OAuth para un proveedor + tenant.
 * State es base64(JSON) con nonce — el callback lo verifica.
 */
export function buildAuthorizationUrl(input: {
  provider: OAuthProvider;
  tenantSlug: string;
}): { url: string; state: string } | { error: string } {
  const cfg = getProviderConfig(input.provider);
  if (!cfg) {
    return {
      error:
        "SSO " +
        input.provider +
        " no configurado. Faltan env vars " +
        input.provider.toUpperCase() +
        "_OAUTH_CLIENT_ID/_SECRET.",
    };
  }
  const nonce = randomBytes(16).toString("hex");
  const stateObj: OAuthStateData = {
    provider: input.provider,
    tenantSlug: input.tenantSlug,
    nonce,
  };
  const state = Buffer.from(JSON.stringify(stateObj)).toString("base64url");
  const redirectUri =
    getBaseUrl() + "/api/runtime/oauth/" + input.provider + "/callback";
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: cfg.scope,
    state,
    prompt: "select_account",
  });
  return { url: cfg.authUrl + "?" + params.toString(), state };
}

export function decodeOAuthState(state: string): OAuthStateData | null {
  try {
    const json = Buffer.from(state, "base64url").toString("utf8");
    const obj = JSON.parse(json);
    if (
      obj &&
      (obj.provider === "google" || obj.provider === "microsoft") &&
      typeof obj.tenantSlug === "string" &&
      typeof obj.nonce === "string"
    ) {
      return obj as OAuthStateData;
    }
  } catch {
    // ignore
  }
  return null;
}

export type OAuthUserInfo = {
  sub: string;
  email: string;
  name: string;
};

/**
 * Intercambia el code por tokens y luego trae la info del usuario.
 */
export async function exchangeCodeAndFetchUser(input: {
  provider: OAuthProvider;
  code: string;
}): Promise<OAuthUserInfo | { error: string }> {
  const cfg = getProviderConfig(input.provider);
  if (!cfg) return { error: "Proveedor " + input.provider + " no configurado." };

  const redirectUri =
    getBaseUrl() + "/api/runtime/oauth/" + input.provider + "/callback";

  const tokenRes = await fetch(cfg.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: input.code,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }).toString(),
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    return { error: "Error intercambiando code: " + text.slice(0, 200) };
  }

  const tokenJson = (await tokenRes.json()) as { access_token?: string };
  const accessToken = tokenJson.access_token;
  if (!accessToken) {
    return { error: "No llegó access_token del proveedor." };
  }

  const userRes = await fetch(cfg.userInfoUrl, {
    headers: { Authorization: "Bearer " + accessToken },
  });
  if (!userRes.ok) {
    return { error: "Error leyendo userinfo del proveedor." };
  }
  const u = (await userRes.json()) as Record<string, string>;
  const sub = String(u.sub || u.id || "");
  const email = String(u.email || "");
  const name = String(u.name || u.given_name || "");
  if (!sub || !email) {
    return { error: "El proveedor no devolvió sub/email — no se puede vincular cuenta." };
  }
  return { sub, email: email.toLowerCase(), name };
}
