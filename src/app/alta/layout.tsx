import type { Metadata } from "next";

/**
 * Layout hermano para `/alta/page.tsx` (que es client component y por
 * tanto no puede exportar `metadata` directamente). Solo aporta SEO.
 */
export const metadata: Metadata = {
  title: "Empezar prueba gratis",
  description:
    "Crea tu entorno Prontara en 2 minutos. 14 días de prueba gratis sin tarjeta. Vertical preconfigurado y datos demo listos para empezar.",
  alternates: { canonical: "/alta" },
  openGraph: {
    title: "Empezar prueba gratis · Prontara",
    description:
      "Crea tu entorno Prontara en 2 minutos. 14 días de prueba gratis sin tarjeta.",
    url: "/alta",
  },
};

export default function AltaLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
