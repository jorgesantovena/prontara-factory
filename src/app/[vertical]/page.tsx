"use client";

import { useEffect, useState } from "react";
import TenantShell from "@/components/erp/tenant-shell";
import HomeDashboard from "@/components/erp/home-dashboard";

/**
 * Home del runtime de un vertical (H13-A).
 *
 * URL: /softwarefactory, /dental, /veterinaria, /colegio…
 *
 * El layout padre (`[vertical]/layout.tsx`) ya validó que el slug es
 * conocido y que el tenant del usuario pertenece a este vertical, así
 * que aquí solo cargamos los datos básicos del tenant para pasarle el
 * accent color al dashboard.
 *
 * (La home anterior estaba en `src/app/page.tsx` — ahora esa ruta es
 * para la Factory landing.)
 */
type DashboardResponse = {
  ok: boolean;
  error?: string;
  tenant?: {
    clientId: string;
    slug: string | null;
    displayName: string | null;
    shortName: string | null;
    accentColor: string | null;
  };
};

const ACCENT_DEFAULT = "#1d4ed8";

export default function VerticalHomePage() {
  const [accent, setAccent] = useState(ACCENT_DEFAULT);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const r = await fetch("/api/runtime/dashboard", { cache: "no-store" });
        if (!r.ok) return;
        const data = (await r.json()) as DashboardResponse;
        if (cancelled) return;
        if (data?.ok && data.tenant?.accentColor) setAccent(data.tenant.accentColor);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error de red.");
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <TenantShell>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        {error ? (
          <div style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", borderRadius: 8, padding: 12, fontSize: 13, marginBottom: 12 }}>
            {error}
          </div>
        ) : null}
        <HomeDashboard accent={accent} />
      </div>
    </TenantShell>
  );
}
