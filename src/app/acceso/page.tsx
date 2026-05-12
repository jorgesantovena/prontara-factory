"use client";

import { useEffect, useState } from "react";
import LoginSidePanel from "@/components/saas/login-side-panel";
import { businessTypeToVerticalSlug } from "@/lib/saas/vertical-slug";

function readQuery(name: string): string {
  if (typeof window === "undefined") return "";
  return String(new URLSearchParams(window.location.search).get(name) || "").trim();
}
function readTenantFromBrowser(): string {
  return readQuery("tenant");
}
function readRedirectTo(): string {
  return readQuery("redirectTo");
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

      // H15-A: a dónde ir después del login.
      //   1) Si la URL trae ?redirectTo=<path>, respétalo (viene de la
      //      landing del vertical o del middleware tras una ruta vieja).
      //   2) Si no, deduce el vertical del businessType que vino en la
      //      sesión y ve al home del vertical (/softwarefactory, /dental…).
      //   3) Fallback: la home raíz, que redirige a /factory.
      const redirectTo = readRedirectTo();
      if (redirectTo && redirectTo.startsWith("/")) {
        window.location.href = redirectTo;
        return;
      }
      const businessType = String(data.session?.businessType || "");
      const verticalSlug = businessType ? businessTypeToVerticalSlug(businessType) : null;
      if (verticalSlug) {
        window.location.href = "/" + verticalSlug;
        return;
      }
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

        {/* H14-E: SSO Google + Microsoft. Solo aparecen si el usuario ha
            puesto un slug — necesitamos saber a qué tenant pertenece para
            redirigir al callback correcto. */}
        {form.tenant.trim() ? (
          <div style={{ display: "grid", gap: 8 }}>
            <a
              href={"/api/runtime/oauth/google/start?tenant=" + encodeURIComponent(form.tenant.trim())}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                padding: "10px 14px",
                border: "1px solid #d1d5db",
                borderRadius: 10,
                background: "#ffffff",
                color: "#0f172a",
                fontSize: 14,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.49h4.84a4.14 4.14 0 01-1.8 2.71v2.26h2.92c1.71-1.58 2.7-3.9 2.7-6.62z"/>
                <path fill="#34A853" d="M9 18c2.43 0 4.47-.81 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.71H.96v2.33A9 9 0 009 18z"/>
                <path fill="#FBBC05" d="M3.97 10.71A5.41 5.41 0 013.68 9c0-.59.1-1.17.29-1.71V4.96H.96A9 9 0 000 9c0 1.45.35 2.83.96 4.04l3.01-2.33z"/>
                <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 009 0 9 9 0 00.96 4.96l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"/>
              </svg>
              Continuar con Google
            </a>
            <a
              href={"/api/runtime/oauth/microsoft/start?tenant=" + encodeURIComponent(form.tenant.trim())}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                padding: "10px 14px",
                border: "1px solid #d1d5db",
                borderRadius: 10,
                background: "#ffffff",
                color: "#0f172a",
                fontSize: 14,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                <rect x="0" y="0" width="8.5" height="8.5" fill="#F25022"/>
                <rect x="9.5" y="0" width="8.5" height="8.5" fill="#7FBA00"/>
                <rect x="0" y="9.5" width="8.5" height="8.5" fill="#00A4EF"/>
                <rect x="9.5" y="9.5" width="8.5" height="8.5" fill="#FFB900"/>
              </svg>
              Continuar con Microsoft
            </a>
            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "4px 0" }}>
              <div style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
              <span style={{ fontSize: 11, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.5 }}>o con email</span>
              <div style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
            </div>
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