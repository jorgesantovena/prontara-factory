"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * Switcher Tabla / Kanban / Calendario / Cards (H11-L) +
 * selector densidad cómoda/normal/compacta (H11-M).
 *
 * Cada elección persiste en localStorage por usuario+módulo.
 * El switcher solo es informativo: enlaza a las páginas existentes
 * (/vista-kanban, /calendario, /<modulo>) que ya tenemos.
 */
export type ViewMode = "tabla" | "kanban" | "calendario" | "cards";
export type Density = "compacta" | "normal" | "comoda";

const VIEW_LABELS: Record<ViewMode, { label: string; icon: string; href: (m: string) => string }> = {
  tabla: { label: "Tabla", icon: "≣", href: (m) => "/" + m },
  kanban: { label: "Kanban", icon: "▥", href: (m) => "/vista-kanban?moduleKey=" + m },
  calendario: { label: "Calendario", icon: "▦", href: () => "/calendario" },
  cards: { label: "Cards", icon: "▢", href: (m) => "/" + m + "?view=cards" },
};

const DENSITY_LABELS: Record<Density, string> = {
  compacta: "Compacta",
  normal: "Normal",
  comoda: "Cómoda",
};

function readLS(key: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  try {
    return window.localStorage.getItem(key) || fallback;
  } catch { return fallback; }
}
function writeLS(key: string, val: string): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(key, val); } catch { /* ignore */ }
}

export default function ModuleViewSwitcher({
  moduleKey,
  current = "tabla",
  showDensity = true,
}: {
  moduleKey: string;
  current?: ViewMode;
  showDensity?: boolean;
}) {
  const [density, setDensity] = useState<Density>("normal");

  useEffect(() => {
    setDensity((readLS("prontara-density-" + moduleKey, "normal") as Density));
  }, [moduleKey]);

  function changeDensity(d: Density) {
    setDensity(d);
    writeLS("prontara-density-" + moduleKey, d);
    // Notifica al resto de la página por si quiere reaccionar
    window.dispatchEvent(new CustomEvent("prontara-density-change", { detail: { moduleKey, density: d } }));
  }

  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
      {/* View switcher */}
      <div style={{ display: "flex", gap: 4, padding: 4, background: "var(--bg-secondary, #f8fafc)", border: "1px solid var(--border, #e5e7eb)", borderRadius: 8 }}>
        {(Object.keys(VIEW_LABELS) as ViewMode[]).map((v) => {
          const isCurrent = v === current;
          return (
            <Link
              key={v}
              href={VIEW_LABELS[v].href(moduleKey)}
              style={{
                padding: "6px 12px",
                background: isCurrent ? "var(--bg-card, #ffffff)" : "transparent",
                border: isCurrent ? "1px solid var(--border, #d1d5db)" : "1px solid transparent",
                borderRadius: 6,
                color: isCurrent ? "var(--fg, #0f172a)" : "var(--fg-muted, #6b7280)",
                fontSize: 12,
                fontWeight: isCurrent ? 700 : 600,
                textDecoration: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span style={{ fontSize: 13 }}>{VIEW_LABELS[v].icon}</span>
              {VIEW_LABELS[v].label}
            </Link>
          );
        })}
      </div>

      {showDensity ? (
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <label style={{ fontSize: 11, color: "var(--fg-muted, #475569)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>Densidad:</label>
          <select
            value={density}
            onChange={(e) => changeDensity(e.target.value as Density)}
            style={{ padding: "5px 10px", border: "1px solid var(--border, #d1d5db)", borderRadius: 6, fontSize: 12, fontWeight: 600 }}
          >
            {(Object.keys(DENSITY_LABELS) as Density[]).map((d) => (
              <option key={d} value={d}>{DENSITY_LABELS[d]}</option>
            ))}
          </select>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Helper para que cualquier tabla aplique densidad sin reescribirla.
 */
export function densityPadding(density: Density): string {
  switch (density) {
    case "compacta": return "4px 8px";
    case "comoda": return "12px 14px";
    default: return "8px 10px";
  }
}
