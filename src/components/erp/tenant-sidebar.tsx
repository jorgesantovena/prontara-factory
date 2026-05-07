"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Sidebar lateral fija del runtime del tenant.
 *
 * Muestra los módulos del vertical contratado, con los labels que vengan del
 * sector pack (p. ej. "Oportunidades" en Software Factory, "Socios" en
 * Gimnasio, "Familias" en Colegio). Lee /api/runtime/tenant-config para
 * resolverlo. Si la API falla o todavía no ha respondido, muestra labels
 * neutros como fallback.
 *
 * En desktop ocupa una columna de 240px; en mobile se colapsa a un botón
 * hamburguesa que despliega un drawer.
 */

type RuntimeConfig = {
  modules: Array<{ moduleKey: string; enabled: boolean }>;
  navigationLabelMap: Record<string, string>;
  labels?: Record<string, string>;
  branding?: { displayName?: string; accentColor?: string };
};

// Orden lógico de los módulos en la sidebar. Los keys que no estén en este
// array salen al final, ordenados por config.modules. "produccion" no es
// un módulo del pack (no tiene schema propio), es un hub que orquesta los
// sub-módulos tareas/incidencias/etc., por eso lo añadimos como item
// "virtual" en la sidebar después de Proyectos.
const MODULE_ORDER = [
  "clientes",
  "crm",
  "proyectos",
  "produccion",
  "presupuestos",
  "facturacion",
  "documentos",
  "catalogo-servicios",
  "asistente",
  "equipo",
  "ajustes",
];

// Items "fijos" no asociados a un módulo del pack: van siempre arriba o abajo.
const FIXED_TOP = [
  { href: "/", label: "Inicio", moduleKey: "_home", icon: "🏠" },
];

// Iconos por módulo (emoji simple para no añadir dependencia de iconos SVG).
const MODULE_ICON: Record<string, string> = {
  clientes: "👥",
  crm: "🎯",
  proyectos: "🛠️",
  produccion: "🏭",
  presupuestos: "📄",
  facturacion: "💶",
  documentos: "📎",
  "catalogo-servicios": "📚",
  asistente: "💬",
  equipo: "👤",
  ajustes: "⚙️",
};

const FALLBACK_LABELS: Record<string, string> = {
  clientes: "Clientes",
  crm: "Oportunidades",
  proyectos: "Proyectos",
  produccion: "Producción",
  presupuestos: "Propuestas",
  facturacion: "Facturas",
  documentos: "Documentos",
  "catalogo-servicios": "Catálogo de servicios",
  asistente: "Asistente",
  equipo: "Equipo",
  ajustes: "Ajustes",
};

// Módulos "virtuales" que no vienen del pack (no tienen entrada en
// config.modules) pero sí tienen página propia. Los mostramos siempre.
const VIRTUAL_MODULES = new Set(["produccion"]);

// Módulos que viven SOLO dentro del hub /produccion (tabs internas).
// El pack los marca como enabled para que existan como módulos del ERP
// y se persistan registros, pero NO tienen página propia /<key> — el
// usuario los ve como tabs dentro de /produccion. Los excluimos del
// sidebar para evitar 404 (SF-20).
const HUB_CHILDREN_MODULES = new Set([
  "tareas",
  "incidencias",
  "actividades",
  "versiones",
  "mantenimientos",
  "justificantes",
  "descripciones-proyecto",
]);

function readQueryParams() {
  if (typeof window === "undefined") return { tenant: "", sectorPack: "" };
  const sp = new URLSearchParams(window.location.search);
  return {
    tenant: String(sp.get("tenant") || "").trim(),
    sectorPack: String(sp.get("sectorPack") || "").trim(),
  };
}

function buildHref(base: string, params: { tenant: string; sectorPack: string }) {
  const qs: string[] = [];
  if (params.tenant) qs.push("tenant=" + encodeURIComponent(params.tenant));
  if (params.sectorPack) qs.push("sectorPack=" + encodeURIComponent(params.sectorPack));
  return qs.length === 0 ? base : base + "?" + qs.join("&");
}

export default function TenantSidebar() {
  const pathname = usePathname() || "/";
  const [config, setConfig] = useState<RuntimeConfig | null>(null);
  const [open, setOpen] = useState(false);
  const [params, setParams] = useState({ tenant: "", sectorPack: "" });

  useEffect(() => {
    setParams(readQueryParams());
  }, []);

  useEffect(() => {
    let cancelled = false;
    const qs: string[] = [];
    if (params.tenant) qs.push("tenant=" + encodeURIComponent(params.tenant));
    if (params.sectorPack) qs.push("sectorPack=" + encodeURIComponent(params.sectorPack));
    const url = "/api/runtime/tenant-config" + (qs.length ? "?" + qs.join("&") : "");

    fetch(url, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data?.ok && data.config) {
          setConfig(data.config as RuntimeConfig);
        }
      })
      .catch(() => {
        // Silencioso: dejamos los fallbacks.
      });

    return () => {
      cancelled = true;
    };
  }, [params.tenant, params.sectorPack]);

  // Construir la lista de módulos a partir de config (orden por MODULE_ORDER + extras al final).
  const moduleItems: Array<{ href: string; label: string; moduleKey: string; icon: string }> = [];
  const labelFor = (key: string): string =>
    config?.navigationLabelMap?.[key] ||
    config?.labels?.[key] ||
    FALLBACK_LABELS[key] ||
    key.charAt(0).toUpperCase() + key.slice(1);

  // Orden canónico
  const seen = new Set<string>();
  for (const key of MODULE_ORDER) {
    if (seen.has(key)) continue;
    if (VIRTUAL_MODULES.has(key)) {
      // Solo mostramos producción si el vertical lo soporta. Lo deducimos:
      // si "tareas" o "incidencias" están activas en el pack, hay
      // producción. En caso contrario lo ocultamos.
      if (config) {
        const tareas = config.modules.find((mm) => mm.moduleKey === "tareas");
        const incidencias = config.modules.find((mm) => mm.moduleKey === "incidencias");
        const enabled =
          (tareas && tareas.enabled !== false) ||
          (incidencias && incidencias.enabled !== false);
        if (!enabled) continue;
      }
    } else if (config) {
      // Si hay config y el módulo está deshabilitado, lo saltamos.
      const m = config.modules.find((mm) => mm.moduleKey === key);
      if (m && m.enabled === false) continue;
    }
    moduleItems.push({
      href: buildHref("/" + key, params),
      label: labelFor(key),
      moduleKey: key,
      icon: MODULE_ICON[key] || "📌",
    });
    seen.add(key);
  }

  // Fallback: módulos del pack que NO están en MODULE_ORDER ni son
  // virtuales — los añadimos al final para no perder módulos custom
  // de futuros verticales sin tener que tocar este array. Por ejemplo,
  // si un pack añade "stock", "rutas" o "consultas", aparecerán aquí.
  // Excluimos los hijos del hub /produccion porque no tienen página
  // propia (SF-20).
  if (config) {
    for (const m of config.modules) {
      if (!m || m.enabled === false) continue;
      const k = m.moduleKey;
      if (!k || seen.has(k)) continue;
      if (VIRTUAL_MODULES.has(k)) continue;
      if (HUB_CHILDREN_MODULES.has(k)) continue;
      moduleItems.push({
        href: buildHref("/" + k, params),
        label: labelFor(k),
        moduleKey: k,
        icon: MODULE_ICON[k] || "📌",
      });
      seen.add(k);
    }
  }

  const accent = config?.branding?.accentColor || "#1d4ed8";
  const displayName = config?.branding?.displayName || "Prontara";

  function isActive(href: string): boolean {
    // href puede llevar query string; comparamos solo el pathname.
    const path = href.split("?")[0];
    if (path === "/") return pathname === "/";
    return pathname === path || pathname.startsWith(path + "/");
  }

  // Bloque visual común: lo renderizamos en un <aside> fijo en desktop y
  // dentro del drawer en mobile.
  const navContent = (
    <nav
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        padding: "20px 12px 16px",
        height: "100%",
        boxSizing: "border-box",
      }}
    >
      <div style={{ padding: "0 8px 16px", borderBottom: "1px solid #e5e7eb", marginBottom: 12 }}>
        <Link
          href={buildHref("/", params)}
          style={{
            textDecoration: "none",
            color: accent,
            fontSize: 18,
            fontWeight: 800,
            letterSpacing: -0.3,
            display: "block",
          }}
        >
          {displayName}
        </Link>
        <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>Panel del cliente</div>
      </div>

      {FIXED_TOP.map((item) => {
        const href = buildHref(item.href, params);
        const active = isActive(href);
        return (
          <Link
            key={item.moduleKey}
            href={href}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "9px 12px",
              borderRadius: 8,
              textDecoration: "none",
              color: active ? "#ffffff" : "#1f2937",
              background: active ? accent : "transparent",
              fontWeight: active ? 700 : 500,
              fontSize: 14,
            }}
            onClick={() => setOpen(false)}
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        );
      })}

      <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.5, padding: "16px 12px 6px" }}>
        Módulos
      </div>

      {moduleItems.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.moduleKey}
            href={item.href}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "9px 12px",
              borderRadius: 8,
              textDecoration: "none",
              color: active ? "#ffffff" : "#1f2937",
              background: active ? accent : "transparent",
              fontWeight: active ? 700 : 500,
              fontSize: 14,
            }}
            onClick={() => setOpen(false)}
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>{item.icon}</span>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {item.label}
            </span>
          </Link>
        );
      })}

      <div style={{ flex: 1 }} />

      <div style={{ fontSize: 11, color: "#9ca3af", padding: "12px 8px", borderTop: "1px solid #e5e7eb" }}>
        Pulsa <strong style={{ color: "#374151" }}>?</strong> para ayuda · powered by Prontara
      </div>
    </nav>
  );

  return (
    <>
      {/* Botón hamburguesa solo en mobile */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir menú"
        className="prontara-sidebar-toggle"
        style={{
          position: "fixed",
          top: 12,
          left: 12,
          zIndex: 60,
          width: 40,
          height: 40,
          border: "1px solid #d1d5db",
          background: "#ffffff",
          borderRadius: 8,
          cursor: "pointer",
          fontSize: 18,
          display: "none", // se hace visible vía media query al final
        }}
      >
        ☰
      </button>

      {/* Sidebar fija en desktop */}
      <aside
        className="prontara-sidebar"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: 240,
          height: "100vh",
          background: "#ffffff",
          borderRight: "1px solid #e5e7eb",
          overflowY: "auto",
          zIndex: 40,
        }}
      >
        {navContent}
      </aside>

      {/* Drawer en mobile */}
      {open ? (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15, 23, 42, 0.45)",
              zIndex: 70,
            }}
          />
          <aside
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: 280,
              height: "100vh",
              background: "#ffffff",
              borderRight: "1px solid #e5e7eb",
              overflowY: "auto",
              zIndex: 80,
              boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
            }}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Cerrar menú"
              style={{
                position: "absolute",
                top: 8,
                right: 8,
                background: "transparent",
                border: "none",
                fontSize: 22,
                cursor: "pointer",
                color: "#6b7280",
              }}
            >
              ×
            </button>
            {navContent}
          </aside>
        </>
      ) : null}

      {/* Media query para mostrar el botón en pantallas pequeñas y ocultar la sidebar fija */}
      <style>{`
        @media (max-width: 900px) {
          .prontara-sidebar { display: none !important; }
          .prontara-sidebar-toggle { display: inline-flex !important; align-items: center; justify-content: center; }
        }
      `}</style>
    </>
  );
}
