"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Atajos de teclado universales (H10-G).
 *
 * - Ctrl+K / Cmd+K: ir a /buscar
 * - ?: abrir panel de ayuda
 * - Esc: cerrar paneles abiertos (lo gestionan los propios paneles)
 * - g+d: ir a / (dashboard)
 * - g+c: ir a /clientes
 * - g+f: ir a /facturacion
 * - g+p: ir a /proyectos
 * - g+t: ir a /tareas
 * - g+a: ir a /agenda-hoy
 * - g+i: ir a /importar
 *
 * No interfiere con inputs/textareas. Se desactiva si el foco está
 * en un campo editable.
 */

const NAV_MAP: Record<string, string> = {
  d: "/",
  c: "/clientes",
  f: "/facturacion",
  p: "/proyectos",
  t: "/tareas",
  a: "/agenda-hoy",
  i: "/importar",
};

function isEditable(el: EventTarget | null): boolean {
  if (!el || !(el instanceof HTMLElement)) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  if (el.isContentEditable) return true;
  return false;
}

export default function KeyboardShortcuts() {
  const router = useRouter();

  useEffect(() => {
    let waitingForG = false;
    let gTimer: ReturnType<typeof setTimeout> | null = null;

    function clearG() {
      waitingForG = false;
      if (gTimer) { clearTimeout(gTimer); gTimer = null; }
    }

    function onKey(e: KeyboardEvent) {
      if (isEditable(e.target)) return;

      // Cmd+K / Ctrl+K -> buscador
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        router.push("/buscar");
        return;
      }

      // ? -> ayuda
      if (e.key === "?" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("prontara-help-open"));
        return;
      }

      // g + letra -> navegación
      if (waitingForG) {
        const target = NAV_MAP[e.key.toLowerCase()];
        if (target) {
          e.preventDefault();
          router.push(target);
        }
        clearG();
        return;
      }
      if (e.key.toLowerCase() === "g" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        waitingForG = true;
        gTimer = setTimeout(clearG, 1500);
        return;
      }
    }

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (gTimer) clearTimeout(gTimer);
    };
  }, [router]);

  return null;
}
