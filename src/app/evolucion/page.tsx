"use client";

import { useEffect, useMemo, useState } from "react";

type EvolutionStatus = {
  ok: boolean;
  tenantId: string;
  clientId: string;
  slug: string;
  current: {
    displayName: string;
    shortName: string;
    labels: Record<string, string>;
    modules: Array<{
      moduleKey: string;
      enabled: boolean;
      label: string;
      navigationLabel: string;
      emptyState: string;
    }>;
    branding: {
      displayName: string;
      shortName: string;
      tone: string;
      accentColor: string;
      logoHint: string;
    };
    dashboardPriorities: Array<{
      key: string;
      label: string;
      description: string;
      order: number;
    }>;
    landingRules: Array<{
      key: string;
      label: string;
      description: string;
      instruction: string;
    }>;
    wrapper?: {
      appName: string;
      installableName: string;
      executableName: string;
      desktopCaption: string;
      iconHint: string;
      windowTitle: string;
    };
  };
  history: Array<{
    id: string;
    actionType: string;
    summary: string;
    createdAt: string;
    createdBy: string;
    rollbackSafe: boolean;
  }>;
  rollbackCandidates: Array<{
    id: string;
    summary: string;
  }>;
};

function readTenantFromBrowser() {
  if (typeof window === "undefined") {
    return "";
  }
  return String(new URLSearchParams(window.location.search).get("tenant") || "").trim();
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("es-ES");
}

export default function EvolucionPage() {
  const [status, setStatus] = useState<EvolutionStatus | null>(null);
  const [busy, setBusy] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [brandingForm, setBrandingForm] = useState({
    displayName: "",
    shortName: "",
    accentColor: "",
    logoHint: "",
    tone: "professional",
  });

  const [moduleToAdd, setModuleToAdd] = useState("crm");
  const [moduleToDisable, setModuleToDisable] = useState("crm");
  const [labelModuleKey, setLabelModuleKey] = useState("clientes");
  const [labelValue, setLabelValue] = useState("");
  const [dashboardKeys, setDashboardKeys] = useState("clientes,pipeline,proyectos,facturas,actividad");
  const [landingInstruction, setLandingInstruction] = useState("Llevar a comprar o empezar el alta online.");
  const [wrapperAppName, setWrapperAppName] = useState("");
  const [rollbackEntryId, setRollbackEntryId] = useState("");

  async function load() {
    setBusy(true);
    setError("");

    try {
      const tenant = readTenantFromBrowser();
      const response = await fetch(
        "/api/runtime/evolution-status" + (tenant ? "?tenant=" + encodeURIComponent(tenant) : ""),
        { cache: "no-store" }
      );
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "No se pudo cargar evolución.");
      }

      const nextStatus = data.status as EvolutionStatus;
      setStatus(nextStatus);

      setBrandingForm({
        displayName: nextStatus.current.branding.displayName || "",
        shortName: nextStatus.current.branding.shortName || "",
        accentColor: nextStatus.current.branding.accentColor || "",
        logoHint: nextStatus.current.branding.logoHint || "",
        tone: nextStatus.current.branding.tone || "professional",
      });

      setWrapperAppName(nextStatus.current.wrapper?.appName || nextStatus.current.displayName || "");
      setRollbackEntryId(nextStatus.rollbackCandidates[0]?.id || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar evolución.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const enabledModules = useMemo(
    () => (status?.current.modules || []).filter((item) => item.enabled),
    [status]
  );

  const allModuleKeys = useMemo(
    () =>
      Array.from(
        new Set((status?.current.modules || []).map((item) => item.moduleKey).concat([
          "clientes",
          "crm",
          "proyectos",
          "presupuestos",
          "facturacion",
          "documentos",
          "ajustes",
          "asistente",
        ]))
      ),
    [status]
  );

  async function applyAction(actionType: string, payload: Record<string, unknown>) {
    setActionBusy(true);
    setError("");
    setMessage("");

    try {
      const tenant = readTenantFromBrowser();
      const response = await fetch(
        "/api/runtime/evolution-apply" + (tenant ? "?tenant=" + encodeURIComponent(tenant) : ""),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            mode: "apply",
            actionType,
            payload,
            createdBy: "owner",
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "No se pudo aplicar el cambio.");
      }

      setMessage("Cambio aplicado correctamente.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo aplicar el cambio.");
    } finally {
      setActionBusy(false);
    }
  }

  async function rollback() {
    if (!rollbackEntryId) {
      setError("Selecciona una entrada para rollback.");
      return;
    }

    setActionBusy(true);
    setError("");
    setMessage("");

    try {
      const tenant = readTenantFromBrowser();
      const response = await fetch(
        "/api/runtime/evolution-apply" + (tenant ? "?tenant=" + encodeURIComponent(tenant) : ""),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            mode: "rollback",
            entryId: rollbackEntryId,
            createdBy: "owner",
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "No se pudo hacer rollback.");
      }

      setMessage("Rollback aplicado correctamente.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo hacer rollback.");
    } finally {
      setActionBusy(false);
    }
  }

  return (
    <main
      style={{
        padding: 24,
        display: "grid",
        gap: 24,
        fontFamily: "Arial, sans-serif",
        background: "#f8fafc",
      }}
    >
      <section
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 16,
          background: "#ffffff",
          padding: 20,
        }}
      >
        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>
          Fase 6
        </div>
        <h1 style={{ marginTop: 0, marginBottom: 10, fontSize: 30 }}>
          Evolución del producto
        </h1>
        <p style={{ margin: 0, color: "#4b5563", maxWidth: 940 }}>
          Aquí la evolución ya se trata como parte normal de Prontara: cambios reales,
          historial real, rollback más seguro y una interfaz entendible para operar sin tocar a mano.
        </p>
      </section>

      {busy ? (
        <section
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 16,
            background: "#ffffff",
            padding: 20,
          }}
        >
          Cargando evolución...
        </section>
      ) : null}

      {status ? (
        <>
          <section
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 16,
            }}
          >
            <article style={{ border: "1px solid #e5e7eb", borderRadius: 16, background: "#ffffff", padding: 16 }}>
              <strong>Display name</strong>
              <div>{status.current.displayName}</div>
            </article>
            <article style={{ border: "1px solid #e5e7eb", borderRadius: 16, background: "#ffffff", padding: 16 }}>
              <strong>Módulos activos</strong>
              <div>{enabledModules.length}</div>
            </article>
            <article style={{ border: "1px solid #e5e7eb", borderRadius: 16, background: "#ffffff", padding: 16 }}>
              <strong>Historial</strong>
              <div>{status.history.length}</div>
            </article>
            <article style={{ border: "1px solid #e5e7eb", borderRadius: 16, background: "#ffffff", padding: 16 }}>
              <strong>Rollback seguro</strong>
              <div>{status.rollbackCandidates.length} entradas</div>
            </article>
          </section>

          <section
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(320px, 1fr) minmax(320px, 1fr)",
              gap: 24,
              alignItems: "start",
            }}
          >
            <article
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 16,
                background: "#ffffff",
                padding: 20,
                display: "grid",
                gap: 14,
              }}
            >
              <h2 style={{ marginTop: 0 }}>Añadir o quitar módulo</h2>

              <div style={{ display: "grid", gap: 8 }}>
                <label>Añadir módulo</label>
                <select
                  value={moduleToAdd}
                  onChange={(event) => setModuleToAdd(event.target.value)}
                  style={{ padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 10 }}
                >
                  {allModuleKeys.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={() => applyAction("add_module", { moduleKey: moduleToAdd })}
                  style={{
                    border: "none",
                    borderRadius: 10,
                    background: "#111827",
                    color: "#ffffff",
                    padding: "10px 14px",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  Añadir módulo
                </button>
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                <label>Quitar módulo</label>
                <select
                  value={moduleToDisable}
                  onChange={(event) => setModuleToDisable(event.target.value)}
                  style={{ padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 10 }}
                >
                  {enabledModules.map((item) => (
                    <option key={item.moduleKey} value={item.moduleKey}>{item.moduleKey}</option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={() => applyAction("remove_module", { moduleKey: moduleToDisable })}
                  style={{
                    border: "1px solid #ef4444",
                    borderRadius: 10,
                    background: "#ffffff",
                    color: "#b91c1c",
                    padding: "10px 14px",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  Quitar módulo
                </button>
              </div>
            </article>

            <article
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 16,
                background: "#ffffff",
                padding: 20,
                display: "grid",
                gap: 14,
              }}
            >
              <h2 style={{ marginTop: 0 }}>Branding y labels</h2>

              <label style={{ display: "grid", gap: 6 }}>
                <span>Display name</span>
                <input
                  value={brandingForm.displayName}
                  onChange={(event) => setBrandingForm((current) => ({ ...current, displayName: event.target.value }))}
                  style={{ padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 10 }}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span>Short name</span>
                <input
                  value={brandingForm.shortName}
                  onChange={(event) => setBrandingForm((current) => ({ ...current, shortName: event.target.value }))}
                  style={{ padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 10 }}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span>Accent color</span>
                <input
                  value={brandingForm.accentColor}
                  onChange={(event) => setBrandingForm((current) => ({ ...current, accentColor: event.target.value }))}
                  style={{ padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 10 }}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span>Logo hint</span>
                <input
                  value={brandingForm.logoHint}
                  onChange={(event) => setBrandingForm((current) => ({ ...current, logoHint: event.target.value }))}
                  style={{ padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 10 }}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span>Tono</span>
                <select
                  value={brandingForm.tone}
                  onChange={(event) => setBrandingForm((current) => ({ ...current, tone: event.target.value }))}
                  style={{ padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 10 }}
                >
                  <option value="simple">simple</option>
                  <option value="professional">professional</option>
                  <option value="sectorial">sectorial</option>
                </select>
              </label>

              <button
                type="button"
                disabled={actionBusy}
                onClick={() =>
                  applyAction("change_branding", {
                    brandingPatch: {
                      displayName: brandingForm.displayName,
                      shortName: brandingForm.shortName,
                      accentColor: brandingForm.accentColor,
                      logoHint: brandingForm.logoHint,
                      tone: brandingForm.tone as "simple" | "professional" | "sectorial",
                    },
                  })
                }
                style={{
                  border: "none",
                  borderRadius: 10,
                  background: "#111827",
                  color: "#ffffff",
                  padding: "10px 14px",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                Guardar branding
              </button>

              <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                <label>Módulo a renombrar</label>
                <select
                  value={labelModuleKey}
                  onChange={(event) => setLabelModuleKey(event.target.value)}
                  style={{ padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 10 }}
                >
                  {allModuleKeys.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
                <input
                  value={labelValue}
                  onChange={(event) => setLabelValue(event.target.value)}
                  placeholder="Nuevo label"
                  style={{ padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 10 }}
                />
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={() =>
                    applyAction("change_labels", {
                      labelPatch: {
                        [labelModuleKey]: labelValue,
                      },
                    })
                  }
                  style={{
                    border: "1px solid #d1d5db",
                    borderRadius: 10,
                    background: "#ffffff",
                    color: "#111827",
                    padding: "10px 14px",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  Cambiar label
                </button>
              </div>
            </article>
          </section>

          <section
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(320px, 1fr) minmax(320px, 1fr)",
              gap: 24,
              alignItems: "start",
            }}
          >
            <article
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 16,
                background: "#ffffff",
                padding: 20,
                display: "grid",
                gap: 14,
              }}
            >
              <h2 style={{ marginTop: 0 }}>Dashboard, landing y demo data</h2>

              <label style={{ display: "grid", gap: 6 }}>
                <span>Prioridades del dashboard</span>
                <input
                  value={dashboardKeys}
                  onChange={(event) => setDashboardKeys(event.target.value)}
                  placeholder="clientes,pipeline,proyectos,facturas,actividad"
                  style={{ padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 10 }}
                />
              </label>

              <button
                type="button"
                disabled={actionBusy}
                onClick={() =>
                  applyAction("update_dashboard", {
                    dashboardPriorityKeys: dashboardKeys
                      .split(",")
                      .map((item) => item.trim())
                      .filter(Boolean),
                  })
                }
                style={{
                  border: "none",
                  borderRadius: 10,
                  background: "#111827",
                  color: "#ffffff",
                  padding: "10px 14px",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                Actualizar dashboard
              </button>

              <label style={{ display: "grid", gap: 6 }}>
                <span>Regla principal de landing</span>
                <textarea
                  value={landingInstruction}
                  onChange={(event) => setLandingInstruction(event.target.value)}
                  rows={4}
                  style={{ padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 10 }}
                />
              </label>

              <button
                type="button"
                disabled={actionBusy}
                onClick={() =>
                  applyAction("update_landing", {
                    landingRulePatches: [
                      {
                        key: "cta-claro",
                        instruction: landingInstruction,
                        label: "CTA claro",
                        description: "Acción principal definida desde evolución.",
                      },
                    ],
                  })
                }
                style={{
                  border: "1px solid #d1d5db",
                  borderRadius: 10,
                  background: "#ffffff",
                  color: "#111827",
                  padding: "10px 14px",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                Actualizar landing
              </button>

              <button
                type="button"
                disabled={actionBusy}
                onClick={() => applyAction("regenerate_demo_data", {})}
                style={{
                  border: "1px solid #d1d5db",
                  borderRadius: 10,
                  background: "#ffffff",
                  color: "#111827",
                  padding: "10px 14px",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                Regenerar demo data
              </button>
            </article>

            <article
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 16,
                background: "#ffffff",
                padding: 20,
                display: "grid",
                gap: 14,
              }}
            >
              <h2 style={{ marginTop: 0 }}>Wrapper e instalable</h2>

              <label style={{ display: "grid", gap: 6 }}>
                <span>Nombre de app</span>
                <input
                  value={wrapperAppName}
                  onChange={(event) => setWrapperAppName(event.target.value)}
                  style={{ padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 10 }}
                />
              </label>

              <button
                type="button"
                disabled={actionBusy}
                onClick={() =>
                  applyAction("regenerate_wrapper", {
                    wrapperPatch: {
                      appName: wrapperAppName,
                      installableName: wrapperAppName.replace(/\s+/g, "") + "-Setup",
                      executableName: wrapperAppName.replace(/\s+/g, "") + ".exe",
                      desktopCaption: wrapperAppName + " Desktop",
                      iconHint: brandingForm.logoHint,
                      windowTitle: wrapperAppName,
                    },
                  })
                }
                style={{
                  border: "none",
                  borderRadius: 10,
                  background: "#111827",
                  color: "#ffffff",
                  padding: "10px 14px",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                Regenerar wrapper
              </button>

              <div
                style={{
                  border: "1px solid #eef2f7",
                  borderRadius: 12,
                  background: "#fafafa",
                  padding: 14,
                  display: "grid",
                  gap: 6,
                }}
              >
                <div><strong>App:</strong> {status.current.wrapper?.appName || "-"}</div>
                <div><strong>Setup:</strong> {status.current.wrapper?.installableName || "-"}</div>
                <div><strong>Exe:</strong> {status.current.wrapper?.executableName || "-"}</div>
                <div><strong>Desktop:</strong> {status.current.wrapper?.desktopCaption || "-"}</div>
              </div>
            </article>
          </section>

          <section
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(320px, 1.2fr) minmax(320px, 0.8fr)",
              gap: 24,
              alignItems: "start",
            }}
          >
            <article
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 16,
                background: "#ffffff",
                padding: 20,
                display: "grid",
                gap: 12,
              }}
            >
              <h2 style={{ marginTop: 0 }}>Historial de cambios</h2>

              {status.history.length === 0 ? (
                <div style={{ color: "#6b7280" }}>Todavía no hay cambios aplicados.</div>
              ) : (
                <div style={{ display: "grid", gap: 12 }}>
                  {status.history.map((item) => (
                    <article
                      key={item.id}
                      style={{
                        border: "1px solid #eef2f7",
                        borderRadius: 12,
                        background: "#fafafa",
                        padding: 14,
                        display: "grid",
                        gap: 6,
                      }}
                    >
                      <div style={{ fontWeight: 700 }}>{item.summary}</div>
                      <div style={{ color: "#4b5563", fontSize: 14 }}>
                        Tipo: {item.actionType}
                      </div>
                      <div style={{ color: "#4b5563", fontSize: 14 }}>
                        Fecha: {formatDate(item.createdAt)}
                      </div>
                      <div style={{ color: "#4b5563", fontSize: 14 }}>
                        Autor: {item.createdBy}
                      </div>
                      <div style={{ color: item.rollbackSafe ? "#166534" : "#92400e", fontSize: 14 }}>
                        Rollback seguro: {item.rollbackSafe ? "Sí" : "No"}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </article>

            <article
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 16,
                background: "#ffffff",
                padding: 20,
                display: "grid",
                gap: 12,
              }}
            >
              <h2 style={{ marginTop: 0 }}>Rollback seguro</h2>

              <label style={{ display: "grid", gap: 6 }}>
                <span>Entrada a revertir</span>
                <select
                  value={rollbackEntryId}
                  onChange={(event) => setRollbackEntryId(event.target.value)}
                  style={{ padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 10 }}
                >
                  <option value="">Selecciona...</option>
                  {status.rollbackCandidates.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.summary}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                disabled={actionBusy}
                onClick={rollback}
                style={{
                  border: "1px solid #ef4444",
                  borderRadius: 10,
                  background: "#ffffff",
                  color: "#b91c1c",
                  padding: "10px 14px",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                Aplicar rollback
              </button>

              <div style={{ color: "#4b5563", fontSize: 14 }}>
                El rollback restaura el snapshot anterior guardado en historial y deja trazabilidad nueva del cambio.
              </div>
            </article>
          </section>
        </>
      ) : null}

      {message ? (
        <section
          style={{
            border: "1px solid #bbf7d0",
            background: "#f0fdf4",
            color: "#166534",
            borderRadius: 12,
            padding: 12,
          }}
        >
          {message}
        </section>
      ) : null}

      {error ? (
        <section
          style={{
            border: "1px solid #fecaca",
            background: "#fef2f2",
            color: "#991b1b",
            borderRadius: 12,
            padding: 12,
          }}
        >
          {error}
        </section>
      ) : null}
    </main>
  );
}