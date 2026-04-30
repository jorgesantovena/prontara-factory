"use client";

import { useEffect, useState } from "react";

export default function RestablecerPasswordPage() {
  const [token, setToken] = useState("");
  const [tenant, setTenant] = useState("");
  const [pwd1, setPwd1] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setToken(params.get("token") || "");
    setTenant(params.get("tenant") || "");
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pwd1.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (pwd1 !== pwd2) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/runtime/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: pwd1 }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "No se pudo cambiar la contraseña.");
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "#f8fafc",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <section
        className="auth-card"
        style={{
          width: "100%",
          maxWidth: 480,
          border: "1px solid #e5e7eb",
          borderRadius: 16,
          background: "#ffffff",
          padding: 24,
          display: "grid",
          gap: 16,
        }}
      >
        <div>
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>
            Nueva contraseña
          </div>
          <h1 style={{ marginTop: 0, marginBottom: 8, fontSize: 26 }}>
            Restablece tu contraseña
          </h1>
          <p style={{ margin: 0, color: "#4b5563" }}>
            Elige una contraseña nueva. Mínimo 8 caracteres.
          </p>
        </div>

        {!token ? (
          <div
            style={{
              border: "1px solid #fecaca",
              background: "#fef2f2",
              color: "#991b1b",
              borderRadius: 12,
              padding: 14,
            }}
          >
            Falta el token de recuperación. Pide un enlace nuevo desde{" "}
            <a href="/recuperar" style={{ color: "#1d4ed8", fontWeight: 700 }}>
              /recuperar
            </a>
            .
          </div>
        ) : done ? (
          <div
            style={{
              border: "1px solid #bbf7d0",
              background: "#f0fdf4",
              color: "#166534",
              borderRadius: 12,
              padding: 14,
            }}
          >
            <strong>Contraseña actualizada.</strong>
            <div style={{ marginTop: 8 }}>
              <a
                href={tenant ? "/acceso?tenant=" + encodeURIComponent(tenant) : "/acceso"}
                style={{
                  display: "inline-block",
                  marginTop: 8,
                  padding: "10px 16px",
                  background: "#1d4ed8",
                  color: "#fff",
                  textDecoration: "none",
                  borderRadius: 10,
                  fontWeight: 700,
                }}
              >
                Ir a iniciar sesión
              </a>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} style={{ display: "grid", gap: 14 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Nueva contraseña</span>
              <input
                type="password"
                value={pwd1}
                onChange={(e) => setPwd1(e.target.value)}
                required
                minLength={8}
                style={inputStyle()}
              />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Confirma la contraseña</span>
              <input
                type="password"
                value={pwd2}
                onChange={(e) => setPwd2(e.target.value)}
                required
                minLength={8}
                style={inputStyle()}
              />
            </label>
            <button
              type="submit"
              disabled={busy}
              style={{
                border: "none",
                borderRadius: 10,
                background: busy ? "#94a3b8" : "#1d4ed8",
                color: "#fff",
                padding: "12px 16px",
                cursor: busy ? "not-allowed" : "pointer",
                fontWeight: 700,
                fontSize: 15,
              }}
            >
              {busy ? "Guardando…" : "Establecer nueva contraseña"}
            </button>

            {error ? (
              <div
                style={{
                  border: "1px solid #fecaca",
                  background: "#fef2f2",
                  color: "#991b1b",
                  borderRadius: 10,
                  padding: 12,
                  fontSize: 13,
                }}
              >
                {error}
              </div>
            ) : null}
          </form>
        )}
      </section>
    </main>
  );
}

function inputStyle(): React.CSSProperties {
  return {
    width: "100%",
    padding: "10px 12px",
    border: "1px solid #d1d5db",
    borderRadius: 10,
    fontSize: 14,
    background: "#fff",
    color: "#111827",
    fontFamily: "inherit",
    boxSizing: "border-box",
  };
}
