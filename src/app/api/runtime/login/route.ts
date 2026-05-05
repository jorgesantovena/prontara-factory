import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { resolveRuntimeRequestContextAsync } from "@/lib/saas/runtime-request-context-async";
import { findTenantAccountByCredentialsAsync } from "@/lib/persistence/account-store-async";
import { attachSessionCookie } from "@/lib/saas/auth-session";
import {
  clearRateLimit,
  consumeRateLimit,
  getClientIp,
} from "@/lib/saas/rate-limiter";

const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const LOGIN_ATTEMPTS_PER_IP_TENANT = 10;
const LOGIN_ATTEMPTS_PER_IP_TENANT_EMAIL = 5;

export async function POST(request: NextRequest) {
  try {
    const context = await resolveRuntimeRequestContextAsync(request);

    if (!context.ok || !context.tenant) {
      return NextResponse.json(
        {
          ok: false,
          source: context.source,
          requestedSlug: context.requestedSlug,
          error: "No se pudo resolver el tenant para login.",
        },
        { status: 404 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const email =
      typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const password =
      typeof body?.password === "string" ? body.password : "";

    if (!email || !password) {
      return NextResponse.json(
        {
          ok: false,
          error: "Faltan credenciales.",
        },
        { status: 400 }
      );
    }

    const ip = getClientIp(request.headers);
    const clientId = context.tenant.clientId;
    const ipTenantKey = "login:ip-tenant:" + ip + ":" + clientId;
    const ipTenantEmailKey =
      "login:ip-tenant-email:" + ip + ":" + clientId + ":" + email;

    const ipTenantGate = consumeRateLimit({
      key: ipTenantKey,
      limit: LOGIN_ATTEMPTS_PER_IP_TENANT,
      windowMs: LOGIN_WINDOW_MS,
    });

    const ipTenantEmailGate = consumeRateLimit({
      key: ipTenantEmailKey,
      limit: LOGIN_ATTEMPTS_PER_IP_TENANT_EMAIL,
      windowMs: LOGIN_WINDOW_MS,
    });

    if (!ipTenantGate.allowed || !ipTenantEmailGate.allowed) {
      const retry = Math.max(
        ipTenantGate.retryAfterSeconds,
        ipTenantEmailGate.retryAfterSeconds
      );
      return NextResponse.json(
        {
          ok: false,
          error:
            "Demasiados intentos de inicio de sesión. Vuelve a intentarlo en unos minutos.",
          retryAfterSeconds: retry,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(retry),
          },
        }
      );
    }

    const account = await findTenantAccountByCredentialsAsync({
      clientId,
      email,
      password,
    });

    if (!account) {
      return NextResponse.json(
        {
          ok: false,
          error: "Credenciales inválidas.",
        },
        { status: 401 }
      );
    }

    // Successful login — reset this identity's counters so legitimate users
    // are not stuck behind their own earlier typos.
    clearRateLimit(ipTenantEmailKey);

    const sessionUser = {
      tenantId: account.tenantId,
      clientId: account.clientId,
      slug: account.slug,
      accountId: account.id,
      email: account.email,
      fullName: account.fullName,
      role: account.role,
      mustChangePassword: account.mustChangePassword,
    };

    const response = NextResponse.json({
      ok: true,
      source: context.source,
      requestedSlug: context.requestedSlug,
      session: sessionUser,
      account: {
        ...account,
        // never leak hashes or stored temporary passwords back to the client
        passwordHash: undefined,
        temporaryPassword: undefined,
      },
    });

    attachSessionCookie(response, sessionUser);
    return response;
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Error inesperado.",
      },
      { status: 500 }
    );
  }
}