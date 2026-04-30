"use client";

import { useEffect, useMemo, useState } from "react";

type ValidationCheck = {
  key: string;
  label: string;
  passed: boolean;
  detail: string;
};

type Row = {
  clientId: string;
  tenantId: string;
  slug: string;
  displayName: string;
  accessUrl: string;
  loginUrl: string;
  firstUseUrl: string;
  deliveryUrl: string;
  openUrl: string;
  onboardingState: "ready" | "partial" | "missing";
  wrapper: {
    appName: string;
    installableName: string;
    executableName: string;
    windowTitle: string;
    desktopCaption: string;
    iconHint: string;
    deliveryMode: string;
  };
  branding: {
    displayName: string;
    shortName: string;
    accentColor: string;
    tone: string;
    logoHint: string;
  };
  demoValidation: {
    passed: number;
    total: number;
    checks: ValidationCheck[];
  };
  deliveryState: "ready" | "partial" | "missing" | "error";
  updatedAt: string | null;
};

type Snapshot = {
  generatedAt: string;
  summary: {
    total: number;
    ready: number;
    partial: number;
    missing: number;
    error: number;
    onboardingReady: number;
    onboardingPartial: number;
    onboardingMissing: number;
    demoValidated: number;
    wrappersReady: number;
  };
  rows: Row[];
};

function formatDate(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return "-";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleString("es-ES");
}

function toneStyle(tone: "ok" | "warn" | "danger" | "info") {
  if (tone === "ok") return { bg: "#dcfce7", color: "#166534", border: "#bbf7d0" };
  if (tone === "warn") return { bg: "#fef3c7", color: "#92400e", border: "#fde68a" };
  if (tone === "danger") return { bg: "#fee2e2", color: "#991b1b", border: "#fecaca" };
  return { bg: "#dbeafe", color: "#1d4ed8", border: "#bfdbfe" };
}

function Badge({ text, tone }: { text: string; tone: "ok" | "warn" | "danger" | "info" }) {
  const style = toneStyle(tone);
  return (
    <span
      style={{
        background: style.bg,
        color: style.color,
        border: "1px solid " + style.border,
        borderRadius: 999,
        padding: "4px 8px",
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      {text}
    </span>
  );
}

function stateTone(value: string): "ok" | "warn" | "danger" | "info" {
  const normalized = String(value || "").trim().toLowerCase();
  if (["ready"].includes(normalized)) return "ok";
  if (["partial", "missing"].includes(normalized)) return "warn";
  if (["error"].includes(normalized)) return "danger";
  return "info";
}

export default function FactoryDeliveriesPage() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [deliveryFilter, setDeliveryFilter] = useState("all");
  const [onboardingFilter, setOnboardingFilter] = useState("all");

  async function load() {
    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/factory/entregas", { cache: "no-store" });
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "No se pudo cargar el panel interno de entregas.");
      }

      setSnapshot(data.snapshot || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el panel interno de entregas.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filteredRows = useMemo(() => {
    const rows = snapshot?.rows || [];
    const q = query.trim().toLowerCase();

    return rows.filter((row) => {
      if (deliveryFilter !== "all" && row.deliveryState !== deliveryFilter) {
        return false;
      }

      if (onboardingFilter !== "all" && row.onboardingState !== onboardingFilter) {
        return false;
      }

      if (!q) {
        return true;
      }

      const haystack = [
        row.clientId,
        row.tenantId,
        row.slug,
        row.displayName,
        row.branding.displayName,
        row.wrapper.installableName,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [snapshot, query, deliveryFilter, onboardingFilter]);

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
          borderRadius: 18,
          background: "#ffffff",
          padding: 24,
          display: "grid",
          gap: 12,
        }}
      >
        <a
          href="/factory"
          style={{
            textDecoration: "none",
            color: "#4b5563",
            fontSize: 14,
            width: "fit-content",
          }}
        >
          ← Volver a Factory
        </a>

        <div style={{ fontSize: 12, color: "#6b7280" }}>Entregas internas</div>
        <h1 style={{ margin: 0, fontSize: 34 }}>Panel interno de entregas</h1>
        <p style={{ margin: 0, color: "#4b5563", maxWidth: 980 }}>
          Revisión final de URL de acceso, onboarding, wrapper, instalable, branding final,
          validación demo y estado completo de entrega por cliente.
        </p>

        {snapshot ? (
          <div style={{ fontSize: 12, color: "#6b7280" }}>
            Última generación del panel: {formatDate(snapshot.generatedAt)}
          </div>
        ) : null}
      </section>

      {busy ? (
        <section
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 18,
            background: "#ffffff",
            padding: 24,
          }}
        >
          Cargando panel de entregas...
        </section>
      ) : null}

      {snapshot ? (
        <>
          <section
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 16,
            }}
          >
            <article style={{ border: "1px solid #e5e7eb", borderRadius: 16, background: "#ffffff", padding: 18 }}>
              <div style={{ fontSize: 13, color: "#6b7280" }}>Total clientes</div>
              <div style={{ fontSize: 34, fontWeight: 700 }}>{snapshot.summary.total}</div>
            </article>
            <article style={{ border: "1px solid #e5e7eb", borderRadius: 16, background: "#ffffff", padding: 18 }}>
              <div style={{ fontSize: 13, color: "#6b7280" }}>Entregas ready</div>
              <div style={{ fontSize: 34, fontWeight: 700 }}>{snapshot.summary.ready}</div>
            </article>
            <article style={{ border: "1px solid #e5e7eb", borderRadius: 16, background: "#ffffff", padding: 18 }}>
              <div style={{ fontSize: 13, color: "#6b7280" }}>Entregas parciales</div>
              <div style={{ fontSize: 34, fontWeight: 700 }}>{snapshot.summary.partial}</div>
            </article>
            <article style={{ border: "1px solid #e5e7eb", borderRadius: 16, background: "#ffffff", padding: 18 }}>
              <div style={{ fontSize: 13, color: "#6b7280" }}>Entregas missing</div>
              <div style={{ fontSize: 34, fontWeight: 700 }}>{snapshot.summary.missing}</div>
            </article>
            <article style={{ border: "1px solid #e5e7eb", borderRadius: 16, background: "#ffffff", padding: 18 }}>
              <div style={{ fontSize: 13, color: "#6b7280" }}>Onboarding ready</div>
              <div style={{ fontSize: 34, fontWeight: 700 }}>{snapshot.summary.onboardingReady}</div>
            </article>
            <article style={{ border: "1px solid #e5e7eb", borderRadius: 16, background: "#ffffff", padding: 18 }}>
              <div style={{ fontSize: 13, color: "#6b7280" }}>Demo validada</div>
              <div style={{ fontSize: 34, fontWeight: 700 }}>{snapshot.summary.demoValidated}</div>
            </article>
          </section>

          <section
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 16,
            }}
          >
            <article style={{ border: "1px solid #e5e7eb", borderRadius: 16, background: "#ffffff", padding: 18 }}>
              <div style={{ fontSize: 13, color: "#6b7280" }}>Wrappers listos</div>
              <div style={{ fontSize: 34, fontWeight: 700 }}>{snapshot.summary.wrappersReady}</div>
            </article>
            <article style={{ border: "1px solid #e5e7eb", borderRadius: 16, background: "#ffffff", padding: 18 }}>
              <div style={{ fontSize: 13, color: "#6b7280" }}>Onboarding parcial</div>
              <div style={{ fontSize: 34, fontWeight: 700 }}>{snapshot.summary.onboardingPartial}</div>
            </article>
            <article style={{ border: "1px solid #e5e7eb", borderRadius: 16, background: "#ffffff", padding: 18 }}>
              <div style={{ fontSize: 13, color: "#6b7280" }}>Onboarding missing</div>
              <div style={{ fontSize: 34, fontWeight: 700 }}>{snapshot.summary.onboardingMissing}</div>
            </article>
            <article style={{ border: "1px solid #e5e7eb", borderRadius: 16, background: "#ffffff", padding: 18 }}>
              <div style={{ fontSize: 13, color: "#6b7280" }}>Entregas error</div>
              <div style={{ fontSize: 34, fontWeight: 700 }}>{snapshot.summary.error}</div>
            </article>
          </section>

          <section
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 18,
              background: "#ffffff",
              padding: 22,
              display: "grid",
              gap: 16,
            }}
          >
            <div style={{ display: "grid", gap: 6 }}>
              <h2 style={{ margin: 0 }}>Listado de entregas</h2>
              <p style={{ margin: 0, color: "#4b5563" }}>
                Filtra por estado de entrega y onboarding para revisar qué cliente está listo y cuál necesita cierre final.
              </p>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(260px, 1fr) minmax(180px, 0.6fr) minmax(180px, 0.6fr)",
                gap: 12,
              }}
            >
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por cliente, tenant, slug o instalable"
                style={{
                  padding: "10px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: 10,
                }}
              />

              <select
                value={deliveryFilter}
                onChange={(event) => setDeliveryFilter(event.target.value)}
                style={{
                  padding: "10px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: 10,
                }}
              >
                <option value="all">Todos los estados de entrega</option>
                <option value="ready">Ready</option>
                <option value="partial">Partial</option>
                <option value="missing">Missing</option>
                <option value="error">Error</option>
              </select>

              <select
                value={onboardingFilter}
                onChange={(event) => setOnboardingFilter(event.target.value)}
                style={{
                  padding: "10px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: 10,
                }}
              >
                <option value="all">Todo el onboarding</option>
                <option value="ready">Ready</option>
                <option value="partial">Partial</option>
                <option value="missing">Missing</option>
              </select>
            </div>

            <div style={{ color: "#6b7280", fontSize: 13 }}>
              Mostrando {filteredRows.length} de {snapshot.rows.length} entregas.
            </div>

            {filteredRows.length === 0 ? (
              <div style={{ color: "#6b7280" }}>No hay clientes que coincidan con el filtro.</div>
            ) : (
              <div style={{ display: "grid", gap: 14 }}>
                {filteredRows.map((row) => (
                  <article
                    key={row.clientId}
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 16,
                      background: "#fafafa",
                      padding: 16,
                      display: "grid",
                      gap: 14,
                    }}
                  >
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "minmax(220px, 1fr) minmax(260px, 1fr) minmax(340px, 1fr)",
                        gap: 16,
                        alignItems: "start",
                      }}
                    >
                      <div style={{ display: "grid", gap: 6 }}>
                        <strong style={{ fontSize: 18 }}>{row.displayName}</strong>
                        <div style={{ color: "#4b5563", fontSize: 14 }}>Client ID: {row.clientId}</div>
                        <div style={{ color: "#4b5563", fontSize: 14 }}>Tenant: {row.tenantId}</div>
                        <div style={{ color: "#4b5563", fontSize: 14 }}>Slug: {row.slug}</div>
                        <div style={{ color: "#6b7280", fontSize: 12 }}>Actualizado: {formatDate(row.updatedAt)}</div>
                      </div>

                      <div style={{ display: "grid", gap: 10 }}>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <Badge text={"Entrega: " + row.deliveryState} tone={stateTone(row.deliveryState)} />
                          <Badge text={"Onboarding: " + row.onboardingState} tone={stateTone(row.onboardingState)} />
                          <Badge
                            text={"Demo: " + row.demoValidation.passed + "/" + row.demoValidation.total}
                            tone={row.demoValidation.passed === row.demoValidation.total && row.demoValidation.total > 0 ? "ok" : "warn"}
                          />
                        </div>

                        <div
                          style={{
                            border: "1px solid #eef2f7",
                            borderRadius: 12,
                            background: "#ffffff",
                            padding: 12,
                            display: "grid",
                            gap: 8,
                          }}
                        >
                          <strong>URLs</strong>
                          <a href={row.accessUrl} target="_blank" rel="noreferrer" style={{ color: "#111827", fontSize: 14 }}>
                            URL de acceso
                          </a>
                          <a href={row.firstUseUrl} target="_blank" rel="noreferrer" style={{ color: "#111827", fontSize: 14 }}>
                            Primer acceso
                          </a>
                          <a href={row.deliveryUrl} target="_blank" rel="noreferrer" style={{ color: "#111827", fontSize: 14 }}>
                            Entrega
                          </a>
                          <a href={row.openUrl} target="_blank" rel="noreferrer" style={{ color: "#111827", fontSize: 14 }}>
                            Abrir ERP
                          </a>
                        </div>
                      </div>

                      <div style={{ display: "grid", gap: 10 }}>
                        <div
                          style={{
                            border: "1px solid #eef2f7",
                            borderRadius: 12,
                            background: "#ffffff",
                            padding: 12,
                            display: "grid",
                            gap: 8,
                          }}
                        >
                          <strong>Wrapper e instalable</strong>
                          <div style={{ fontSize: 14 }}>App: {row.wrapper.appName}</div>
                          <div style={{ fontSize: 14 }}>Instalable: {row.wrapper.installableName}</div>
                          <div style={{ fontSize: 14 }}>Ejecutable: {row.wrapper.executableName}</div>
                          <div style={{ fontSize: 14 }}>Window title: {row.wrapper.windowTitle}</div>
                          <div style={{ fontSize: 14 }}>Desktop caption: {row.wrapper.desktopCaption}</div>
                          <div style={{ fontSize: 14 }}>Delivery mode: {row.wrapper.deliveryMode}</div>
                          <div style={{ fontSize: 14 }}>Icon hint: {row.wrapper.iconHint || "-"}</div>
                        </div>

                        <div
                          style={{
                            border: "1px solid #eef2f7",
                            borderRadius: 12,
                            background: "#ffffff",
                            padding: 12,
                            display: "grid",
                            gap: 8,
                          }}
                        >
                          <strong>Branding final</strong>
                          <div style={{ fontSize: 14 }}>Display name: {row.branding.displayName}</div>
                          <div style={{ fontSize: 14 }}>Short name: {row.branding.shortName}</div>
                          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: 14 }}>
                            <span>Accent color:</span>
                            <span
                              style={{
                                width: 14,
                                height: 14,
                                borderRadius: 999,
                                background: row.branding.accentColor,
                                display: "inline-block",
                                border: "1px solid #d1d5db",
                              }}
                            />
                            <span>{row.branding.accentColor}</span>
                          </div>
                          <div style={{ fontSize: 14 }}>Tone: {row.branding.tone}</div>
                          <div style={{ fontSize: 14 }}>Logo hint: {row.branding.logoHint || "-"}</div>
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        border: "1px solid #eef2f7",
                        borderRadius: 12,
                        background: "#ffffff",
                        padding: 12,
                        display: "grid",
                        gap: 8,
                      }}
                    >
                      <strong>Validación demo</strong>
                      {row.demoValidation.checks.length === 0 ? (
                        <div style={{ color: "#6b7280", fontSize: 13 }}>Sin checks de validación.</div>
                      ) : (
                        <div style={{ display: "grid", gap: 8 }}>
                          {row.demoValidation.checks.map((check) => (
                            <article
                              key={check.key}
                              style={{
                                border: "1px solid " + (check.passed ? "#bbf7d0" : "#fde68a"),
                                borderRadius: 10,
                                background: check.passed ? "#f0fdf4" : "#fffbeb",
                                padding: 10,
                                display: "grid",
                                gap: 4,
                              }}
                            >
                              <strong style={{ color: check.passed ? "#166534" : "#92400e" }}>
                                {check.label} · {check.passed ? "OK" : "Pendiente"}
                              </strong>
                              <div style={{ fontSize: 13, color: "#4b5563" }}>{check.detail}</div>
                            </article>
                          ))}
                        </div>
                      )}
                    </div>

                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <a
                        href={"/factory/client/" + encodeURIComponent(row.clientId)}
                        style={{
                          textDecoration: "none",
                          borderRadius: 10,
                          padding: "10px 12px",
                          background: "#111827",
                          color: "#ffffff",
                          fontWeight: 700,
                        }}
                      >
                        Ver ficha
                      </a>

                      <a
                        href={row.deliveryUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          textDecoration: "none",
                          borderRadius: 10,
                          padding: "10px 12px",
                          border: "1px solid #d1d5db",
                          background: "#ffffff",
                          color: "#111827",
                          fontWeight: 700,
                        }}
                      >
                        Abrir entrega
                      </a>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}

      {error ? (
        <section
          style={{
            border: "1px solid #fecaca",
            borderRadius: 12,
            background: "#fef2f2",
            color: "#991b1b",
            padding: 12,
          }}
        >
          {error}
        </section>
      ) : null}
    </main>
  );
}