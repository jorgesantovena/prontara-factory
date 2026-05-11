"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * TopBar profesional del ERP (H9-A2).
 *
 * Elementos:
 *   - Saludo personalizado ("Buenos días, Ana")
 *   - Selector de empresa interna (TenantCompany — H7-C4)
 *   - Botón notificaciones con badge
 *   - Botón ayuda contextual
 *   - Menú de perfil (vínculos y cerrar sesión)
 *
 * Se renderiza dentro de TenantShell, encima del contenido principal,
 * a la derecha de la sidebar.
 */

type Company = { id: string; razonSocial: string; cif: string; esEmisorPorDefecto: boolean };
type Notification = { id: string; type: string; severity: string; title: string; message: string; readAt: string | null; createdAt: string };

function saludoPorHora(now: Date): string {
  const h = now.getHours();
  if (h < 6) return "Buenas noches";
  if (h < 13) return "Buenos días";
  if (h < 21) return "Buenas tardes";
  return "Buenas noches";
}

export default function DashboardTopBar({ accent = "#1d4ed8" }: { accent?: string }) {
  const [user, setUser] = useState<{ email: string; fullName?: string; role?: string } | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState<string>("");
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [today] = useState(() => new Date());

  useEffect(() => {
    // Cargar sesión
    fetch("/api/runtime/session", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d?.ok && d.session) {
          setUser({ email: d.session.email, fullName: d.session.fullName, role: d.session.role });
        }
      })
      .catch(() => undefined);

    // Cargar empresas internas
    fetch("/api/runtime/companies", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d?.ok) {
          setCompanies(d.companies || []);
          const stored = (typeof window !== "undefined" ? window.localStorage.getItem("prontara-active-company") : null) || "";
          const def = (d.companies || []).find((c: Company) => c.esEmisorPorDefecto)?.id || (d.companies?.[0]?.id ?? "");
          setActiveCompanyId(stored || def);
        }
      })
      .catch(() => undefined);

    // Cargar notificaciones (últimas 20)
    fetch("/api/factory/notifications?unreadOnly=false", { cache: "no-store" })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d?.notifications) setNotifs(d.notifications.slice(0, 20));
      })
      .catch(() => undefined);
  }, []);

  function changeCompany(id: string) {
    setActiveCompanyId(id);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("prontara-active-company", id);
    }
  }

  const firstName = user?.fullName?.split(/\s+/)[0] || (user?.email?.split("@")[0] || "");
  const unreadCount = notifs.filter((n) => !n.readAt).length;
  const fechaHoy = today.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });

  return (
    <header style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      padding: "12px 24px",
      background: "var(--bg, #ffffff)",
      borderBottom: "1px solid var(--border, #e5e7eb)",
      position: "sticky",
      top: 0,
      zIndex: 30,
    }}>
      {/* Saludo + fecha */}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--fg, #0f172a)" }}>
          {saludoPorHora(today)}{firstName ? ", " + firstName : ""}
        </div>
        <div style={{ fontSize: 11, color: "var(--fg-muted, #6b7280)", textTransform: "capitalize" }}>{fechaHoy}</div>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        {/* Selector empresa interna */}
        {companies.length > 1 ? (
          <select
            value={activeCompanyId}
            onChange={(e) => changeCompany(e.target.value)}
            style={{
              padding: "6px 10px",
              border: "1px solid var(--border, #d1d5db)",
              borderRadius: 6,
              background: "var(--bg-secondary, #ffffff)",
              color: "var(--fg, #0f172a)",
              fontSize: 12,
              fontWeight: 600,
              maxWidth: 220,
            }}
            title="Empresa activa"
          >
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.razonSocial}</option>
            ))}
          </select>
        ) : null}

        {/* Notificaciones */}
        <div style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => { setShowNotifs(!showNotifs); setShowProfile(false); }}
            style={{
              border: "1px solid var(--border, #e5e7eb)",
              background: "var(--bg-secondary, #ffffff)",
              color: "var(--fg, #0f172a)",
              borderRadius: 6,
              padding: "6px 10px",
              cursor: "pointer",
              position: "relative",
              fontSize: 14,
            }}
            title="Notificaciones"
          >
            🔔
            {unreadCount > 0 ? (
              <span style={{ position: "absolute", top: -4, right: -4, background: "#dc2626", color: "#fff", borderRadius: 10, padding: "1px 6px", fontSize: 10, fontWeight: 700, minWidth: 16, textAlign: "center" }}>
                {unreadCount}
              </span>
            ) : null}
          </button>
          {showNotifs ? (
            <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, width: 320, maxHeight: 400, overflowY: "auto", background: "var(--bg-card, #ffffff)", border: "1px solid var(--border, #e5e7eb)", borderRadius: 8, boxShadow: "0 10px 30px rgba(0,0,0,0.1)", zIndex: 50 }}>
              <div style={{ padding: 10, borderBottom: "1px solid var(--border, #f1f5f9)", fontSize: 11, fontWeight: 700, color: "var(--fg-muted, #475569)", textTransform: "uppercase" }}>
                Notificaciones
              </div>
              {notifs.length === 0 ? (
                <div style={{ padding: 16, fontSize: 12, color: "var(--fg-muted, #94a3b8)", textAlign: "center" }}>
                  Sin notificaciones
                </div>
              ) : (
                notifs.map((n) => (
                  <div key={n.id} style={{ padding: 10, borderBottom: "1px solid var(--border, #f1f5f9)", background: n.readAt ? "transparent" : "var(--bg-secondary, #f8fafc)" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--fg, #0f172a)", marginBottom: 2 }}>{n.title}</div>
                    <div style={{ fontSize: 11, color: "var(--fg-muted, #475569)" }}>{n.message}</div>
                    <div style={{ fontSize: 10, color: "var(--fg-muted, #94a3b8)", marginTop: 4 }}>{new Date(n.createdAt).toLocaleString("es-ES")}</div>
                  </div>
                ))
              )}
            </div>
          ) : null}
        </div>

        {/* Help (H9-B3) */}
        <button
          type="button"
          onClick={() => { window.dispatchEvent(new CustomEvent("prontara-help-open")); }}
          style={{
            border: "1px solid var(--border, #e5e7eb)",
            background: "var(--bg-secondary, #ffffff)",
            color: "var(--fg, #0f172a)",
            borderRadius: 6,
            padding: "6px 10px",
            cursor: "pointer",
            fontSize: 14,
          }}
          title="Ayuda"
        >
          ?
        </button>

        {/* Perfil */}
        <div style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => { setShowProfile(!showProfile); setShowNotifs(false); }}
            style={{
              border: "1px solid " + accent,
              background: accent,
              color: "#ffffff",
              borderRadius: 999,
              width: 34,
              height: 34,
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 700,
            }}
            title={user?.email}
          >
            {(firstName || "?").charAt(0).toUpperCase()}
          </button>
          {showProfile ? (
            <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, width: 220, background: "var(--bg-card, #ffffff)", border: "1px solid var(--border, #e5e7eb)", borderRadius: 8, boxShadow: "0 10px 30px rgba(0,0,0,0.1)", zIndex: 50, padding: 6 }}>
              <div style={{ padding: "8px 10px", borderBottom: "1px solid var(--border, #f1f5f9)", fontSize: 11 }}>
                <div style={{ fontWeight: 700, color: "var(--fg, #0f172a)" }}>{user?.fullName || user?.email || ""}</div>
                <div style={{ color: "var(--fg-muted, #6b7280)", fontSize: 10, marginTop: 2 }}>{user?.role || ""}</div>
              </div>
              <Link href="/ajustes-cuenta" style={menuItem}>Mi cuenta</Link>
              <Link href="/ajustes" style={menuItem}>Ajustes del tenant</Link>
              <Link href="/ajustes-campos" style={menuItem}>Campos personalizados</Link>
              <Link href="/integraciones" style={menuItem}>Integraciones</Link>
              <Link href="/logout" style={{ ...menuItem, color: "#dc2626", borderTop: "1px solid var(--border, #f1f5f9)", marginTop: 4, paddingTop: 8 }}>Cerrar sesión</Link>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

const menuItem: React.CSSProperties = {
  display: "block",
  padding: "8px 10px",
  fontSize: 13,
  color: "var(--fg, #0f172a)",
  textDecoration: "none",
  borderRadius: 4,
};
