"use client";

import { useEffect, useState } from "react";

/**
 * Marketplace de integraciones (H3-FUNC-05).
 */
type Provider = {
  id: string;
  name: string;
  description: string;
  configKeys: string[];
  requiresOAuth: boolean;
};

type Integration = {
  provider: string;
  enabled: boolean;
  lastSyncAt: string | null;
  hasConfig: boolean;
};

export default function IntegracionesPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [openConfig, setOpenConfig] = useState<string | null>(null);
  const [configValues, setConfigValues] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/runtime/integrations", { cache: "no-store" });
      const data = await r.json();
      if (r.ok && data.ok) {
        setProviders(data.providers || []);
        setIntegrations(data.integrations || []);
      } else setError(data.error || "Error.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function toggle(provider: string, enabled: boolean, config?: Record<string, string>) {
    setBusy(provider);
    setError("");
    try {
      const r = await fetch("/api/runtime/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, enabled, config: config || {} }),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        setError(data.error || "Error.");
        return;
      }
      await load();
    } finally {
      setBusy(null);
    }
  }

  function getStatus(providerId: string): Integration | undefined {
    return integrations.find((i) => i.provider === providerId);
  }

  return (
    <main style={{ maxWidth: 1080, margin: "0 auto", padding: 24, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, color: "#0f172a", margin: "0 0 8px 0" }}>Integraciones</h1>
      <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 20 }}>
        Conecta Prontara con tus herramientas externas. Activa, configura y desactiva cuando quieras.
      </p>

      {error ? <div style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 13 }}>{error}</div> : null}
      {loading ? <p>Cargando…</p> : null}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
        {providers.map((p) => {
          const status = getStatus(p.id);
          const enabled = status?.enabled || false;
          const isOpen = openConfig === p.id;
          return (
            <div key={p.id} style={{ border: "1px solid " + (enabled ? "#16a34a" : "#e5e7eb"), borderRadius: 12, padding: 16, background: enabled ? "#f0fdf4" : "#ffffff" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <strong style={{ fontSize: 15 }}>{p.name}</strong>
                  <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>{p.description}</div>
                </div>
                <span style={{
                  fontSize: 10,
                  padding: "2px 8px",
                  borderRadius: 4,
                  background: enabled ? "#16a34a" : "#94a3b8",
                  color: "#ffffff",
                  fontWeight: 700,
                  textTransform: "uppercase",
                }}>
                  {enabled ? "Activa" : "Inactiva"}
                </span>
              </div>

              {status?.lastSyncAt ? (
                <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 8 }}>
                  Última sync: {new Date(status.lastSyncAt).toLocaleString("es-ES")}
                </div>
              ) : null}

              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => toggle(p.id, !enabled)}
                  disabled={busy === p.id}
                  style={{
                    flex: 1,
                    border: "none",
                    background: enabled ? "#dc2626" : "#1d4ed8",
                    color: "#ffffff",
                    padding: "6px 12px",
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: busy === p.id ? "not-allowed" : "pointer",
                  }}
                >
                  {busy === p.id ? "..." : enabled ? "Desactivar" : "Activar"}
                </button>
                {p.configKeys.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setOpenConfig(isOpen ? null : p.id);
                      setConfigValues({});
                    }}
                    style={{ border: "1px solid #cbd5e1", background: "#ffffff", padding: "6px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                  >
                    {isOpen ? "Cerrar" : "Configurar"}
                  </button>
                ) : null}
                {p.requiresOAuth ? (
                  <span style={{ fontSize: 10, color: "#94a3b8", padding: "6px 8px" }}>OAuth (próximamente)</span>
                ) : null}
              </div>

              {isOpen ? (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #e5e7eb" }}>
                  {p.configKeys.map((k) => (
                    <div key={k} style={{ marginBottom: 6 }}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: "#475569", display: "block", marginBottom: 2 }}>{k}</label>
                      <input
                        type="password"
                        value={configValues[k] || ""}
                        onChange={(e) => setConfigValues({ ...configValues, [k]: e.target.value })}
                        placeholder={k === "apiKey" || k === "accessToken" ? "sk_..." : k === "webhookUrl" ? "https://..." : ""}
                        style={{
                          width: "100%",
                          padding: "5px 8px",
                          border: "1px solid #d1d5db",
                          borderRadius: 4,
                          fontSize: 12,
                          fontFamily: "inherit",
                          boxSizing: "border-box",
                        }}
                      />
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      toggle(p.id, true, configValues);
                      setOpenConfig(null);
                    }}
                    style={{ marginTop: 6, border: "none", background: "#16a34a", color: "#ffffff", padding: "6px 12px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer", width: "100%" }}
                  >
                    Guardar configuración
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </main>
  );
}
