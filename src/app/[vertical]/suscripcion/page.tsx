"use client";

import { useEffect, useState } from "react";

type BillingOverview = {
  tenantId: string;
  clientId: string;
  slug: string;
  displayName: string;
  catalog: Array<{
    key: string;
    label: string;
    description: string;
    commercialTag: string;
    setupFeeCents: number;
    supportMonthlyCentsPerUser: number | null;
    includedUsers: number | null;
    includedClientes: number | null;
    includedFacturasMes: number | null;
    includedDocumentos: number | null;
    featured?: boolean;
  }>;
  subscription: {
    currentPlanKey: string;
    status: string;
    autoRenew: boolean;
    seats: number;
    renewsAt: string;
    cancelAt?: string;
    billingEmail: string;
    setupFeePaidCents: number;
    concurrentUsersBilled: number;
    supportActive: boolean;
    invoices: Array<{
      id: string;
      concept: string;
      amountCents: number;
      currency: string;
      status: string;
      createdAt: string;
      planKey: string;
    }>;
  };
  currentPlan: {
    key: string;
    label: string;
    description: string;
    commercialTag: string;
    setupFeeCents: number;
    supportMonthlyCentsPerUser: number | null;
    includedUsers: number | null;
    includedClientes: number | null;
    includedFacturasMes: number | null;
    includedDocumentos: number | null;
  };
  usage: {
    users: number;
    clientes: number;
    facturasMes: number;
    documentos: number;
  };
  limits: Array<{
    key: string;
    label: string;
    used: number;
    limit: number | null;
    withinLimit: boolean;
  }>;
  accessAllowed: boolean;
  checkoutConfigured: boolean;
  canUpgrade: boolean;
  canDowngrade: boolean;
  canCancel: boolean;
};

function readTenantFromBrowser() {
  if (typeof window === "undefined") return "";
  return String(new URLSearchParams(window.location.search).get("tenant") || "").trim();
}

function readCheckoutSessionId() {
  if (typeof window === "undefined") return "";
  return String(new URLSearchParams(window.location.search).get("session_id") || "").trim();
}

function readCheckoutStatus() {
  if (typeof window === "undefined") return "";
  return String(new URLSearchParams(window.location.search).get("checkout") || "").trim();
}

function formatMoney(cents: number) {
  return (cents / 100).toLocaleString("es-ES", {
    style: "currency",
    currency: "EUR",
  });
}

function formatDate(value?: string) {
  const raw = String(value || "").trim();
  if (!raw) return "-";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleString("es-ES");
}

function LimitValue({ value }: { value: number | null }) {
  return <>{value == null ? "Sin límite" : value}</>;
}

type TrialState = {
  plan: "trial";
  status: "active" | "expired";
  trialDays: number;
  daysRemaining: number;
  expiresAt: string;
};

export default function SuscripcionPage() {
  const [overview, setOverview] = useState<BillingOverview | null>(null);
  const [trial, setTrial] = useState<TrialState | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");

  async function load() {
    setBusy(true);
    setError("");

    try {
      const tenant = readTenantFromBrowser();
      const response = await fetch(
        "/api/runtime/billing" + (tenant ? "?tenant=" + encodeURIComponent(tenant) : ""),
        { cache: "no-store" }
      );
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "No se pudo cargar la suscripción.");
      }

      setOverview(data.overview || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar la suscripción.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const checkoutStatus = readCheckoutStatus();
      const sessionId = readCheckoutSessionId();
      const tenant = readTenantFromBrowser();

      if (checkoutStatus === "success" && sessionId) {
        try {
          const response = await fetch(
            "/api/runtime/billing-confirm" + (tenant ? "?tenant=" + encodeURIComponent(tenant) : ""),
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                sessionId,
              }),
            }
          );

          const data = await response.json();

          if (!cancelled) {
            if (response.ok && data.ok) {
              setActionMessage("Compra confirmada correctamente. Tu suscripción ya está activa.");
            } else {
              setError(data.error || "No se pudo confirmar la compra.");
            }
          }
        } catch (err) {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : "No se pudo confirmar la compra.");
          }
        }
      }

      await load();

      // Cargar estado del trial en paralelo (no bloqueante).
      try {
        const tenantForTrial = readTenantFromBrowser();
        const trialRes = await fetch(
          "/api/runtime/trial" + (tenantForTrial ? "?tenant=" + encodeURIComponent(tenantForTrial) : ""),
          { cache: "no-store" }
        );
        const trialData = await trialRes.json();
        if (!cancelled && trialRes.ok && trialData.ok && trialData.trial) {
          setTrial(trialData.trial as TrialState);
        }
      } catch {
        // Sin trial: se muestra la página normal.
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, []);

  async function openCheckout(planKey: string) {
    setActionMessage("");
    setError("");

    try {
      const tenant = readTenantFromBrowser();
      const response = await fetch(
        "/api/runtime/billing-checkout" + (tenant ? "?tenant=" + encodeURIComponent(tenant) : ""),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ planKey }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "No se pudo abrir el checkout.");
      }

      window.location.href = data.checkout.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo abrir el checkout.");
    }
  }

  async function changePlan(planKey: string) {
    setActionMessage("");
    setError("");

    try {
      const tenant = readTenantFromBrowser();
      const response = await fetch(
        "/api/runtime/billing-change-plan" + (tenant ? "?tenant=" + encodeURIComponent(tenant) : ""),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ planKey }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "No se pudo preparar el cambio de plan.");
      }

      window.location.href = data.checkout.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo preparar el cambio de plan.");
    }
  }

  async function cancelSubscription() {
    setActionMessage("");
    setError("");

    try {
      const tenant = readTenantFromBrowser();
      const response = await fetch(
        "/api/runtime/billing-cancel" + (tenant ? "?tenant=" + encodeURIComponent(tenant) : ""),
        {
          method: "POST",
        }
      );

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "No se pudo cancelar la suscripción.");
      }

      setOverview(data.overview || null);
      setActionMessage("Cancelación programada correctamente.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cancelar la suscripción.");
    }
  }

  const currentPlanKey = overview?.subscription.currentPlanKey || "";

  // Banner destacado del trial: contador + CTA activar.
  const trialBanner = (() => {
    if (!trial || trial.plan !== "trial") return null;
    const days = Math.max(0, trial.daysRemaining);
    const expired = trial.status === "expired" || days <= 0;
    const tone = expired || days <= 3 ? "danger" : days <= 7 ? "warn" : "info";
    const toneStyles =
      tone === "danger"
        ? { bg: "#fef2f2", fg: "#991b1b", border: "#fecaca", button: "#991b1b" }
        : tone === "warn"
          ? { bg: "#fffbeb", fg: "#92400e", border: "#fde68a", button: "#92400e" }
          : { bg: "#eff6ff", fg: "#1d4ed8", border: "#bfdbfe", button: "#1d4ed8" };
    const headline = expired
      ? "Tu periodo de prueba ha terminado"
      : days === 0
        ? "Tu periodo de prueba termina hoy"
        : days === 1
          ? "Te queda 1 día de prueba"
          : "Te quedan " + days + " días de prueba";
    const expiresReadable = (() => {
      const d = new Date(trial.expiresAt);
      return Number.isFinite(d.getTime()) ? d.toLocaleDateString("es-ES") : "";
    })();

    return (
      <section
        style={{
          background: toneStyles.bg,
          border: "1px solid " + toneStyles.border,
          borderRadius: 16,
          padding: 24,
          display: "grid",
          gridTemplateColumns: "auto 1fr auto",
          gap: 20,
          alignItems: "center",
        }}
      >
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 16,
            background: toneStyles.fg,
            color: "#ffffff",
            display: "grid",
            placeItems: "center",
            fontSize: 28,
            fontWeight: 700,
          }}
        >
          {expired ? "!" : days}
        </div>
        <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: toneStyles.fg }}>{headline}</div>
          <div style={{ color: toneStyles.fg, fontSize: 14 }}>
            {expired
              ? "Activa una suscripción para recuperar el acceso completo al ERP."
              : "Tu prueba vence el " + expiresReadable + ". Activa una suscripción abajo para seguir sin interrupciones."}
          </div>
          <div style={{ color: toneStyles.fg, fontSize: 12, opacity: 0.8 }}>
            Periodo de prueba configurado: {trial.trialDays} días.
          </div>
        </div>
        <a
          href="#planes-disponibles"
          style={{
            background: toneStyles.button,
            color: "#ffffff",
            padding: "12px 20px",
            borderRadius: 999,
            textDecoration: "none",
            fontWeight: 700,
            whiteSpace: "nowrap",
          }}
        >
          Activar suscripción
        </a>
      </section>
    );
  })();

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
      {trialBanner}
      <section
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 16,
          background: "#ffffff",
          padding: 20,
        }}
      >
        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>
          Monetización SaaS real
        </div>
        <h1 style={{ marginTop: 0, marginBottom: 10, fontSize: 30 }}>
          Planes, compra y suscripción
        </h1>
        <p style={{ margin: 0, color: "#4b5563" }}>
          Aquí puedes revisar tu plan actual, límites reales, acceso permitido y abrir
          compra o cambio de plan con checkout real.
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
          Cargando suscripción...
        </section>
      ) : null}

      {overview ? (
        <>
          <section
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(320px, 0.95fr) minmax(420px, 1.05fr)",
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
                gap: 10,
              }}
            >
              <h2 style={{ marginTop: 0, marginBottom: 8 }}>Suscripción actual</h2>
              <div><strong>Tenant:</strong> {overview.slug}</div>
              <div><strong>Plan:</strong> {overview.currentPlan.label}</div>
              <div><strong>Estado:</strong> {overview.subscription.status}</div>
              <div><strong>Acceso permitido:</strong> {overview.accessAllowed ? "Sí" : "No"}</div>
              <div><strong>Auto renovación:</strong> {overview.subscription.autoRenew ? "Sí" : "No"}</div>
              <div><strong>Billing email:</strong> {overview.subscription.billingEmail}</div>
              <div><strong>Renueva:</strong> {formatDate(overview.subscription.renewsAt)}</div>
              <div><strong>Cancelación:</strong> {formatDate(overview.subscription.cancelAt)}</div>
              <div><strong>Checkout configurado:</strong> {overview.checkoutConfigured ? "Sí" : "No"}</div>
            </article>

            <article
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 16,
                background: "#ffffff",
                padding: 20,
                display: "grid",
                gap: 10,
              }}
            >
              <h2 style={{ marginTop: 0, marginBottom: 8 }}>Uso y límites reales</h2>
              {overview.limits.map((item) => (
                <div
                  key={item.key}
                  style={{
                    border: "1px solid #eef2f7",
                    borderRadius: 12,
                    background: item.withinLimit ? "#fafafa" : "#fef2f2",
                    padding: 12,
                  }}
                >
                  <div style={{ fontWeight: 700 }}>{item.label}</div>
                  <div style={{ color: "#4b5563", marginTop: 4 }}>
                    Usado: {item.used} · Límite: <LimitValue value={item.limit} />
                  </div>
                </div>
              ))}
            </article>
          </section>

          <section
            id="planes-disponibles"
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 16,
              background: "#ffffff",
              padding: 20,
              scrollMarginTop: 20,
            }}
          >
            <h2 style={{ marginTop: 0, marginBottom: 16 }}>Planes comerciales</h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: 16,
              }}
            >
              {overview.catalog.map((plan) => {
                const isCurrent = currentPlanKey === plan.key;

                return (
                  <article
                    key={plan.key}
                    style={{
                      border: isCurrent ? "2px solid #111827" : "1px solid #e5e7eb",
                      borderRadius: 14,
                      background: "#ffffff",
                      padding: 16,
                      display: "grid",
                      gap: 10,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                      <strong>{plan.label}</strong>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          background: plan.featured ? "#dbeafe" : "#f3f4f6",
                          color: plan.featured ? "#1d4ed8" : "#374151",
                          borderRadius: 999,
                          padding: "4px 8px",
                        }}
                      >
                        {plan.commercialTag}
                      </span>
                    </div>

                    <div style={{ fontSize: 28, fontWeight: 700 }}>
                      {plan.setupFeeCents === 0
                        ? "Gratis"
                        : formatMoney(plan.setupFeeCents)}
                      {plan.setupFeeCents > 0 ? (
                        <span style={{ fontSize: 13, color: "#6b7280", fontWeight: 500 }}>
                          {" "}· pago único
                        </span>
                      ) : null}
                    </div>

                    {plan.supportMonthlyCentsPerUser != null && plan.supportMonthlyCentsPerUser > 0 ? (
                      <div style={{ fontSize: 13, color: "#374151" }}>
                        + soporte: <strong>{formatMoney(plan.supportMonthlyCentsPerUser)}</strong> por usuario concurrente al mes
                      </div>
                    ) : null}

                    <div style={{ color: "#4b5563", minHeight: 40 }}>
                      {plan.description}
                    </div>

                    <div style={{ fontSize: 14, color: "#374151", display: "grid", gap: 4 }}>
                      <div>Usuarios: <LimitValue value={plan.includedUsers} /></div>
                      <div>Clientes: <LimitValue value={plan.includedClientes} /></div>
                      <div>Facturas/mes: <LimitValue value={plan.includedFacturasMes} /></div>
                      <div>Documentos: <LimitValue value={plan.includedDocumentos} /></div>
                    </div>

                    {isCurrent ? (
                      <div
                        style={{
                          marginTop: 8,
                          fontWeight: 700,
                          color: "#166534",
                        }}
                      >
                        Plan actual
                      </div>
                    ) : plan.key === "trial" ? null : currentPlanKey === "trial" ? (
                      <button
                        type="button"
                        onClick={() => openCheckout(plan.key)}
                        style={{
                          marginTop: 8,
                          border: "none",
                          borderRadius: 10,
                          background: "#111827",
                          color: "#ffffff",
                          padding: "10px 14px",
                          cursor: "pointer",
                          fontWeight: 700,
                        }}
                      >
                        Comprar este plan
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => changePlan(plan.key)}
                        style={{
                          marginTop: 8,
                          border: "none",
                          borderRadius: 10,
                          background: "#111827",
                          color: "#ffffff",
                          padding: "10px 14px",
                          cursor: "pointer",
                          fontWeight: 700,
                        }}
                      >
                        Cambiar a este plan
                      </button>
                    )}
                  </article>
                );
              })}
            </div>

            {overview.canCancel ? (
              <div style={{ marginTop: 20 }}>
                <button
                  type="button"
                  onClick={cancelSubscription}
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
                  Programar cancelación
                </button>
              </div>
            ) : null}
          </section>

          <section
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 16,
              background: "#ffffff",
              padding: 20,
            }}
          >
            <h2 style={{ marginTop: 0, marginBottom: 16 }}>Facturación SaaS</h2>

            {overview.subscription.invoices.length === 0 ? (
              <div style={{ color: "#6b7280" }}>Todavía no hay facturas SaaS emitidas.</div>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {overview.subscription.invoices.map((invoice) => (
                  <article
                    key={invoice.id}
                    style={{
                      border: "1px solid #eef2f7",
                      borderRadius: 12,
                      background: "#fafafa",
                      padding: 14,
                      display: "grid",
                      gap: 4,
                    }}
                  >
                    <div><strong>{invoice.concept}</strong></div>
                    <div>Plan: {invoice.planKey}</div>
                    <div>Importe: {formatMoney(invoice.amountCents)}</div>
                    <div>Estado: {invoice.status}</div>
                    <div>Fecha: {formatDate(invoice.createdAt)}</div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}

      {actionMessage ? (
        <section
          style={{
            border: "1px solid #bbf7d0",
            background: "#f0fdf4",
            color: "#166534",
            borderRadius: 12,
            padding: 12,
          }}
        >
          {actionMessage}
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