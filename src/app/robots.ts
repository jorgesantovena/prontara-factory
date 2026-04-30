import type { MetadataRoute } from "next";
import { getPublicBaseUrl } from "@/lib/saas/runtime-env";

/**
 * /robots.txt — generado por Next.js a partir de este file.
 *
 * Política:
 *   - Permite indexar el sitio público (home, verticales, precios, etc.).
 *   - Bloquea las áreas privadas: panel /factory, asistente, runtime de
 *     tenants (clientes, crm, finanzas, etc.) y las APIs.
 *   - Apunta al sitemap para que los buscadores lo descubran.
 */
export default function robots(): MetadataRoute.Robots {
  const baseUrl = getPublicBaseUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/verticales",
          "/verticales/",
          "/precios",
          "/como-funciona",
          "/faq",
          "/contacto",
          "/alta",
          "/contrato",
          "/legal/",
        ],
        disallow: [
          "/api/",
          "/factory",
          "/factory/",
          "/asistente",
          "/asistente/",
          "/acceso",
          "/recuperar",
          "/restablecer",
          "/primer-acceso",
          "/ajustes",
          "/blueprint",
          "/clientes",
          "/contratos",
          "/crm",
          "/demo",
          "/demo-comercial",
          "/documentos",
          "/entrega",
          "/equipo",
          "/evolucion",
          "/facturacion",
          "/finanzas",
          "/interno",
          "/landing",
          "/packs-sectoriales",
          "/planificacion_recursos",
          "/presupuestos",
          "/proyectos",
          "/rrhh",
          "/software-factory",
          "/suscripcion",
          "/timesheets",
        ],
      },
    ],
    sitemap: baseUrl + "/sitemap.xml",
    host: baseUrl,
  };
}
