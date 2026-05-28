"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

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

function labelFromPath(pathname: string): string {
  // /softwarefactory/clientes → "Clientes"
  // /softwarefactory/actividades-catalogo → "Actividades"
  // /softwarefactory → "Inicio"
  const parts = pathname.replace(/^\/+|\/+$/g, "").split("/");
  if (parts.length === 0 || (parts.length === 1 && !parts[0])) return "Inicio";
  if (parts.length === 1) return "Inicio";
  const last = parts[parts.length - 1];
  // Convertir kebab/snake a Título.
  const pretty = last.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return pretty.length > MAX_LABEL ? pretty.slice(0, MAX_LABEL - 1) + "…" : pretty;
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

  // Cargar tabs guardadas al montar.
  useEffect(() => {
    setTabs(loadTabs());
  }, []);

  // Cada vez que cambia la URL, asegurar que la tab existe.
  useEffect(() => {
    if (!pathname) return;
    setTabs((prev) => {
      const exists = prev.some((t) => t.href === pathname);
      if (exists) return prev;
      const newTab: Tab = { href: pathname, label: labelFromPath(pathname) };
      const next = [...prev, newTab];
      saveTabs(next);
      return next;
    });
  }, [pathname]);

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
