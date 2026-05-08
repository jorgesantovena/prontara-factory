"use client";

import { useEffect, useMemo, useState } from "react";

/**
 * Constructor de campos personalizados (DEV-CF + H2-FBD).
 *
 * H2-FBD: añade reorden visual con drag&drop nativo HTML5 dentro de
 * cada módulo. La nueva posición se persiste vía PATCH masivo a
 * /api/runtime/custom-fields { reorder: [{ id, position }, ...] }.
 *
 * También se ha añadido edición inline (cambiar etiqueta, kind o
 * required sin borrar y recrear) — el endpoint POST hace upsert por
 * (clientId, moduleKey, fieldKey).
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
  const [savedHint, setSavedHint] = useState("");

  // Form de creación
  const [moduleKey, setModuleKey] = useState("clientes");
  const [fieldKey, setFieldKey] = useState("");
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState("text");
  const [required, setRequired] = useState(false);
  const [placeholder, setPlaceholder] = useState("");

  // Drag state
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/runtime/custom-fields", { cache: "no-store" });
      const data = await r.json();
      if (r.ok && data.ok) setFields((data.fields || []) as CustomField[]);
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

  async function handleSaveInline(field: CustomField, patch: Partial<CustomField>) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/runtime/custom-fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moduleKey: field.moduleKey,
          fieldKey: field.fieldKey,
          label: patch.label ?? field.label,
          kind: patch.kind ?? field.kind,
          required: patch.required ?? field.required,
          placeholder: patch.placeholder ?? field.placeholder ?? "",
          position: field.position,
        }),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        setError(data.error || "Error guardando cambios.");
        return;
      }
      setSavedHint("✓ Guardado");
      setTimeout(() => setSavedHint(""), 1200);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setBusy(false);
    }
  }

  /**
   * Agrupar por moduleKey para drag&drop dentro del scope de cada módulo.
   * Reordenar entre módulos no tiene sentido (el campo pertenece a uno).
   */
  const grouped = useMemo(() => {
    const m = new Map<string, CustomField[]>();
    for (const f of fields) {
      if (!m.has(f.moduleKey)) m.set(f.moduleKey, []);
      m.get(f.moduleKey)!.push(f);
    }
    for (const arr of m.values()) {
      arr.sort((a, b) => a.position - b.position);
    }
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [fields]);

  function onDragStart(id: string) {
    setDragId(id);
  }
  function onDragOver(e: React.DragEvent, id: string) {
    e.preventDefault();
    if (dragId && dragId !== id) setOverId(id);
  }
  function onDragLeave() {
    setOverId(null);
  }
  async function onDrop(targetModule: string, targetId: string) {
    if (!dragId) {
      setOverId(null);
      return;
    }
    const moduleFields = fields.filter((f) => f.moduleKey === targetModule).slice().sort((a, b) => a.position - b.position);
    const fromIdx = moduleFields.findIndex((f) => f.id === dragId);
    const toIdx = moduleFields.findIndex((f) => f.id === targetId);
    setDragId(null);
    setOverId(null);
    if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return;

    // Solo reordenamos dentro del mismo módulo
    const dragField = moduleFields[fromIdx];
    if (dragField.moduleKey !== targetModule) return;

    const reordered = moduleFields.slice();
    reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, dragField);

    // Recalcular posiciones (10, 20, 30...)
    const reorderPayload = reordered.map((f, i) => ({ id: f.id, position: (i + 1) * 10 }));

    // Optimistic update
    setFields((prev) => {
      const others = prev.filter((f) => f.moduleKey !== targetModule);
      const updated = reordered.map((f, i) => ({ ...f, position: (i + 1) * 10 }));
      return [...others, ...updated];
    });

    try {
      const r = await fetch("/api/runtime/custom-fields", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reorder: reorderPayload }),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        setError(data.error || "Error reordenando.");
        await load();
        return;
      }
      setSavedHint("✓ Orden guardado");
      setTimeout(() => setSavedHint(""), 1200);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
      await load();
    }
  }

  return (
    <main style={{ maxWidth: 1080, margin: "0 auto", padding: 24, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, color: "#0f172a", margin: "0 0 8px 0" }}>
        Campos personalizados
      </h1>
      <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 24 }}>
        Añade campos extra a cualquier módulo. Aparecerán en formulario y tabla automáticamente.
        Reordénalos arrastrándolos para cambiar el orden en que se muestran.
      </p>

      {error ? <Alert kind="error">{error}</Alert> : null}
      {savedHint ? <Alert kind="ok">{savedHint}</Alert> : null}

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

      <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 12px 0" }}>
        Campos personalizados ({fields.length})
      </h2>
      {loading ? <p>Cargando…</p> : null}
      {!loading && fields.length === 0 ? (
        <p style={{ color: "#6b7280", padding: 16, background: "#f9fafb", borderRadius: 8 }}>
          Sin campos personalizados. Añade el primero arriba.
        </p>
      ) : null}

      <div style={{ display: "grid", gap: 18 }}>
        {grouped.map(([modKey, modFields]) => (
          <section key={modKey} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, background: "#ffffff" }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 10px 0" }}>
              Módulo: <code style={{ color: "#1d4ed8" }}>{modKey}</code> · {modFields.length} campos
            </h3>
            <div style={{ display: "grid", gap: 6 }}>
              {modFields.map((f) => (
                <div
                  key={f.id}
                  draggable
                  onDragStart={() => onDragStart(f.id)}
                  onDragOver={(e) => onDragOver(e, f.id)}
                  onDragLeave={onDragLeave}
                  onDrop={() => onDrop(modKey, f.id)}
                  onDragEnd={() => { setDragId(null); setOverId(null); }}
                  style={{
                    border: "1px solid " + (overId === f.id ? "#1d4ed8" : "#e5e7eb"),
                    background: overId === f.id ? "#eff6ff" : (dragId === f.id ? "#f1f5f9" : "#ffffff"),
                    borderRadius: 8,
                    padding: "10px 12px",
                    display: "grid",
                    gridTemplateColumns: "20px 1.4fr 1fr 0.7fr auto auto",
                    gap: 10,
                    alignItems: "center",
                    cursor: "grab",
                    opacity: dragId === f.id ? 0.5 : 1,
                    transition: "background 0.15s, border-color 0.15s",
                  }}
                >
                  <span title="Arrastra para reordenar" style={{ color: "#94a3b8", fontSize: 16, userSelect: "none" }}>≡</span>
                  <div>
                    <input
                      type="text"
                      defaultValue={f.label}
                      onBlur={(e) => {
                        if (e.target.value !== f.label) handleSaveInline(f, { label: e.target.value });
                      }}
                      style={{ ...ipt, padding: "5px 8px" }}
                    />
                    <code style={{ fontSize: 11, color: "#94a3b8", marginLeft: 2 }}>{f.fieldKey}</code>
                  </div>
                  <select
                    defaultValue={f.kind}
                    onChange={(e) => handleSaveInline(f, { kind: e.target.value })}
                    style={{ ...ipt, padding: "5px 8px" }}
                  >
                    {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
                  </select>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                    <input
                      type="checkbox"
                      defaultChecked={f.required}
                      onChange={(e) => handleSaveInline(f, { required: e.target.checked })}
                    />
                    Obligatorio
                  </label>
                  <span style={{ fontSize: 11, color: "#94a3b8" }}>pos {f.position}</span>
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
          </section>
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
