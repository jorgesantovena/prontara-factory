import type {
  SignupSimulateInput,
  SignupSimulateResult,
  SignupSimulateValidation,
} from "@/lib/saas/signup-definition";
import { buildActivationPackageFromRequest } from "@/lib/saas/activation-package";
import { NextRequest } from "next/server";
import { resolveRuntimeRequestContext } from "@/lib/saas/runtime-request-context";
import {
  generateTemporaryPassword,
  upsertTenantAdminAccount,
} from "@/lib/saas/account-store";
import { sendActivationEmailFromRequest } from "@/lib/saas/access-activation-service";

function normalizeSlug(value: string): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

export function validateSignupSimulateInput(
  input: Partial<SignupSimulateInput>
): SignupSimulateValidation {
  const errors: string[] = [];
  const normalizedSlug = normalizeSlug(String(input.slug || ""));

  if (!String(input.companyName || "").trim()) {
    errors.push("Falta companyName.");
  }

  if (!String(input.contactName || "").trim()) {
    errors.push("Falta contactName.");
  }

  if (!String(input.email || "").trim()) {
    errors.push("Falta email.");
  } else if (!isValidEmail(String(input.email || ""))) {
    errors.push("El email no tiene un formato válido.");
  }

  if (!normalizedSlug) {
    errors.push("Falta slug válido.");
  }

  return {
    ok: errors.length === 0,
    errors,
    normalizedSlug,
  };
}

function buildTenantUrlFromRequest(request: NextRequest, slug: string): string {
  const url = new URL(request.url);
  url.searchParams.set("tenant", slug);
  return url.toString();
}

export async function runSignupSimulateFromRequest(
  request: NextRequest,
  input: Partial<SignupSimulateInput>
): Promise<SignupSimulateResult> {
  const validation = validateSignupSimulateInput(input);

  if (!validation.ok) {
    return {
      ok: false,
      requestedSlug: String(input.slug || "").trim() || null,
      normalizedSlug: validation.normalizedSlug || null,
      validationErrors: validation.errors,
      tenantMatched: false,
      provisioningTriggered: false,
      activationPackage: null,
      message: "La solicitud de alta simulada no es válida.",
    };
  }

  const tenantUrl = buildTenantUrlFromRequest(request, validation.normalizedSlug);
  const tenantRequest = new NextRequest(tenantUrl, {
    method: "GET",
    headers: request.headers,
  });

  const context = resolveRuntimeRequestContext(tenantRequest);

  if (!context.ok || !context.tenant) {
    return {
      ok: false,
      requestedSlug: String(input.slug || "").trim(),
      normalizedSlug: validation.normalizedSlug,
      validationErrors: [],
      tenantMatched: false,
      provisioningTriggered: false,
      activationPackage: null,
      message:
        "No existe todavía un tenant con ese slug. Esta alta simulada sigue trabajando sobre tenants ya creados.",
    };
  }

  const temporaryPassword = generateTemporaryPassword();

  upsertTenantAdminAccount({
    tenantId: context.tenant.tenantId,
    clientId: context.tenant.clientId,
    slug: context.tenant.slug,
    email: String(input.email || "").trim().toLowerCase(),
    fullName: String(input.contactName || "").trim(),
    temporaryPassword,
    role: "owner",
  });

  const activationPackage = buildActivationPackageFromRequest(tenantRequest);
  const delivery = await sendActivationEmailFromRequest(tenantRequest);
  const readyToSend = Boolean(
    activationPackage.ok &&
      activationPackage.email &&
      activationPackage.admin.email
  );

  return {
    ok: readyToSend,
    requestedSlug: String(input.slug || "").trim(),
    normalizedSlug: validation.normalizedSlug,
    validationErrors: [],
    tenantMatched: true,
    provisioningTriggered: true,
    activationPackage,
    message: readyToSend
      ? (
          "Alta simulada completada. Acceso preparado" +
          (delivery.delivery?.provider === "resend"
            ? " y email enviado."
            : " y email guardado en outbox porque no había proveedor real configurado.")
        )
      : "El tenant existe, pero todavía no quedó listo del todo para activación automática.",
  };
}

/**
 * Route-facing wrapper. Parses the body from the request (query string on
 * GET, JSON body on POST) and delegates to `runSignupSimulateFromRequest`.
 *
 * The route expects a result shape that always includes `source` and
 * `requestedSlug` for telemetry, so we adapt the underlying result.
 */
export async function simulateSignupFromRequest(
  request: NextRequest
): Promise<SignupSimulateResult & { source: string }> {
  let rawInput: Partial<SignupSimulateInput> = {};

  if (request.method === "POST") {
    try {
      rawInput = (await request.json()) as Partial<SignupSimulateInput>;
    } catch {
      rawInput = {};
    }
  } else {
    const params = request.nextUrl.searchParams;
    rawInput = {
      slug: params.get("slug") || undefined,
      email: params.get("email") || undefined,
      contactName: params.get("contactName") || params.get("name") || undefined,
      displayName: params.get("displayName") || undefined,
    } as Partial<SignupSimulateInput>;
  }

  const result = await runSignupSimulateFromRequest(request, rawInput);
  return {
    ...result,
    source: "signup-simulate",
  };
}