"use client";

import { useEffect, useState } from "react";
import TenantSidebar from "@/components/erp/tenant-sidebar";
import DashboardTopBar from "@/components/erp/dashboard-topbar";
import HelpPanel from "@/components/erp/help-panel";
import FirstTimeTour from "@/components/erp/first-time-tour";
// TEST-16 bis (2) — `Breadcrumbs` ya no se monta aquí (franja 2
// eliminada). Se mantiene el componente vivo en `breadcrumbs.tsx` por
// si en el futuro se reincorpora a una vista concreta.
import KeyboardShortcuts from "@/components/erp/keyboard-shortcuts";
import DailyActivityBanner from "@/components/erp/daily-activity-banner";
// TEST-12 #3 — Solapas concurrentes (Pedro). Barra de pestañas estilo
// navegador que mantiene visible varias operaciones abiertas; los
// formularios persisten su borrador en sessionStorage para no perder
// progreso al saltar de una pestaña a otra.
import TabBar from "@/components/erp/tab-bar";

/**
 * Wrapper del runtime del tenant: añade la sidebar lateral fija a la
 * izquierda y deja el contenido en el área principal a la derecha.
 *
 * En desktop: sidebar 240px (o 64px colapsada) + contenido fluido.
 * En mobile (<900px): sidebar oculta tras hamburguesa, contenido a 100%.
 *
 * Escucha el evento `prontara-sidebar-toggle` que emite TenantSidebar para
 * ajustar el marginLeft del main al cambiar el ancho.
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
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      setCollapsed(window.localStorage.getItem("prontara-sidebar-collapsed") === "1");
    } catch { /* ignore */ }
    function onToggle(e: Event) {
      const detail = (e as CustomEvent<{ collapsed: boolean }>).detail;
      if (detail) setCollapsed(Boolean(detail.collapsed));
    }
    window.addEventListener("prontara-sidebar-toggle", onToggle);
    return () => window.removeEventListener("prontara-sidebar-toggle", onToggle);
  }, []);

  const sidebarWidth = collapsed ? 64 : 240;

  return (
    <div style={{ minHeight: "100vh" }}>
      <TenantSidebar />

      <main
        className="prontara-tenant-main"
        style={{
          marginLeft: sidebarWidth,
          minHeight: "100vh",
          background: contentBackground,
          boxSizing: "border-box",
          transition: "margin-left 180ms ease",
        }}
      >
        <DashboardTopBar />
        <DailyActivityBanner />
        {/* TEST-16 bis (2) — Franja 2 eliminada (Pedro): el Breadcrumbs
            global mostraba "Inicio / Vertical / Módulo" repitiendo lo
            que el TopBar y la TabBar ya dejan claro. La navegación se
            mantiene desde el sidebar y desde las pestañas. */}
        <TabBar />
        <div style={{ padding: contentPadding }}>
          {children}
        </div>
      </main>

      <HelpPanel />
      <FirstTimeTour />
      <KeyboardShortcuts />

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
