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

  useEffect(() => {
    if (!open) return;
    const next: Record<string, string> = {};
    for (const field of fields) {
      next[field.key] = String(initialValue?.[field.key] || "");
    }
    setValues(next);
    setError("");
  }, [open, fields, initialValue]);

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

  const requiredFields = useMemo(
    () => fields.filter((field) => field.required),
    [fields],
  );

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    for (const field of requiredFields) {
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

  function updateField(key: string, value: string) {
    setValues((current) => ({
      ...current,
      [key]: value,
    }));
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
        {fields.map((field) => (
          <label key={field.key} style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>
              {field.label}
              {field.required ? <span style={{ color: "#dc2626" }}> *</span> : null}
            </span>

            {field.kind === "textarea" ? (
              <textarea
                value={values[field.key] || ""}
                onChange={(event) => updateField(field.key, event.target.value)}
                rows={4}
                placeholder={field.placeholder || ""}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: 8,
                  fontSize: 14,
                  resize: "vertical",
                  fontFamily: "inherit",
                  boxSizing: "border-box",
                }}
              />
            ) : field.kind === "relation" ? (
              <select
                value={values[field.key] || ""}
                onChange={(event) => updateField(field.key, event.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: 8,
                  fontSize: 14,
                  background: "#ffffff",
                  boxSizing: "border-box",
                }}
              >
                <option value="">— Selecciona —</option>
                {(optionsMap[field.key] || []).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type={
                  field.kind === "email"
                    ? "email"
                    : field.kind === "date"
                      ? "date"
                      : field.kind === "tel"
                        ? "tel"
                        : field.kind === "number"
                          ? "number"
                          : "text"
                }
                value={values[field.key] || ""}
                onChange={(event) => updateField(field.key, event.target.value)}
                placeholder={field.placeholder || ""}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: 8,
                  fontSize: 14,
                  boxSizing: "border-box",
                }}
              />
            )}

            {field.placeholder && field.kind !== "textarea" ? (
              <span style={{ fontSize: 11, color: "#9ca3af" }}>{field.placeholder}</span>
            ) : null}
          </label>
        ))}

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
