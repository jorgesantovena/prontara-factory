"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import FactoryShell from "@/components/factory/factory-shell";

/**
 * Vista de un vertical concreto en el panel Factory.
 *
 * Por defecto muestra una rejilla con los CLIENTES que tienen este vertical
 * activo, con su estado de suscripción (active / trial / cancelled). Es lo
 * que el operador necesita para responder rápido a "¿cuántos clientes
 * tengo en gimnasio? ¿cuántos siguen pagando?".
 *
 * Para editar el pack en sí (branding, módulos, entidades, fields), hay un
 * link a /factory/verticales/[key]/editar.
 */

type ClientRow = {
  clientId: string;
  tenantId: string;
  slug: string;
  displayName: string;
  vertical: string;
  plan: string;
  subscriptionState: "active" | "trial" | "cancelled";
  brandingDisplayName: string;
  brandingAccentColor: string;
  updatedAt: string | null;
  openUrl: string;
};

type VerticalSummary = {
  key: string;
  label: string;
  sector: string;
  businessType: string;
  description: string;
  accentColor: string;
  displayName: string;
  moduleCount: number;
  entityCount: number;
  fieldCount: number;
  hasOverride: boolean;
};

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "ahora";
  if (minutes < 60) return "hace " + minutes + " min";
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return "hace " + hours + " h";
  const days = Math.floor(hours / 24);
  if (days < 30) return "hace " + days + " d";
  return date.toLocaleDateString("es-ES");
}

function badgeStyle(state: ClientRow["subscriptionState"]) {
  if (state === "active") return { bg: "#dcfce7", color: "#166534", border: "#bbf7d0", text: "Activa" };
  if (state === "trial") return { bg: "#fef3c7", color: "#92400e", border: "#fde68a", text: "Trial" };
  return { bg: "#fee2e2", color: "#991b1b", border: "#fecaca", text: "Cancelada" };
}

export default function FactoryVerticalDetailPage() {
  const params = useParams();
  const verticalKey = decodeURIComponent(String(params?.key || ""));

  const [vertical, setVertical] = useState<VerticalSummary | null>(null);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verticalKey]);

  async function load() {
    setBusy(true);
    setError(null);
    try {
      const [verticalsRes, dashboardRes] = await Promise.all([
        fetch("/api/factory/verticales", { cache: "no-store" }),
        fetch("/api/factory/dashboard", { cache: "no-store" }),
      ]);

      if (verticalsRes.status === 401 || dashboardRes.status === 401) {
        setError("Se requiere sesión con rol admin/owner.");
        return;
      }

      const verticalsData = await verticalsRes.json();
      const dashboardData = await dashboardRes.json();

      if (verticalsData.ok) {
        const found = (verticalsData.verticals || []).find(
          (v: VerticalSummary) => v.key === verticalKey,
        );
        setVertical(found || null);
      }

      const allClients: ClientRow[] = (dashboardData.snapshot?.clients || []) as ClientRow[];
      const filtered = allClients
        .filter((c) => c.vertical === verticalKey)
        .sort((a, b) => {
          const aT = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
          const bT = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
          return bT - aT;
        });
      setClients(filtered);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error cargando.");
    } finally {
      setBusy(false);
    }
  }

  const counts = useMemo(() => {
    return {
      total: clients.length,
      active: clients.filter((c) => c.subscriptionState === "active").length,
      trial: clients.filter((c) => c.subscriptionState === "trial").length,
      cancelled: clients.filter((c) => c.subscriptionState === "cancelled").length,
    };
  }, [clients]);

  const accent = vertical?.accentColor || "#1d4ed8";

  return (
    <FactoryShell>
      <div style={{ maxWidth: 1280, margin: "0 auto", display: "grid", gap: 18 }}>
        {/* Cabecera + breadcrumb */}
        <div style={{ display: "grid", gap: 6 }}>
          <Link
            href="/factory/verticales"
            style={{ fontSize: 12, color: "#6b7280", textDecoration: "none" }}
          >
            ← Verticales
          </Link>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 14,
                  background: accent,
                  flexShrink: 0,
                }}
              />
              <div>
                <h1 style={{ margin: 0, fontSize: 26, color: "#0f172a" }}>
                  {vertical?.label || verticalKey}
                </h1>
                <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: 14 }}>
                  {vertical?.sector ? vertical.sector + " · " + vertical.businessType : "Vertical"}
                </p>
              </div>
            </div>
            <Link
              href={"/factory/verticales/" + encodeURIComponent(verticalKey) + "/editar"}
              style={{
                border: "1px solid #d1d5db",
                background: "#ffffff",
                color: "#374151",
                padding: "9px 16px",
                borderRadius: 8,
                textDecoration: "none",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              ✎ Configurar pack
            </Link>
          </div>
        </div>

        {/* KPI cards */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 12,
          }}
        >
          <Kpi label="Clientes totales" value={counts.total} tone="neutral" />
          <Kpi label="Suscripción activa" value={counts.active} tone="ok" />
          <Kpi label="En trial" value={counts.trial} tone="warn" />
          <Kpi label="Cancelados" value={counts.cancelled} tone="danger" />
        </section>

        {/* Resumen del pack */}
        {vertical ? (
          <section
            style={{
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              padding: "14px 16px",
              display: "flex",
              gap: 24,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <div style={{ flex: "1 1 280px", minWidth: 0 }}>
              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Descripción del vertical</div>
              <div style={{ fontSize: 14, color: "#374151" }}>{vertical.description}</div>
            </div>
            <div style={{ display: "flex", gap: 16 }}>
              <Stat label="Módulos" value={vertical.moduleCount} />
              <Stat label="Entidades" value={vertical.entityCount} />
              <Stat label="Campos" value={vertical.fieldCount} />
              {vertical.hasOverride ? (
                <span
                  style={{
                    fontSize: 11,
                    color: "#9a3412",
                    background: "#fed7aa",
                    padding: "4px 10px",
                    borderRadius: 999,
                    fontWeight: 700,
                    alignSelf: "center",
                  }}
                >
                  ✎ con override
                </span>
              ) : null}
            </div>
          </section>
        ) : null}

        {/* Tabla de clientes */}
        <section>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
            <h2 style={{ margin: 0, fontSize: 17, color: "#0f172a" }}>Clientes en este vertical</h2>
            <span style={{ fontSize: 12, color: "#6b7280" }}>
              Ordenados por última actividad
            </span>
          </div>

          {error ? (
            <div
              style={{
                border: "1px solid #fecaca",
                background: "#fef2f2",
                color: "#991b1b",
                borderRadius: 8,
                padding: 12,
                fontSize: 14,
                marginBottom: 12,
              }}
            >
              {error}
            </div>
          ) : null}

          <div
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              background: "#ffffff",
              overflow: "hidden",
            }}
          >
            {busy ? (
              <div style={{ padding: 40, textAlign: "center", color: "#6b7280", fontSize: 14 }}>
                Cargando…
              </div>
            ) : clients.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: "#6b7280", fontSize: 14 }}>
                Aún no hay clientes que hayan contratado este vertical.
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                  <thead>
                    <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                      <Th>Cliente</Th>
                      <Th>Slug</Th>
                      <Th>Plan</Th>
                      <Th>Suscripción</Th>
                      <Th>Última actividad</Th>
                      <Th right>Acciones</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {clients.map((c) => {
                      const badge = badgeStyle(c.subscriptionState);
                      return (
                        <tr
                          key={c.clientId}
                          style={{ borderBottom: "1px solid #f3f4f6" }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "#f9fafb")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                        >
                          <Td>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <div
                                style={{
                                  width: 32,
                                  height: 32,
                                  borderRadius: 8,
                                  background: c.brandingAccentColor || accent,
                                  color: "#ffffff",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: 12,
                                  fontWeight: 700,
                                  flexShrink: 0,
                                }}
                              >
                                {(c.brandingDisplayName || c.displayName || "?").slice(0, 2).toUpperCase()}
                              </div>
                              <Link
                                href={"/factory/client/" + encodeURIComponent(c.clientId)}
                                style={{ color: "#0f172a", fontWeight: 600, textDecoration: "none" }}
                              >
                                {c.brandingDisplayName || c.displayName || c.slug}
                              </Link>
                            </div>
                          </Td>
                          <Td muted>{c.slug}</Td>
                          <Td muted>{c.plan || "—"}</Td>
                          <Td>
                            <span
                              style={{
                                background: badge.bg,
                                color: badge.color,
                                border: "1px solid " + badge.border,
                                borderRadius: 999,
                                padding: "3px 10px",
                                fontSize: 11,
                                fontWeight: 700,
                                display: "inline-block",
                              }}
                            >
                              {badge.text}
                            </span>
                          </Td>
                          <Td muted>{formatRelative(c.updatedAt)}</Td>
                          <Td right>
                            <Link
                              href={"/factory/client/" + encodeURIComponent(c.clientId)}
                              style={{
                                border: "1px solid #d1d5db",
                                borderRadius: 6,
                                padding: "5px 10px",
                                fontSize: 12,
                                color: "#374151",
                                textDecoration: "none",
                                fontWeight: 600,
                                marginRight: 6,
                              }}
                            >
                              Abrir
                            </Link>
                            <a
                              href={c.openUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                border: "1px solid #1d4ed8",
                                background: "#1d4ed8",
                                color: "#ffffff",
                                borderRadius: 6,
                                padding: "5px 10px",
                                fontSize: 12,
                                textDecoration: "none",
                                fontWeight: 600,
                              }}
                            >
                              Ver runtime
                            </a>
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>
    </FactoryShell>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "neutral" | "ok" | "warn" | "danger";
}) {
  const colors = {
    neutral: { bg: "#ffffff", border: "#e5e7eb", text: "#0f172a" },
    ok: { bg: "#ecfdf5", border: "#bbf7d0", text: "#166534" },
    warn: { bg: "#fffbeb", border: "#fde68a", text: "#92400e" },
    danger: { bg: "#fef2f2", border: "#fecaca", text: "#991b1b" },
  }[tone];
  return (
    <article
      style={{
        background: colors.bg,
        border: "1px solid " + colors.border,
        borderRadius: 12,
        padding: 14,
      }}
    >
      <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: colors.text, marginTop: 4 }}>
        {value}
      </div>
    </article>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 16, color: "#111827", fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th
      style={{
        textAlign: right ? "right" : "left",
        padding: "10px 14px",
        fontWeight: 600,
        fontSize: 11,
        color: "#6b7280",
        textTransform: "uppercase",
        letterSpacing: 0.4,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  muted,
  right,
}: {
  children: React.ReactNode;
  muted?: boolean;
  right?: boolean;
}) {
  return (
    <td
      style={{
        padding: "10px 14px",
        fontSize: 13,
        color: muted ? "#6b7280" : "#0f172a",
        textAlign: right ? "right" : "left",
        whiteSpace: right ? "nowrap" : undefined,
      }}
    >
      {children}
    </td>
  );
}
