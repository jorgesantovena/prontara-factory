"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCurrentVertical } from "@/lib/saas/use-current-vertical";

/**
 * TEST-12 #2 — El módulo "Tipos de servicio" ha sido retirado (Pedro: era
 * concepto duplicado con el Catálogo de actividades). La ruta sigue
 * existiendo para no romper bookmarks; redirige al catálogo de
 * actividades, que es ahora el único sitio donde se gestiona ese
 * concepto.
 */
export default function TiposServicioPage() {
  const router = useRouter();
  const { link } = useCurrentVertical();
  useEffect(() => {
    router.replace(link("actividades-catalogo"));
  }, [router, link]);
  return (
    <div style={{ padding: 40, color: "#64748b", fontSize: 14 }}>
      Redirigiendo a Actividades…
    </div>
  );
}
