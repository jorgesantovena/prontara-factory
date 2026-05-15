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

// TEST-3.8 — "proyectos" añadido como tab virtual (no agrupa fields, igual
// que "documentos"). Solo visible cuando moduleKey === "clientes" y el
// cliente ya tiene id (mode === "edit").
type TabKey = "general" | "contacto" | "comercial" | "financiero" | "notas" | "proyectos" | "documentos";

const TAB_LABELS: Record<TabKey, string> = {
  general: "Datos generales",
  contacto: "Contactos",
  comercial: "Comercial",
  financiero: "Financiero",
  notas: "Notas",
  proyectos: "Proyectos",
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

  // Agrupa fields por tab. "proyectos" y "documentos" son tabs virtuales
  // (no agrupan fields del registro — tienen contenido propio).
  const grouped = useMemo(() => {
    const acc: Record<TabKey, UiFieldDefinition[]> = {
      general: [], contacto: [], comercial: [], financiero: [], notas: [], proyectos: [], documentos: [],
    };
    for (const f of fields) acc[classifyField(f.key)].push(f);
    return acc;
  }, [fields]);

  // TEST-1.5 — Tabs visibles. "Documentos" solo se muestra si hay otras
  // tabs con fields (no como única tab — antes salía sola si fields=[]).
  // TEST-3.8 — "Proyectos" se añade entre las otras tabs y Documentos
  // cuando moduleKey === "clientes" y el cliente ya tiene id.
  const tabsConFields = (Object.keys(TAB_LABELS) as TabKey[]).filter((t) => grouped[t].length > 0);
  const showProyectosTab = moduleKey === "clientes" && mode === "edit" && Boolean(initialValue?.id);
  const visibleTabs: TabKey[] = tabsConFields.length > 0
    ? [
        ...tabsConFields,
        ...(showProyectosTab ? ["proyectos" as TabKey] : []),
        "documentos" as TabKey,
      ]
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
      // TEST-4.1.a.iii — Sincronizar contacto/email/telefono del record con
      // el contacto preferido de contactosJson, para que el listado siempre
      // muestre los datos correctos sin importar de dónde vengan.
      const payload: Record<string, string> = { ...values };
      if (moduleKey === "clientes" && payload.contactosJson) {
        try {
          const raw = typeof payload.contactosJson === "string"
            ? JSON.parse(payload.contactosJson)
            : payload.contactosJson;
          if (Array.isArray(raw) && raw.length > 0) {
            const pref = raw.find((c) => c?.preferido) || raw[0];
            if (pref) {
              const prefNombre = String(pref.nombre || "").trim();
              const prefEmail = String(pref.email || "").trim();
              const prefTel = String(pref.telefono || "").trim();
              if (prefNombre) payload.contacto = prefNombre;
              if (prefEmail) payload.email = prefEmail;
              if (prefTel) payload.telefono = prefTel;
            }
          }
        } catch { /* ignorar JSON malformado */ }
      }
      await onSubmit(payload, { andNew });
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
          ) : tab === "proyectos" ? (
            <ProyectosSublist
              clienteId={String(initialValue?.id || "")}
              clienteName={String(initialValue?.nombre || "")}
              accent={accent}
            />
          ) : tab === "contacto" && moduleKey === "clientes" ? (
            // TEST-4.1.a.i — En el tab Contactos del cliente solo se muestra
            // la sublista en rejilla. Los antiguos inputs sueltos
            // (Persona de contacto / Email / Teléfono del record) se ocultan
            // para evitar duplicar la entrada de datos; quedan como espejo
            // del contacto preferido y se sincronizan en doSubmit().
            <ContactosSublist
              initialJson={(() => {
                const raw = values.contactosJson ?? initialValue?.contactosJson;
                if (raw == null) return "[]";
                if (typeof raw === "string") return raw;
                try { return JSON.stringify(raw); } catch { return "[]"; }
              })()}
              onChange={(json) => setField("contactosJson", json)}
              accent={accent}
            />
          ) : (
            <FieldGrid fields={grouped[tab]} values={values} setField={setField} optionsMap={optionsMap} accent={accent} />
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

// TEST-2.3 + TEST-2.4 — Sublista de Contactos con CRUD.
// TEST-3.2a — Migrada a modo rejilla (tabla) con acciones por fila:
// Editar / Copiar / Eliminar / marcar Preferido. Edición en panel inline.
// TEST-3.2b-i — Normalizador asegura que contactos legacy salgan con shape
// canónico y, si ninguno está marcado preferido, fuerza el primero.
// Persiste como JSON en el field `contactosJson` del cliente.
type Contacto = {
  id: string;
  nombre: string;
  cargo: string;
  email: string;
  telefono: string;
  preferido: boolean;
};

function normalizeContactos(raw: unknown): Contacto[] {
  if (!Array.isArray(raw)) return [];
  let list: Contacto[] = raw
    .filter((c): c is Record<string, unknown> => !!c && typeof c === "object")
    .map((c) => ({
      id: String(c.id || Math.random().toString(36).slice(2, 10)),
      nombre: String(c.nombre || ""),
      cargo: String(c.cargo || ""),
      email: String(c.email || ""),
      telefono: String(c.telefono || ""),
      preferido: Boolean(c.preferido),
    }));
  // TEST-3.2b-i: si hay contactos pero ninguno preferido (legacy), marcar el primero.
  if (list.length > 0 && !list.some((c) => c.preferido)) {
    list = list.map((c, i) => ({ ...c, preferido: i === 0 }));
  }
  return list;
}

function ContactosSublist({ initialJson, onChange, accent }: {
  initialJson: string;
  onChange: (json: string) => void;
  accent: string;
}) {
  const [contactos, setContactos] = useState<Contacto[]>(() => {
    try { return normalizeContactos(JSON.parse(initialJson || "[]")); }
    catch { return []; }
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Contacto | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // TEST-4.1.a.ii — Resincronizar el state local con initialJson cuando éste
  // cambia (por ejemplo, al recargar el editor con datos frescos del servidor).
  // El useState inicial solo se evalúa una vez al montar, así que sin este
  // useEffect los datos persistidos no aparecían tras salir y volver.
  useEffect(() => {
    if (editingId !== null) return; // no pisar edición en curso
    try {
      const next = normalizeContactos(JSON.parse(initialJson || "[]"));
      setContactos((prev) => {
        // Evitar bucle: solo actualizar si difiere realmente.
        if (JSON.stringify(prev) === JSON.stringify(next)) return prev;
        return next;
      });
    } catch { /* ignorar */ }
  }, [initialJson, editingId]);

  function persist(next: Contacto[]) {
    setContactos(next);
    onChange(JSON.stringify(next));
  }

  function buildEmptyDraft(currentList: Contacto[]): Contacto {
    return {
      id: Math.random().toString(36).slice(2, 10),
      nombre: "", cargo: "", email: "", telefono: "",
      preferido: currentList.length === 0,
    };
  }

  function startAdd() {
    const newC = buildEmptyDraft(contactos);
    persist([...contactos, newC]);
    setEditingId(newC.id);
    setDraft(newC);
  }

  function startEdit(c: Contacto) {
    setEditingId(c.id);
    setDraft({ ...c });
  }

  function saveDraft() {
    if (!draft || editingId === null) return;
    // Si el draft está totalmente vacío, cancelar sin más.
    const empty = !draft.nombre && !draft.email && !draft.telefono && !draft.cargo;
    if (empty) { cancelEdit(); return; }
    const updatedList = contactos.map((c) => c.id === editingId ? draft : c);
    persist(updatedList);
    // TEST-4.1.a.i — flujo encadenado: tras Guardar abrimos automáticamente
    // un nuevo formulario vacío para añadir el siguiente contacto. El usuario
    // pulsa "Cancelar" cuando ya no quiere añadir más.
    const newC = buildEmptyDraft(updatedList);
    setContactos([...updatedList, newC]);
    // Nota: no llamamos onChange aquí porque el draft vacío no se persiste
    // hasta que se rellene y se guarde. Si el usuario sale del editor sin
    // guardar el draft vacío, cancelEdit lo limpiará.
    setEditingId(newC.id);
    setDraft(newC);
  }

  function cancelEdit() {
    // Si era una fila recién añadida y está vacía, eliminarla
    if (draft && !draft.nombre && !draft.email && !draft.telefono && !draft.cargo) {
      const filtered = contactos.filter((c) => c.id !== editingId);
      // Mantener invariante de preferido si quitamos el preferido
      const fixed = filtered.length > 0 && !filtered.some((c) => c.preferido)
        ? filtered.map((c, i) => ({ ...c, preferido: i === 0 }))
        : filtered;
      persist(fixed);
    }
    setEditingId(null);
    setDraft(null);
  }

  function duplicate(c: Contacto) {
    const copy: Contacto = {
      ...c,
      id: Math.random().toString(36).slice(2, 10),
      nombre: c.nombre ? c.nombre + " (copia)" : "(copia)",
      preferido: false,
    };
    persist([...contactos, copy]);
  }

  function setPreferido(id: string) {
    persist(contactos.map((c) => ({ ...c, preferido: c.id === id })));
  }

  function confirmRemove(id: string) {
    setConfirmDeleteId(id);
  }

  function remove(id: string) {
    const removing = contactos.find((c) => c.id === id);
    let next = contactos.filter((c) => c.id !== id);
    if (removing?.preferido && next.length > 0) {
      next = next.map((c, i) => ({ ...c, preferido: i === 0 }));
    }
    persist(next);
    setConfirmDeleteId(null);
    if (editingId === id) { setEditingId(null); setDraft(null); }
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
          onClick={startAdd}
          style={{ background: accent, color: "#fff", border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
        >
          + Añadir contacto
        </button>
      </div>

      {contactos.length === 0 ? (
        <div style={{ padding: 24, textAlign: "center", color: "#94a3b8", fontSize: 13, border: "1px dashed #e5e7eb", borderRadius: 10 }}>
          Aún no hay contactos. Pulsa &quot;Añadir contacto&quot; para empezar.
        </div>
      ) : (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f8fafc", color: "#475569", fontWeight: 600, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.3 }}>
                <th style={subTh(56)}>Pref.</th>
                <th style={subTh()}>Nombre</th>
                <th style={subTh()}>Cargo</th>
                <th style={subTh()}>Email</th>
                <th style={subTh()}>Teléfono</th>
                <th style={subTh(160)}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {contactos.map((c) => {
                const isEditing = editingId === c.id;
                const v = isEditing && draft ? draft : c;
                return (
                  <tr key={c.id} style={{ borderTop: "1px solid #e5e7eb", background: c.preferido ? "#f0f9ff" : "transparent" }}>
                    <td style={subTd}>
                      <label title={c.preferido ? "Contacto preferido" : "Marcar como preferido"} style={{ display: "inline-flex", cursor: "pointer" }}>
                        <input type="radio" checked={c.preferido} onChange={() => setPreferido(c.id)} disabled={isEditing} />
                      </label>
                    </td>
                    {isEditing && draft ? (
                      <>
                        <td style={subTd}><input style={subIpt} value={draft.nombre} onChange={(e) => setDraft({ ...draft, nombre: e.target.value })} placeholder="Nombre" autoFocus /></td>
                        <td style={subTd}><input style={subIpt} value={draft.cargo} onChange={(e) => setDraft({ ...draft, cargo: e.target.value })} placeholder="Cargo" /></td>
                        <td style={subTd}><input style={subIpt} type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} placeholder="email@ejemplo.com" /></td>
                        <td style={subTd}><input style={subIpt} type="tel" value={draft.telefono} onChange={(e) => setDraft({ ...draft, telefono: e.target.value })} placeholder="+34 600 000 000" /></td>
                        <td style={subTd}>
                          <div style={{ display: "flex", gap: 4 }}>
                            <button type="button" onClick={saveDraft} style={subBtnPrimary(accent)} title="Guardar cambios">Guardar</button>
                            <button type="button" onClick={cancelEdit} style={subBtn} title="Descartar cambios">Cancelar</button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={subTd}>{v.nombre || <span style={{ color: "#cbd5e1" }}>—</span>}</td>
                        <td style={subTd}>{v.cargo || <span style={{ color: "#cbd5e1" }}>—</span>}</td>
                        <td style={subTd}>{v.email ? <a href={"mailto:" + v.email} style={{ color: "#2563eb", textDecoration: "none" }}>{v.email}</a> : <span style={{ color: "#cbd5e1" }}>—</span>}</td>
                        <td style={subTd}>{v.telefono ? <a href={"tel:" + v.telefono} style={{ color: "#2563eb", textDecoration: "none" }}>{v.telefono}</a> : <span style={{ color: "#cbd5e1" }}>—</span>}</td>
                        <td style={subTd}>
                          <div style={{ display: "flex", gap: 4 }}>
                            <button type="button" onClick={() => startEdit(c)} style={subBtn} title="Modificar">✏️</button>
                            <button type="button" onClick={() => duplicate(c)} style={subBtn} title="Copiar / Duplicar">📋</button>
                            <button type="button" onClick={() => confirmRemove(c.id)} style={subBtnDanger} title="Eliminar">🗑</button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Confirmación de eliminación */}
      {confirmDeleteId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.45)", zIndex: 80, display: "grid", placeItems: "center" }} onClick={() => setConfirmDeleteId(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, padding: 20, maxWidth: 380, boxShadow: "0 12px 32px rgba(0,0,0,0.25)" }}>
            <h4 style={{ margin: "0 0 8px 0", fontSize: 16, color: "#0f172a" }}>Eliminar contacto</h4>
            <p style={{ margin: "0 0 16px 0", fontSize: 13, color: "#475569" }}>¿Eliminar este contacto del cliente? Esta acción no se puede deshacer hasta que guardes el cliente.</p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" onClick={() => setConfirmDeleteId(null)} style={subBtn}>Cancelar</button>
              <button type="button" onClick={() => remove(confirmDeleteId)} style={{ ...subBtnDanger, padding: "8px 14px" }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

const subIpt: React.CSSProperties = {
  padding: "6px 8px", border: "1px solid #d1d5db", borderRadius: 6,
  fontSize: 13, fontFamily: "inherit", boxSizing: "border-box", width: "100%",
};

function subTh(width?: number): React.CSSProperties {
  return {
    textAlign: "left", padding: "8px 10px", fontSize: 11,
    ...(width ? { width } : {}),
  };
}

const subTd: React.CSSProperties = {
  padding: "8px 10px", verticalAlign: "middle", color: "#0f172a",
};

const subBtn: React.CSSProperties = {
  background: "#fff", border: "1px solid #e2e8f0", borderRadius: 6,
  padding: "4px 8px", fontSize: 13, cursor: "pointer", color: "#334155",
};

const subBtnDanger: React.CSSProperties = {
  ...subBtn,
  border: "1px solid #fecaca", color: "#dc2626",
};

function subBtnPrimary(accent: string): React.CSSProperties {
  return {
    ...subBtn,
    background: accent, color: "#fff", border: "1px solid " + accent,
    fontWeight: 600,
  };
}

// TEST-3.8 — Sublista de Proyectos colgando del cliente.
// Lista los proyectos cuyo campo "cliente" coincide con el ID del cliente
// abierto. Solo se monta cuando ya existe id (mode === "edit"). El usuario
// puede ver datos, eliminar y crear nuevos proyectos con el cliente
// precargado vía query string `?prefill_cliente=<id>` que el generic
// module-runtime-page interpreta para abrir el editor en modo create.
type ProyectoRow = {
  id: string;
  nombre: string;
  cliente: string;
  estado: string;
  responsable: string;
  fechaInicio: string;
  fechaCaducidad: string;
};

function ProyectosSublist({ clienteId, clienteName, accent }: { clienteId: string; clienteName: string; accent: string }) {
  const { link } = useCurrentVertical();
  const [rows, setRows] = useState<ProyectoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  async function load() {
    if (!clienteId && !clienteName) { setLoading(false); return; }
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/erp/module?module=proyectos", { cache: "no-store" });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        // Si el tenant no tiene el módulo proyectos, salimos limpios.
        setRows([]);
        setError("");
        setLoading(false);
        return;
      }
      const all: Array<Record<string, unknown>> = Array.isArray(data.rows) ? data.rows : [];
      // TEST-4.2 — La API /api/erp/options para 'clientes' usa `nombre` como
      // `value` del dropdown relation, así que `row.cliente` se guarda con el
      // NOMBRE del cliente, no su id. Filtramos por nombre, con fallback al id
      // por si en el futuro se migra a id.
      const filtered = all.filter((row) => {
        const c = String(row.cliente || "");
        if (!c) return false;
        return c === clienteName || c === clienteId;
      }).map((row) => ({
        id: String(row.id || ""),
        nombre: String(row.nombre || ""),
        cliente: String(row.cliente || ""),
        estado: String(row.estado || ""),
        responsable: String(row.responsable || ""),
        fechaInicio: String(row.fechaInicio || ""),
        fechaCaducidad: String(row.fechaCaducidad || ""),
      }));
      setRows(filtered);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error cargando proyectos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [clienteId, clienteName]);

  async function remove(id: string) {
    setBusy(true);
    try {
      const r = await fetch("/api/erp/module", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module: "proyectos", mode: "delete", recordId: id }),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        setError(data.error || "Error eliminando.");
      } else {
        setRows((prev) => prev.filter((row) => row.id !== id));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setBusy(false);
      setConfirmDeleteId(null);
    }
  }

  // TEST-4.2 — prefill_cliente recibe el NOMBRE del cliente (no el id) porque
  // la API /api/erp/options usa nombre como `value` del dropdown relation.
  const nuevoHref = link("proyectos") + "?prefill_cliente=" + encodeURIComponent(clienteName || clienteId);

  return (
    <section>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0f172a" }}>Proyectos del cliente</h3>
          <p style={{ margin: "2px 0 0 0", fontSize: 12, color: "#64748b" }}>
            Trabajos y contratos asignados a este cliente. Para crear o editar a fondo se abre el módulo Proyectos con el cliente ya seleccionado.
          </p>
        </div>
        <Link href={nuevoHref} style={{ background: accent, color: "#fff", border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
          + Nuevo proyecto
        </Link>
      </div>

      {error ? (
        <div style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", borderRadius: 8, padding: 10, marginBottom: 10, fontSize: 13 }}>{error}</div>
      ) : null}

      {loading ? (
        <div style={{ padding: 24, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>Cargando proyectos…</div>
      ) : rows.length === 0 ? (
        <div style={{ padding: 24, textAlign: "center", color: "#94a3b8", fontSize: 13, border: "1px dashed #e5e7eb", borderRadius: 10 }}>
          Este cliente todavía no tiene proyectos asignados. Pulsa &quot;Nuevo proyecto&quot; para crear el primero.
        </div>
      ) : (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f8fafc", color: "#475569", fontWeight: 600, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.3 }}>
                <th style={subTh()}>Proyecto</th>
                <th style={subTh()}>Estado</th>
                <th style={subTh()}>Responsable</th>
                <th style={subTh(110)}>Inicio</th>
                <th style={subTh(110)}>Caducidad</th>
                <th style={subTh(120)}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                  <td style={subTd}>{p.nombre || <span style={{ color: "#cbd5e1" }}>—</span>}</td>
                  <td style={subTd}>{p.estado || <span style={{ color: "#cbd5e1" }}>—</span>}</td>
                  <td style={subTd}>{p.responsable || <span style={{ color: "#cbd5e1" }}>—</span>}</td>
                  <td style={subTd}>{p.fechaInicio || <span style={{ color: "#cbd5e1" }}>—</span>}</td>
                  <td style={subTd}>{p.fechaCaducidad || <span style={{ color: "#cbd5e1" }}>—</span>}</td>
                  <td style={subTd}>
                    <div style={{ display: "flex", gap: 4 }}>
                      <Link href={link("proyectos")} style={{ ...subBtn, textDecoration: "none" }} title="Abrir módulo Proyectos para editar">Abrir</Link>
                      <button type="button" onClick={() => setConfirmDeleteId(p.id)} style={subBtnDanger} title="Eliminar proyecto" disabled={busy}>🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Confirmación de eliminación */}
      {confirmDeleteId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.45)", zIndex: 80, display: "grid", placeItems: "center" }} onClick={() => setConfirmDeleteId(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, padding: 20, maxWidth: 380, boxShadow: "0 12px 32px rgba(0,0,0,0.25)" }}>
            <h4 style={{ margin: "0 0 8px 0", fontSize: 16, color: "#0f172a" }}>Eliminar proyecto</h4>
            <p style={{ margin: "0 0 16px 0", fontSize: 13, color: "#475569" }}>¿Eliminar este proyecto del cliente? Esta acción no se puede deshacer.</p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" onClick={() => setConfirmDeleteId(null)} style={subBtn}>Cancelar</button>
              <button type="button" onClick={() => remove(confirmDeleteId)} style={{ ...subBtnDanger, padding: "8px 14px" }} disabled={busy}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

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
