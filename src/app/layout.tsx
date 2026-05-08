import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

import { getPublicBaseUrl } from "@/lib/saas/runtime-env";
import PwaRegister from "@/components/pwa-register";

const SITE_URL = getPublicBaseUrl();

/**
 * Metadata raíz: define los defaults para todo el árbol de la app.
 * Cada página puede sobrescribir título y descripción exportando su propio
 * `export const metadata` (Next.js 13+ App Router).
 *
 * - `metadataBase`: imprescindible para que Next genere absolute URLs en
 *   tags Open Graph y canonical correctamente.
 * - `title.template`: las páginas devuelven solo su parte ("Precios") y
 *   Next compone "Precios · Prontara".
 * - `openGraph` y `twitter`: defaults que cualquier página hereda salvo
 *   que los redefina.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Prontara — ERP online por sector, listo en minutos",
    template: "%s · Prontara",
  },
  description:
    "Prontara es el ERP online configurable para pymes (4–20 empleados). Plantillas por sector, precios cerrados, prueba gratis 14 días sin tarjeta.",
  applicationName: "Prontara",
  authors: [{ name: "SISPYME, S.L." }],
  creator: "SISPYME, S.L.",
  publisher: "SISPYME, S.L.",
  keywords: [
    "ERP online",
    "ERP para pymes",
    "software de gestión",
    "ERP por sector",
    "ERP gimnasio",
    "ERP peluquería",
    "ERP colegio",
    "ERP software factory",
    "SaaS ERP España",
    "Prontara",
  ],
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "es_ES",
    url: SITE_URL,
    siteName: "Prontara",
    title: "Prontara — ERP online por sector, listo en minutos",
    description:
      "ERP online configurable para pymes (4–20 empleados). Plantillas por sector, precios cerrados, prueba gratis 14 días.",
    images: [
      {
        url: "/brand/prontara-horizontal-1024.png",
        width: 1024,
        height: 256,
        alt: "Prontara — ERP online por sector",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Prontara — ERP online por sector, listo en minutos",
    description:
      "ERP online configurable para pymes (4–20 empleados). Plantillas por sector, precios cerrados, prueba gratis 14 días.",
    images: ["/brand/prontara-horizontal-1024.png"],
  },
  icons: {
    icon: "/favicon.png",
    apple: "/brand/prontara-icon.png",
  },
  alternates: {
    canonical: SITE_URL,
  },
  manifest: "/manifest.json",
  themeColor: "#1d4ed8",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable}`}
      style={{
        height: "100%",
        WebkitFontSmoothing: "antialiased",
        MozOsxFontSmoothing: "grayscale",
      }}
    >
      <body style={{ minHeight: "100%", display: "flex", flexDirection: "column", margin: 0 }}>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
