"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import FactoryShell from "@/components/factory/factory-shell";

/**
 * Vista global de todos los clientes (tenants) de Prontara.
 *
 * El operador entra aquí para ver de un vistazo qué clientes tiene, en qué
 * estado de suscripción están y cuándo fue su última actividad. Ordenado
 * por defecto por última actividad descendente — los más recientes arriba.
 *
 * Click en una fila → /factory/client/[clientId] (ficha completa con
 * acciones: cancelar suscripción, regenerar, ver runtime, etc.).
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

type Filter = "all" | "active" | "trial" | "cancelled";

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

export default function FactoryClientesPage() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/factory/dashboard", { cache: "no-store" });
      if (res.status === 401) {
        setError("Se requiere sesión con rol admin/owner.");
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Error cargando clientes.");
      }
      const data = await res.json();
      const rows: ClientRow[] = (data.snapshot?.clients || []) as ClientRow[];
      // Orden por updatedAt desc (los más recientes primero)
      rows.sort((a, b) => {
        const aT = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const bT = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return bT - aT;
      });
      setClients(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error cargando clientes.");
    } finally {
      setBusy(false);
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clients.filter((c) => {
      if (filter !== "all" && c.subscriptionState !== filter) return false;
      if (!q) return true;
      const blob = (
        c.displayName +
        " " +
        c.brandingDisplayName +
        " " +
        c.slug +
        " " +
        c.vertical +
        " " +
        c.plan
      ).toLowerCase();
      return blob.includes(q);
    });
  }, [clients, query, filter]);

  const counts = useMemo(() => {
    return {
      all: clients.length,
      active: clients.filter((c) => c.subscriptionState === "active").length,
      trial: clients.filter((c) => c.subscriptionState === "trial").length,
      cancelled: clients.filter((c) => c.subscriptionState === "cancelled").length,
    };
  }, [clients]);

  return (
    <FactoryShell>
      <div style={{ maxWidth: 1280, margin: "0 auto", display: "grid", gap: 16 }}>
        <header>
          <h1 style={{ margin: 0, fontSize: 26, color: "#0f172a" }}>Clientes</h1>
          <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: 14 }}>
            Tenants creados, ordenados por actividad más reciente.
          </p>
        </header>

        {/* Filtros + buscador */}
        <section
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: 10,
            padding: "10px 14px",
          }}
        >
          <div style={{ display: "flex", gap: 6 }}>
            {(["all", "active", "trial", "cancelled"] as Filter[]).map((f) => {
              const active = filter === f;
              const labelMap: Record<Filter, string> = {
                all: "Todos",
                active: "Activos",
                trial: "Trial",
                cancelled: "Cancelados",
              };
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  style={{
                    border: "1px solid " + (active ? "#1d4ed8" : "#d1d5db"),
                    background: active ? "#1d4ed8" : "#ffffff",
                    color: active ? "#ffffff" : "#374151",
                    borderRadius: 999,
                    padding: "6px 14px",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {labelMap[f]} ({counts[f]})
                </button>
              );
            })}
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre, slug, vertical o plan..."
            style={{
              flex: "1 1 280px",
              padding: "8px 12px",
              border: "1px solid #d1d5db",
              borderRadius: 8,
              fontSize: 13,
            }}
          />
        </section>

        {error ? (
          <div
            style={{
              border: "1px solid #fecaca",
              background: "#fef2f2",
              color: "#991b1b",
              borderRadius: 8,
              padding: 12,
              fontSize: 14,
            }}
          >
            {error}
          </div>
        ) : null}

        {/* Tabla de clientes */}
        <section
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            background: "#ffffff",
            overflow: "hidden",
          }}
        >
          {busy ? (
            <div style={{ padding: 40, textAlign: "center", color: "#6b7280", fontSize: 14 }}>
              Cargando clientes...
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "#6b7280", fontSize: 14 }}>
              {query
                ? "Ningún cliente coincide con la búsqueda."
                : "Sin clientes en este filtro."}
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                    <Th>Cliente</Th>
                    <Th>Slug</Th>
                    <Th>Vertical</Th>
                    <Th>Plan</Th>
                    <Th>Suscripción</Th>
                    <Th>Última actividad</Th>
                    <Th right>Acciones</Th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => {
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
                                background: c.brandingAccentColor || "#94a3b8",
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
                              style={{
                                color: "#0f172a",
                                fontWeight: 600,
                                textDecoration: "none",
                              }}
                            >
                              {c.brandingDisplayName || c.displayName || c.slug}
                            </Link>
                          </div>
                        </Td>
                        <Td muted>{c.slug}</Td>
                        <Td>
                          {c.vertical ? (
                            <Link
                              href={"/factory/verticales/" + encodeURIComponent(c.vertical)}
                              style={{ color: "#1d4ed8", textDecoration: "none", fontSize: 13 }}
                            >
                              {c.vertical}
                            </Link>
                          ) : (
                            <span style={{ color: "#9ca3af" }}>—</span>
                          )}
                        </Td>
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
        </section>
      </div>
    </FactoryShell>
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
