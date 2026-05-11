"use client";

import { useEffect, useState } from "react";
import LoginSidePanel from "@/components/saas/login-side-panel";

function readTenantFromBrowser(): string {
  if (typeof window === "undefined") {
    return "";
  }

  return String(new URLSearchParams(window.location.search).get("tenant") || "").trim();
}

export default function AccesoPage() {
  const [tenantFromUrl, setTenantFromUrl] = useState("");
  const [form, setForm] = useState({
    tenant: "",
    email: "",
    password: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const tenant = readTenantFromBrowser();
    setTenantFromUrl(tenant);

    if (tenant) {
      setForm((current) => ({
        ...current,
        tenant,
      }));
    }
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/runtime/login?tenant=" + encodeURIComponent(form.tenant), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "No se pudo entrar.");
      }

      if (data.account?.mustChangePassword) {
        window.location.href = "/primer-acceso?tenant=" + encodeURIComponent(form.tenant);
        return;
      }

      setMessage("Sesión iniciada correctamente. Entrando en tu entorno...");
      window.location.href = "/?tenant=" + encodeURIComponent(form.tenant);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo entrar.");
    } finally {
      setBusy(false);
    }
  }

  function updateField(key: "tenant" | "email" | "password", value: string) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        background: "#f8fafc",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ flex: 1, display: "grid", placeItems: "center", padding: 24 }}>
      <section
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
            Acceso
          </div>
          <h1 style={{ marginTop: 0, marginBottom: 8, fontSize: 30 }}>
            Entra en tu entorno
          </h1>
          <p style={{ margin: 0, color: "#4b5563" }}>
            Solo necesitas tres datos: el tenant, tu email y tu contraseña.
          </p>
        </div>

        <div
          style={{
            border: "1px solid #eef2f7",
            borderRadius: 12,
            background: "#fafafa",
            padding: 14,
            color: "#374151",
            fontSize: 14,
          }}
        >
          Si acabas de recibir el correo de bienvenida, usa la contraseña temporal y
          el sistema te pedirá cambiarla en el primer acceso.
        </div>

        {tenantFromUrl ? (
          <div
            style={{
              border: "1px solid #dbeafe",
              borderRadius: 12,
              background: "#eff6ff",
              padding: 12,
              color: "#1d4ed8",
              fontSize: 14,
            }}
          >
            Tenant detectado: <strong>{tenantFromUrl}</strong>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span>Tenant o slug</span>
            <input
              value={form.tenant}
              onChange={(event) => updateField("tenant", event.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "1px solid #d1d5db",
                borderRadius: 10,
                fontSize: 14,
              }}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>Email</span>
            <input
              type="email"
              value={form.email}
              onChange={(event) => updateField("email", event.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "1px solid #d1d5db",
                borderRadius: 10,
                fontSize: 14,
              }}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>Contraseña</span>
            <input
              type="password"
              value={form.password}
              onChange={(event) => updateField("password", event.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "1px solid #d1d5db",
                borderRadius: 10,
                fontSize: 14,
              }}
            />
          </label>

          <button
            type="submit"
            disabled={busy}
            style={{
              border: "none",
              borderRadius: 10,
              background: "#111827",
              color: "#ffffff",
              padding: "12px 16px",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            {busy ? "Entrando..." : "Entrar"}
          </button>
          <div style={{ textAlign: "center", marginTop: 4 }}>
            <a
              href={
                form.tenant
                  ? "/recuperar?tenant=" + encodeURIComponent(form.tenant)
                  : "/recuperar"
              }
              style={{ fontSize: 13, color: "#1d4ed8", textDecoration: "none" }}
            >
              ¿Olvidaste tu contraseña?
            </a>
          </div>
        </form>

        {error ? (
          <div
            style={{
              border: "1px solid #fecaca",
              background: "#fef2f2",
              color: "#991b1b",
              borderRadius: 12,
              padding: 12,
            }}
          >
            {error}
          </div>
        ) : null}

        {message ? (
          <div
            style={{
              border: "1px solid #bbf7d0",
              background: "#f0fdf4",
              color: "#166534",
              borderRadius: 12,
              padding: 12,
            }}
          >
            {message}
          </div>
        ) : null}
      </section>
      </div>
      <LoginSidePanel />
    </main>
  );
}