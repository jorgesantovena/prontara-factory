"use client";

import { useEffect, useState } from "react";

/**
 * Constructor de campos personalizados (DEV-CF).
 *
 * Permite al operador del tenant añadir campos custom a CUALQUIER módulo
 * sin tocar código. Los campos se mezclan en runtime con los del pack
 * sectorial — los custom tienen prioridad sobre los del pack.
 */
type CustomField = {
  id: string;
  moduleKey: string;
  fieldKey: string;
  label: string;
  kind: string;
  required: boolean;
  placeholder: string | null;
  position: number;
};

const KINDS = ["text", "email", "tel", "textarea", "date", "number", "money", "status"];

export default function AjustesCamposPage() {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Form
  const [moduleKey, setModuleKey] = useState("clientes");
  const [fieldKey, setFieldKey] = useState("");
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState("text");
  const [required, setRequired] = useState(false);
  const [placeholder, setPlaceholder] = useState("");

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/runtime/custom-fields", { cache: "no-store" });
      const data = await r.json();
      if (r.ok && data.ok) setFields(data.fields || []);
      else setError(data.error || "Error.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function handleCreate() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/runtime/custom-fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleKey, fieldKey, label, kind, required, placeholder, position: 100 + fields.length }),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        setError(data.error || "Error creando campo.");
        return;
      }
      setFieldKey(""); setLabel(""); setPlaceholder(""); setRequired(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Borrar este campo personalizado? Los registros existentes que tengan ese campo lo conservarán como dato suelto.")) return;
    setBusy(true);
    try {
      await fetch("/api/runtime/custom-fields?id=" + encodeURIComponent(id), { method: "DELETE" });
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: 24, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, color: "#0f172a", margin: "0 0 8px 0" }}>
        Campos personalizados
      </h1>
      <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 24 }}>
        Añade campos extra a cualquier módulo. Aparecerán en formulario y tabla automáticamente.
      </p>

      {error ? <Alert kind="error">{error}</Alert> : null}

      <section style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 18, background: "#ffffff", marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 12px 0" }}>Nuevo campo</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <Field label="Módulo">
            <input value={moduleKey} onChange={(e) => setModuleKey(e.target.value)} placeholder="clientes, proyectos..." style={ipt} />
          </Field>
          <Field label="Identificador (snake_case)">
            <input value={fieldKey} onChange={(e) => setFieldKey(e.target.value)} placeholder="dni, ultima_visita..." style={ipt} />
          </Field>
          <Field label="Etiqueta visible">
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="DNI" style={ipt} />
          </Field>
          <Field label="Tipo">
            <select value={kind} onChange={(e) => setKind(e.target.value)} style={ipt}>
              {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </Field>
          <Field label="Placeholder">
            <input value={placeholder} onChange={(e) => setPlaceholder(e.target.value)} style={ipt} />
          </Field>
          <Field label="Obligatorio">
            <label style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 6, fontSize: 13 }}>
              <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} />
              Sí, debe rellenarse
            </label>
          </Field>
        </div>
        <button
          type="button"
          onClick={handleCreate}
          disabled={busy || !moduleKey || !fieldKey || !label}
          style={{ marginTop: 16, border: "none", background: "#1d4ed8", color: "#ffffff", borderRadius: 8, padding: "10px 18px", fontWeight: 700, fontSize: 14, cursor: busy ? "not-allowed" : "pointer", opacity: busy || !moduleKey || !fieldKey || !label ? 0.6 : 1 }}
        >
          {busy ? "Guardando..." : "Crear campo"}
        </button>
      </section>

      <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 12px 0" }}>Campos personalizados ({fields.length})</h2>
      {loading ? <p>Cargando…</p> : null}
      {!loading && fields.length === 0 ? (
        <p style={{ color: "#6b7280", padding: 16, background: "#f9fafb", borderRadius: 8 }}>
          Sin campos personalizados. Añade el primero arriba.
        </p>
      ) : null}
      <div style={{ display: "grid", gap: 8 }}>
        {fields.map((f) => (
          <div key={f.id} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 14, background: "#ffffff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <strong>{f.label}</strong>{" "}
              <code style={{ fontSize: 12, color: "#6b7280" }}>({f.fieldKey})</code>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                Módulo: <code>{f.moduleKey}</code> · Tipo: <code>{f.kind}</code>
                {f.required ? " · Obligatorio" : ""}
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleDelete(f.id)}
              style={{ border: "1px solid #fecaca", background: "#ffffff", color: "#dc2626", borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}
            >
              Borrar
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}

const ipt: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  border: "1px solid #d1d5db",
  borderRadius: 6,
  fontSize: 13,
  fontFamily: "inherit",
  boxSizing: "border-box",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 4 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: "#475569", textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</span>
      {children}
    </label>
  );
}

function Alert({ kind, children }: { kind: "error" | "ok"; children: React.ReactNode }) {
  const palette = kind === "error"
    ? { border: "#fecaca", bg: "#fef2f2", color: "#991b1b" }
    : { border: "#bbf7d0", bg: "#f0fdf4", color: "#166534" };
  return (
    <div style={{ border: "1px solid " + palette.border, background: palette.bg, color: palette.color, borderRadius: 8, padding: 12, fontSize: 13, marginBottom: 12 }}>
      {children}
    </div>
  );
}
