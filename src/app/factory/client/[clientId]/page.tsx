"use client";

import { useEffect, useMemo, useState } from "react";

type EvolutionItem = {
  id: string;
  actionType: string;
  summary: string;
  createdAt: string;
  createdBy: string;
  rollbackSafe: boolean;
};

type CommercialCheck = {
  key: string;
  label: string;
  passed: boolean;
  detail: string;
};

type Snapshot = {
  ok: boolean;
  clientId: string;
  tenantId: string;
  slug: string;
  displayName: string;
  purchase: {
    createdAt: string | null;
    source: string;
    email: string;
    companyName: string;
    plan: string;
    amount: string;
    currency: string;
    status: string;
  };
  assignedVertical: {
    businessType: string;
    sector: string;
    displayName: string;
  };
  tenant: {
    tenantId: string;
    slug: string;
    displayName: string;
  };
  subscription: {
    plan: string;
    status: "active" | "trial" | "cancelled";
    billingState: "ok" | "trial" | "cancelled" | "warning";
    updatedAt: string | null;
  };
  branding: {
    displayName: string;
    shortName: string;
    accentColor: string;
    tone: string;
    logoHint: string;
  };
  access: {
    accessUrl: string;
    loginUrl: string;
    firstUseUrl: string;
    deliveryUrl: string;
    openUrl: string;
  };
  runtime: {
    ready: boolean;
    businessType: string;
    sector: string;
    companySize: string;
    updatedAt: string | null;
  };
  provisioning: {
    state: "ready" | "pending" | "error";
    updatedAt: string | null;
    lastEventTitle: string;
  };
  evolution: {
    ready: boolean;
    history: EvolutionItem[];
  };
  wrapper: {
    appName: string;
    installableName: string;
    executableName: string;
    desktopCaption: string;
    windowTitle: string;
    iconHint: string;
    deliveryMode: string;
  };
  delivery: {
    accessUrl: string;
    loginUrl: string;
    firstUseUrl: string;
    deliveryUrl: string;
  };
  commercialValidation: {
    passed: number;
    total: number;
    checks: CommercialCheck[];
  };
  operational: {
    totalClientes: number;
    oportunidadesAbiertas: number;
    pipelineAbierto: number;
    proyectosActivos: number;
    presupuestosAbiertos: number;
    facturasPendientes: number;
    totalDocumentos: number;
  };
};

function formatDate(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "-";
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return raw;
  }

  return date.toLocaleString("es-ES");
}

function readClientIdFromPath() {
  if (typeof window === "undefined") {
    return "";
  }

  const pathParts = window.location.pathname.split("/").filter(Boolean);
  return decodeURIComponent(pathParts[pathParts.length - 1] || "");
}

function toneStyle(tone: "ok" | "warn" | "danger" | "info") {
  if (tone === "ok") {
    return { bg: "#dcfce7", color: "#166534", border: "#bbf7d0" };
  }
  if (tone === "warn") {
    return { bg: "#fef3c7", color: "#92400e", border: "#fde68a" };
  }
  if (tone === "danger") {
    return { bg: "#fee2e2", color: "#991b1b", border: "#fecaca" };
  }
  return { bg: "#dbeafe", color: "#1d4ed8", border: "#bfdbfe" };
}

function stateTone(value: string): "ok" | "warn" | "danger" | "info" {
  const normalized = String(value || "").trim().toLowerCase();

  if (["ready", "healthy", "ok", "active"].includes(normalized)) {
    return "ok";
  }
  if (["trial", "pending", "partial", "warning"].includes(normalized)) {
    return "warn";
  }
  if (["error", "corrupt", "cancelled", "canceled"].includes(normalized)) {
    return "danger";
  }
  return "info";
}

function StateBadge({ label, value }: { label: string; value: string }) {
  const tone = stateTone(value);
  const style = toneStyle(tone);

  return (
    <span
      style={{
        background: style.bg,
        color: style.color,
        border: "1px solid " + style.border,
        borderRadius: 999,
        padding: "4px 10px",
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      {label}: {value}
    </span>
  );
}

type ActionFeedback =
  | { kind: "idle" }
  | { kind: "busy"; action: string }
  | { kind: "success"; action: string; message: string }
  | { kind: "error"; action: string; message: string };

function formatMoney(value: number): string {
  return value.toLocaleString("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

type SeedFeedback =
  | { kind: "idle" }
  | { kind: "busy" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

type HardFeedback =
  | { kind: "idle" }
  | { kind: "busy" }
  | {
      kind: "success";
      message: string;
      temporaryPassword?: string;
      adminEmail?: string | null;
    }
  | { kind: "error"; message: string };

export default function FactoryClientDetailPage() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [actionFeedback, setActionFeedback] = useState<ActionFeedback>({ kind: "idle" });
  const [seedFeedback, setSeedFeedback] = useState<SeedFeedback>({ kind: "idle" });
  const [hardFeedback, setHardFeedback] = useState<HardFeedback>({ kind: "idle" });

  const clientId = useMemo(() => readClientIdFromPath(), []);

  async function runHardReprovision(
    options: { resetAdminPassword?: boolean; seedDemo?: "merge" | "replace" },
  ) {
    if (!clientId || !snapshot) return;
    const hints: string[] = [];
    if (options.resetAdminPassword) hints.push("regenerar password del admin");
    if (options.seedDemo) hints.push("sembrar demo data (" + options.seedDemo + ")");
    const hintText = hints.length > 0 ? " (" + hints.join(", ") + ")" : "";
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        "¿Ejecutar provisioning duro para " +
          snapshot.displayName +
          hintText +
          "? Se asegurará cuenta admin, trial y onboarding. Si marcaste reset de password, el admin actual perderá sus credenciales.",
      )
    ) {
      return;
    }

    setHardFeedback({ kind: "busy" });
    try {
      const res = await fetch("/api/factory/hard-provisioning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          resetAdminPassword: Boolean(options.resetAdminPassword),
          seedDemo: options.seedDemo,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "No se pudo ejecutar el provisioning duro.");
      }
      const r = data.result as {
        steps: Array<{ step: string; ok: boolean; detail: string }>;
        adminEmail?: string;
        temporaryPassword?: string | null;
        newState?: string;
      };
      const oks = r.steps.filter((s) => s.ok).length;
      setHardFeedback({
        kind: "success",
        message:
          "Provisioning duro completado. " +
          oks +
          "/" +
          r.steps.length +
          " pasos OK. Estado final: " +
          (r.newState || "desconocido") +
          ".",
        temporaryPassword: r.temporaryPassword || undefined,
        adminEmail: r.adminEmail,
      });
    } catch (err) {
      setHardFeedback({
        kind: "error",
        message: err instanceof Error ? err.message : "Error desconocido.",
      });
    }
  }

  async function runSeed(mode: "merge" | "replace") {
    if (!clientId || !snapshot) return;
    const message =
      mode === "replace"
        ? "¿Seguro? Esto SOBREESCRIBE los datos actuales de todos los módulos de " +
          snapshot.displayName +
          " con los datos de ejemplo del vertical."
        : "¿Añadir datos de ejemplo del vertical a " +
          snapshot.displayName +
          "? Solo se añaden registros que aún no existen.";
    if (typeof window !== "undefined" && !window.confirm(message)) return;

    setSeedFeedback({ kind: "busy" });
    try {
      const response = await fetch("/api/factory/demo-seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, mode }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "No se pudo sembrar demo data.");
      }
      const r = data.result as {
        totalInserted: number;
        totalSkipped: number;
        modulesProcessed: Array<{ moduleKey: string; insertedRows: number }>;
        notes: string[];
      };
      const modulesText =
        r.modulesProcessed.length === 0
          ? "ningún módulo procesado"
          : r.modulesProcessed
              .map((m) => m.moduleKey + ": +" + m.insertedRows)
              .join(", ");
      const notes = r.notes.length > 0 ? " " + r.notes.join(" ") : "";
      setSeedFeedback({
        kind: "success",
        message:
          "Demo data aplicada (" +
          mode +
          "). " +
          r.totalInserted +
          " filas añadidas, " +
          r.totalSkipped +
          " duplicadas omitidas. " +
          modulesText +
          "." +
          notes,
      });
    } catch (err) {
      setSeedFeedback({
        kind: "error",
        message: err instanceof Error ? err.message : "Error desconocido.",
      });
    }
  }

  async function runAction(
    action: "regenerate" | "suspend" | "reactivate" | "contact",
    confirmMessage?: string
  ) {
    if (!clientId) return;
    if (confirmMessage && typeof window !== "undefined") {
      if (!window.confirm(confirmMessage)) return;
    }

    setActionFeedback({ kind: "busy", action });

    try {
      const response = await fetch("/api/factory/client-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, clientId }),
      });
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "No se pudo ejecutar la acción.");
      }

      setActionFeedback({
        kind: "success",
        action,
        message: String(data.message || "Acción procesada."),
      });
    } catch (err) {
      setActionFeedback({
        kind: "error",
        action,
        message: err instanceof Error ? err.message : "Error ejecutando la acción.",
      });
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setBusy(true);
      setError("");

      try {
        if (!clientId) {
          throw new Error("No se pudo resolver el clientId desde la URL.");
        }

        const response = await fetch(
          "/api/factory/client-detail?clientId=" + encodeURIComponent(clientId),
          { cache: "no-store" }
        );
        const data = await response.json();

        if (!response.ok || !data.ok) {
          throw new Error(data.error || "No se pudo cargar la ficha del cliente.");
        }

        if (!cancelled) {
          setSnapshot(data.snapshot || null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "No se pudo cargar la ficha del cliente.");
        }
      } finally {
        if (!cancelled) {
          setBusy(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [clientId]);

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

        <div style={{ fontSize: 12, color: "#6b7280" }}>Ficha detallada de cliente</div>
        <h1 style={{ margin: 0, fontSize: 34 }}>
          {snapshot?.displayName || clientId || "Cliente"}
        </h1>
        <p style={{ margin: 0, color: "#4b5563", maxWidth: 960 }}>
          Vista interna completa de Factory con compra, vertical, tenant, suscripción, branding,
          acceso, runtime, evolución, wrapper, entrega y validación comercial.
        </p>
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
          Cargando ficha detallada...
        </section>
      ) : null}

      {snapshot ? (
        <>
          <section
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <StateBadge label="Suscripción" value={snapshot.subscription.status} />
            <StateBadge label="Billing" value={snapshot.subscription.billingState} />
            <StateBadge label="Provisioning" value={snapshot.provisioning.state} />
            <StateBadge label="Runtime" value={snapshot.runtime.ready ? "ready" : "pending"} />
            <StateBadge label="Evolución" value={snapshot.evolution.ready ? "ready" : "pending"} />
          </section>

          {/* Acciones operativas */}
          <section
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 18,
              background: "#ffffff",
              padding: 20,
              display: "grid",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 20 }}>Acciones</h2>
                <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
                  Las acciones se registran en modo seguro. La ejecución destructiva exige confirmación explícita.
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <ActionButton
                label="Regenerar"
                tone="primary"
                busy={actionFeedback.kind === "busy" && actionFeedback.action === "regenerate"}
                onClick={() =>
                  runAction(
                    "regenerate",
                    "¿Registrar solicitud de regeneración para " + snapshot.displayName + "?"
                  )
                }
              />
              {snapshot.subscription.status === "cancelled" ? (
                <ActionButton
                  label="Reactivar suscripción"
                  tone="primary"
                  busy={actionFeedback.kind === "busy" && actionFeedback.action === "reactivate"}
                  onClick={() =>
                    runAction(
                      "reactivate",
                      "¿Registrar solicitud de reactivación para " + snapshot.displayName + "?"
                    )
                  }
                />
              ) : (
                <ActionButton
                  label="Suspender"
                  tone="warning"
                  busy={actionFeedback.kind === "busy" && actionFeedback.action === "suspend"}
                  onClick={() =>
                    runAction(
                      "suspend",
                      "¿Registrar solicitud de suspensión para " + snapshot.displayName + "?"
                    )
                  }
                />
              )}
              {snapshot.purchase.email ? (
                <a
                  href={
                    "mailto:" +
                    encodeURIComponent(snapshot.purchase.email) +
                    "?subject=" +
                    encodeURIComponent("Prontara · " + snapshot.displayName)
                  }
                  onClick={() => runAction("contact")}
                  style={{
                    border: "1px solid #d1d5db",
                    background: "#ffffff",
                    color: "#111827",
                    padding: "10px 14px",
                    borderRadius: 10,
                    fontWeight: 700,
                    textDecoration: "none",
                    fontSize: 14,
                  }}
                >
                  Contactar
                </a>
              ) : (
                <span style={{ color: "#9ca3af", fontSize: 13, alignSelf: "center" }}>
                  Sin email de contacto en compra.
                </span>
              )}
              <ActionButton
                label="Rellenar con demo (merge)"
                tone="secondary"
                busy={seedFeedback.kind === "busy"}
                onClick={() => runSeed("merge")}
              />
              <ActionButton
                label="Reemplazar con demo"
                tone="warning"
                busy={seedFeedback.kind === "busy"}
                onClick={() => runSeed("replace")}
              />
              <ActionButton
                label="Provisioning duro"
                tone="primary"
                busy={hardFeedback.kind === "busy"}
                onClick={() => runHardReprovision({ seedDemo: "merge" })}
              />
              <ActionButton
                label="Regenerar credenciales"
                tone="warning"
                busy={hardFeedback.kind === "busy"}
                onClick={() => runHardReprovision({ resetAdminPassword: true })}
              />
            </div>

            {hardFeedback.kind === "success" ? (
              <div
                role="status"
                style={{
                  border: "1px solid #bbf7d0",
                  background: "#f0fdf4",
                  color: "#166534",
                  borderRadius: 10,
                  padding: 10,
                  fontSize: 13,
                }}
              >
                <div>{hardFeedback.message}</div>
                {hardFeedback.temporaryPassword ? (
                  <div
                    style={{
                      marginTop: 8,
                      padding: 8,
                      background: "#fff",
                      border: "1px solid #bbf7d0",
                      borderRadius: 8,
                      fontFamily: "monospace",
                      fontSize: 12,
                    }}
                  >
                    <strong>Credenciales nuevas — guárdalas ahora:</strong>
                    <div style={{ marginTop: 4 }}>
                      Email: {hardFeedback.adminEmail || "(sin email)"}
                    </div>
                    <div>Password temporal: {hardFeedback.temporaryPassword}</div>
                    <div style={{ fontSize: 10, color: "#6b7280", marginTop: 4 }}>
                      No se guarda en el log de auditoría. Ciérra esta página y se pierden.
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
            {hardFeedback.kind === "error" ? (
              <div
                role="alert"
                style={{
                  border: "1px solid #fecaca",
                  background: "#fef2f2",
                  color: "#991b1b",
                  borderRadius: 10,
                  padding: 10,
                  fontSize: 13,
                }}
              >
                {hardFeedback.message}
              </div>
            ) : null}

            {seedFeedback.kind === "success" ? (
              <div
                role="status"
                style={{
                  border: "1px solid #bfdbfe",
                  background: "#eff6ff",
                  color: "#1e40af",
                  borderRadius: 10,
                  padding: 10,
                  fontSize: 13,
                }}
              >
                {seedFeedback.message}
              </div>
            ) : null}
            {seedFeedback.kind === "error" ? (
              <div
                role="alert"
                style={{
                  border: "1px solid #fecaca",
                  background: "#fef2f2",
                  color: "#991b1b",
                  borderRadius: 10,
                  padding: 10,
                  fontSize: 13,
                }}
              >
                {seedFeedback.message}
              </div>
            ) : null}

            {actionFeedback.kind === "success" ? (
              <div
                role="status"
                style={{
                  border: "1px solid #bbf7d0",
                  background: "#f0fdf4",
                  color: "#166534",
                  borderRadius: 10,
                  padding: 10,
                  fontSize: 14,
                }}
              >
                {actionFeedback.message}
              </div>
            ) : null}

            {actionFeedback.kind === "error" ? (
              <div
                role="alert"
                style={{
                  border: "1px solid #fecaca",
                  background: "#fef2f2",
                  color: "#b91c1c",
                  borderRadius: 10,
                  padding: 10,
                  fontSize: 14,
                }}
              >
                {actionFeedback.message}
              </div>
            ) : null}
          </section>

          {/* Indicadores operativos */}
          <section
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 18,
              background: "#ffffff",
              padding: 20,
              display: "grid",
              gap: 12,
            }}
          >
            <h2 style={{ margin: 0, fontSize: 20 }}>Indicadores operativos</h2>
            <div style={{ fontSize: 13, color: "#6b7280" }}>
              KPIs del tenant calculados sobre los datos reales del ERP del cliente.
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 10,
                marginTop: 4,
              }}
            >
              <KpiCard label="Clientes" value={String(snapshot.operational.totalClientes)} />
              <KpiCard label="Oportunidades" value={String(snapshot.operational.oportunidadesAbiertas)} />
              <KpiCard label="Pipeline" value={formatMoney(snapshot.operational.pipelineAbierto)} />
              <KpiCard label="Trabajos activos" value={String(snapshot.operational.proyectosActivos)} />
              <KpiCard label="Propuestas abiertas" value={String(snapshot.operational.presupuestosAbiertos)} />
              <KpiCard label="Facturas pendientes" value={String(snapshot.operational.facturasPendientes)} />
              <KpiCard label="Documentos" value={String(snapshot.operational.totalDocumentos)} />
            </div>
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
                borderRadius: 18,
                background: "#ffffff",
                padding: 22,
                display: "grid",
                gap: 10,
              }}
            >
              <h2 style={{ marginTop: 0 }}>Datos de compra</h2>
              <div><strong>Empresa:</strong> {snapshot.purchase.companyName || "-"}</div>
              <div><strong>Email:</strong> {snapshot.purchase.email || "-"}</div>
              <div><strong>Plan:</strong> {snapshot.purchase.plan || "-"}</div>
              <div><strong>Importe:</strong> {snapshot.purchase.amount || "-"} {snapshot.purchase.currency || ""}</div>
              <div><strong>Origen:</strong> {snapshot.purchase.source || "-"}</div>
              <div><strong>Estado:</strong> {snapshot.purchase.status || "-"}</div>
              <div><strong>Fecha:</strong> {formatDate(snapshot.purchase.createdAt)}</div>
            </article>

            <article
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 18,
                background: "#ffffff",
                padding: 22,
                display: "grid",
                gap: 10,
              }}
            >
              <h2 style={{ marginTop: 0 }}>Tenant y vertical</h2>
              <div><strong>Client ID:</strong> {snapshot.clientId}</div>
              <div><strong>Tenant ID:</strong> {snapshot.tenant.tenantId}</div>
              <div><strong>Slug:</strong> {snapshot.tenant.slug}</div>
              <div><strong>Vertical:</strong> {snapshot.assignedVertical.businessType}</div>
              <div><strong>Sector:</strong> {snapshot.assignedVertical.sector}</div>
              <div><strong>Display name:</strong> {snapshot.assignedVertical.displayName}</div>
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
                borderRadius: 18,
                background: "#ffffff",
                padding: 22,
                display: "grid",
                gap: 10,
              }}
            >
              <h2 style={{ marginTop: 0 }}>Suscripción y runtime</h2>
              <div><strong>Plan:</strong> {snapshot.subscription.plan}</div>
              <div><strong>Estado:</strong> {snapshot.subscription.status}</div>
              <div><strong>Billing:</strong> {snapshot.subscription.billingState}</div>
              <div><strong>Runtime ready:</strong> {snapshot.runtime.ready ? "sí" : "no"}</div>
              <div><strong>Business type:</strong> {snapshot.runtime.businessType}</div>
              <div><strong>Sector:</strong> {snapshot.runtime.sector}</div>
              <div><strong>Company size:</strong> {snapshot.runtime.companySize}</div>
              <div><strong>Runtime actualizado:</strong> {formatDate(snapshot.runtime.updatedAt)}</div>
            </article>

            <SupportPanel clientId={clientId || ""} displayName={snapshot.displayName} />

            <InvoicesPanel clientId={clientId || ""} displayName={snapshot.displayName} />

            <article
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 18,
                background: "#ffffff",
                padding: 22,
                display: "grid",
                gap: 10,
              }}
            >
              <h2 style={{ marginTop: 0 }}>Branding</h2>
              <div><strong>Display name:</strong> {snapshot.branding.displayName}</div>
              <div><strong>Short name:</strong> {snapshot.branding.shortName}</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <strong>Accent color:</strong>
                <span
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 999,
                    background: snapshot.branding.accentColor,
                    display: "inline-block",
                    border: "1px solid #d1d5db",
                  }}
                />
                <span>{snapshot.branding.accentColor}</span>
              </div>
              <div><strong>Tono:</strong> {snapshot.branding.tone}</div>
              <div><strong>Logo hint:</strong> {snapshot.branding.logoHint || "-"}</div>
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
                borderRadius: 18,
                background: "#ffffff",
                padding: 22,
                display: "grid",
                gap: 12,
              }}
            >
              <h2 style={{ marginTop: 0 }}>Login y acceso</h2>
              <a href={snapshot.access.openUrl} target="_blank" rel="noreferrer" style={{ color: "#111827" }}>
                Abrir ERP real
              </a>
              <a href={snapshot.access.loginUrl} target="_blank" rel="noreferrer" style={{ color: "#111827" }}>
                Ver login / acceso
              </a>
              <a href={snapshot.access.firstUseUrl} target="_blank" rel="noreferrer" style={{ color: "#111827" }}>
                Ver primer acceso
              </a>
              <a href={snapshot.access.deliveryUrl} target="_blank" rel="noreferrer" style={{ color: "#111827" }}>
                Ver entrega
              </a>
            </article>

            <article
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 18,
                background: "#ffffff",
                padding: 22,
                display: "grid",
                gap: 10,
              }}
            >
              <h2 style={{ marginTop: 0 }}>Provisioning</h2>
              <div><strong>Estado:</strong> {snapshot.provisioning.state}</div>
              <div><strong>Último evento:</strong> {snapshot.provisioning.lastEventTitle || "-"}</div>
              <div><strong>Actualizado:</strong> {formatDate(snapshot.provisioning.updatedAt)}</div>
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
                borderRadius: 18,
                background: "#ffffff",
                padding: 22,
                display: "grid",
                gap: 10,
              }}
            >
              <h2 style={{ marginTop: 0 }}>Wrapper y entrega</h2>
              <div><strong>App:</strong> {snapshot.wrapper.appName}</div>
              <div><strong>Instalable:</strong> {snapshot.wrapper.installableName}</div>
              <div><strong>Ejecutable:</strong> {snapshot.wrapper.executableName}</div>
              <div><strong>Desktop caption:</strong> {snapshot.wrapper.desktopCaption}</div>
              <div><strong>Window title:</strong> {snapshot.wrapper.windowTitle}</div>
              <div><strong>Icon hint:</strong> {snapshot.wrapper.iconHint || "-"}</div>
              <div><strong>Delivery mode:</strong> {snapshot.wrapper.deliveryMode}</div>
            </article>

            <article
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 18,
                background: "#ffffff",
                padding: 22,
                display: "grid",
                gap: 10,
              }}
            >
              <h2 style={{ marginTop: 0 }}>Validación comercial</h2>
              <div>
                <strong>Resultado:</strong> {snapshot.commercialValidation.passed} / {snapshot.commercialValidation.total}
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                {snapshot.commercialValidation.checks.map((check) => {
                  const style = toneStyle(check.passed ? "ok" : "warn");
                  return (
                    <article
                      key={check.key}
                      style={{
                        border: "1px solid " + style.border,
                        borderRadius: 12,
                        background: style.bg,
                        color: style.color,
                        padding: 12,
                        display: "grid",
                        gap: 6,
                      }}
                    >
                      <strong>{check.label}</strong>
                      <div style={{ fontSize: 14 }}>{check.detail}</div>
                    </article>
                  );
                })}
              </div>
            </article>
          </section>

          <section
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 18,
              background: "#ffffff",
              padding: 22,
              display: "grid",
              gap: 14,
            }}
          >
            <h2 style={{ marginTop: 0 }}>Historial de evolución</h2>

            {snapshot.evolution.history.length === 0 ? (
              <div style={{ color: "#6b7280" }}>No hay historial de evolución todavía.</div>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {snapshot.evolution.history.map((item) => (
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
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                      <strong>{item.summary}</strong>
                      <StateBadge label="Rollback" value={item.rollbackSafe ? "safe" : "no"} />
                    </div>
                    <div style={{ color: "#4b5563", fontSize: 14 }}>
                      Tipo: {item.actionType || "-"}
                    </div>
                    <div style={{ color: "#4b5563", fontSize: 14 }}>
                      Autor: {item.createdBy || "-"}
                    </div>
                    <div style={{ color: "#6b7280", fontSize: 12 }}>
                      Fecha: {formatDate(item.createdAt)}
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

function ActionButton({
  label,
  tone,
  busy,
  onClick,
}: {
  label: string;
  tone: "primary" | "warning" | "secondary";
  busy?: boolean;
  onClick: () => void;
}) {
  const toneStyles =
    tone === "warning"
      ? { bg: busy ? "#6b7280" : "#b45309", hoverBg: "#78350f", color: "#ffffff", border: "#b45309" }
      : tone === "secondary"
        ? { bg: busy ? "#f3f4f6" : "#ffffff", hoverBg: "#f9fafb", color: "#111827", border: "#d1d5db" }
        : { bg: busy ? "#6b7280" : "#111827", hoverBg: "#1f2937", color: "#ffffff", border: "#111827" };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      style={{
        border: "1px solid " + toneStyles.border,
        background: toneStyles.bg,
        color: toneStyles.color,
        padding: "10px 14px",
        borderRadius: 10,
        fontWeight: 700,
        cursor: busy ? "not-allowed" : "pointer",
        fontSize: 14,
      }}
    >
      {busy ? "Procesando…" : label}
    </button>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        background: "#f9fafb",
        padding: 14,
        display: "grid",
        gap: 4,
      }}
    >
      <div style={{ fontSize: 12, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.4 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: "#111827" }}>{value}</div>
    </div>
  );
}

// ---------- Soporte mensual ----------

type SupportConfig = {
  supportActive: boolean;
  concurrentUsersBilled: number;
  currentPlanKey: string;
};

const PLAN_SUPPORT_PRICE_CENTS_PER_USER = 1200;

function SupportPanel({ clientId, displayName }: { clientId: string; displayName: string; key?: string | number }) {
  const [config, setConfig] = useState<SupportConfig | null>(null);
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/factory/client/" + encodeURIComponent(clientId) + "/support");
      if (!res.ok) {
        if (res.status === 404) {
          setConfig(null);
          return;
        }
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Error cargando soporte.");
      }
      const data = await res.json();
      setConfig({
        supportActive: Boolean(data.supportActive),
        concurrentUsersBilled: Number(data.concurrentUsersBilled || 1),
        currentPlanKey: String(data.currentPlanKey || "trial"),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (clientId) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  async function save(next: { supportActive?: boolean; concurrentUsersBilled?: number }) {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(
        "/api/factory/client/" + encodeURIComponent(clientId) + "/support",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next),
        },
      );
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "No se pudo guardar.");
      }
      setConfig({
        supportActive: Boolean(data.supportActive),
        concurrentUsersBilled: Number(data.concurrentUsersBilled || 1),
        currentPlanKey: String(data.currentPlanKey || "trial"),
      });
      setMessage("Configuración guardada.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error.");
    } finally {
      setSaving(false);
    }
  }

  const mrrCents = config && config.supportActive
    ? PLAN_SUPPORT_PRICE_CENTS_PER_USER * Math.max(1, config.concurrentUsersBilled)
    : 0;

  return (
    <article
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 18,
        background: "#ffffff",
        padding: 22,
        display: "grid",
        gap: 10,
      }}
    >
      <h2 style={{ marginTop: 0 }}>Soporte mensual</h2>
      <p style={{ margin: 0, color: "#6b7280", fontSize: 13 }}>
        12 € por usuario concurrente al mes. Cancelable en cualquier momento. Cuando está activo,
        el tenant {displayName} aporta MRR a las analíticas.
      </p>

      {busy ? (
        <div style={{ color: "#6b7280", fontSize: 13 }}>Cargando…</div>
      ) : !config ? (
        <div style={{ color: "#6b7280", fontSize: 13 }}>
          Este tenant aún no tiene suscripción de billing. Crea una primero.
        </div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => save({ supportActive: !config.supportActive })}
              disabled={saving}
              style={{
                border: "none",
                padding: "10px 14px",
                borderRadius: 10,
                fontWeight: 700,
                fontSize: 13,
                cursor: saving ? "not-allowed" : "pointer",
                background: config.supportActive ? "#dcfce7" : "#fee2e2",
                color: config.supportActive ? "#166534" : "#991b1b",
              }}
            >
              {config.supportActive ? "✓ Soporte activo" : "✗ Soporte inactivo"}
            </button>
            <button
              type="button"
              onClick={() => save({ supportActive: !config.supportActive })}
              disabled={saving}
              style={{
                border: "1px solid #d1d5db",
                background: "#fff",
                color: "#374151",
                padding: "8px 12px",
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 600,
                cursor: saving ? "not-allowed" : "pointer",
              }}
            >
              {config.supportActive ? "Desactivar" : "Activar"}
            </button>
          </div>

          <label style={{ display: "grid", gap: 4, marginTop: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>
              Usuarios concurrentes facturados
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="number"
                min={1}
                value={config.concurrentUsersBilled}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    concurrentUsersBilled: Math.max(1, Number(e.target.value) || 1),
                  })
                }
                style={{
                  width: 100,
                  padding: "8px 10px",
                  border: "1px solid #d1d5db",
                  borderRadius: 8,
                  fontSize: 14,
                }}
              />
              <button
                type="button"
                onClick={() => save({ concurrentUsersBilled: config.concurrentUsersBilled })}
                disabled={saving}
                style={{
                  border: "1px solid #1d4ed8",
                  background: "#1d4ed8",
                  color: "#fff",
                  padding: "8px 14px",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: saving ? "not-allowed" : "pointer",
                }}
              >
                Guardar
              </button>
              <span style={{ fontSize: 12, color: "#6b7280" }}>
                MRR: <strong>{formatCents(mrrCents)}</strong>/mes
              </span>
            </div>
          </label>

          {message ? <SmallBanner tone="ok" text={message} /> : null}
          {error ? <SmallBanner tone="danger" text={error} /> : null}
        </>
      )}
    </article>
  );
}

// ---------- Facturas ----------

type InvoiceRecord = {
  id: string;
  concept: string;
  amountCents: number;
  currency: string;
  status: "issued" | "paid" | "void";
  createdAt: string;
  planKey: string;
};

function InvoicesPanel({ clientId, displayName }: { clientId: string; displayName: string; key?: string | number }) {
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [busy, setBusy] = useState(true);
  const [issuing, setIssuing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [stripeUrl, setStripeUrl] = useState<string | null>(null);
  const [sendViaStripe, setSendViaStripe] = useState(false);
  const [periodLabel, setPeriodLabel] = useState(() => {
    const now = new Date();
    const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    return months[now.getMonth()] + " " + now.getFullYear();
  });

  async function load() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/factory/client/" + encodeURIComponent(clientId) + "/invoices");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Error cargando facturas.");
      }
      const data = await res.json();
      setInvoices(Array.isArray(data.invoices) ? data.invoices : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (clientId) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  async function issue() {
    if (!periodLabel.trim()) {
      setError("Pon una etiqueta para el periodo (p.ej. 'Octubre 2026').");
      return;
    }
    setIssuing(true);
    setError(null);
    setMessage(null);
    setStripeUrl(null);
    try {
      const res = await fetch(
        "/api/factory/client/" + encodeURIComponent(clientId) + "/invoices",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ periodLabel, sendViaStripe }),
        },
      );
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "No se pudo emitir.");
      }
      setInvoices(Array.isArray(data.invoices) ? data.invoices : []);
      let msg = "Factura emitida por " + formatCents(data.invoice?.amountCents || 0) + ".";
      if (data.stripeInvoice) {
        msg += " Enviada a Stripe — el cliente recibe email para pagar.";
        setStripeUrl(data.stripeInvoice.hostedInvoiceUrl || null);
      }
      setMessage(msg);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error.");
    } finally {
      setIssuing(false);
    }
  }

  async function changeStatus(invoiceId: string, status: "issued" | "paid" | "void") {
    setError(null);
    try {
      const res = await fetch(
        "/api/factory/client/" + encodeURIComponent(clientId) + "/invoices",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invoiceId, status }),
        },
      );
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "No se pudo actualizar.");
      }
      setInvoices(Array.isArray(data.invoices) ? data.invoices : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error.");
    }
  }

  return (
    <article
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 18,
        background: "#ffffff",
        padding: 22,
        display: "grid",
        gap: 12,
        gridColumn: "1 / -1",
      }}
    >
      <h2 style={{ marginTop: 0 }}>Facturas de {displayName}</h2>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <input
          type="text"
          value={periodLabel}
          onChange={(e) => setPeriodLabel(e.target.value)}
          placeholder="Etiqueta del periodo (p.ej. Octubre 2026)"
          style={{
            padding: "8px 10px",
            border: "1px solid #d1d5db",
            borderRadius: 8,
            fontSize: 14,
            minWidth: 240,
          }}
        />
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#374151" }}>
          <input
            type="checkbox"
            checked={sendViaStripe}
            onChange={(e) => setSendViaStripe(e.target.checked)}
          />
          Enviar a Stripe (cobro automático)
        </label>
        <button
          type="button"
          onClick={issue}
          disabled={issuing}
          style={{
            border: "none",
            background: issuing ? "#94a3b8" : "#1d4ed8",
            color: "#fff",
            padding: "10px 14px",
            borderRadius: 10,
            fontWeight: 700,
            fontSize: 13,
            cursor: issuing ? "not-allowed" : "pointer",
          }}
        >
          {issuing ? "Emitiendo…" : "Emitir factura de soporte"}
        </button>
      </div>

      {message ? <SmallBanner tone="ok" text={message} /> : null}
      {stripeUrl ? (
        <div
          style={{
            padding: 10,
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            borderRadius: 10,
            fontSize: 13,
          }}
        >
          Factura Stripe disponible:{" "}
          <a href={stripeUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#1d4ed8", fontWeight: 700 }}>
            ver en Stripe ↗
          </a>
        </div>
      ) : null}
      {error ? <SmallBanner tone="danger" text={error} /> : null}

      {busy ? (
        <div style={{ color: "#6b7280", fontSize: 13 }}>Cargando…</div>
      ) : invoices.length === 0 ? (
        <div style={{ color: "#6b7280", fontSize: 13 }}>Sin facturas todavía.</div>
      ) : (
        <div
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                <th style={invoiceTh()}>Fecha</th>
                <th style={invoiceTh()}>Concepto</th>
                <th style={invoiceTh()} align="right">Importe</th>
                <th style={invoiceTh()}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} style={{ borderTop: "1px solid #f3f4f6" }}>
                  <td style={invoiceTd()}>
                    <span style={{ fontSize: 12, color: "#6b7280" }}>
                      {new Date(inv.createdAt).toLocaleDateString("es")}
                    </span>
                  </td>
                  <td style={invoiceTd()}>{inv.concept}</td>
                  <td style={invoiceTd()} align="right">
                    <strong>{formatCents(inv.amountCents)}</strong>
                  </td>
                  <td style={invoiceTd()}>
                    <select
                      value={inv.status}
                      onChange={(e) =>
                        changeStatus(inv.id, e.target.value as "issued" | "paid" | "void")
                      }
                      style={{
                        padding: "4px 8px",
                        border: "1px solid #d1d5db",
                        borderRadius: 6,
                        fontSize: 12,
                        background:
                          inv.status === "paid"
                            ? "#dcfce7"
                            : inv.status === "void"
                              ? "#f3f4f6"
                              : "#fef3c7",
                        color:
                          inv.status === "paid"
                            ? "#166534"
                            : inv.status === "void"
                              ? "#6b7280"
                              : "#92400e",
                        fontWeight: 700,
                      }}
                    >
                      <option value="issued">issued</option>
                      <option value="paid">paid</option>
                      <option value="void">void</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}

function SmallBanner({ tone, text }: { tone: "ok" | "danger"; text: string }) {
  const palette =
    tone === "ok"
      ? { bg: "#f0fdf4", border: "#bbf7d0", color: "#166534" }
      : { bg: "#fef2f2", border: "#fecaca", color: "#991b1b" };
  return (
    <div
      style={{
        border: "1px solid " + palette.border,
        background: palette.bg,
        color: palette.color,
        padding: "8px 12px",
        borderRadius: 10,
        fontSize: 12,
      }}
    >
      {text}
    </div>
  );
}

function invoiceTh(): React.CSSProperties {
  return {
    textAlign: "left",
    padding: "10px 12px",
    background: "#f9fafb",
    fontSize: 11,
    fontWeight: 700,
    color: "#374151",
    borderBottom: "1px solid #e5e7eb",
  };
}

function invoiceTd(): React.CSSProperties {
  return { padding: "10px 12px", color: "#111827", verticalAlign: "top" };
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(cents / 100);
}