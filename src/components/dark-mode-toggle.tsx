"use client";

import { useEffect, useState } from "react";

/**
 * Toggle de dark mode (H5-UX-01).
 *
 * Persistencia en localStorage. Aplica `data-theme="dark"` al
 * documentElement. Las páginas pueden leer `var(--bg)` / `var(--fg)`
 * etc. del CSS root y dark sobreescribe.
 *
 * Si nunca eligió, respeta `prefers-color-scheme: dark` del sistema.
 */
type Theme = "light" | "dark";

function getInitial(): Theme {
  if (typeof window === "undefined") return "light";
  const saved = window.localStorage.getItem("prontara-theme") as Theme | null;
  if (saved === "light" || saved === "dark") return saved;
  if (window.matchMedia("(prefers-color-scheme: dark)").matches) return "dark";
  return "light";
}

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export default function DarkModeToggle() {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const t = getInitial();
    setTheme(t);
    applyTheme(t);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    applyTheme(theme);
    try { window.localStorage.setItem("prontara-theme", theme); } catch { /* ignore */ }
  }, [theme, mounted]);

  if (!mounted) return null;

  return (
    <button
      type="button"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      title={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      style={{
        border: "1px solid var(--border, #e5e7eb)",
        background: "var(--bg-secondary, #ffffff)",
        color: "var(--fg, #0f172a)",
        borderRadius: 6,
        padding: "4px 10px",
        fontSize: 13,
        cursor: "pointer",
        fontWeight: 600,
      }}
    >
      {theme === "dark" ? "☀ Claro" : "☾ Oscuro"}
    </button>
  );
}
