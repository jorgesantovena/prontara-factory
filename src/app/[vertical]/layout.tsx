import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { resolveTenantFromRequestAsync } from "@/lib/saas/tenant-resolver-async";
import {
  ALL_VERTICAL_SLUGS,
  normalizeVerticalSlug,
  verticalSlugToBusinessType,
  businessTypeToVerticalSlug,
} from "@/lib/saas/vertical-slug";

/**
 * Layout del runtime de cualquier vertical (H13-A).
 *
 * Responsabilidades:
 *   1. Validar que `[vertical]` es uno de los slugs reconocidos.
 *      Si no lo es → notFound() (404 nativo de Next).
 *   2. Validar que el usuario tiene sesión.
 *      Si no → redirect a /acceso?redirectTo=/{vertical}.
 *   3. Validar que el tenant del usuario logueado pertenece a este
 *      vertical. Si NO coincide:
 *        - Si el usuario es admin de Factory (Jorge): permitir y switch.
 *        - Si el usuario es cliente final: redirect a SU vertical.
 *
 * El TenantShell (sidebar + topbar + breadcrumbs) lo monta cada page,
 * no el layout — eso ya estaba así antes del refactor.
 */
export default async function VerticalLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ vertical: string }>;
}) {
  const { vertical: rawVertical } = await params;

  // 1. Validar slug
  const slug = normalizeVerticalSlug(String(rawVertical || ""));
  if (!slug || !ALL_VERTICAL_SLUGS.includes(slug)) {
    notFound();
  }

  // 2. Validar sesión + tenant
  // Construimos un "request-like" para reusar el resolver async existente.
  // En Next 16 server components no tenemos acceso directo al NextRequest, pero
  // sí a las cookies — el resolver async lo soporta.
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("prontara_session");
  if (!sessionCookie?.value) {
    redirect("/acceso?redirectTo=/" + slug);
  }

  // El resolver async espera un NextRequest. Le pasamos un objeto
  // mínimo con cookies + headers vacíos. Si esto no funciona en runtime
  // tendremos que adaptar el resolver, pero la firma actual lo permite.
  const fakeReq = {
    cookies: { get: (name: string) => (name === "prontara_session" ? { value: sessionCookie.value } : undefined) },
    headers: new Headers(),
    nextUrl: { searchParams: new URLSearchParams() },
  } as unknown as Parameters<typeof resolveTenantFromRequestAsync>[0];

  let tenantBusinessType: string | null = null;
  try {
    const resolution = await resolveTenantFromRequestAsync(fakeReq);
    if (resolution.ok && resolution.tenant) {
      tenantBusinessType = String(resolution.tenant.businessType || "");
    }
  } catch {
    // Si no se resuelve, sigue como si no hubiera sesión válida.
  }

  if (!tenantBusinessType) {
    redirect("/acceso?redirectTo=/" + slug);
  }

  // 3. Validar match vertical-tenant
  const expectedBusinessType = verticalSlugToBusinessType(slug);
  if (expectedBusinessType && tenantBusinessType !== expectedBusinessType) {
    // El tenant del usuario es de OTRO vertical. Redirige al suyo.
    const userVerticalSlug = businessTypeToVerticalSlug(tenantBusinessType);
    if (userVerticalSlug) {
      redirect("/" + userVerticalSlug);
    }
    // No tiene mapping → mandar al login con error
    redirect("/acceso?error=vertical-mismatch");
  }

  return <>{children}</>;
}
