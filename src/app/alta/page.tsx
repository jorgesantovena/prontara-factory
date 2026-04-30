"use client";

import { useEffect, useMemo, useState } from "react";
import PublicNav from "@/components/public-nav";

type AltaSuccess = {
  ok: true;
  clientId: string;
  slug: string;
  displayName: string;
  adminEmail: string;
  activationUrl: string;
  trialExpiresAt: string;
  emailDelivery: { provider: string; sent: boolean; detail: string };
  /** Solo presente si el email NO se envió por Resend. */
  temporaryPasswordIfNotEmailed: string | null;
};

type AltaError = {
  ok: false;
  error: string;
  validationErrors?: string[];
};

type AltaResult = AltaSuccess | AltaError;

const VERTICAL_OPTIONS: Array<{ value: string; label: string; sectorDefault: string }> = [
  { value: "software-factory", label: "Software factory", sectorDefault: "tecnologia" },
  { value: "clinica-dental", label: "Clínica dental", sectorDefault: "salud" },
  { value: "gimnasio", label: "Gimnasio / fitness", sectorDefault: "deporte" },
  { value: "peluqueria", label: "Peluquería / estética", sectorDefault: "servicios" },
  { value: "taller-auto", label: "Taller mecánico", sectorDefault: "automoción" },
  { value: "panaderia", label: "Panadería / hostelería", sectorDefault: "alimentación" },
  { value: "colegio", label: "Colegio / academia", sectorDefault: "educación" },
  { value: "general", label: "Otro / general", sectorDefault: "general" },
];

export default function AltaPage() {
  const [form, setForm] = useState({
    companyName: "",
    contactName: "",
    email: "",
    phone: "",
    slug: "",
    sector: "tecnologia",
    businessType: "software-factory",
    companySize: "small",
  });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AltaResult | null>(null);
  const [transportError, setTransportError] = useState("");

  // Si la URL trae ?vertical=<key>, preseleccionamos el businessType y
  // ajustamos el sector default.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const vertical = (params.get("vertical") || "").trim();
    if (vertical) {
      const found = VERTICAL_OPTIONS.find((v) => v.value === vertical);
      setForm((current) => ({
        ...current,
        businessType: vertical,
        sector: found?.sectorDefault || current.sector,
      }));
    }
  }, []);

  const visualStatus: "idle" | "ok" | "error" = useMemo(() => {
    if (transportError) return "error";
    if (!result) return "idle";
    return result.ok ? "ok" : "error";
  }, [result, transportError]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setTransportError("");
    setResult(null);

    try {
      const response = await fetch("/api/factory/tenants/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: form.companyName,
          contactName: form.contactName,
          email: form.email,
          phone: form.phone,
          desiredSlug: form.slug || undefined,
          sector: form.sector,
          businessType: form.businessType,
          companySize: form.companySize,
        }),
      });

      const data = (await response.json()) as AltaResult;
      setResult(data);

      if (!response.ok || !data.ok) {
        const err = data as AltaError;
        throw new Error(err.error || "Error en el alta.");
      }
    } catch (error) {
      setTransportError(
        error instanceof Error ? error.message : "No se pudo completar el alta.",
      );
    } finally {
      setBusy(false);
    }
  }

  function updateField(key: keyof typeof form, value: string) {
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === "businessType") {
        const found = VERTICAL_OPTIONS.find((v) => v.value === value);
        if (found) next.sector = found.sectorDefault;
      }
      return next;
    });
  }

  return (
    <main style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "Arial, sans-serif" }}>
      <PublicNav />
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px 64px" }}>
        <div style={{ fontSize: 12, color: "#1d4ed8", fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase" }}>
          Alta · 100% online
        </div>
        <h1 style={{ margin: "6px 0 12px 0", fontSize: 36, color: "#111827", lineHeight: 1.15 }}>
          Tu entorno listo en minutos
        </h1>
        <p style={{ color: "#4b5563", fontSize: 16, lineHeight: 1.55 }}>
          Rellena estos cinco datos y te creamos un entorno con 14 días de prueba sin tarjeta. El email
          con tus credenciales te llega al instante.
        </p>

        {result && result.ok ? (
          <SuccessPanel data={result} />
        ) : (
          <form
            onSubmit={handleSubmit}
            className="auth-card"
            style={{
              marginTop: 28,
              padding: 24,
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 16,
              display: "grid",
              gap: 14,
            }}
          >
            <Field
              label="Nombre de empresa"
              required
              value={form.companyName}
              onChange={(v) => updateField("companyName", v)}
            />
            <div style={{ display: "grid", gap: 14, gridTemplateColumns: "1fr 1fr" }}>
              <Field
                label="Tu nombre"
                required
                value={form.contactName}
                onChange={(v) => updateField("contactName", v)}
              />
              <Field
                label="Email de contacto"
                type="email"
                required
                value={form.email}
                onChange={(v) => updateField("email", v)}
              />
            </div>
            <div style={{ display: "grid", gap: 14, gridTemplateColumns: "1fr 1fr" }}>
              <Field
                label="Teléfono (opcional)"
                type="tel"
                value={form.phone}
                onChange={(v) => updateField("phone", v)}
              />
              <Field
                label="Slug (URL de tu entorno, opcional)"
                value={form.slug}
                onChange={(v) => updateField("slug", v.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                hint="Si lo dejas vacío, lo generamos del nombre."
              />
            </div>

            <label style={{ display: "grid", gap: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Vertical de tu negocio</span>
              <select
                value={form.businessType}
                onChange={(e) => updateField("businessType", e.target.value)}
                style={inputStyle()}
              >
                {VERTICAL_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="submit"
              disabled={busy}
              style={{
                marginTop: 8,
                padding: "14px 20px",
                background: busy ? "#94a3b8" : "#1d4ed8",
                color: "#fff",
                border: "none",
                borderRadius: 12,
                fontWeight: 700,
                fontSize: 16,
                cursor: busy ? "not-allowed" : "pointer",
              }}
            >
              {busy ? "Creando tu entorno…" : "Crear mi entorno gratis"}
            </button>

            {visualStatus === "error" && (transportError || (result && !result.ok)) ? (
              <Banner
                tone="danger"
                text={
                  transportError ||
                  ((result as AltaError | null)?.error ?? "Error desconocido.")
                }
                detail={(result as AltaError | null)?.validationErrors?.join(" · ")}
              />
            ) : null}

            <div style={{ fontSize: 11, color: "#9ca3af" }}>
              Al enviar aceptas nuestros{" "}
              <a href="/legal/terminos" style={{ color: "#1d4ed8" }}>términos</a> y{" "}
              <a href="/legal/privacidad" style={{ color: "#1d4ed8" }}>política de privacidad</a>.
            </div>
          </form>
        )}
      </div>
    </main>
  );
}

function SuccessPanel({ data }: { data: AltaSuccess }) {
  return (
    <div
      style={{
        marginTop: 28,
        padding: 24,
        background: "#f0fdf4",
        border: "1px solid #bbf7d0",
        borderRadius: 16,
      }}
    >
      <h2 style={{ margin: 0, fontSize: 22, color: "#166534" }}>¡Bienvenido a Prontara!</h2>
      <p style={{ marginTop: 8, color: "#166534", fontSize: 15 }}>
        Tu entorno <strong>{data.displayName}</strong> está activo. Tienes 14 días de prueba.
      </p>

      <div
        style={{
          marginTop: 16,
          padding: 14,
          background: "#fff",
          border: "1px solid #bbf7d0",
          borderRadius: 12,
          fontSize: 14,
          lineHeight: 1.6,
        }}
      >
        <div><strong>URL de acceso:</strong> <a href={data.activationUrl} style={{ color: "#1d4ed8" }}>{data.activationUrl}</a></div>
        <div><strong>Email:</strong> {data.adminEmail}</div>
        {data.temporaryPasswordIfNotEmailed ? (
          <>
            <div style={{ marginTop: 8, padding: 8, background: "#fef3c7", borderRadius: 8, color: "#92400e" }}>
              <strong>Password temporal:</strong>{" "}
              <code style={{ fontSize: 13 }}>{data.temporaryPasswordIfNotEmailed}</code>
              <div style={{ fontSize: 11, marginTop: 4 }}>
                ⚠ Cópiala ahora — no la guardamos en ningún sitio. (Se muestra aquí
                porque el email no se pudo enviar automáticamente. Cuando configuremos el
                proveedor de email, esto irá a tu bandeja.)
              </div>
            </div>
          </>
        ) : (
          <div style={{ marginTop: 8, fontSize: 13, color: "#166534" }}>
            ✓ Te hemos enviado un email a <strong>{data.adminEmail}</strong> con la contraseña
            temporal. Revisa también la carpeta de spam.
          </div>
        )}
      </div>

      <div style={{ marginTop: 16 }}>
        <a
          href={data.activationUrl}
          style={{
            display: "inline-block",
            padding: "12px 20px",
            background: "#1d4ed8",
            color: "#fff",
            textDecoration: "none",
            borderRadius: 12,
            fontWeight: 700,
            fontSize: 15,
          }}
        >
          Ir a iniciar sesión →
        </a>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: "text" | "email" | "tel";
  required?: boolean;
  hint?: string;
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
      {hint ? <span style={{ fontSize: 11, color: "#6b7280" }}>{hint}</span> : null}
    </label>
  );
}

function Banner({ tone, text, detail }: { tone: "danger"; text: string; detail?: string }) {
  return (
    <div
      style={{
        padding: 12,
        background: "#fef2f2",
        border: "1px solid #fecaca",
        color: "#991b1b",
        borderRadius: 10,
        fontSize: 13,
      }}
    >
      <div style={{ fontWeight: 700 }}>{text}</div>
      {detail ? <div style={{ marginTop: 4, fontSize: 12 }}>{detail}</div> : null}
    </div>
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
