"use client";

import { useEffect, useState } from "react";

export default function RecuperarPasswordPage() {
  const [tenant, setTenant] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const t = params.get("tenant") || "";
    if (t) setTenant(t);
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/runtime/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant, email }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "No se pudo procesar la solicitud.");
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
            Recuperación de contraseña
          </div>
          <h1 style={{ marginTop: 0, marginBottom: 8, fontSize: 26 }}>
            ¿Olvidaste tu contraseña?
          </h1>
          <p style={{ margin: 0, color: "#4b5563" }}>
            Te enviamos un enlace por email para que elijas una nueva. El
            enlace caduca en 12 horas.
          </p>
        </div>

        {done ? (
          <div
            style={{
              border: "1px solid #bbf7d0",
              background: "#f0fdf4",
              color: "#166534",
              borderRadius: 12,
              padding: 14,
            }}
          >
            <strong>Si el email existe en este tenant, recibirás el enlace en breve.</strong>
            <div style={{ fontSize: 13, marginTop: 6, color: "#374151" }}>
              Revisa también tu carpeta de spam. Si después de 5 minutos no llega,
              vuelve a probar.
            </div>
          </div>
        ) : (
          <form onSubmit={submit} style={{ display: "grid", gap: 14 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Tenant o slug</span>
              <input
                type="text"
                value={tenant}
                onChange={(e) => setTenant(e.target.value)}
                required
                style={inputStyle()}
              />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Email de la cuenta</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
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
              {busy ? "Enviando…" : "Enviar enlace de recuperación"}
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

        <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: 12 }}>
          <a
            href={tenant ? "/acceso?tenant=" + encodeURIComponent(tenant) : "/acceso"}
            style={{ fontSize: 13, color: "#1d4ed8", textDecoration: "none" }}
          >
            ← Volver al acceso
          </a>
        </div>
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
