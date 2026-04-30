"use client";

import TenantSidebar from "@/components/erp/tenant-sidebar";

/**
 * Wrapper del runtime del tenant: añade la sidebar lateral fija a la
 * izquierda y deja el contenido en el área principal a la derecha.
 *
 * En desktop: sidebar 240px + contenido fluido.
 * En mobile (<900px): sidebar oculta tras hamburguesa, contenido a 100%.
 *
 * Cada página de módulo (clientes, crm, proyectos…) se envuelve en
 * <TenantShell>...</TenantShell>. El home también, para que la sidebar
 * sea persistente.
 */
export default function TenantShell({
  children,
  contentBackground = "#f5f7fb",
  contentPadding = 24,
}: {
  children: React.ReactNode;
  /** Color de fondo del área principal (para contraste con la sidebar blanca). */
  contentBackground?: string;
  /** Padding del área principal en desktop. */
  contentPadding?: number;
}) {
  return (
    <div style={{ minHeight: "100vh" }}>
      <TenantSidebar />

      <main
        className="prontara-tenant-main"
        style={{
          marginLeft: 240,
          minHeight: "100vh",
          background: contentBackground,
          padding: contentPadding,
          boxSizing: "border-box",
        }}
      >
        {children}
      </main>

      <style>{`
        @media (max-width: 900px) {
          .prontara-tenant-main {
            margin-left: 0 !important;
            padding-top: 64px !important;
          }
        }
      `}</style>
    </div>
  );
}
