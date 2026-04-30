"use client";

import { useEffect, useState } from "react";
import PublicNav from "@/components/public-nav";

type Status = "idle" | "sending" | "ok" | "error";

export default function ContactoPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    company: "",
    phone: "",
    message: "",
    website: "",
  });
  const [sourceVertical, setSourceVertical] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const v = params.get("vertical") || "";
    if (v) setSourceVertical(v);
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setError(null);
    try {
      const res = await fetch("/api/public/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          company: form.company,
          phone: form.phone,
          message: form.message,
          website: form.website, // honeypot
          sourceVertical: sourceVertical || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "No se pudo enviar el formulario.");
      }
      setStatus("ok");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Error al enviar.");
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(180deg, #f0f9ff 0%, #ffffff 40%, #ffffff 100%)",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <PublicNav current="contacto" />
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "64px 24px" }}>
        <div style={{ fontSize: 12, color: "#1d4ed8", fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase" }}>
          Hablemos
        </div>
        <h1 style={{ margin: "6px 0 12px 0", fontSize: 38, lineHeight: 1.15, color: "#111827" }}>
          Cuéntanos qué quieres{" "}
          <span style={{ color: "#1d4ed8" }}>digitalizar</span>
        </h1>
        <p style={{ color: "#4b5563", fontSize: 16, lineHeight: 1.55 }}>
          Déjanos un mensaje y te llamamos en 24 horas. Si sabes qué vertical te encaja, díselo —
          si no, lo decidimos juntos.
          {sourceVertical ? (
            <>
              {" "}
              <strong style={{ color: "#1d4ed8" }}>
                Llegas desde el vertical {sourceVertical}.
              </strong>
            </>
          ) : null}
        </p>

        {status === "ok" ? (
          <div
            style={{
              marginTop: 24,
              padding: 20,
              border: "1px solid #bbf7d0",
              background: "#f0fdf4",
              borderRadius: 16,
              color: "#166534",
            }}
          >
            <h2 style={{ margin: 0, fontSize: 20 }}>Gracias, mensaje recibido.</h2>
            <p style={{ margin: "6px 0 0 0", fontSize: 14 }}>
              Te escribimos a {form.email} en menos de 24 horas hábiles.
            </p>
          </div>
        ) : (
          <form
            onSubmit={submit}
            style={{
              marginTop: 24,
              display: "grid",
              gap: 14,
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 16,
              padding: 22,
            }}
          >
            <Field
              label="Nombre"
              required
              value={form.name}
              onChange={(v) => setForm({ ...form, name: v })}
            />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Field
                label="Email"
                type="email"
                required
                value={form.email}
                onChange={(v) => setForm({ ...form, email: v })}
              />
              <Field
                label="Teléfono (opcional)"
                type="tel"
                value={form.phone}
                onChange={(v) => setForm({ ...form, phone: v })}
              />
            </div>
            <Field
              label="Empresa (opcional)"
              value={form.company}
              onChange={(v) => setForm({ ...form, company: v })}
            />
            <label style={{ display: "grid", gap: 4 }}>
              <span style={{ fontSize: 13, color: "#374151", fontWeight: 600 }}>
                Cuéntanos qué necesitas
              </span>
              <textarea
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                rows={5}
                style={inputStyle()}
                placeholder="Tengo una pyme de… Me interesa sobre todo…"
              />
            </label>

            {/* Honeypot: invisible para humanos, visible para bots */}
            <label
              aria-hidden="true"
              style={{ position: "absolute", left: -9999, top: "auto", width: 1, height: 1, overflow: "hidden" }}
            >
              Website
              <input
                type="text"
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
                tabIndex={-1}
                autoComplete="off"
              />
            </label>

            <button
              type="submit"
              disabled={status === "sending"}
              style={{
                padding: "14px 20px",
                background: status === "sending" ? "#94a3b8" : "#1d4ed8",
                color: "#fff",
                border: "none",
                borderRadius: 12,
                fontWeight: 700,
                cursor: status === "sending" ? "not-allowed" : "pointer",
                fontSize: 15,
              }}
            >
              {status === "sending" ? "Enviando…" : "Enviar"}
            </button>

            {status === "error" && error ? (
              <div
                role="alert"
                style={{
                  padding: 12,
                  border: "1px solid #fecaca",
                  background: "#fef2f2",
                  color: "#991b1b",
                  borderRadius: 10,
                  fontSize: 13,
                }}
              >
                {error}
              </div>
            ) : null}

            <div style={{ fontSize: 11, color: "#9ca3af" }}>
              Al enviar aceptas que guardemos tu email para contactarte. No se lo pasamos a nadie.
            </div>
          </form>
        )}
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: "text" | "email" | "tel";
  required?: boolean;
}) {
  return (
    <label style={{ display: "grid", gap: 4 }}>
      <span style={{ fontSize: 13, color: "#374151", fontWeight: 600 }}>
        {label} {required ? <span style={{ color: "#991b1b" }}>*</span> : null}
      </span>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle()}
      />
    </label>
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
