"use client";

import { useParams, usePathname } from "next/navigation";
import { useMemo } from "react";
import {
  normalizeVerticalSlug,
  verticalLink as buildVerticalLink,
  type VerticalSlug,
} from "@/lib/saas/vertical-slug";

/**
 * Hook que devuelve el slug del vertical actual basándose en:
 *   1. El parámetro [vertical] de la ruta dinámica si existe.
 *   2. El primer segmento del pathname si la ruta no es dinámica
 *      (ej. cuando se renderiza desde un layout que no tiene params).
 *
 * Devuelve null si no estamos dentro de un vertical (por ejemplo, en
 * la home raíz de la Factory).
 *
 * Y un helper `link(modulePath)` listo para usar en hrefs:
 *   const { link } = useCurrentVertical();
 *   <Link href={link("clientes")}>Clientes</Link>
 */
export function useCurrentVertical(): {
  vertical: VerticalSlug | null;
  link: (modulePath?: string) => string;
} {
  const params = useParams();
  const pathname = usePathname() || "/";

  const vertical = useMemo<VerticalSlug | null>(() => {
    // Intento 1: param de la ruta dinámica
    const fromParams = (params as Record<string, string | string[] | undefined>)?.vertical;
    if (fromParams) {
      const raw = Array.isArray(fromParams) ? fromParams[0] : fromParams;
      const norm = normalizeVerticalSlug(String(raw || ""));
      if (norm) return norm;
    }
    // Intento 2: primer segmento del path
    const seg = pathname.split("/").filter(Boolean)[0];
    if (seg) {
      const norm = normalizeVerticalSlug(seg);
      if (norm) return norm;
    }
    return null;
  }, [params, pathname]);

  const link = (modulePath: string = "") => {
    if (!vertical) return "/" + String(modulePath || "").replace(/^\/+/, "");
    return buildVerticalLink(vertical, modulePath);
  };

  return { vertical, link };
}
