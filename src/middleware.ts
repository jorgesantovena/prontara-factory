import { NextRequest, NextResponse } from "next/server";
import { SAAS_SESSION_COOKIE, verifySessionTokenEdge } from "@/lib/saas/auth-session-edge";
import { businessTypeToVerticalSlug, ALL_VERTICAL_SLUGS } from "@/lib/saas/vertical-slug";

/**
 * Middleware Next 16 (H13-C) — redirect transparente de rutas viejas
 * a la nueva estructura /[vertical]/[modulo].
 *
 * Estrategia:
 *   - Si la ruta es un módulo conocido SIN prefijo de vertical
 *     (ej. /clientes, /facturacion, /proyectos…), miramos el cookie
 *     de sesión, sacamos el businessType del usuario, lo mapeamos al
 *     slug del vertical (software-factory → softwarefactory) y
 *     hacemos 307 redirect a /<vertical>/<modulo>.
 *   - Si no hay sesión, redirige a /acceso con `redirectTo` para volver
 *     después del login.
 *   - Si la ruta ya tiene prefijo de vertical o es global (/factory,
 *     /api, /landing, /acceso, /verticales, /docs, /onboarding…),
 *     dejamos pasar sin tocar.
 *   - Si el path es estático (favicon, _next, public assets), dejamos
 *     pasar — el matcher de abajo ya los excluye.
 *
 * Esto evita tener que reescribir 200+ <Link> en componentes después
 * del refactor — los hrefs viejos siguen funcionando.
 */

// Set de módulos tenant-runtime que viven hoy bajo [vertical]/.
// Si una request llega a /<modulo> con uno de estos nombres y NO hay
// prefijo de vertical, redirigimos.
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

// Rutas globales que NO deben ser interceptadas.
const GLOBAL_PATHS = [
  "/factory", "/api", "/acceso", "/alta", "/landing", "/verticales",
  "/onboarding", "/logout", "/docs", "/status", "/contacto", "/contrato",
  "/faq", "/precios", "/recuperar", "/restablecer", "/legal",
  "/como-funciona", "/interno", "/software-factory",
];

function isGlobalPath(pathname: string): boolean {
  return GLOBAL_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function isVerticalPrefixed(pathname: string): boolean {
  const seg = pathname.split("/").filter(Boolean)[0];
  if (!seg) return false;
  return ALL_VERTICAL_SLUGS.includes(seg as (typeof ALL_VERTICAL_SLUGS)[number]);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Dejamos pasar rutas globales y assets.
  if (isGlobalPath(pathname)) return NextResponse.next();

  // 2. Si la ruta ya está bajo /<vertical>/..., dejamos pasar.
  if (isVerticalPrefixed(pathname)) return NextResponse.next();

  // 3. Solo nos interesan rutas que pertenezcan a un módulo conocido.
  const firstSeg = pathname.split("/").filter(Boolean)[0];
  if (!firstSeg || !KNOWN_MODULES.has(firstSeg)) return NextResponse.next();

  // 4. Leemos cookie de sesión + sacamos businessType.
  const token = request.cookies.get(SAAS_SESSION_COOKIE)?.value;
  const session = token ? await verifySessionTokenEdge(token) : null;

  if (!session) {
    // Sin sesión válida → al login con redirectTo
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/acceso";
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const businessType = String(session.businessType || "");
  if (!businessType) {
    // Cookie antigua sin businessType → forzamos re-login para regenerar.
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/acceso";
    loginUrl.searchParams.set("reload", "1");
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const verticalSlug = businessTypeToVerticalSlug(businessType);
  if (!verticalSlug) {
    // businessType desconocido (no debería pasar, pero por si acaso).
    return NextResponse.next();
  }

  // 5. Redirect 307 a /<vertical>/<resto-del-path>
  const newUrl = request.nextUrl.clone();
  newUrl.pathname = "/" + verticalSlug + pathname;
  return NextResponse.redirect(newUrl, 307);
}

/**
 * Matcher: el middleware corre en todas las rutas EXCEPTO:
 *   - /_next/static (assets de build)
 *   - /_next/image  (optimizador imágenes)
 *   - favicon.ico
 *   - cualquier archivo con extensión (imágenes, fuentes, css, js, etc.)
 *
 * Las rutas globales (/factory, /api, etc.) sí entran pero el handler
 * las deja pasar con NextResponse.next() rápidamente.
 */
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
