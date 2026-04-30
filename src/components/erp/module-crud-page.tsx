"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { ModuleField, ModuleRecord, ModuleSchema } from "@/lib/erp/module-schemas";

type ModuleApiResponse = {
  ok?: boolean;
  moduleKey?: string;
  schema?: ModuleSchema;
  items?: ModuleRecord[];
  item?: ModuleRecord;
  deletedId?: string;
  error?: string;
};

type ActiveApiResponse = {
  ok?: boolean;
  activeClientId?: string | null;
};

type FormValues = Record<string, string>;

export type CrudColumn = {
  key: string;
  label: string;
};

export type RelatedModuleConfig = {
  key: string;
  label: string;
  relationField: string;
  columns: CrudColumn[];
};

export type LinkedSelectConfig = {
  fieldKey: string;
  label?: string;
  sourceModuleKey: string;
  optionValueField: string;
  optionLabelField: string;
  bindIdField?: string;
  bindNameField?: string;
  includeEmptyOption?: boolean;
  emptyOptionLabel?: string;
  filterByFormField?: string;
  filterBySourceField?: string;
  autoFillMap?: Record<string, string>;
};

export type ModuleCrudPageProps = {
  moduleKey: string;
  title: string;
  description: string;
  searchPlaceholder: string;
  columns: CrudColumn[];
  relatedModules?: RelatedModuleConfig[];
  linkedSelects?: LinkedSelectConfig[];
  renderSummary?: (selected: ModuleRecord | null) => ReactNode;
};

function toText(value: unknown): string {
  if (value == null) return "";
  return String(value);
}

function buildEmptyValues(
  schema?: ModuleSchema | null,
  linkedSelects?: LinkedSelectConfig[]
): FormValues {
  const values: FormValues = {};
  if (!schema) return values;

  for (const field of schema.fields) {
    if (field.type === "select" && field.options && field.options.length > 0) {
      values[field.key] = field.options[0].value;
    } else {
      values[field.key] = "";
    }
  }

  for (const linked of linkedSelects || []) {
    if (!(linked.fieldKey in values)) {
      values[linked.fieldKey] = "";
    }
    if (linked.bindIdField) {
      values[linked.bindIdField] = "";
    }
    if (linked.bindNameField) {
      values[linked.bindNameField] = "";
    }
    for (const targetField of Object.keys(linked.autoFillMap || {})) {
      if (!(targetField in values)) {
        values[targetField] = "";
      }
    }
  }

  return values;
}

function buildValuesFromRecord(
  schema: ModuleSchema | null | undefined,
  linkedSelects: LinkedSelectConfig[] | undefined,
  record?: ModuleRecord | null
): FormValues {
  const base = buildEmptyValues(schema, linkedSelects);
  if (!schema || !record) return base;

  for (const field of schema.fields) {
    base[field.key] = toText(record[field.key]);
  }

  for (const linked of linkedSelects || []) {
    base[linked.fieldKey] = toText(record[linked.fieldKey]);
    if (linked.bindIdField) {
      base[linked.bindIdField] = toText(record[linked.bindIdField]);
    }
    if (linked.bindNameField) {
      base[linked.bindNameField] = toText(record[linked.bindNameField]);
    }
    for (const targetField of Object.keys(linked.autoFillMap || {})) {
      base[targetField] = toText(record[targetField]);
    }
  }

  return base;
}

function renderStandardField(
  field: ModuleField,
  value: string,
  disabled: boolean,
  onChange: (fieldKey: string, nextValue: string) => void
) {
  const commonStyle: React.CSSProperties = {
    width: "100%",
    border: "1px solid #d9d9d9",
    borderRadius: 10,
    padding: "10px 12px",
    fontSize: 14,
    background: disabled ? "#f5f5f5" : "#fff",
  };

  if (field.type === "textarea") {
    return (
      <textarea
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(field.key, e.target.value)}
        placeholder={field.placeholder || ""}
        rows={4}
        style={{ ...commonStyle, resize: "vertical" }}
      />
    );
  }

  if (field.type === "select") {
    return (
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(field.key, e.target.value)}
        style={commonStyle}
      >
        {(field.options || []).map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  const htmlType =
    field.type === "email"
      ? "email"
      : field.type === "tel"
        ? "tel"
        : field.type === "date"
          ? "date"
          : "text";

  return (
    <input
      type={htmlType}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(field.key, e.target.value)}
      placeholder={field.placeholder || ""}
      style={commonStyle}
    />
  );
}

export default function ModuleCrudPage(props: ModuleCrudPageProps) {
  const {
    moduleKey,
    title,
    description,
    searchPlaceholder,
    columns,
    relatedModules = [],
    linkedSelects = [],
    renderSummary,
  } = props;

  const [activeClientId, setActiveClientId] = useState<string>("");
  const [schema, setSchema] = useState<ModuleSchema | null>(null);
  const [items, setItems] = useState<ModuleRecord[]>([]);
  const [moduleDataMap, setModuleDataMap] = useState<Record<string, ModuleRecord[]>>({});
  const [selectedId, setSelectedId] = useState<string>("");
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [formValues, setFormValues] = useState<FormValues>({});
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [successText, setSuccessText] = useState("");

  const extraModuleKeys = useMemo(() => {
    const set = new Set<string>();
    for (const rel of relatedModules) set.add(rel.key);
    for (const linked of linkedSelects) set.add(linked.sourceModuleKey);
    return Array.from(set);
  }, [relatedModules, linkedSelects]);

  async function loadModule(key: string): Promise<ModuleApiResponse> {
    const response = await fetch("/api/erp/module?module=" + encodeURIComponent(key), {
      cache: "no-store",
    });
    return (await response.json()) as ModuleApiResponse;
  }

  async function loadAll() {
    setIsLoading(true);
    setErrorText("");
    setSuccessText("");

    try {
      const responses = await Promise.all([
        fetch("/api/factory/active", { cache: "no-store" }).then((r) => r.json() as Promise<ActiveApiResponse>),
        loadModule(moduleKey),
        ...extraModuleKeys.map((key) => loadModule(key)),
      ]);

      const activeData = responses[0] as ActiveApiResponse;
      const moduleData = responses[1] as ModuleApiResponse;
      const extraData = responses.slice(2) as ModuleApiResponse[];

      setActiveClientId(toText(activeData.activeClientId));

      if (!moduleData.ok || !moduleData.schema) {
        throw new Error(moduleData.error || ("No se pudo cargar el modulo " + moduleKey + "."));
      }

      const nextSchema = moduleData.schema;
      const nextItems = Array.isArray(moduleData.items) ? moduleData.items : [];
      const nextModuleDataMap: Record<string, ModuleRecord[]> = {};

      extraModuleKeys.forEach((key, index) => {
        const response = extraData[index];
        nextModuleDataMap[key] = Array.isArray(response?.items) ? response.items! : [];
      });

      setSchema(nextSchema);
      setItems(nextItems);
      setModuleDataMap(nextModuleDataMap);

      if (nextItems.length > 0) {
        const selected = nextItems.find((item) => toText(item.id) === selectedId) || nextItems[0];
        setSelectedId(toText(selected.id));

        if (mode === "edit") {
          setFormValues(buildValuesFromRecord(nextSchema, linkedSelects, selected));
        } else {
          setFormValues((prev) => {
            const empty = buildEmptyValues(nextSchema, linkedSelects);
            return Object.keys(prev).length > 0 ? prev : empty;
          });
        }
      } else {
        setSelectedId("");
        setFormValues(buildEmptyValues(nextSchema, linkedSelects));
      }
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "No se pudo cargar la pagina.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, [moduleKey]);

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;

    return items.filter((item) => {
      return columns.some((column) =>
        toText(item[column.key]).toLowerCase().includes(term)
      );
    });
  }, [items, search, columns]);

  const selectedItem = useMemo(() => {
    return items.find((item) => toText(item.id) === selectedId) || null;
  }, [items, selectedId]);

  function startCreate() {
    setMode("create");
    setSelectedId("");
    setErrorText("");
    setSuccessText("");

    const next = buildEmptyValues(schema, linkedSelects);

    for (const linked of linkedSelects) {
      const sourceRows = moduleDataMap[linked.sourceModuleKey] || [];
      const first = sourceRows[0];

      if (first) {
        next[linked.fieldKey] = toText(first[linked.optionLabelField]);

        if (linked.bindIdField) {
          next[linked.bindIdField] = toText(first[linked.optionValueField]);
        }

        if (linked.bindNameField) {
          next[linked.bindNameField] = toText(first[linked.optionLabelField]);
        }

        for (const [targetField, sourceField] of Object.entries(linked.autoFillMap || {})) {
          next[targetField] = toText(first[sourceField]);
        }
      }
    }

    setFormValues(next);
  }

  function startEdit(record: ModuleRecord) {
    setMode("edit");
    setSelectedId(toText(record.id));
    setErrorText("");
    setSuccessText("");
    setFormValues(buildValuesFromRecord(schema, linkedSelects, record));
  }

  function onFieldChange(fieldKey: string, nextValue: string) {
    setFormValues((prev) => ({
      ...prev,
      [fieldKey]: nextValue,
    }));
  }

  function onLinkedSelectChange(linked: LinkedSelectConfig, selectedValue: string) {
    const sourceRows = moduleDataMap[linked.sourceModuleKey] || [];
    const selected = sourceRows.find(
      (row) => toText(row[linked.optionValueField]) === selectedValue
    );

    setFormValues((prev) => {
      const next = { ...prev };

      next[linked.fieldKey] = selected ? toText(selected[linked.optionLabelField]) : "";

      if (linked.bindIdField) {
        next[linked.bindIdField] = selected ? toText(selected[linked.optionValueField]) : "";
      }

      if (linked.bindNameField) {
        next[linked.bindNameField] = selected ? toText(selected[linked.optionLabelField]) : "";
      }

      for (const [targetField, sourceField] of Object.entries(linked.autoFillMap || {})) {
        next[targetField] = selected ? toText(selected[sourceField]) : "";
      }

      for (const childLinked of linkedSelects) {
        if (childLinked.filterByFormField && childLinked.filterByFormField === (linked.bindIdField || linked.fieldKey)) {
          next[childLinked.fieldKey] = "";
          if (childLinked.bindIdField) next[childLinked.bindIdField] = "";
          if (childLinked.bindNameField) next[childLinked.bindNameField] = "";
        }
      }

      return next;
    });
  }

  async function onSave() {
    if (!schema) return;

    setIsSaving(true);
    setErrorText("");
    setSuccessText("");

    try {
      for (const field of schema.fields) {
        if (field.required && !toText(formValues[field.key]).trim()) {
          throw new Error("Falta el campo obligatorio: " + field.label);
        }
      }

      for (const linked of linkedSelects) {
        if (!linked.includeEmptyOption) {
          const valueToCheck = linked.bindIdField ? formValues[linked.bindIdField] : formValues[linked.fieldKey];
          if (!toText(valueToCheck).trim()) {
            throw new Error("Falta seleccionar: " + (linked.label || linked.fieldKey));
          }
        }
      }

      if (mode === "create") {
        const response = await fetch("/api/erp/module?module=" + encodeURIComponent(moduleKey), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formValues),
        });

        const data = (await response.json()) as ModuleApiResponse;
        if (!response.ok || !data.ok) {
          throw new Error(data.error || "No se pudo crear el registro.");
        }

        setSuccessText("Registro creado correctamente.");
      } else {
        if (!selectedId) {
          throw new Error("No hay registro seleccionado para editar.");
        }

        const response = await fetch(
          "/api/erp/module?module=" + encodeURIComponent(moduleKey) + "&id=" + encodeURIComponent(selectedId),
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formValues),
          }
        );

        const data = (await response.json()) as ModuleApiResponse;
        if (!response.ok || !data.ok) {
          throw new Error(data.error || "No se pudo actualizar el registro.");
        }

        setSuccessText("Registro actualizado correctamente.");
      }

      await loadAll();
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "No se pudo guardar.");
    } finally {
      setIsSaving(false);
    }
  }

  async function onDelete() {
    if (!selectedId) {
      setErrorText("No hay registro seleccionado para borrar.");
      return;
    }

    const confirmed = window.confirm("Se va a borrar el registro seleccionado. ¿Continuar?");
    if (!confirmed) return;

    setIsSaving(true);
    setErrorText("");
    setSuccessText("");

    try {
      const response = await fetch(
        "/api/erp/module?module=" + encodeURIComponent(moduleKey) + "&id=" + encodeURIComponent(selectedId),
        { method: "DELETE" }
      );

      const data = (await response.json()) as ModuleApiResponse;
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "No se pudo borrar el registro.");
      }

      setMode("create");
      setSelectedId("");
      setFormValues(buildEmptyValues(schema, linkedSelects));
      setSuccessText("Registro borrado correctamente.");

      await loadAll();
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "No se pudo borrar.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main style={{ padding: 24, fontFamily: "Arial, sans-serif", maxWidth: 1500, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 18 }}>
        <div>
          <Link href="/" style={{ textDecoration: "none" }}>
            Volver al dashboard
          </Link>
        </div>
        <div style={{ fontSize: 12, opacity: 0.7 }}>
          Cliente activo: {activeClientId || "-"}
        </div>
      </div>

      <div style={{ marginBottom: 18 }}>
        <h1 style={{ marginBottom: 8 }}>{title}</h1>
        <p style={{ margin: 0, opacity: 0.8 }}>{description}</p>
      </div>

      {errorText ? (
        <div style={{ marginBottom: 14, border: "1px solid #f0b7b7", background: "#fff4f4", color: "#8a1f1f", borderRadius: 12, padding: 12 }}>
          {errorText}
        </div>
      ) : null}

      {successText ? (
        <div style={{ marginBottom: 14, border: "1px solid #bfe3bf", background: "#f4fff4", color: "#1f6b1f", borderRadius: 12, padding: 12 }}>
          {successText}
        </div>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "1.15fr 0.95fr 0.9fr", gap: 18, alignItems: "start" }}>
        <section style={{ border: "1px solid #ddd", borderRadius: 14, background: "#fff", padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 14 }}>
            <h2 style={{ margin: 0, fontSize: 20 }}>Rejilla</h2>
            <button
              type="button"
              onClick={() => void loadAll()}
              disabled={isLoading || isSaving}
              style={{ border: "1px solid #ddd", borderRadius: 10, background: "#fff", padding: "8px 12px", cursor: "pointer" }}
            >
              Recargar
            </button>
          </div>

          <div style={{ marginBottom: 12 }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              style={{
                width: "100%",
                border: "1px solid #d9d9d9",
                borderRadius: 10,
                padding: "10px 12px",
                fontSize: 14,
              }}
            />
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ background: "#fafafa" }}>
                  {columns.map((column) => (
                    <th key={column.key} style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #eee" }}>
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => {
                  const isSelected = toText(item.id) === selectedId;

                  return (
                    <tr
                      key={toText(item.id)}
                      onClick={() => startEdit(item)}
                      style={{
                        cursor: "pointer",
                        background: isSelected ? "#eef5ff" : "#fff",
                      }}
                    >
                      {columns.map((column) => (
                        <td key={column.key} style={{ padding: 10, borderBottom: "1px solid #f1f1f1" }}>
                          {toText(item[column.key]) || "-"}
                        </td>
                      ))}
                    </tr>
                  );
                })}

                {!isLoading && filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} style={{ padding: 14, opacity: 0.7 }}>
                      No hay registros para mostrar.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section style={{ border: "1px solid #ddd", borderRadius: 14, background: "#fff", padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 14 }}>
            <h2 style={{ margin: 0, fontSize: 20 }}>
              {mode === "create" ? "Alta de registro" : "Edicion de registro"}
            </h2>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={startCreate}
                disabled={isSaving}
                style={{ border: "1px solid #ddd", borderRadius: 10, background: "#fff", padding: "8px 12px", cursor: "pointer" }}
              >
                Nuevo
              </button>

              <button
                type="button"
                onClick={() => void onSave()}
                disabled={isSaving || !schema}
                style={{ border: "1px solid #111", borderRadius: 10, background: "#111", color: "#fff", padding: "8px 12px", cursor: "pointer" }}
              >
                Guardar
              </button>

              <button
                type="button"
                onClick={() => void onDelete()}
                disabled={isSaving || !selectedId || mode === "create"}
                style={{ border: "1px solid #c62828", borderRadius: 10, background: "#fff", color: "#c62828", padding: "8px 12px", cursor: "pointer" }}
              >
                Borrar
              </button>
            </div>
          </div>

          {schema ? (
            <div style={{ display: "grid", gap: 14 }}>
              {schema.fields.map((field) => {
                const linked = linkedSelects.find((item) => item.fieldKey === field.key);

                if (linked) {
                  const sourceRows = moduleDataMap[linked.sourceModuleKey] || [];
                  const filteredSourceRows = sourceRows.filter((row) => {
                    if (!linked.filterByFormField || !linked.filterBySourceField) {
                      return true;
                    }

                    const formFilterValue = linked.filterByFormField
                      ? toText(formValues[linked.filterByFormField])
                      : "";

                    if (!formFilterValue) return true;

                    return toText(row[linked.filterBySourceField]) === formFilterValue;
                  });

                  const selectValue = linked.bindIdField
                    ? toText(formValues[linked.bindIdField])
                    : toText(formValues[field.key]);

                  return (
                    <div key={field.key}>
                      <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 600 }}>
                        {linked.label || field.label}
                        {field.required ? " *" : ""}
                      </label>

                      <select
                        value={selectValue}
                        disabled={isSaving}
                        onChange={(e) => onLinkedSelectChange(linked, e.target.value)}
                        style={{
                          width: "100%",
                          border: "1px solid #d9d9d9",
                          borderRadius: 10,
                          padding: "10px 12px",
                          fontSize: 14,
                          background: isSaving ? "#f5f5f5" : "#fff",
                        }}
                      >
                        {linked.includeEmptyOption ? (
                          <option value="">{linked.emptyOptionLabel || "Selecciona una opcion"}</option>
                        ) : null}

                        {filteredSourceRows.map((row) => (
                          <option key={toText(row[linked.optionValueField])} value={toText(row[linked.optionValueField])}>
                            {toText(row[linked.optionLabelField])}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                }

                return (
                  <div key={field.key}>
                    <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 600 }}>
                      {field.label}
                      {field.required ? " *" : ""}
                    </label>

                    {renderStandardField(field, toText(formValues[field.key]), isSaving, onFieldChange)}
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ opacity: 0.7 }}>Cargando esquema del modulo...</div>
          )}
        </section>

        <section style={{ border: "1px solid #ddd", borderRadius: 14, background: "#fff", padding: 16 }}>
          <h2 style={{ marginTop: 0, fontSize: 20 }}>Contexto</h2>

          {selectedItem ? (
            <div style={{ display: "grid", gap: 16 }}>
              {renderSummary ? renderSummary(selectedItem) : (
                <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 14, background: "#fafafa" }}>
                  <div style={{ fontSize: 12, opacity: 0.65, marginBottom: 6 }}>Registro seleccionado</div>
                  <div style={{ display: "grid", gap: 8 }}>
                    {columns.map((column) => (
                      <div key={column.key}>
                        <strong>{column.label}:</strong> {toText(selectedItem[column.key]) || "-"}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {relatedModules.map((rel) => {
                const allRows = moduleDataMap[rel.key] || [];
                const relationValue = toText(selectedItem.id);

                const rows = allRows.filter((item) => toText(item[rel.relationField]) === relationValue);

                return (
                  <div key={rel.key}>
                    <h3 style={{ marginBottom: 8 }}>{rel.label}</h3>
                    {rows.length > 0 ? (
                      <div style={{ display: "grid", gap: 10 }}>
                        {rows.map((item) => (
                          <div key={toText(item.id)} style={{ border: "1px solid #eee", borderRadius: 12, padding: 12, background: "#fafafa" }}>
                            {rel.columns.map((column) => (
                              <div key={column.key}>
                                <strong>{column.label}:</strong> {toText(item[column.key]) || "-"}
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ opacity: 0.7 }}>No hay registros relacionados.</div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ opacity: 0.7 }}>
              Selecciona un registro de la rejilla o pulsa Nuevo para dar de alta uno.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}