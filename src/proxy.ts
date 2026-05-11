import { NextResponse, type NextRequest } from "next/server";
import {
  isFactoryAdminFromCookieEdge,
  SAAS_SESSION_COOKIE,
  verifySessionTokenEdge,
} from "@/lib/saas/auth-session-edge";
import { ALL_VERTICAL_SLUGS, businessTypeToVerticalSlug } from "@/lib/saas/vertical-slug";

/**
 * Proxy global de Prontara (antes "middleware" — renombrado en Next 16).
 *
 * DOS responsabilidades:
 *
 *   1. **Auth Factory** — `/api/factory/*` requiere sesión HMAC válida con
 *      rol admin u owner. Whitelist explícita en FACTORY_API_WHITELIST.
 *
 *   2. **Redirect rutas viejas** (H13-C) — cualquier request a un módulo
 *      conocido SIN prefijo de vertical (ej. /clientes, /facturacion,
 *      /proyectos) se redirige a /<vertical>/<modulo> leyendo el
 *      businessType del cookie de sesión. Backward-compatible con todos
 *      los <Link href="/x"> que quedan en el código tras el refactor.
 *
 * Runtime: Node (no Edge). El módulo auth-session-edge usa Web Crypto API
 * que funciona en ambos runtimes.
 */

const FACTORY_API_WHITELIST: ReadonlyArray<string> = [
  "/api/factory/tenants/create",
];

// Set de módulos tenant-runtime bajo /[vertical]/. Si llega una request a
// /<modulo> con uno de estos nombres, redirigimos al vertical del usuario.
const KNOWN_MODULES = new Set<string>([
  "actividades", "agenda-hoy", "ajustes", "ajustes-campos", "ajustes-cuenta",
  "aprobaciones", "asistencia", "asistente", "becas", "biblioteca", "blueprint",
  "buscar", "caja-rapida", "calendario", "calificaciones", "catalogo-servicios",
  "clientes", "comedor", "compras", "comunicaciones", "contratos", "crm",
  "demo", "demo-comercial", "disciplina", "docentes", "documentos", "egresados",
  "encuestas", "enfermeria", "entrega", "equipo", "etiquetas", "eventos",
  "evolucion", "facturacion", "finanzas", "horarios", "importar", "integraciones",
  "inventario", "mantenimiento", "mensajes", "orientacion", "packs-sectoriales",
  "personal", "planeaciones", "planificacion_recursos", "plantillas",
  "portal-docente", "portal-estudiante", "portal-familia", "presupuestos",
  "primer-acceso", "produccion", "productos", "proyectos", "reportes",
  "reservas", "rrhh", "salidas", "suscripcion", "tareas", "tickets",
  "timesheets", "tramites", "transporte", "vista-gantt", "vista-kanban",
  "visitantes", "workflows",
]);

function isWhitelisted(pathname: string): boolean {
  return FACTORY_API_WHITELIST.some(
    (allowed) => pathname === allowed || pathname.startsWith(allowed + "/"),
  );
}

function isVerticalPrefixed(pathname: string): boolean {
  const seg = pathname.split("/").filter(Boolean)[0];
  if (!seg) return false;
  return ALL_VERTICAL_SLUGS.includes(seg as (typeof ALL_VERTICAL_SLUGS)[number]);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── 1. Auth Factory ─────────────────────────────────────────────────
  if (pathname.startsWith("/api/factory")) {
    if (isWhitelisted(pathname)) return NextResponse.next();

    const token = request.cookies.get(SAAS_SESSION_COOKIE)?.value;
    const ok = await isFactoryAdminFromCookieEdge(token);
    if (!ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "Se requiere sesión con rol admin u owner en la Factory.",
          code: "FACTORY_AUTH_REQUIRED",
        },
        { status: 401 },
      );
    }
    return NextResponse.next();
  }

  // ── 2. Redirect rutas viejas /<modulo> → /<vertical>/<modulo> ──────
  // Solo nos interesa el primer segmento del path; si ya está prefijado
  // por un vertical conocido, dejamos pasar.
  if (isVerticalPrefixed(pathname)) return NextResponse.next();

  const firstSeg = pathname.split("/").filter(Boolean)[0];
  if (!firstSeg || !KNOWN_MODULES.has(firstSeg)) return NextResponse.next();

  // Es un módulo conocido sin prefijo. Sacamos el vertical del cookie.
  const token = request.cookies.get(SAAS_SESSION_COOKIE)?.value;
  const session = token ? await verifySessionTokenEdge(token) : null;

  if (!session) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/acceso";
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const businessType = String(session.businessType || "");
  if (!businessType) {
    // Cookie antiguo sin businessType → forzamos re-login para regenerarlo.
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/acceso";
    loginUrl.searchParams.set("reload", "1");
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const verticalSlug = businessTypeToVerticalSlug(businessType);
  if (!verticalSlug) {
    // businessType desconocido — no rompemos, dejamos pasar.
    return NextResponse.next();
  }

  const newUrl = request.nextUrl.clone();
  newUrl.pathname = "/" + verticalSlug + pathname;
  return NextResponse.redirect(newUrl, 307);
}

/**
 * Matcher: el proxy corre en
 *   - /api/factory/:path*   → auth Factory
 *   - / + cualquier path NO estático → redirect rutas viejas
 *
 * Excluye assets (_next/static, _next/image, favicon, archivos con ext).
 */
export const config = {
  matcher: [
    "/api/factory/:path*",
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
