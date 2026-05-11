"use client";

import { useEffect, useState } from "react";

type SessionData = {
  ok: boolean;
  session?: {
    accountId: string;
    tenantId: string;
    clientId: string;
    slug: string;
    email: string;
    fullName: string;
    role: string;
    mustChangePassword: boolean;
  } | null;
};

type UsersData = {
  ok: boolean;
  accounts?: Array<{
    id: string;
    email: string;
    fullName: string;
    role: string;
    status: string;
    mustChangePassword: boolean;
    createdAt: string;
    updatedAt: string;
  }>;
  error?: string;
};

export default function EquipoPage() {
  const [session, setSession] = useState<SessionData["session"]>(null);
  const [accounts, setAccounts] = useState<UsersData["accounts"]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [createMessage, setCreateMessage] = useState("");
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    role: "staff",
  });

  async function load() {
    setBusy(true);
    setError("");

    try {
      const sessionResponse = await fetch("/api/runtime/session", { cache: "no-store" });
      const sessionData = (await sessionResponse.json()) as SessionData;

      if (!sessionResponse.ok || !sessionData.ok || !sessionData.session) {
        throw new Error("Necesitas iniciar sesión para gestionar el equipo.");
      }

      if (sessionData.session.mustChangePassword) {
        window.location.href = "/primer-acceso?tenant=" + encodeURIComponent(sessionData.session.slug);
        return;
      }

      setSession(sessionData.session);

      const usersResponse = await fetch(
        "/api/runtime/users?tenant=" + encodeURIComponent(sessionData.session.slug),
        { cache: "no-store" }
      );
      const usersData = (await usersResponse.json()) as UsersData;

      if (!usersResponse.ok || !usersData.ok) {
        throw new Error(usersData.error || "No se pudo cargar el equipo.");
      }

      setAccounts(usersData.accounts || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el equipo.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateMessage("");
    setError("");

    if (!session) {
      setError("No hay sesión activa.");
      return;
    }

    try {
      const response = await fetch(
        "/api/runtime/users?tenant=" + encodeURIComponent(session.slug),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            mode: "create",
            ...form,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "No se pudo crear el usuario.");
      }

      setCreateMessage(
        "Usuario creado. Contraseña temporal: " + String(data.account?.temporaryPassword || "")
      );
      setForm({
        fullName: "",
        email: "",
        role: "staff",
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el usuario.");
    }
  }

  async function handleRoleChange(accountId: string, role: string) {
    if (!session) {
      return;
    }

    setCreateMessage("");
    setError("");

    try {
      const response = await fetch(
        "/api/runtime/users?tenant=" + encodeURIComponent(session.slug),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            mode: "role",
            accountId,
            role,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "No se pudo cambiar el rol.");
      }

      setCreateMessage("Rol actualizado correctamente.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cambiar el rol.");
    }
  }

  return (
    <main
      style={{
        padding: 24,
        display: "grid",
        gap: 24,
        fontFamily: "Arial, sans-serif",
        background: "#f8fafc",
      }}
    >
      <section
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 16,
          background: "#ffffff",
          padding: 20,
        }}
      >
        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>Equipo</div>
        <h1 style={{ marginTop: 0, marginBottom: 10, fontSize: 30 }}>
          Usuarios y permisos
        </h1>
        <p style={{ margin: 0, color: "#4b5563" }}>
          Aquí puedes dar acceso a otras personas del negocio y decidir qué rol tiene cada una.
        </p>
      </section>

      {session ? (
        <section
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 16,
            background: "#ffffff",
            padding: 18,
            display: "grid",
            gap: 8,
          }}
        >
          <div><strong>Sesión actual:</strong> {session.fullName}</div>
          <div><strong>Email:</strong> {session.email}</div>
          <div><strong>Rol:</strong> {session.role}</div>
          <div><strong>Tenant:</strong> {session.slug}</div>
        </section>
      ) : null}

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(320px, 0.9fr) minmax(420px, 1.1fr)",
          gap: 24,
          alignItems: "start",
        }}
      >
        <article
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 16,
            background: "#ffffff",
            padding: 20,
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: 16 }}>Dar acceso a otra persona</h2>

          <form onSubmit={handleCreate} style={{ display: "grid", gap: 14 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span>Nombre completo</span>
              <input
                value={form.fullName}
                onChange={(event) =>
                  setForm((current) => ({ ...current, fullName: event.target.value }))
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
              <span>Email</span>
              <input
                type="email"
                value={form.email}
                onChange={(event) =>
                  setForm((current) => ({ ...current, email: event.target.value }))
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
              <span>Rol</span>
              <select
                value={form.role}
                onChange={(event) =>
                  setForm((current) => ({ ...current, role: event.target.value }))
                }
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: 10,
                  fontSize: 14,
                }}
              >
                <option value="admin">admin</option>
                <option value="manager">manager</option>
                <option value="staff">staff</option>
              </select>
            </label>

            <button
              type="submit"
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
              Crear usuario
            </button>
          </form>

          {createMessage ? (
            <div
              style={{
                marginTop: 14,
                border: "1px solid #bbf7d0",
                background: "#f0fdf4",
                color: "#166534",
                borderRadius: 12,
                padding: 12,
              }}
            >
              {createMessage}
            </div>
          ) : null}
        </article>

        <article
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 16,
            background: "#ffffff",
            padding: 20,
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: 16 }}>Personas con acceso</h2>

          {busy ? (
            <div style={{ color: "#6b7280" }}>Cargando equipo...</div>
          ) : accounts && accounts.length > 0 ? (
            <div style={{ display: "grid", gap: 12 }}>
              {accounts.map((item) => (
                <article
                  key={item.id}
                  style={{
                    border: "1px solid #eef2f7",
                    borderRadius: 12,
                    background: "#fafafa",
                    padding: 14,
                    display: "grid",
                    gap: 8,
                  }}
                >
                  <div><strong>{item.fullName}</strong></div>
                  <div>{item.email}</div>
                  <div>Estado: {item.status}</div>
                  <div>Cambio de contraseña pendiente: {item.mustChangePassword ? "Sí" : "No"}</div>

                  <label style={{ display: "grid", gap: 6 }}>
                    <span>Rol</span>
                    <select
                      value={item.role}
                      onChange={(event) => handleRoleChange(item.id, event.target.value)}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        border: "1px solid #d1d5db",
                        borderRadius: 10,
                        fontSize: 14,
                      }}
                    >
                      <option value="owner">owner</option>
                      <option value="admin">admin</option>
                      <option value="manager">manager</option>
                      <option value="staff">staff</option>
                    </select>
                  </label>
                </article>
              ))}
            </div>
          ) : (
            <div style={{ color: "#6b7280" }}>Todavía no hay más usuarios.</div>
          )}
        </article>
      </section>

      {error ? (
        <section
          style={{
            border: "1px solid #fecaca",
            background: "#fef2f2",
            color: "#991b1b",
            borderRadius: 12,
            padding: 12,
          }}
        >
          {error}
        </section>
      ) : null}
    </main>
  );
}