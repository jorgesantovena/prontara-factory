"use client";

import { useEffect, useMemo, useState } from "react";
import type { ModuleField } from "@/lib/erp/module-schemas";
import { validateField, validateFields } from "@/lib/erp/field-validation";

type ModuleFormProps = {
  title: string;
  fields: ModuleField[];
  initialValues: Record<string, string>;
  submitLabel: string;
  isOpen: boolean;
  isSaving?: boolean;
  errorText?: string;
  onClose: () => void;
  onSubmit: (values: Record<string, string>) => void;
};

export function ModuleForm(props: ModuleFormProps) {
  const {
    title,
    fields,
    initialValues,
    submitLabel,
    isOpen,
    isSaving,
    errorText,
    onClose,
    onSubmit,
  } = props;

  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const normalizedInitialValues = useMemo(
    () => JSON.stringify(initialValues),
    [initialValues]
  );

  useEffect(() => {
    setValues(initialValues);
    setTouched({});
    setSubmitAttempted(false);
  }, [normalizedInitialValues, initialValues]);

  const errors = useMemo(() => validateFields(fields, values).errors, [fields, values]);
  const hasErrors = Object.keys(errors).length > 0;

  if (!isOpen) {
    return null;
  }

  function updateValue(key: string, value: string) {
    setValues((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function markTouched(key: string) {
    setTouched((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitAttempted(true);

    const result = validateFields(fields, values);
    if (!result.valid) {
      // Marca todos los campos como tocados para que afloren los errores.
      const allTouched: Record<string, boolean> = {};
      for (const field of fields) {
        allTouched[field.key] = true;
      }
      setTouched(allTouched);
      return;
    }

    onSubmit(values);
  }

  function shouldShowError(key: string): boolean {
    if (!errors[key]) return false;
    return submitAttempted || Boolean(touched[key]);
  }

  const errorBorder = "1px solid #dc2626";
  const errorShadow = "0 0 0 3px rgba(220, 38, 38, 0.15)";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.28)",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        padding: 24,
        zIndex: 1000,
        overflowY: "auto",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 760,
          background: "#fff",
          borderRadius: 18,
          boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
          padding: 20,
          marginTop: 24,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <h2 style={{ margin: 0 }}>{title}</h2>

          <button
            onClick={onClose}
            type="button"
            style={{
              border: "1px solid #ddd",
              background: "#fff",
              borderRadius: 10,
              padding: "8px 12px",
              cursor: "pointer",
            }}
          >
            Cerrar
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }} noValidate>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16 }}>
            {fields.map((field) => {
              const showError = shouldShowError(field.key);
              const fieldError = errors[field.key];

              const commonStyle: React.CSSProperties = {
                width: "100%",
                border: showError ? errorBorder : "1px solid #ccc",
                borderRadius: 10,
                padding: 10,
                fontFamily: "inherit",
                fontSize: 14,
                boxSizing: "border-box",
                boxShadow: showError ? errorShadow : undefined,
                outline: "none",
              };

              const wrapperStyle: React.CSSProperties =
                field.type === "textarea"
                  ? { gridColumn: "1 / -1" }
                  : {};

              const fieldId = "module-form-field-" + field.key;
              const errorId = fieldId + "-error";

              return (
                <label
                  key={field.key}
                  htmlFor={fieldId}
                  style={{ display: "grid", gap: 6, ...wrapperStyle }}
                >
                  <span>
                    {field.label}
                    {field.required ? (
                      <span style={{ color: "#dc2626", marginLeft: 4 }} aria-hidden="true">
                        *
                      </span>
                    ) : null}
                  </span>

                  {field.type === "textarea" ? (
                    <textarea
                      id={fieldId}
                      value={values[field.key] || ""}
                      onChange={(e) => updateValue(field.key, e.target.value)}
                      onBlur={() => {
                        markTouched(field.key);
                        // Validación puntual: no bloquea, solo fuerza pintado del error.
                        validateField(field, values[field.key] || "");
                      }}
                      placeholder={field.placeholder || ""}
                      rows={5}
                      aria-invalid={showError || undefined}
                      aria-describedby={showError ? errorId : undefined}
                      style={{ ...commonStyle, resize: "vertical" }}
                    />
                  ) : field.type === "select" ? (
                    <select
                      id={fieldId}
                      value={values[field.key] || ""}
                      onChange={(e) => updateValue(field.key, e.target.value)}
                      onBlur={() => markTouched(field.key)}
                      aria-invalid={showError || undefined}
                      aria-describedby={showError ? errorId : undefined}
                      style={commonStyle}
                    >
                      {(field.options || []).map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id={fieldId}
                      type={field.type === "email" ? "email" : field.type === "date" ? "date" : "text"}
                      value={values[field.key] || ""}
                      onChange={(e) => updateValue(field.key, e.target.value)}
                      onBlur={() => markTouched(field.key)}
                      placeholder={field.placeholder || ""}
                      aria-invalid={showError || undefined}
                      aria-describedby={showError ? errorId : undefined}
                      style={commonStyle}
                    />
                  )}

                  {showError && fieldError ? (
                    <span
                      id={errorId}
                      role="alert"
                      style={{ color: "#b91c1c", fontSize: 13 }}
                    >
                      {fieldError}
                    </span>
                  ) : field.helperText ? (
                    <span style={{ color: "#6b7280", fontSize: 13 }}>{field.helperText}</span>
                  ) : null}
                </label>
              );
            })}
          </div>

          {errorText ? (
            <div
              style={{
                border: "1px solid #fecaca",
                background: "#fef2f2",
                color: "#b91c1c",
                borderRadius: 10,
                padding: 12,
              }}
            >
              {errorText}
            </div>
          ) : null}

          {submitAttempted && hasErrors ? (
            <div
              style={{
                border: "1px solid #fecaca",
                background: "#fef2f2",
                color: "#b91c1c",
                borderRadius: 10,
                padding: 12,
              }}
              role="alert"
            >
              Revisa los campos marcados en rojo antes de guardar.
            </div>
          ) : null}

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                border: "1px solid #ddd",
                background: "#fff",
                borderRadius: 10,
                padding: "10px 14px",
                cursor: "pointer",
              }}
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={!!isSaving || (submitAttempted && hasErrors)}
              style={{
                border: "1px solid #111",
                background: isSaving || (submitAttempted && hasErrors) ? "#666" : "#111",
                color: "#fff",
                borderRadius: 10,
                padding: "10px 14px",
                cursor: isSaving || (submitAttempted && hasErrors) ? "not-allowed" : "pointer",
              }}
            >
              {isSaving ? "Guardando..." : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
