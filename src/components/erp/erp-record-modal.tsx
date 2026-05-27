"use client";

import { useEffect, useMemo, useState } from "react";
import type { UiFieldDefinition } from "@/lib/erp/ui-contracts";
import SlideOverPanel from "@/components/erp/slide-over-panel";

/**
 * Formulario de crear/editar registro renderizado dentro de un panel
 * lateral deslizable (SlideOverPanel).
 *
 * Mantiene la misma API que el modal anterior, así que los callers
 * (clientes, crm, proyectos, presupuestos, facturacion, documentos) no
 * necesitan cambiar nada — heredan automáticamente la nueva experiencia.
 */
type OptionItem = {
  value: string;
  label: string;
};

// TEST-11 — Calcula duración entre dos horas "hh:mm" y la devuelve
// formateada "hh:mm". Mismo helper que erp-record-editor.tsx.
function computeDuration(desde: string, hasta: string): string {
  if (!desde || !hasta) return "";
  const toMin = (s: string): number => {
    const [hh = "0", mm = "0"] = String(s).split(":");
    return parseInt(hh, 10) * 60 + parseInt(mm, 10);
  };
  const diff = toMin(hasta) - toMin(desde);
  if (!Number.isFinite(diff) || diff <= 0) return "";
  const hh = Math.floor(diff / 60).toString().padStart(2, "0");
  const mm = (diff % 60).toString().padStart(2, "0");
  return hh + ":" + mm;
}

export default function ErpRecordModal({
  open,
  mode,
  title,
  fields,
  initialValue,
  tenant,
  onClose,
  onSubmit,
}: {
  open: boolean;
  mode: "create" | "edit";
  title: string;
  fields: UiFieldDefinition[];
  initialValue?: Record<string, string> | null;
  tenant?: string;
  onClose: () => void;
  onSubmit: (payload: Record<string, string>) => Promise<void> | void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [optionsMap, setOptionsMap] = useState<Record<string, OptionItem[]>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // TEST-11 — cache de records relacionados para resolver herencia
  // (proyecto → cliente / facturable / tipoFacturacion / tarifaHora;
  // cliente → kilometrosBase). Igual que en ErpRecordEditor.
  const [relatedCache, setRelatedCache] = useState<Record<string, Record<string, Record<string, string>>>>({});

  useEffect(() => {
    if (!open) return;
    // TEST-11 — fecha = HOY por defecto en create para campos típicos.
    const TODAY_DEFAULT_DATE_FIELDS = new Set([
      "fechaEnvio", "fechaEmision", "fechaInicio", "fechaAlta", "fechaCreacion",
      "fecha_alta", "fechaApertura", "fecha",
    ]);
    const todayIso = new Date().toISOString().slice(0, 10);
    const next: Record<string, string> = {};
    for (const field of fields) {
      const initVal = initialValue?.[field.key];
      if (initVal != null && String(initVal) !== "") {
        next[field.key] = String(initVal);
      } else if (mode === "create" && field.kind === "date" && TODAY_DEFAULT_DATE_FIELDS.has(field.key)) {
        next[field.key] = todayIso;
      } else {
        next[field.key] = "";
      }
    }
    // TEST-11 — Recalcular computed.duration en carga inicial.
    for (const f of fields) {
      if (f.computed?.type === "duration") {
        const current = String(next[f.key] || "").trim();
        if (!current) {
          const dur = computeDuration(String(next[f.computed.from] || ""), String(next[f.computed.to] || ""));
          if (dur) next[f.key] = dur;
        }
      }
    }
    setValues(next);
    setError("");
  }, [open, fields, initialValue, mode]);

  useEffect(() => {
    let cancelled = false;

    async function loadRelations() {
      const relationFields = fields.filter(
        (field) => field.kind === "relation" && field.relationModuleKey,
      );

      for (const field of relationFields) {
        try {
          const response = await fetch(
            "/api/erp/options?module=" +
              encodeURIComponent(String(field.relationModuleKey || "")) +
              (tenant ? "&tenant=" + encodeURIComponent(tenant) : ""),
            { cache: "no-store" },
          );
          const data = await response.json();
          if (!cancelled && response.ok && data.ok) {
            setOptionsMap((current) => ({
              ...current,
              [field.key]: Array.isArray(data.options) ? data.options : [],
            }));
          }
        } catch {
          // ignoramos
        }
      }
    }

    if (open) {
      loadRelations();
    }

    return () => {
      cancelled = true;
    };
  }, [open, fields, tenant]);

  // TEST-11 — La validación de "required" solo aplica a campos visibles
  // (visibleWhen) y NO read-only/heredados (cuyo valor lo establece el
  // sistema, no el usuario).
  const requiredFields = useMemo(
    () => fields.filter((field) => field.required && !field.readOnly),
    [fields],
  );

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    for (const field of requiredFields) {
      // Si el campo no está visible por visibleWhen, no es obligatorio.
      if (field.visibleWhen) {
        const actual = String(values[field.visibleWhen.field] || "");
        const expected = field.visibleWhen.equals;
        const visible = Array.isArray(expected) ? expected.includes(actual) : actual === expected;
        if (!visible) continue;
      }
      if (!String(values[field.key] || "").trim()) {
        setError("Completa el campo obligatorio: " + field.label);
        setBusy(false);
        return;
      }
    }

    try {
      await onSubmit(values);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  }

  // TEST-11 — Lookup en cache + fallback id/nombre/numero/titulo/codigo
  // (mismo criterio que /api/erp/options).
  async function loadRelatedRecord(modKey: string, ref: string): Promise<Record<string, string> | null> {
    if (!modKey || !ref) return null;
    const cached = relatedCache[modKey]?.[ref];
    if (cached) return cached;
    try {
      const url = "/api/erp/module?module=" + encodeURIComponent(modKey) +
        (tenant ? "&tenant=" + encodeURIComponent(tenant) : "");
      const r = await fetch(url, { cache: "no-store" });
      const d = await r.json();
      if (!r.ok || !d.ok || !Array.isArray(d.rows)) return null;
      const rows = d.rows as Array<Record<string, string>>;
      const record = rows.find((row) => String(row.id || "") === ref)
        || rows.find((row) => String(row.nombre || "") === ref)
        || rows.find((row) => String(row.numero || "") === ref)
        || rows.find((row) => String(row.titulo || "") === ref)
        || rows.find((row) => String(row.codigo || "") === ref);
      if (!record) return null;
      setRelatedCache((c) => ({ ...c, [modKey]: { ...(c[modKey] || {}), [ref]: record } }));
      return record;
    } catch {
      return null;
    }
  }

  function updateField(key: string, value: string) {
    setValues((current) => {
      const next: Record<string, string> = { ...current, [key]: value };
      // TEST-11 — Recalcular computed.duration cuando from o to cambian.
      for (const f of fields) {
        if (f.computed?.type === "duration" && (f.computed.from === key || f.computed.to === key)) {
          const desde = f.computed.from === key ? value : (next[f.computed.from] || "");
          const hasta = f.computed.to === key ? value : (next[f.computed.to] || "");
          next[f.key] = computeDuration(desde, hasta);
        }
      }
      return next;
    });

    // TEST-11 — Herencia: si el campo modificado es relation y otros tienen
    // inheritFrom.from = key, cargar el record destino y copiar campos.
    const sourceField = fields.find((f) => f.key === key);
    if (sourceField?.kind === "relation" && sourceField.relationModuleKey && value) {
      const heredables = fields.filter((f) => f.inheritFrom?.from === key);
      if (heredables.length > 0) {
        loadRelatedRecord(sourceField.relationModuleKey, value).then((record) => {
          if (!record) return;
          setValues((v) => {
            const nx: Record<string, string> = { ...v };
            for (const f of heredables) nx[f.key] = String(record[f.inheritFrom!.field] || "");
            return nx;
          });
          // Cascada heredable → su propia relación → siguiente nivel.
          (async () => {
            for (const f of heredables) {
              if (f.kind !== "relation" || !f.relationModuleKey) continue;
              const childHeredables = fields.filter((c) => c.inheritFrom?.from === f.key);
              if (childHeredables.length === 0) continue;
              const incoming = String(record[f.inheritFrom!.field] || "");
              if (!incoming) continue;
              const childRecord = await loadRelatedRecord(f.relationModuleKey, incoming);
              if (!childRecord) continue;
              setValues((v) => {
                const nx: Record<string, string> = { ...v };
                for (const c of childHeredables) nx[c.key] = String(childRecord[c.inheritFrom!.field] || "");
                return nx;
              });
            }
          })();
        });
      }
    }
  }

  // TEST-11 — `visibleWhen` evalúa si un campo se renderiza según el valor
  // de otro campo del mismo record.
  function isVisible(field: UiFieldDefinition): boolean {
    if (!field.visibleWhen) return true;
    const actual = String(values[field.visibleWhen.field] || "");
    const expected = field.visibleWhen.equals;
    if (Array.isArray(expected)) return expected.includes(actual);
    return actual === expected;
  }

  // Footer del slide-over con los botones de acción.
  const footer = (
    <>
      <button
        type="button"
        onClick={onClose}
        style={{
          border: "1px solid #d1d5db",
          borderRadius: 8,
          background: "#ffffff",
          padding: "10px 16px",
          cursor: "pointer",
          fontWeight: 600,
          fontSize: 14,
          color: "#374151",
        }}
      >
        Cancelar
      </button>
      <button
        type="submit"
        form="erp-record-form"
        disabled={busy}
        style={{
          border: "none",
          borderRadius: 8,
          background: "#1d4ed8",
          color: "#ffffff",
          padding: "10px 18px",
          cursor: busy ? "not-allowed" : "pointer",
          fontWeight: 700,
          fontSize: 14,
          opacity: busy ? 0.7 : 1,
        }}
      >
        {busy ? "Guardando..." : mode === "create" ? "Crear" : "Guardar cambios"}
      </button>
    </>
  );

  return (
    <SlideOverPanel
      open={open}
      onClose={onClose}
      title={title}
      subtitle={mode === "create" ? "Nuevo registro" : "Editando registro"}
      size="md"
      footer={footer}
    >
      <form id="erp-record-form" onSubmit={submit} style={{ display: "grid", gap: 14 }}>
        {fields.filter(isVisible).map((field) => {
          // TEST-11 — readOnly: input deshabilitado y estilo atenuado.
          const ro = !!field.readOnly;
          const inputStyleBase = {
            width: "100%",
            padding: "10px 12px",
            border: "1px solid #d1d5db",
            borderRadius: 8,
            fontSize: 14,
            boxSizing: "border-box" as const,
            background: ro ? "#f3f4f6" : "#ffffff",
            color: ro ? "#6b7280" : "#111827",
            cursor: ro ? "not-allowed" : "auto",
          };
          return (
          <label key={field.key} style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>
              {field.label}
              {field.required ? <span style={{ color: "#dc2626" }}> *</span> : null}
              {/* TEST-11 bis-7 — Candado consistente con el editor full-page. */}
              {ro ? <span style={{ color: "#94a3b8", marginLeft: 6, fontWeight: 400 }} title="Campo de solo lectura (heredado, calculado o de proceso)">🔒</span> : null}
            </span>

            {field.kind === "textarea" ? (
              <textarea
                value={values[field.key] || ""}
                onChange={(event) => updateField(field.key, event.target.value)}
                rows={4}
                placeholder={field.placeholder || ""}
                disabled={ro}
                style={{ ...inputStyleBase, resize: "vertical", fontFamily: "inherit" }}
              />
            ) : field.kind === "relation" ? (
              // TEST-11 bis-2 / bis-7 — relation+readOnly: render como input
              // text con el label resuelto, no <select disabled> con
              // "— Selecciona" (era contradictorio con el candado).
              ro ? (
                (() => {
                  const opts = optionsMap[field.key] || [];
                  const matched = opts.find((o) => o.value === (values[field.key] || ""));
                  const display = matched?.label || values[field.key] || "";
                  return (
                    <input
                      type="text"
                      value={display}
                      placeholder={field.placeholder || "—"}
                      readOnly
                      disabled
                      style={inputStyleBase}
                    />
                  );
                })()
              ) : (
                <select
                  value={values[field.key] || ""}
                  onChange={(event) => updateField(field.key, event.target.value)}
                  style={inputStyleBase}
                >
                  <option value="">— Selecciona —</option>
                  {(optionsMap[field.key] || []).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              )
            ) : field.kind === "status" && field.options && field.options.length > 0 ? (
              // TEST-11 bis-7 — status+readOnly: mismo patrón, input text
              // deshabilitado con el label de la opción seleccionada (o
              // placeholder si vacío, p.ej. "Se actualiza con el proceso de
              // facturación").
              ro ? (
                (() => {
                  const matched = field.options!.find((o) => o.value === (values[field.key] || ""));
                  const display = matched?.label || values[field.key] || "";
                  return (
                    <input
                      type="text"
                      value={display}
                      placeholder={field.placeholder || "—"}
                      readOnly
                      disabled
                      style={inputStyleBase}
                    />
                  );
                })()
              ) : (
                <select
                  value={values[field.key] || ""}
                  onChange={(event) => updateField(field.key, event.target.value)}
                  style={inputStyleBase}
                >
                  <option value="">— Selecciona —</option>
                  {field.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              )
            ) : (
              <input
                type={
                  field.kind === "email"
                    ? "email"
                    : field.kind === "date"
                      ? "date"
                      // TEST-11 — kind:"time" → input nativo hh:mm.
                      : field.kind === "time"
                        ? "time"
                        : field.kind === "tel"
                          ? "tel"
                          : field.kind === "number"
                            ? "number"
                            : "text"
                }
                value={values[field.key] || ""}
                onChange={(event) => updateField(field.key, event.target.value)}
                placeholder={field.placeholder || ""}
                readOnly={ro}
                disabled={ro}
                style={inputStyleBase}
              />
            )}

            {field.placeholder && field.kind !== "textarea" ? (
              <span style={{ fontSize: 11, color: "#9ca3af" }}>{field.placeholder}</span>
            ) : null}
          </label>
          );
        })}

        {error ? (
          <div
            style={{
              border: "1px solid #fecaca",
              background: "#fef2f2",
              color: "#991b1b",
              borderRadius: 8,
              padding: "10px 12px",
              fontSize: 13,
            }}
          >
            {error}
          </div>
        ) : null}
      </form>
    </SlideOverPanel>
  );
}
