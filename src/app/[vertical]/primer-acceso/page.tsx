"use client";

import { useEffect, useState } from "react";

type SessionResponse = {
  ok: boolean;
  session?: {
    mustChangePassword: boolean;
    slug: string;
    fullName: string;
    email: string;
  } | null;
};

function readTenantFromBrowser(): string {
  if (typeof window === "undefined") {
    return "";
  }

  return String(new URLSearchParams(window.location.search).get("tenant") || "").trim();
}

export default function PrimerAccesoPage() {
  const [tenant, setTenant] = useState("");
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [form, setForm] = useState({
    newPassword: "",
    repeatPassword: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const browserTenant = readTenantFromBrowser();
      setTenant(browserTenant);

      try {
        const response = await fetch(
          "/api/runtime/session" + (browserTenant ? "?tenant=" + encodeURIComponent(browserTenant) : ""),
          { cache: "no-store" }
        );
        const data = (await response.json()) as SessionResponse;

        if (cancelled) {
          return;
        }

        if (!response.ok || !data.ok || !data.session) {
          window.location.href = "/acceso" + (browserTenant ? "?tenant=" + encodeURIComponent(browserTenant) : "");
          return;
        }

        if (!data.session.mustChangePassword) {
          window.location.href = "/?tenant=" + encodeURIComponent(data.session.slug);
          return;
        }

        setFullName(data.session.fullName);
        setEmail(data.session.email);
        setAllowed(true);
      } catch {
        window.location.href = "/acceso" + (browserTenant ? "?tenant=" + encodeURIComponent(browserTenant) : "");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (form.newPassword.length < 8) {
      setError("La nueva contraseña debe tener al menos 8 caracteres.");
      return;
    }

    if (form.newPassword !== form.repeatPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setBusy(true);

    try {
      const response = await fetch(
        "/api/runtime/change-password" + (tenant ? "?tenant=" + encodeURIComponent(tenant) : ""),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            newPassword: form.newPassword,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "No se pudo cambiar la contraseña.");
      }

      setMessage("Contraseña actualizada. Entrando en tu entorno...");
      window.setTimeout(() => {
        window.location.href = "/?tenant=" + encodeURIComponent(tenant);
      }, 700);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cambiar la contraseña.");
    } finally {
      setBusy(false);
    }
  }

  if (loading || !allowed) {
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
          style={{
            width: "100%",
            maxWidth: 520,
            border: "1px solid #e5e7eb",
            borderRadius: 16,
            background: "#ffffff",
            padding: 24,
          }}
        >
          Preparando primer acceso...
        </section>
      </main>
    );
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
        style={{
          width: "100%",
          maxWidth: 560,
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
            Primer acceso
          </div>
          <h1 style={{ marginTop: 0, marginBottom: 8, fontSize: 30 }}>
            Cambia tu contraseña para empezar
          </h1>
          <p style={{ margin: 0, color: "#4b5563" }}>
            Este paso es obligatorio para que tu entorno quede seguro desde el primer día.
          </p>
        </div>

        <div
          style={{
            border: "1px solid #eef2f7",
            borderRadius: 12,
            background: "#fafafa",
            padding: 14,
            display: "grid",
            gap: 6,
            color: "#374151",
            fontSize: 14,
          }}
        >
          <div><strong>Usuario:</strong> {fullName}</div>
          <div><strong>Email:</strong> {email}</div>
          <div><strong>Tenant:</strong> {tenant || "-"}</div>
        </div>

        <div
          style={{
            border: "1px solid #dbeafe",
            background: "#eff6ff",
            borderRadius: 12,
            padding: 14,
            display: "grid",
            gap: 6,
            color: "#1e3a8a",
            fontSize: 14,
          }}
        >
          <div style={{ fontWeight: 700 }}>Al entrar, tendrás una guía de arranque corta</div>
          <div style={{ color: "#1e40af" }}>
            Cinco pasos de pocos minutos: revisar datos de tu empresa, crear tu primer
            cliente, preparar una propuesta, emitir una factura y dejar un trabajo en marcha.
            Puedes ocultarla cuando quieras.
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span>Nueva contraseña</span>
            <input
              type="password"
              value={form.newPassword}
              onChange={(event) =>
                setForm((current) => ({ ...current, newPassword: event.target.value }))
              }
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
            <span>Repite la contraseña</span>
            <input
              type="password"
              value={form.repeatPassword}
              onChange={(event) =>
                setForm((current) => ({ ...current, repeatPassword: event.target.value }))
              }
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
            {busy ? "Guardando..." : "Guardar contraseña y entrar"}
          </button>
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
    </main>
  );
}