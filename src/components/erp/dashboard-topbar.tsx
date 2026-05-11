"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import GlobalCreateButton from "@/components/erp/global-create-button";

/**
 * TopBar profesional del ERP (H12-C — rediseñado según mockup).
 *
 * Layout:
 *   [Buscador central grande con ⌘K]   [Sede ▾] [🔔 N] [?] [Avatar Nombre ▾]
 *
 * El saludo desaparece del topbar y se mueve al hero del Home (mockup).
 *
 * Atajo ⌘K / Ctrl+K enfoca el buscador. Submit navega a /buscar?q=...
 */

type Company = { id: string; razonSocial: string; cif: string; esEmisorPorDefecto: boolean };
type Notification = { id: string; type: string; severity: string; title: string; message: string; readAt: string | null; createdAt: string };

export default function DashboardTopBar({ accent = "#1d4ed8" }: { accent?: string }) {
  const router = useRouter();
  const [user, setUser] = useState<{ email: string; fullName?: string; role?: string } | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState<string>("");
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [query, setQuery] = useState("");
  const [isMac, setIsMac] = useState(false);
  const searchRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setIsMac(typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform));

    fetch("/api/runtime/session", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d?.ok && d.session) {
          setUser({ email: d.session.email, fullName: d.session.fullName, role: d.session.role });
        }
      })
      .catch(() => undefined);

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

    fetch("/api/factory/notifications?unreadOnly=false", { cache: "no-store" })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d?.notifications) setNotifs(d.notifications.slice(0, 20));
      })
      .catch(() => undefined);

    // ⌘K / Ctrl+K — focus al buscador
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function changeCompany(id: string) {
    setActiveCompanyId(id);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("prontara-active-company", id);
    }
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    router.push("/buscar?q=" + encodeURIComponent(query.trim()));
  }

  const firstName = user?.fullName?.split(/\s+/)[0] || (user?.email?.split("@")[0] || "");
  const unreadCount = notifs.filter((n) => !n.readAt).length;
  const activeCompany = companies.find((c) => c.id === activeCompanyId);
  const shortcutHint = isMac ? "⌘K" : "Ctrl K";

  return (
    <header style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 14,
      padding: "12px 24px",
      background: "var(--bg, #ffffff)",
      borderBottom: "1px solid var(--border, #e5e7eb)",
      position: "sticky",
      top: 0,
      zIndex: 30,
    }}>
      {/* Buscador central grande */}
      <form onSubmit={submitSearch} style={{ flex: 1, maxWidth: 640, display: "flex", alignItems: "center", position: "relative" }}>
        <span style={{ position: "absolute", left: 14, color: "#94a3b8", fontSize: 14, pointerEvents: "none" }}>🔍</span>
        <input
          ref={searchRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar clientes, documentos, productos…"
          style={{
            width: "100%",
            padding: "10px 64px 10px 38px",
            border: "1px solid var(--border, #e2e8f0)",
            borderRadius: 10,
            background: "var(--bg-secondary, #f8fafc)",
            color: "var(--fg, #0f172a)",
            fontSize: 13,
            outline: "none",
          }}
        />
        <span style={{
          position: "absolute",
          right: 12,
          padding: "2px 7px",
          border: "1px solid var(--border, #e2e8f0)",
          borderRadius: 5,
          background: "var(--bg, #ffffff)",
          fontSize: 10,
          fontWeight: 700,
          color: "#94a3b8",
          pointerEvents: "none",
        }}>{shortcutHint}</span>
      </form>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexShrink: 0 }}>
        {/* Selector empresa interna */}
        {companies.length > 1 ? (
          <div style={{ position: "relative" }}>
            <select
              value={activeCompanyId}
              onChange={(e) => changeCompany(e.target.value)}
              style={{
                padding: "8px 30px 8px 32px",
                border: "1px solid var(--border, #e2e8f0)",
                borderRadius: 8,
                background: "var(--bg, #ffffff)",
                color: "var(--fg, #0f172a)",
                fontSize: 12,
                fontWeight: 600,
                maxWidth: 200,
                appearance: "none",
                cursor: "pointer",
              }}
              title="Empresa activa"
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.razonSocial}</option>
              ))}
            </select>
            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: "#64748b", pointerEvents: "none" }}>🏢</span>
            <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: "#64748b", pointerEvents: "none" }}>▾</span>
          </div>
        ) : activeCompany ? (
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 12px", border: "1px solid var(--border, #e2e8f0)", borderRadius: 8,
            background: "var(--bg, #ffffff)", fontSize: 12, fontWeight: 600, color: "var(--fg, #0f172a)",
          }} title={activeCompany.razonSocial}>
            <span style={{ fontSize: 13 }}>🏢</span>
            <span style={{ maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{activeCompany.razonSocial}</span>
          </div>
        ) : null}

        {/* Botón + Crear global (H10-E) */}
        <GlobalCreateButton accent={accent} />

        {/* Notificaciones */}
        <div style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => { setShowNotifs(!showNotifs); setShowProfile(false); }}
            style={{
              border: "1px solid var(--border, #e2e8f0)",
              background: "var(--bg, #ffffff)",
              color: "var(--fg, #0f172a)",
              borderRadius: 8,
              width: 38,
              height: 38,
              cursor: "pointer",
              position: "relative",
              fontSize: 15,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            title="Notificaciones"
          >
            🔔
            {unreadCount > 0 ? (
              <span style={{ position: "absolute", top: -3, right: -3, background: "#dc2626", color: "#fff", borderRadius: 10, padding: "1px 6px", fontSize: 10, fontWeight: 700, minWidth: 18, textAlign: "center", lineHeight: 1.4 }}>
                {unreadCount}
              </span>
            ) : null}
          </button>
          {showNotifs ? (
            <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, width: 340, maxHeight: 420, overflowY: "auto", background: "var(--bg-card, #ffffff)", border: "1px solid var(--border, #e5e7eb)", borderRadius: 10, boxShadow: "0 10px 30px rgba(15,23,42,0.12)", zIndex: 50 }}>
              <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border, #f1f5f9)", fontSize: 11, fontWeight: 700, color: "var(--fg-muted, #475569)", textTransform: "uppercase", letterSpacing: 0.5, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>Notificaciones</span>
                <Link href="/notificaciones" style={{ color: accent, fontSize: 11, textDecoration: "none", textTransform: "none", letterSpacing: 0 }}>Ver todas</Link>
              </div>
              {notifs.length === 0 ? (
                <div style={{ padding: 24, fontSize: 12, color: "var(--fg-muted, #94a3b8)", textAlign: "center" }}>
                  Sin notificaciones
                </div>
              ) : (
                notifs.map((n) => (
                  <div key={n.id} style={{ padding: 12, borderBottom: "1px solid var(--border, #f1f5f9)", background: n.readAt ? "transparent" : "var(--bg-secondary, #f8fafc)" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--fg, #0f172a)", marginBottom: 2 }}>{n.title}</div>
                    <div style={{ fontSize: 12, color: "var(--fg-muted, #475569)" }}>{n.message}</div>
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
            border: "1px solid var(--border, #e2e8f0)",
            background: "var(--bg, #ffffff)",
            color: "var(--fg, #0f172a)",
            borderRadius: 8,
            width: 38,
            height: 38,
            cursor: "pointer",
            fontSize: 15,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          title="Ayuda"
        >
          ?
        </button>

        {/* Perfil con avatar + nombre */}
        <div style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => { setShowProfile(!showProfile); setShowNotifs(false); }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "5px 12px 5px 5px",
              border: "1px solid var(--border, #e2e8f0)",
              background: "var(--bg, #ffffff)",
              color: "var(--fg, #0f172a)",
              borderRadius: 999,
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
            }}
            title={user?.email}
          >
            <span style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 30,
              height: 30,
              borderRadius: 999,
              background: accent,
              color: "#ffffff",
              fontSize: 12,
              fontWeight: 700,
            }}>
              {(firstName || "?").charAt(0).toUpperCase()}
            </span>
            <span style={{ maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{firstName || "Usuario"}</span>
            <span style={{ fontSize: 9, color: "#64748b" }}>▾</span>
          </button>
          {showProfile ? (
            <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, width: 240, background: "var(--bg-card, #ffffff)", border: "1px solid var(--border, #e5e7eb)", borderRadius: 10, boxShadow: "0 10px 30px rgba(15,23,42,0.12)", zIndex: 50, padding: 6 }}>
              <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border, #f1f5f9)" }}>
                <div style={{ fontWeight: 700, color: "var(--fg, #0f172a)", fontSize: 13 }}>{user?.fullName || user?.email || ""}</div>
                <div style={{ color: "var(--fg-muted, #6b7280)", fontSize: 11, marginTop: 2 }}>{user?.email || ""}</div>
                {user?.role ? <div style={{ color: "var(--fg-muted, #94a3b8)", fontSize: 10, marginTop: 4, textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 700 }}>{user.role}</div> : null}
              </div>
              <Link href="/ajustes-cuenta" style={menuItem}>Mi cuenta</Link>
              <Link href="/ajustes" style={menuItem}>Ajustes del tenant</Link>
              <Link href="/ajustes-campos" style={menuItem}>Campos personalizados</Link>
              <Link href="/integraciones" style={menuItem}>Integraciones</Link>
              <Link href="/logout" style={{ ...menuItem, color: "#dc2626", borderTop: "1px solid var(--border, #f1f5f9)", marginTop: 4, paddingTop: 10 }}>Cerrar sesión</Link>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

const menuItem: React.CSSProperties = {
  display: "block",
  padding: "9px 12px",
  fontSize: 13,
  color: "var(--fg, #0f172a)",
  textDecoration: "none",
  borderRadius: 6,
};
