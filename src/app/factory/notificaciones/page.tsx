"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Severity = "info" | "success" | "warning" | "error";
type NotificationType =
  | "alta_created"
  | "payment_received"
  | "trial_expiring"
  | "trial_expired"
  | "payment_failed"
  | "tenant_cancelled"
  | "webhook_error"
  | "manual";

type FactoryNotification = {
  id: string;
  type: NotificationType;
  severity: Severity;
  title: string;
  message: string;
  metadata: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
};

const TYPE_LABEL: Record<NotificationType, string> = {
  alta_created: "Alta",
  payment_received: "Pago",
  trial_expiring: "Trial avisa",
  trial_expired: "Trial caducó",
  payment_failed: "Pago fallido",
  tenant_cancelled: "Cancelación",
  webhook_error: "Webhook",
  manual: "Manual",
};

const SEVERITY_COLOR: Record<Severity, { bg: string; fg: string; border: string }> = {
  info: { bg: "#eff6ff", fg: "#1e40af", border: "#93c5fd" },
  success: { bg: "#ecfdf5", fg: "#065f46", border: "#6ee7b7" },
  warning: { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d" },
  error: { bg: "#fef2f2", fg: "#991b1b", border: "#fca5a5" },
};

export default function NotificacionesPage() {
  const [items, setItems] = useState<FactoryNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  async function load() {
    setBusy(true);
    setError(null);
    try {
      const url = filter === "unread"
        ? "/api/factory/notifications?unread=1"
        : "/api/factory/notifications";
      const res = await fetch(url);
      if (res.status === 401) {
        setError("Se requiere sesión con rol admin/owner.");
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Error cargando.");
      }
      const data = await res.json();
      setItems(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error cargando.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function markRead(id: string) {
    try {
      await fetch("/api/factory/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark-read", id }),
      });
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error marcando.");
    }
  }

  async function markAllRead() {
    if (!confirm("¿Marcar todas las notificaciones como leídas?")) return;
    try {
      await fetch("/api/factory/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark-all-read" }),
      });
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error marcando.");
    }
  }

  return (
    <main style={{ padding: 24, fontFamily: "Arial, sans-serif", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ marginBottom: 12 }}>
        <Link href="/factory" style={{ fontSize: 13, color: "#1d4ed8", textDecoration: "none" }}>
          &larr; Volver al panel
        </Link>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 28, margin: 0 }}>Notificaciones</h1>
          <p style={{ color: "#6b7280", fontSize: 14, marginTop: 4 }}>
            Eventos relevantes del SaaS: altas, pagos, fallos, cancelaciones.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span
            style={{
              fontSize: 12,
              padding: "4px 10px",
              borderRadius: 999,
              background: unreadCount > 0 ? "#fef2f2" : "#f3f4f6",
              color: unreadCount > 0 ? "#991b1b" : "#6b7280",
              fontWeight: 600,
            }}
          >
            {unreadCount} sin leer
          </span>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as "all" | "unread")}
            style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }}
          >
            <option value="all">Todas</option>
            <option value="unread">Solo no leídas</option>
          </select>
          {unreadCount > 0 ? (
            <button
              onClick={markAllRead}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                border: "1px solid #1d4ed8",
                background: "#1d4ed8",
                color: "#fff",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Marcar todas leídas
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <div style={{ padding: 12, background: "#fef2f2", color: "#991b1b", borderRadius: 8, marginBottom: 16 }}>
          {error}
        </div>
      ) : null}

      {busy ? (
        <div style={{ padding: 20, color: "#6b7280", fontSize: 14 }}>Cargando…</div>
      ) : items.length === 0 ? (
        <div
          style={{
            padding: 40,
            textAlign: "center",
            color: "#6b7280",
            fontSize: 14,
            border: "1px dashed #d1d5db",
            borderRadius: 12,
          }}
        >
          {filter === "unread"
            ? "No hay notificaciones sin leer. ✨"
            : "No hay notificaciones. Aparecerán aquí cuando alguien firme alta, pague o falle un cobro."}
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {items.map((n) => {
            const colors = SEVERITY_COLOR[n.severity] || SEVERITY_COLOR.info;
            const date = new Date(n.createdAt);
            return (
              <div
                key={n.id}
                style={{
                  padding: 14,
                  border: "1px solid " + colors.border,
                  background: n.readAt ? "#ffffff" : colors.bg,
                  borderRadius: 10,
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: 0.4,
                        padding: "2px 8px",
                        borderRadius: 999,
                        background: colors.bg,
                        color: colors.fg,
                        border: "1px solid " + colors.border,
                      }}
                    >
                      {TYPE_LABEL[n.type]}
                    </span>
                    {!n.readAt ? (
                      <span style={{ width: 8, height: 8, background: "#1d4ed8", borderRadius: 999 }} />
                    ) : null}
                    <strong style={{ fontSize: 15, color: "#0f172a" }}>{n.title}</strong>
                  </div>
                  <span style={{ fontSize: 12, color: "#6b7280" }}>
                    {date.toLocaleString("es-ES")}
                  </span>
                </div>
                <div style={{ fontSize: 14, color: "#374151", lineHeight: 1.5 }}>
                  {n.message}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  {!n.readAt ? (
                    <button
                      onClick={() => markRead(n.id)}
                      style={{
                        padding: "4px 10px",
                        fontSize: 12,
                        borderRadius: 6,
                        border: "1px solid #d1d5db",
                        background: "#fff",
                        color: "#374151",
                        cursor: "pointer",
                      }}
                    >
                      Marcar leída
                    </button>
                  ) : null}
                  {n.metadata && (n.metadata as { slug?: string }).slug ? (
                    <Link
                      href={"/factory/client/" + encodeURIComponent(String((n.metadata as { slug?: string }).slug))}
                      style={{
                        padding: "4px 10px",
                        fontSize: 12,
                        borderRadius: 6,
                        border: "1px solid #1d4ed8",
                        background: "#fff",
                        color: "#1d4ed8",
                        textDecoration: "none",
                      }}
                    >
                      Abrir cliente
                    </Link>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
