import type { NextRequest } from "next/server";
import { resolveRuntimeRequestContext } from "@/lib/saas/runtime-request-context";
import { inspectTenantAccountsFromRequest } from "@/lib/saas/account-provisioning";
import { buildActivationUrl, createActivationToken } from "@/lib/saas/activation-link";

export type ActivationEmailPayload = {
  ok: boolean;
  source: string;
  requestedSlug: string | null;
  tenantId: string | null;
  clientId: string | null;
  slug: string | null;
  displayName: string | null;
  adminEmail: string | null;
  adminFullName: string | null;
  /**
   * Kept only for backward compatibility with the factory preview screen,
   * which still renders the temporary password until the new activation
   * flow is fully wired end-to-end. Never include this in the actual
   * outgoing email HTML/text.
   */
  temporaryPassword: string | null;
  activationUrl: string | null;
  activationExpiresAt: number | null;
  subject: string;
  previewText: string;
  html: string;
  text: string;
};

function escapeHtml(value: string): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildLoginUrl(slug: string | null): string {
  const safeSlug = String(slug || "").trim();
  return safeSlug ? "/login?tenant=" + encodeURIComponent(safeSlug) : "/login";
}

export function buildActivationEmailFromRequest(
  request: NextRequest
): ActivationEmailPayload {
  const context = resolveRuntimeRequestContext(request);
  const accountInfo = inspectTenantAccountsFromRequest(request);

  if (!context.ok || !context.tenant) {
    return {
      ok: false,
      source: context.source,
      requestedSlug: context.requestedSlug,
      tenantId: null,
      clientId: null,
      slug: null,
      displayName: null,
      adminEmail: null,
      adminFullName: null,
      temporaryPassword: null,
      activationUrl: null,
      activationExpiresAt: null,
      subject: "Activación de acceso Prontara",
      previewText: "No se pudo resolver el tenant para generar el email.",
      html: "<p>No se pudo resolver el tenant para generar el email.</p>",
      text: "No se pudo resolver el tenant para generar el email.",
    };
  }

  const tenant = context.tenant;
  const displayName =
    context.branding?.displayName ||
    context.config?.displayName ||
    tenant.displayName;

  const adminAccount = accountInfo.account;
  const loginUrl = buildLoginUrl(tenant.slug);
  const subject = "Tu acceso a " + displayName + " ya está listo";
  const previewText =
    "Accede a tu entorno Prontara con tus credenciales iniciales.";

  const adminEmail = adminAccount?.email || null;
  const adminFullName = adminAccount?.fullName || null;
  const temporaryPassword = adminAccount?.temporaryPassword || null;

  let activationUrl: string | null = null;
  let activationExpiresAt: number | null = null;

  if (adminEmail) {
    const { token, expiresAt } = createActivationToken({
      clientId: tenant.clientId,
      email: adminEmail,
    });
    const baseUrl =
      process.env.PRONTARA_PUBLIC_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "";
    activationUrl = buildActivationUrl({ baseUrl, slug: tenant.slug, token });
    activationExpiresAt = expiresAt;
  }

  const activationUrlForEmail = activationUrl || loginUrl;

  const html =
    "<h1>Tu acceso ya está listo</h1>" +
    "<p>Hola " + escapeHtml(adminFullName || "equipo") + ",</p>" +
    "<p>Tu entorno <strong>" + escapeHtml(displayName) + "</strong> ya está preparado.</p>" +
    "<p>" +
    "Entra y define tu contraseña con este enlace seguro (caduca en 7 días):" +
    "<br/>" +
    "<a href=\"" + escapeHtml(activationUrlForEmail) + "\">" + escapeHtml(activationUrlForEmail) + "</a>" +
    "</p>" +
    "<p>Email de acceso: <strong>" + escapeHtml(adminEmail || "pendiente") + "</strong></p>" +
    "<p>Por seguridad ya no enviamos la contraseña por email. Si el enlace caduca antes de que lo uses, solicita un nuevo acceso desde el panel.</p>";

  const text = [
    "Tu acceso ya está listo",
    "",
    "Entorno: " + displayName,
    "Enlace de activación (caduca en 7 días): " + activationUrlForEmail,
    "Email: " + (adminEmail || "pendiente"),
    "",
    "Por seguridad ya no enviamos la contraseña por email.",
    "Si el enlace caduca, solicita un nuevo acceso desde el panel.",
  ].join("\n");

  return {
    ok: true,
    source: context.source,
    requestedSlug: context.requestedSlug,
    tenantId: tenant.tenantId,
    clientId: tenant.clientId,
    slug: tenant.slug,
    displayName,
    adminEmail,
    adminFullName,
    temporaryPassword,
    activationUrl,
    activationExpiresAt,
    subject,
    previewText,
    html,
    text,
  };
}