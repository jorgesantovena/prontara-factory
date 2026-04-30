import type { MetadataRoute } from "next";
import { listSectorPacks } from "@/lib/factory/sector-pack-registry";
import { getPublicBaseUrl } from "@/lib/saas/runtime-env";

/**
 * /sitemap.xml — generado dinámicamente por Next.js a partir de este file.
 *
 * Incluye todas las páginas públicas indexables y una entrada por vertical.
 * Se excluyen las rutas autenticadas (/factory, /asistente, /clientes, etc.)
 * y las APIs.
 *
 * Para que Google y Bing lo encuentren, cuando hagamos deploy a Vercel hay
 * que dar de alta en Search Console y Bing Webmaster Tools la URL
 *   https://prontara.com/sitemap.xml
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getPublicBaseUrl();
  const lastModified = new Date();

  const corePages: MetadataRoute.Sitemap = [
    { url: baseUrl + "/", lastModified, changeFrequency: "weekly", priority: 1.0 },
    { url: baseUrl + "/verticales", lastModified, changeFrequency: "weekly", priority: 0.9 },
    { url: baseUrl + "/precios", lastModified, changeFrequency: "monthly", priority: 0.9 },
    { url: baseUrl + "/como-funciona", lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: baseUrl + "/faq", lastModified, changeFrequency: "monthly", priority: 0.7 },
    { url: baseUrl + "/contacto", lastModified, changeFrequency: "yearly", priority: 0.6 },
    { url: baseUrl + "/alta", lastModified, changeFrequency: "monthly", priority: 0.9 },
    { url: baseUrl + "/contrato", lastModified, changeFrequency: "monthly", priority: 0.5 },
    { url: baseUrl + "/legal/terminos", lastModified, changeFrequency: "yearly", priority: 0.4 },
    { url: baseUrl + "/legal/privacidad", lastModified, changeFrequency: "yearly", priority: 0.4 },
    { url: baseUrl + "/legal/cookies", lastModified, changeFrequency: "yearly", priority: 0.4 },
  ];

  // Una URL por vertical disponible en /verticales/[key]
  let verticalPages: MetadataRoute.Sitemap = [];
  try {
    verticalPages = listSectorPacks().map((p) => ({
      url: baseUrl + "/verticales/" + p.key,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    }));
  } catch {
    // Si listSectorPacks falla en build (p.ej. sin datos), no rompemos
    // la generación del sitemap — devolvemos al menos las páginas core.
    verticalPages = [];
  }

  return [...corePages, ...verticalPages];
}
