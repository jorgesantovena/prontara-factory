"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
// TEST-17 — Pedro: el icono del moduleKey debe aparecer también en la
// solapa, a la izquierda de la etiqueta (mismo icono que la sidebar).
import { iconForModule } from "@/lib/ui/module-icons";

/**
 * TEST-12 #3 — Solapas concurrentes.
 *
 * Pestañas estilo navegador para que el usuario pueda tener varias
 * operaciones abiertas a la vez (p.ej. Alta de Parte de horas + Alta de
 * Actividad) y saltar entre ellas con [x] para cerrar.
 *
 * Cómo funciona:
 * - Cada URL que visita el usuario dentro del tenant se añade
 *   automáticamente a la lista de tabs persistida en localStorage por
 *   tenant.
 * - La tab activa es la que coincide con `pathname` actual.
 * - Click en una tab navega a su URL (router.push). El navegador NO
 *   mantiene el estado del DOM en memoria (App Router desmonta), pero
 *   los formularios persisten su draft en sessionStorage (ver
 *   `erp-record-editor.tsx` clave `prontara-draft:<moduleKey>:<id|new>`).
 * - Click en la [x] cierra la tab; si era la activa, navega a la
 *   siguiente o, si era la única, al "Inicio" del vertical.
 *
 * Diseño minimalista para no robar espacio: barra horizontal de 32px
 * justo encima del contenido.
 */
type Tab = {
  href: string;
  label: string;
};

const MAX_LABEL = 24;
const STORAGE_KEY = "prontara-tabs";

function readTenant(): string {
  if (typeof window === "undefined") return "default";
  return new URLSearchParams(window.location.search).get("tenant") || "default";
}

function storageKey(): string {
  return STORAGE_KEY + ":" + readTenant();
}

// Extrae el segmento que representa el moduleKey en la URL del runtime
// (/<vertical>/<moduleKey>[/<subseccion>...]). Devuelve "" para la raíz
// del vertical.
//
// TEST-17 bis B — Rutas anidadas tipo /<vertical>/produccion/pre-facturacion:
// el moduleKey "real" es el ÚLTIMO segmento (pre-facturacion), no el padre
// (produccion). Si la URL tiene 3+ segmentos y el último es conocido,
// devolvemos el último. Si no, caemos al segundo segmento (comportamiento
// histórico para /vertical/clientes, /vertical/proyectos, etc.).
function moduleKeyFromPath(pathname: string): string {
  const parts = pathname.replace(/^\/+|\/+$/g, "").split("/");
  if (parts.length < 2) return "";
  if (parts.length >= 3 && parts[parts.length - 1]) {
    return parts[parts.length - 1];
  }
  return parts[1] || "";
}

// TEST-17 bis B — Mapa estático para slugs que no están en CORE_MODULES
// (no aparecen en navigationLabelMap del tenant-config) pero merecen un
// label legible. Lo usa fallbackLabelFromSlug antes de "capitalizar".
const STATIC_LABELS: Record<string, string> = {
  "pre-facturacion": "Pre-facturación",
  produccion: "Producción",
  agenda: "Agenda",
  "agenda-hoy": "Agenda hoy",
  calendario: "Calendario",
  reportes: "Reportes",
  workflows: "Workflows",
  "ajustes-cuenta": "Mi cuenta",
  "ajustes-campos": "Campos personalizados",
  integraciones: "Integraciones",
};

function fallbackLabelFromSlug(slug: string): string {
  if (!slug) return "Inicio";
  if (STATIC_LABELS[slug]) {
    const s = STATIC_LABELS[slug];
    return s.length > MAX_LABEL ? s.slice(0, MAX_LABEL - 1) + "…" : s;
  }
  const pretty = slug.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return pretty.length > MAX_LABEL ? pretty.slice(0, MAX_LABEL - 1) + "…" : pretty;
}

// TEST-13 C — Resuelve el label visible de una tab usando el
// navigationLabelMap del tenant-config (donde "actividades" = "Trabajos"
// y "actividades-catalogo" = "Actividades"). Si la URL no corresponde a
// un módulo, o si todavía no se ha cargado el map, cae al título
// derivado del slug. Así las solapas se llaman como las entradas del
// Menú Principal y no aparecen labels desincronizados.
function labelFromPath(pathname: string, navigationLabelMap: Record<string, string>): string {
  const slug = moduleKeyFromPath(pathname);
  if (!slug) return "Inicio";
  const fromMap = navigationLabelMap[slug];
  if (fromMap) {
    return fromMap.length > MAX_LABEL ? fromMap.slice(0, MAX_LABEL - 1) + "…" : fromMap;
  }
  return fallbackLabelFromSlug(slug);
}

function loadTabs(): Tab[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey());
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((t): t is Tab => typeof t?.href === "string" && typeof t?.label === "string");
  } catch {
    return [];
  }
}

function saveTabs(tabs: Tab[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(), JSON.stringify(tabs));
  } catch { /* localStorage lleno o bloqueado: tabs vivirán solo durante esta navegación */ }
}

export default function TabBar() {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const [tabs, setTabs] = useState<Tab[]>([]);
  // TEST-13 C — Map de navigationLabel por moduleKey, leído del config
  // del tenant. Asegura que la solapa de "/actividades" sea "Trabajos" y
  // la de "/actividades-catalogo" sea "Actividades" (no derivados del slug).
  const [navigationLabelMap, setNavigationLabelMap] = useState<Record<string, string>>({});

  // Cargar tabs guardadas al montar.
  useEffect(() => {
    setTabs(loadTabs());
  }, []);

  // Cargar el navigationLabelMap del tenant-config (una sola vez por
  // sesión; el config cambia raramente y el fallback por slug es seguro).
  useEffect(() => {
    let cancelled = false;
    async function loadConfig() {
      if (typeof window === "undefined") return;
      try {
        const params = new URLSearchParams(window.location.search);
        const tenant = params.get("tenant") || "";
        const sectorPack = params.get("sectorPack") || "";
        const qs: string[] = [];
        if (tenant) qs.push("tenant=" + encodeURIComponent(tenant));
        if (sectorPack) qs.push("sectorPack=" + encodeURIComponent(sectorPack));
        const url = "/api/runtime/tenant-config" + (qs.length ? "?" + qs.join("&") : "");
        const r = await fetch(url, { cache: "no-store" });
        const d = await r.json();
        if (cancelled) return;
        if (r.ok && d.ok) {
          const map = (d.config?.navigationLabelMap || {}) as Record<string, string>;
          setNavigationLabelMap(map);
        }
      } catch { /* fallback al slug */ }
    }
    loadConfig();
    return () => { cancelled = true; };
  }, []);

  // Cada vez que cambia la URL, asegurar que la tab existe.
  useEffect(() => {
    if (!pathname) return;
    setTabs((prev) => {
      const exists = prev.some((t) => t.href === pathname);
      if (exists) return prev;
      const newTab: Tab = { href: pathname, label: labelFromPath(pathname, navigationLabelMap) };
      const next = [...prev, newTab];
      saveTabs(next);
      return next;
    });
  }, [pathname, navigationLabelMap]);

  // Cuando el navigationLabelMap llega (asíncrono), recalcular los
  // labels de las tabs ya abiertas para que dejen de mostrar el slug
  // crudo (p.ej. "Actividades Catalogo" → "Actividades", "Actividades"
  // del moduleKey actividades → "Trabajos").
  useEffect(() => {
    if (Object.keys(navigationLabelMap).length === 0) return;
    setTabs((prev) => {
      let changed = false;
      const next = prev.map((t) => {
        const fresh = labelFromPath(t.href, navigationLabelMap);
        if (fresh !== t.label) { changed = true; return { ...t, label: fresh }; }
        return t;
      });
      if (changed) saveTabs(next);
      return changed ? next : prev;
    });
  }, [navigationLabelMap]);

  const closeTab = useCallback((href: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.href === href);
      if (idx < 0) return prev;
      const next = prev.filter((t) => t.href !== href);
      saveTabs(next);
      // Si cerramos la tab activa, navegar a otra.
      if (pathname === href) {
        const target = next[idx] || next[idx - 1] || next[0];
        if (target) {
          router.push(target.href);
        } else {
          // No quedan tabs: ir al raíz del vertical (primer segmento de la URL).
          const root = "/" + (pathname.replace(/^\/+/, "").split("/")[0] || "");
          router.push(root);
        }
      }
      return next;
    });
  }, [pathname, router]);

  // Si no hay tabs visibles, no renderizar nada.
  if (tabs.length === 0) return null;

  return (
    <div
      role="tablist"
      aria-label="Pestañas abiertas"
      style={{
        display: "flex",
        gap: 2,
        padding: "0 12px",
        background: "#ffffff",
        borderBottom: "1px solid #e5e7eb",
        overflowX: "auto",
        scrollbarWidth: "thin",
      }}
    >
      {tabs.map((t) => {
        const active = pathname === t.href;
        // TEST-17 — Icono del moduleKey, igual al de la sidebar.
        const moduleKey = moduleKeyFromPath(t.href);
        const icon = iconForModule(moduleKey);
        return (
          <Link
            key={t.href}
            href={t.href}
            role="tab"
            aria-selected={active}
            title={t.label}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "7px 10px 7px 12px",
              borderTop: active ? "2px solid #1d4ed8" : "2px solid transparent",
              borderLeft: "1px solid transparent",
              borderRight: "1px solid transparent",
              borderBottom: active ? "1px solid #ffffff" : "1px solid transparent",
              marginBottom: -1,
              background: active ? "#ffffff" : "#f8fafc",
              color: active ? "#0f172a" : "#475569",
              fontSize: 12,
              fontWeight: active ? 700 : 500,
              textDecoration: "none",
              whiteSpace: "nowrap",
              cursor: "pointer",
            }}
          >
            <span aria-hidden="true" style={{ fontSize: 13, lineHeight: 1 }}>{icon}</span>
            <span>{t.label}</span>
            <button
              type="button"
              onClick={(e) => closeTab(t.href, e)}
              title={"Cerrar " + t.label}
              aria-label={"Cerrar " + t.label}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 16,
                height: 16,
                borderRadius: 4,
                background: "transparent",
                border: "none",
                color: "#94a3b8",
                cursor: "pointer",
                fontSize: 13,
                lineHeight: 1,
                padding: 0,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#e2e8f0"; e.currentTarget.style.color = "#dc2626"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#94a3b8"; }}
            >
              ×
            </button>
          </Link>
        );
      })}
    </div>
  );
}
