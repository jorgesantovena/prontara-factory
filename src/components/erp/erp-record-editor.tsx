"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useCurrentVertical } from "@/lib/saas/use-current-vertical";

/**
 * Editor full-page para crear/editar un registro de cualquier módulo.
 * Reemplaza al modal slideover (H12-G — diseño mockup).
 *
 * Layout:
 *   1. Breadcrumb "{Módulo} / {Módulo} / Nuevo {singular}"
 *   2. Header: título + estrella favorito + pill "No guardado" si dirty
 *      + botones [Cancelar] [Guardar y nuevo] [Guardar]
 *   3. Tabs (Datos generales / Contactos / Comercial / Financiero / Notas / Documentos)
 *      — agrupados auto por heurística sobre fieldKey para no tocar los packs.
 *   4. Layout 2 columnas:
 *        - Izquierda: grid 2-cols con los campos del tab activo
 *        - Derecha: cards de info rápida + estadísticas (solo en edición)
 *
 * Mantiene la misma firma que ErpRecordModal para que el componente
 * que lo usa (generic-module-runtime-page) pueda swap directo.
 */

type FieldKind = "text" | "email" | "tel" | "textarea" | "date" | "number" | "money" | "status" | "relation";

type UiFieldDefinition = {
  key: string;
  label: string;
  kind: FieldKind;
  required?: boolean;
  relationModuleKey?: string;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
};

type OptionItem = { value: string; label: string };

type TabKey = "general" | "contacto" | "comercial" | "financiero" | "notas" | "documentos";

const TAB_LABELS: Record<TabKey, string> = {
  general: "Datos generales",
  contacto: "Contactos",
  comercial: "Comercial",
  financiero: "Financiero",
  notas: "Notas",
  documentos: "Documentos",
};

function classifyField(key: string): TabKey {
  const k = key.toLowerCase();
  // TEST-2.5 — dirección, población, CP, provincia, país NO van en
  // "contacto" sino en "general" (son datos de la empresa/cliente, no
  // del interlocutor humano que es un contacto independiente).
  if (k.includes("telefono") || k.includes("tel") || k.includes("email") ||
      k.includes("contacto") || k.includes("web") || k.includes("sitio")) {
    return "contacto";
  }
  if (k.includes("importe") || k.includes("saldo") || k.includes("credito") ||
      k.includes("iban") || k.includes("forma") || k.includes("tarifa") ||
      k.includes("cuenta") || k.includes("vencimiento") || k.includes("descuento") ||
      k.includes("recargo") || k.includes("precio") || k.includes("moneda") ||
      k === "iva" || k === "irpf") {
    return "financiero";
  }
  if (k.includes("vendedor") || k.includes("comercial") || k.includes("zona") ||
      k.includes("grupo") || k.includes("origen") || k === "tipo" ||
      k.includes("segmento") || k.includes("responsable") || k.includes("ejecutivo")) {
    return "comercial";
  }
  if (k.includes("nota") || k.includes("observ") || k.includes("comment") ||
      k.includes("descripcion")) {
    return "notas";
  }
  return "general";
}

export default function ErpRecordEditor({
  mode,
  moduleKey,
  moduleLabel,
  fields,
  initialValue,
  tenant,
  accent = "#1d4ed8",
  onCancel,
  onSubmit,
}: {
  mode: "create" | "edit";
  moduleKey: string;
  moduleLabel: string;
  fields: UiFieldDefinition[];
  initialValue?: Record<string, string> | null;
  tenant?: string;
  accent?: string;
  onCancel: () => void;
  onSubmit: (payload: Record<string, string>, options?: { andNew?: boolean }) => Promise<void> | void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [optionsMap, setOptionsMap] = useState<Record<string, OptionItem[]>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [tab, setTab] = useState<TabKey>("general");
  const [favorite, setFavorite] = useState(false);

  // Agrupa fields por tab
  const grouped = useMemo(() => {
    const acc: Record<TabKey, UiFieldDefinition[]> = {
      general: [], contacto: [], comercial: [], financiero: [], notas: [], documentos: [],
    };
    for (const f of fields) acc[classifyField(f.key)].push(f);
    return acc;
  }, [fields]);

  // TEST-1.5 — Tabs visibles. "Documentos" solo se muestra si hay otras
  // tabs con fields (no como única tab — antes salía sola si fields=[]).
  const tabsConFields = (Object.keys(TAB_LABELS) as TabKey[]).filter((t) => grouped[t].length > 0);
  const visibleTabs: TabKey[] = tabsConFields.length > 0
    ? [...tabsConFields, "documentos" as TabKey]
    : []; // sin fields → no mostramos tabs, mostramos mensaje (ver render)

  // Reset valores al cambiar mode/initialValue/fields
  useEffect(() => {
    const next: Record<string, string> = {};
    for (const f of fields) next[f.key] = String(initialValue?.[f.key] ?? "");
    setValues(next);
    setDirty(false);
    setError("");
    // Tab inicial: primera tab con fields, NUNCA "documentos" como default.
    setTab(tabsConFields[0] || "general");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, fields, initialValue]);

  // Cargar opciones de relación
  useEffect(() => {
    let cancelled = false;
    async function loadRelations() {
      const relationFields = fields.filter((f) => f.kind === "relation" && f.relationModuleKey);
      for (const f of relationFields) {
        try {
          const r = await fetch(
            "/api/erp/options?module=" + encodeURIComponent(String(f.relationModuleKey || "")) +
            (tenant ? "&tenant=" + encodeURIComponent(tenant) : ""),
            { cache: "no-store" },
          );
          const d = await r.json();
          if (!cancelled && r.ok && d.ok) {
            setOptionsMap((cur) => ({ ...cur, [f.key]: Array.isArray(d.options) ? d.options : [] }));
          }
        } catch { /* ignore */ }
      }
    }
    loadRelations();
    return () => { cancelled = true; };
  }, [fields, tenant]);

  function setField(key: string, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
    setDirty(true);
  }

  async function doSubmit(andNew: boolean = false) {
    setBusy(true);
    setError("");
    try {
      // TEST-1.5 — Bloquear guardado si no hay fields configurados.
      // Antes el tester podía pulsar Guardar 4 veces y crear 4 registros vacíos.
      if (fields.length === 0) {
        throw new Error("Este módulo no tiene campos configurados. Configúralos en Ajustes → Campos personalizados antes de crear registros.");
      }
      // Validación mínima: required no vacíos
      const missing = fields.filter((f) => f.required && !String(values[f.key] || "").trim());
      if (missing.length > 0) {
        // Saltar al primer tab que tenga el campo faltante
        const firstMissingTab = classifyField(missing[0].key);
        setTab(firstMissingTab);
        throw new Error("Faltan campos obligatorios: " + missing.map((m) => m.label).join(", "));
      }
      await onSubmit(values, { andNew });
      setDirty(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error guardando.");
    } finally {
      setBusy(false);
    }
  }

  const titulo = mode === "edit"
    ? String(initialValue?.nombre || initialValue?.titulo || initialValue?.numero || initialValue?.referencia || initialValue?.asunto || "Editar " + singular(moduleLabel))
    : "Nuevo " + singular(moduleLabel);

  // Sidebar info: solo en edit, calculada de los datos del propio registro
  const showSidebar = mode === "edit" && initialValue;

  return (
    <div style={{ color: "#0f172a", fontFamily: "system-ui, -apple-system, sans-serif", maxWidth: 1280, margin: "0 auto" }}>
      {/* Breadcrumb */}
      <div style={{ fontSize: 13, color: "#64748b", marginBottom: 6 }}>
        <Link href="/" style={{ color: "#64748b", textDecoration: "none" }}>Inicio</Link>
        <span style={{ margin: "0 6px" }}>/</span>
        <Link href={"/" + moduleKey} style={{ color: "#64748b", textDecoration: "none" }}>{moduleLabel}</Link>
        <span style={{ margin: "0 6px" }}>/</span>
        <span style={{ color: "#0f172a", fontWeight: 600 }}>{titulo}</span>
      </div>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 18, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: -0.4 }}>{titulo}</h1>
          <button
            type="button"
            onClick={() => setFavorite((f) => !f)}
            title={favorite ? "Quitar de favoritos" : "Marcar como favorito"}
            style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 18, color: favorite ? "#eab308" : "#cbd5e1" }}
          >
            {favorite ? "★" : "☆"}
          </button>
          {dirty ? (
            <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 999, background: "#ffedd5", color: "#c2410c", fontSize: 11, fontWeight: 700 }}>
              No guardado
            </span>
          ) : mode === "edit" ? (
            <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 999, background: "#dcfce7", color: "#15803d", fontSize: 11, fontWeight: 700 }}>
              Guardado
            </span>
          ) : null}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={onCancel} disabled={busy} style={btnSecondary}>Cancelar</button>
          {mode === "create" ? (
            <button type="button" onClick={() => doSubmit(true)} disabled={busy} style={btnSecondaryAccent(accent)}>
              Guardar y nuevo
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => doSubmit(false)}
            disabled={busy || fields.length === 0}
            style={{ ...btnPrimary(accent), opacity: fields.length === 0 ? 0.5 : 1, cursor: fields.length === 0 ? "not-allowed" : "pointer" }}
            title={fields.length === 0 ? "No hay campos configurados en este módulo" : undefined}
          >
            {busy ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      {visibleTabs.length > 1 ? (
        <div style={{ display: "flex", gap: 4, borderBottom: "1px solid #e5e7eb", marginBottom: 20, overflowX: "auto" }}>
          {visibleTabs.map((t) => {
            const active = tab === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                style={{
                  padding: "12px 18px",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: active ? 700 : 500,
                  color: active ? accent : "#64748b",
                  borderBottom: active ? "2px solid " + accent : "2px solid transparent",
                  marginBottom: -1,
                  whiteSpace: "nowrap",
                }}
              >
                {TAB_LABELS[t]}
              </button>
            );
          })}
        </div>
      ) : null}

      {error ? (
        <div style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", borderRadius: 10, padding: "10px 14px", fontSize: 13, marginBottom: 14 }}>
          {error}
        </div>
      ) : null}

      {/* Contenido principal: 2 columnas */}
      <div style={{ display: "grid", gridTemplateColumns: showSidebar ? "minmax(0, 1fr) 320px" : "minmax(0, 1fr)", gap: 18, alignItems: "flex-start" }} className="prontara-editor-cols">
        {/* Form izquierda */}
        <form
          onSubmit={(e) => { e.preventDefault(); doSubmit(false); }}
          style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 24 }}
        >
          {fields.length === 0 ? (
            <NoFieldsConfigured moduleLabel={moduleLabel} />
          ) : tab === "documentos" ? (
            <DocumentosTab moduleKey={moduleKey} recordId={String(initialValue?.id || "")} mode={mode} />
          ) : (
            <>
              <FieldGrid fields={grouped[tab]} values={values} setField={setField} optionsMap={optionsMap} accent={accent} />
              {/* TEST-2.3 + TEST-2.4 — Sublista de Contactos cuando aplique.
                  El usuario puede crear/editar/eliminar contactos y marcar
                  uno como preferido. Se persiste como JSON en contactosJson. */}
              {tab === "contacto" && moduleKey === "clientes" ? (
                <ContactosSublist
                  initialJson={String(values.contactosJson || initialValue?.contactosJson || "[]")}
                  onChange={(json) => setField("contactosJson", json)}
                  accent={accent}
                />
              ) : null}
            </>
          )}
        </form>

        {/* Sidebar derecha (solo edit) */}
        {showSidebar ? (
          <div style={{ display: "grid", gap: 14 }}>
            <InfoRapidaCard record={initialValue || {}} />
            <EstadisticasCard record={initialValue || {}} />
          </div>
        ) : null}
      </div>

      <style>{`
        @media (max-width: 980px) {
          .prontara-editor-cols { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

// === Field grid ===
function FieldGrid({ fields, values, setField, optionsMap, accent }: {
  fields: UiFieldDefinition[];
  values: Record<string, string>;
  setField: (k: string, v: string) => void;
  optionsMap: Record<string, OptionItem[]>;
  accent: string;
}) {
  if (fields.length === 0) {
    return <div style={{ padding: 30, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>No hay campos en esta sección.</div>;
  }
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} className="prontara-field-grid">
      {fields.map((f) => {
        const isWide = f.kind === "textarea";
        return (
          <div key={f.key} style={{ gridColumn: isWide ? "1 / -1" : undefined }}>
            <FieldInput field={f} value={values[f.key] || ""} onChange={(v) => setField(f.key, v)} options={optionsMap[f.key]} accent={accent} />
          </div>
        );
      })}
      <style>{`
        @media (max-width: 720px) {
          .prontara-field-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

function FieldInput({ field, value, onChange, options, accent }: {
  field: UiFieldDefinition;
  value: string;
  onChange: (v: string) => void;
  options?: OptionItem[];
  accent: string;
}) {
  const labelEl = (
    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
      {field.label}
      {field.required ? <span style={{ color: "#dc2626", marginLeft: 4 }}>*</span> : null}
    </label>
  );
  const baseStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    background: "#ffffff",
    color: "#0f172a",
    fontSize: 13,
    fontFamily: "inherit",
    boxSizing: "border-box",
    outline: "none",
  };

  let inputEl: React.ReactNode;

  if (field.kind === "textarea") {
    inputEl = (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        rows={4}
        style={{ ...baseStyle, resize: "vertical", minHeight: 80 }}
      />
    );
  } else if (field.kind === "status" && (field.options?.length || options?.length)) {
    const opts = field.options || options || [];
    inputEl = (
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{ ...baseStyle, appearance: "none", paddingRight: 28, backgroundImage: chevronBg, backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center", backgroundSize: "10px" }}>
        <option value="">— Selecciona —</option>
        {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  } else if (field.kind === "relation") {
    const opts = options || [];
    inputEl = (
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{ ...baseStyle, appearance: "none", paddingRight: 28, backgroundImage: chevronBg, backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center", backgroundSize: "10px" }}>
        <option value="">— Selecciona —</option>
        {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  } else if (field.kind === "money") {
    inputEl = (
      <div style={{ position: "relative" }}>
        <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94a3b8", fontSize: 13, pointerEvents: "none" }}>€</span>
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder || "0,00"}
          style={{ ...baseStyle, paddingLeft: 28 }}
        />
      </div>
    );
  } else if (field.kind === "date") {
    inputEl = (
      <input type="date" value={value} onChange={(e) => onChange(e.target.value)} style={baseStyle} />
    );
  } else if (field.kind === "tel") {
    inputEl = (
      <div style={{ display: "flex", gap: 6 }}>
        <span style={{ display: "inline-flex", alignItems: "center", padding: "0 10px", border: "1px solid #e2e8f0", borderRadius: 8, background: "#f8fafc", fontSize: 13, color: "#475569" }}>🇪🇸</span>
        <input type="tel" value={value} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder || "+34 600 000 000"} style={baseStyle} />
      </div>
    );
  } else if (field.kind === "email") {
    inputEl = <input type="email" value={value} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} style={baseStyle} />;
  } else if (field.kind === "number") {
    inputEl = <input type="number" value={value} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} style={baseStyle} />;
  } else {
    inputEl = <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} style={baseStyle} />;
  }

  void accent;

  return (
    <div>
      {labelEl}
      {inputEl}
    </div>
  );
}

const chevronBg = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath fill='%2364748b' d='M6 8.5L2 4.5h8z'/%3E%3C/svg%3E\")";

// TEST-2.3 + TEST-2.4 — Sublista de Contactos con CRUD inline.
// Persiste como JSON en el field `contactosJson` del cliente.
type Contacto = {
  id: string;
  nombre: string;
  cargo: string;
  email: string;
  telefono: string;
  preferido: boolean;
};

function ContactosSublist({ initialJson, onChange, accent }: {
  initialJson: string;
  onChange: (json: string) => void;
  accent: string;
}) {
  const [contactos, setContactos] = useState<Contacto[]>(() => {
    try {
      const arr = JSON.parse(initialJson || "[]");
      if (Array.isArray(arr)) return arr.filter((c) => c && typeof c === "object").map((c) => ({
        id: String(c.id || Math.random().toString(36).slice(2, 10)),
        nombre: String(c.nombre || ""),
        cargo: String(c.cargo || ""),
        email: String(c.email || ""),
        telefono: String(c.telefono || ""),
        preferido: Boolean(c.preferido),
      }));
    } catch { /* invalid json */ }
    return [];
  });

  function persist(next: Contacto[]) {
    setContactos(next);
    onChange(JSON.stringify(next));
  }

  function add() {
    const newC: Contacto = {
      id: Math.random().toString(36).slice(2, 10),
      nombre: "", cargo: "", email: "", telefono: "",
      preferido: contactos.length === 0, // el primero queda como preferido por defecto
    };
    persist([...contactos, newC]);
  }

  function update(id: string, patch: Partial<Contacto>) {
    persist(contactos.map((c) => c.id === id ? { ...c, ...patch } : c));
  }

  function setPreferido(id: string) {
    persist(contactos.map((c) => ({ ...c, preferido: c.id === id })));
  }

  function remove(id: string) {
    const removing = contactos.find((c) => c.id === id);
    let next = contactos.filter((c) => c.id !== id);
    // Si borramos el preferido y queda alguien, marcar el primero
    if (removing?.preferido && next.length > 0) {
      next = next.map((c, i) => ({ ...c, preferido: i === 0 }));
    }
    persist(next);
  }

  return (
    <section style={{ marginTop: 24, paddingTop: 18, borderTop: "1px solid #e5e7eb" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0f172a" }}>Contactos del cliente</h3>
          <p style={{ margin: "2px 0 0 0", fontSize: 12, color: "#64748b" }}>
            Las personas con las que tratas. Marca uno como preferido para que aparezca en el listado.
          </p>
        </div>
        <button
          type="button"
          onClick={add}
          style={{ background: accent, color: "#fff", border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
        >
          + Añadir contacto
        </button>
      </div>

      {contactos.length === 0 ? (
        <div style={{ padding: 24, textAlign: "center", color: "#94a3b8", fontSize: 13, border: "1px dashed #e5e7eb", borderRadius: 10 }}>
          Aún no hay contactos. Pulsa "Añadir contacto" para empezar.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {contactos.map((c) => (
            <div key={c.id} style={{ border: "1px solid " + (c.preferido ? accent : "#e5e7eb"), background: c.preferido ? "#eff6ff" : "#ffffff", borderRadius: 10, padding: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8, marginBottom: 8, alignItems: "center" }}>
                <input
                  type="text"
                  value={c.nombre}
                  onChange={(e) => update(c.id, { nombre: e.target.value })}
                  placeholder="Nombre"
                  style={subIpt}
                />
                <input
                  type="text"
                  value={c.cargo}
                  onChange={(e) => update(c.id, { cargo: e.target.value })}
                  placeholder="Cargo"
                  style={subIpt}
                />
                <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: c.preferido ? accent : "#64748b", cursor: "pointer", whiteSpace: "nowrap" }}>
                  <input type="radio" checked={c.preferido} onChange={() => setPreferido(c.id)} />
                  Preferido
                </label>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8, alignItems: "center" }}>
                <input
                  type="email"
                  value={c.email}
                  onChange={(e) => update(c.id, { email: e.target.value })}
                  placeholder="email@ejemplo.com"
                  style={subIpt}
                />
                <input
                  type="tel"
                  value={c.telefono}
                  onChange={(e) => update(c.id, { telefono: e.target.value })}
                  placeholder="+34 600 000 000"
                  style={subIpt}
                />
                <button
                  type="button"
                  onClick={() => remove(c.id)}
                  title="Eliminar contacto"
                  style={{ background: "transparent", border: "1px solid #fecaca", color: "#dc2626", borderRadius: 6, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

const subIpt: React.CSSProperties = {
  padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6,
  fontSize: 13, fontFamily: "inherit", boxSizing: "border-box",
};

// TEST-1.5 — mensaje cuando el pack del tenant no tiene fields para el
// módulo. Antes el editor mostraba la tab "Documentos" como única, lo que
// permitía al usuario pulsar Guardar y crear registros vacíos.
function NoFieldsConfigured({ moduleLabel }: { moduleLabel: string }) {
  return (
    <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>
      <div style={{ fontSize: 40, marginBottom: 14 }}>🧩</div>
      <h3 style={{ margin: "0 0 8px 0", fontSize: 16, fontWeight: 700, color: "#0f172a" }}>
        Sin campos configurados
      </h3>
      <p style={{ margin: "0 0 16px 0", fontSize: 13, maxWidth: 460, marginLeft: "auto", marginRight: "auto", lineHeight: 1.5 }}>
        El módulo <strong>{moduleLabel}</strong> aún no tiene campos definidos en tu pack sectorial.
        Configúralos en <strong>Ajustes → Campos personalizados</strong> antes de crear registros.
      </p>
      <a href="/ajustes-campos" style={{ display: "inline-block", padding: "8px 16px", background: "#1d4ed8", color: "#ffffff", borderRadius: 8, textDecoration: "none", fontSize: 13, fontWeight: 600 }}>
        Ir a Ajustes de campos →
      </a>
    </div>
  );
}

// === Documentos tab (placeholder con link al módulo documentos) ===
function DocumentosTab({ moduleKey, recordId, mode }: { moduleKey: string; recordId: string; mode: "create" | "edit" }) {
  const { link } = useCurrentVertical();
  if (mode === "create") {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
        Guarda primero el registro para poder adjuntar documentos.
      </div>
    );
  }
  void moduleKey;
  return (
    <div style={{ padding: 30, textAlign: "center", color: "#64748b", fontSize: 13 }}>
      <div style={{ fontSize: 32, marginBottom: 10 }}>📎</div>
      <div style={{ marginBottom: 10 }}>Documentos vinculados aparecerán aquí.</div>
      <Link href={link("documentos?ref=" + recordId)} style={{ color: "#1d4ed8", fontSize: 13, fontWeight: 600 }}>
        Ir a Documentos →
      </Link>
    </div>
  );
}

// === Sidebar cards ===
function InfoRapidaCard({ record }: { record: Record<string, string> }) {
  const items: Array<{ label: string; value: string; valueColor?: string; pill?: { bg: string; fg: string; text: string } }> = [];
  if (record.limiteCredito) items.push({ label: "Límite de crédito", value: fmtMoney(record.limiteCredito) });
  if (record.creditoDisponible) items.push({ label: "Crédito disponible", value: fmtMoney(record.creditoDisponible), valueColor: "#15803d" });
  if (record.diasCredito) items.push({ label: "Días de crédito", value: record.diasCredito + " días" });
  if (record.ventasAcumuladas) items.push({ label: "Ventas acumuladas", value: fmtMoney(record.ventasAcumuladas) });
  if (record.ultimaCompra) items.push({ label: "Última compra", value: record.ultimaCompra });
  if (record.estado) items.push({ label: "Estado", value: "", pill: { bg: "#dcfce7", fg: "#15803d", text: record.estado === "activo" ? "Al día" : record.estado } });

  if (items.length === 0) return null;

  return (
    <div style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 18 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 14 }}>Información rápida</div>
      <div style={{ display: "grid", gap: 12 }}>
        {items.map((it, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
            <span style={{ color: "#64748b" }}>{it.label}</span>
            {it.pill ? (
              <span style={{ background: it.pill.bg, color: it.pill.fg, padding: "2px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>{it.pill.text}</span>
            ) : (
              <span style={{ color: it.valueColor || "#0f172a", fontWeight: 600 }}>{it.value}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function EstadisticasCard({ record }: { record: Record<string, string> }) {
  const items: Array<{ label: string; value: string }> = [];
  if (record.numCompras) items.push({ label: "Nº de compras", value: record.numCompras });
  if (record.importeTotal) items.push({ label: "Importe total", value: fmtMoney(record.importeTotal) });
  if (record.ticketPromedio) items.push({ label: "Ticket promedio", value: fmtMoney(record.ticketPromedio) });
  if (items.length === 0) return null;

  return (
    <div style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>Estadísticas</div>
        <select style={{ border: "1px solid #e2e8f0", borderRadius: 6, padding: "4px 24px 4px 8px", fontSize: 11, fontWeight: 600, color: "#475569", background: "#ffffff", appearance: "none", backgroundImage: chevronBg, backgroundRepeat: "no-repeat", backgroundPosition: "right 6px center", backgroundSize: "8px" }}>
          <option>Este año</option>
          <option>Este mes</option>
          <option>Histórico</option>
        </select>
      </div>
      <div style={{ display: "grid", gap: 12 }}>
        {items.map((it, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
            <span style={{ color: "#64748b" }}>{it.label}</span>
            <span style={{ color: "#0f172a", fontWeight: 600 }}>{it.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// === Helpers ===
function fmtMoney(v: unknown): string {
  const n = parseFloat(String(v ?? "").replace(/[^\d,.-]/g, "").replace(",", "."));
  if (!Number.isFinite(n)) return String(v ?? "—");
  return n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}
// TEST-1.2 — singular() con overrides. El fallback genérico se equivocaba
// con palabras tipo "Clientes" → "client" (cortaba "es" entero). Para
// palabras castellanas comunes mapeamos a su singular correcto.
const SINGULAR_OVERRIDES: Record<string, string> = {
  clientes: "cliente",
  oportunidades: "oportunidad",
  proyectos: "proyecto",
  propuestas: "propuesta",
  presupuestos: "presupuesto",
  facturas: "factura",
  documentos: "documento",
  entregables: "entregable",
  tareas: "tarea",
  tickets: "ticket",
  compras: "compra",
  productos: "producto",
  reservas: "reserva",
  encuestas: "encuesta",
  etiquetas: "etiqueta",
  plantillas: "plantilla",
  empleados: "empleado",
  gastos: "gasto",
  vencimientos: "vencimiento",
  desplazamientos: "desplazamiento",
  hitos: "hito",
  aplicaciones: "aplicación",
  notificaciones: "notificación",
  pacientes: "paciente",
  citas: "cita",
  tratamientos: "tratamiento",
  alumnos: "alumno",
  docentes: "docente",
  calificaciones: "calificación",
};
function singular(label: string): string {
  const l = label.toLowerCase().trim();
  if (SINGULAR_OVERRIDES[l]) return SINGULAR_OVERRIDES[l];
  // Fallback genérico: si termina en "s", quitar la "s" final.
  if (l.endsWith("s") && l.length > 2) return l.slice(0, -1);
  return l;
}

// === Botones ===
function btnPrimary(accent: string): React.CSSProperties {
  return {
    padding: "10px 20px", border: "none", borderRadius: 10,
    background: accent, color: "#ffffff",
    fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
  };
}
function btnSecondaryAccent(accent: string): React.CSSProperties {
  return {
    padding: "10px 18px", border: "1px solid " + accent + "55", borderRadius: 10,
    background: accent + "10", color: accent,
    fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
  };
}
const btnSecondary: React.CSSProperties = {
  padding: "10px 18px", border: "1px solid #e2e8f0", borderRadius: 10,
  background: "#ffffff", color: "#475569",
  fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
};
