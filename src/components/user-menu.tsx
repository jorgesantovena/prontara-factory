"use client";

import { useEffect, useState } from "react";

type SessionUser = {
  email: string;
  fullName: string;
  role: "owner" | "admin" | "manager" | "staff";
  slug: string;
};

type SessionResponse = {
  ok: boolean;
  authenticated: boolean;
  session: SessionUser | null;
};

/**
 * Chip de sesión actual con nombre, rol y botón de cerrar sesión. Se
 * encarga solo de llamar a /api/runtime/session al montar para pintar
 * su estado. Si no hay sesión no renderiza nada (la página ya se habrá
 * redirigido al /acceso probablemente).
 */
export default function UserMenu({ variant = "factory" }: { variant?: "factory" | "runtime" }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/runtime/session", { cache: "no-store" });
        const data = (await res.json()) as SessionResponse;
        if (cancelled) return;
        if (data.authenticated && data.session) {
          setUser(data.session);
        }
      } catch {
        // silent — si falla, no mostramos nada
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function logout() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/runtime/logout", { method: "POST" });
    } finally {
      window.location.href = "/acceso" + (user?.slug ? "?tenant=" + encodeURIComponent(user.slug) : "");
    }
  }

  if (!user) return null;

  const badgeBg = variant === "runtime" ? "#eff6ff" : "#f3f4f6";
  const badgeColor = variant === "runtime" ? "#1d4ed8" : "#374151";

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 12px",
          border: "1px solid #e5e7eb",
          borderRadius: 999,
          background: "#fff",
          cursor: "pointer",
          fontSize: 13,
          color: "#111827",
          fontFamily: "inherit",
        }}
      >
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: 999,
            background: badgeBg,
            color: badgeColor,
            display: "grid",
            placeItems: "center",
            fontWeight: 700,
            fontSize: 12,
          }}
        >
          {initials(user.fullName || user.email)}
        </span>
        <span style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {user.email}
        </span>
        <span style={{ fontSize: 10, color: "#6b7280", fontWeight: 600, textTransform: "uppercase" }}>
          {user.role}
        </span>
        <span style={{ fontSize: 10, color: "#9ca3af" }}>▾</span>
      </button>
      {open ? (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 6px)",
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            padding: 8,
            minWidth: 220,
            boxShadow: "0 10px 20px rgba(17,24,39,0.08)",
            zIndex: 50,
          }}
        >
          <div
            style={{
              padding: "6px 10px",
              fontSize: 11,
              color: "#6b7280",
              borderBottom: "1px solid #f3f4f6",
              marginBottom: 4,
            }}
          >
            Tenant: <code style={{ fontSize: 11 }}>{user.slug}</code>
          </div>
          <button
            type="button"
            onClick={logout}
            disabled={busy}
            style={{
              width: "100%",
              textAlign: "left",
              background: "transparent",
              border: "none",
              padding: "8px 10px",
              borderRadius: 8,
              cursor: busy ? "not-allowed" : "pointer",
              color: "#991b1b",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {busy ? "Cerrando…" : "Cerrar sesión"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function initials(value: string): string {
  const parts = String(value || "")
    .trim()
    .split(/[\s@.]+/)
    .filter(Boolean);
  if (parts.length === 0) return "·";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
