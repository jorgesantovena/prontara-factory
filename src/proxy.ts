import { NextResponse, type NextRequest } from "next/server";
import {
  isFactoryAdminFromCookieEdge,
  SAAS_SESSION_COOKIE,
} from "@/lib/saas/auth-session-edge";

/**
 * Proxy global de Prontara (antes "middleware" — renombrado en Next 16).
 *
 * Por defecto, todo `/api/factory/*` requiere sesión HMAC válida con rol
 * admin u owner. Es la primera línea de defensa: aunque un endpoint
 * concreto se haya olvidado de llamar a `requireFactoryAdmin`, ya queda
 * protegido por el proxy antes de tocar la lógica.
 *
 * Whitelist (rutas que SÍ deben ser públicas dentro de /api/factory):
 *   - /api/factory/tenants/create — endpoint del alta del trial; tiene
 *     su propio rate-limit por IP en el handler.
 *
 * Notas sobre el runtime (Next 16):
 *   - `proxy.ts` corre en Node runtime (no Edge). Cold start ligeramente
 *     mayor que Edge pero sin restricciones de libs.
 *   - Reusamos el módulo `auth-session-edge` (Web Crypto API) porque
 *     funciona también en Node y mantiene la paridad con el formato de
 *     token usado por el resto de la app.
 */

const FACTORY_API_WHITELIST: ReadonlyArray<string> = [
  "/api/factory/tenants/create",
];

function isWhitelisted(pathname: string): boolean {
  return FACTORY_API_WHITELIST.some(
    (allowed) => pathname === allowed || pathname.startsWith(allowed + "/"),
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Solo nos interesan los endpoints internos del operador.
  if (!pathname.startsWith("/api/factory")) {
    return NextResponse.next();
  }

  // Whitelist explícita.
  if (isWhitelisted(pathname)) {
    return NextResponse.next();
  }

  // Validación de sesión.
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

/**
 * El matcher restringe el proxy a las rutas /api/factory/*. El resto
 * del sitio (páginas públicas, /api/public, /api/runtime, /api/stripe,
 * /api/erp) NO pasa por este proxy, evitando overhead innecesario.
 */
export const config = {
  matcher: ["/api/factory/:path*"],
};
