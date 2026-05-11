"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import TenantShell from "@/components/erp/tenant-shell";
import HomeDashboard from "@/components/erp/home-dashboard";

/**
 * Home del tenant (H12-D — rediseñado según mockup limpio).
 *
 * Esta página resuelve el estado de sesión vía /api/runtime/dashboard:
 *   - loading → spinner mínimo
 *   - unauth (401/4xx) → landing pública con CTA
 *   - error → caja roja con mensaje
 *   - ready → renderiza <TenantShell><HomeDashboard /></TenantShell>
 *
 * Toda la lógica de KPIs, accesos rápidos, pendientes, notificaciones,
 * actividad reciente y agenda vive ahora en HomeDashboard, que llama a
 * /api/runtime/dashboard-sectorial (ampliado en H12-A) y a las endpoints
 * existentes de session/notifications.
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

export default function HomePage() {
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "error"; message: string }
    | { kind: "unauth" }
    | { kind: "ready"; data: DashboardResponse }
  >({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      let res: Response;
      try {
        res = await fetch("/api/runtime/dashboard", { cache: "no-store" });
      } catch (err) {
        if (!cancelled) {
          setState({ kind: "error", message: err instanceof Error ? err.message : "Error de red." });
        }
        return;
      }

      // 4xx/5xx → asumir no autenticado y mostrar la landing pública.
      if (!res.ok) {
        if (!cancelled) setState({ kind: "unauth" });
        return;
      }

      let json: DashboardResponse;
      try {
        json = (await res.json()) as DashboardResponse;
      } catch {
        if (!cancelled) setState({ kind: "unauth" });
        return;
      }

      if (!json.ok) {
        if (!cancelled) setState({ kind: "error", message: json.error || "Error cargando dashboard." });
        return;
      }
      if (!cancelled) setState({ kind: "ready", data: json });
    }
    load();
    return () => { cancelled = true; };
  }, []);

  if (state.kind === "loading") {
    return (
      <main style={{ padding: 48, fontFamily: "system-ui, -apple-system, sans-serif", color: "#64748b" }}>
        Cargando tu panel…
      </main>
    );
  }

  if (state.kind === "unauth") {
    return (
      <main
        style={{
          padding: 48,
          fontFamily: "system-ui, -apple-system, sans-serif",
          background: "#f5f7fb",
          minHeight: "100vh",
        }}
      >
        <div
          style={{
            maxWidth: 720,
            margin: "60px auto",
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: 16,
            padding: 36,
            color: "#0f172a",
            textAlign: "center",
          }}
        >
          <h1 style={{ margin: "0 0 12px 0", fontSize: 26, fontWeight: 800 }}>Bienvenido a Prontara</h1>
          <p style={{ margin: "0 0 24px 0", color: "#64748b", fontSize: 14 }}>
            Inicia sesión para acceder al panel de tu empresa.
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
            <Link
              href="/acceso"
              style={{
                background: ACCENT_DEFAULT,
                color: "#ffffff",
                padding: "10px 24px",
                borderRadius: 8,
                textDecoration: "none",
                fontWeight: 700,
                fontSize: 14,
              }}
            >
              Iniciar sesión
            </Link>
            <Link
              href="/alta"
              style={{
                background: "#ffffff",
                color: ACCENT_DEFAULT,
                padding: "10px 24px",
                borderRadius: 8,
                textDecoration: "none",
                fontWeight: 700,
                fontSize: 14,
                border: "1px solid " + ACCENT_DEFAULT,
              }}
            >
              Crear cuenta
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (state.kind === "error") {
    return (
      <main style={{ padding: 48, fontFamily: "system-ui, -apple-system, sans-serif", background: "#f5f7fb", minHeight: "100vh" }}>
        <div
          style={{
            maxWidth: 640,
            margin: "40px auto",
            background: "#fff1f2",
            border: "1px solid #fecdd3",
            borderRadius: 16,
            padding: 24,
            color: "#9f1239",
          }}
        >
          <h2 style={{ marginTop: 0 }}>No hemos podido cargar tu panel</h2>
          <p style={{ margin: 0 }}>{state.message}</p>
        </div>
      </main>
    );
  }

  const accent = state.data.tenant?.accentColor || ACCENT_DEFAULT;

  return (
    <TenantShell>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <HomeDashboard accent={accent} />
      </div>
    </TenantShell>
  );
}
