import type { Metadata } from "next";

/**
 * Layout hermano para `/contacto/page.tsx` (que es client component y por
 * tanto no puede exportar `metadata` directamente). Solo aporta SEO.
 */
export const metadata: Metadata = {
  title: "Contacto",
  description:
    "Habla con el equipo de Prontara. Resolvemos dudas comerciales y técnicas en menos de 24 horas laborables.",
  alternates: { canonical: "/contacto" },
  openGraph: {
    title: "Contacto · Prontara",
    description:
      "Habla con el equipo. Respondemos dudas comerciales y técnicas en menos de 24 horas laborables.",
    url: "/contacto",
  },
};

export default function ContactoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
