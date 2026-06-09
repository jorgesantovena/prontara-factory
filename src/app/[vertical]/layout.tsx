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
import { ensureTest19Seed } from "@/lib/verticals/software-factory/ensure-test19-seed";

// TEST 19 (Pedro) — Auto-seed de Niveles + Contratos al entrar al
// vertical software-factory. Pedro no debe pulsar ningún botón: entra y
// los datos están. La función es idempotente; este Set evita repetir las
// comprobaciones en cada navegación dentro de la misma instancia de
// servidor (en serverless el Set se resetea por instancia, pero la
// idempotencia mantiene la corrección). Se ejecuta best-effort: cualquier
// fallo se traga para no romper nunca la carga del runtime.
const seededTenants = new Set<string>();
const seedingInFlight = new Map<string, Promise<void>>();
async function maybeAutoSeedSoftwareFactory(clientId: string): Promise<void> {
  if (seededTenants.has(clientId)) return;
  // Deduplica entradas concurrentes del primer arranque: todas esperan la
  // misma promesa en vez de sembrar en paralelo (evita niveles duplicados).
  const existing = seedingInFlight.get(clientId);
  if (existing) return existing;
  const run = (async () => {
    try {
      await ensureTest19Seed(clientId);
      seededTenants.add(clientId);
    } catch {
      // No marcamos como sembrado: se reintentará en la próxima entrada.
    } finally {
      seedingInFlight.delete(clientId);
    }
  })();
  seedingInFlight.set(clientId, run);
  return run;
}

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
  let tenantClientId: string | null = null;
  try {
    const resolution = await resolveTenantFromRequestAsync(fakeReq);
    if (resolution.ok && resolution.tenant) {
      tenantBusinessType = String(resolution.tenant.businessType || "");
      tenantClientId = String(resolution.tenant.clientId || "");
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

  // TEST 19 — Solo el vertical software-factory usa el modelo de
  // Facturación con Niveles + Contratos. Al entrar, garantizamos que esos
  // datos existan para que Pedro (tenant anterior al TEST 19) los vea sin
  // pulsar nada. Idempotente y best-effort (no bloquea la carga).
  // OJO: el slug canónico de URL es "softwarefactory" (sin guion); el
  // businessType del pack es "software-factory" (con guion). Comparamos
  // contra el businessType, que es lo semánticamente correcto.
  if (tenantBusinessType === "software-factory" && tenantClientId) {
    await maybeAutoSeedSoftwareFactory(tenantClientId);
  }

  return <>{children}</>;
}
