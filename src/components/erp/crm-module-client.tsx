"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  createEmptyRecordFromSchema,
  type ModuleRecord,
  type ModuleSchema,
} from "@/lib/erp/module-schemas";
import { ModuleGrid } from "@/components/erp/module-grid";
import { ModuleForm } from "@/components/erp/module-form";

type RuntimeClientInfo = {
  clientId: string;
  displayName: string;
  sector: string;
  businessType?: string;
};

type ApiResponse = {
  ok?: boolean;
  error?: string;
  schema?: ModuleSchema;
  items?: ModuleRecord[];
  item?: ModuleRecord;
};

type OptionItem = {
  value: string;
  label: string;
};

type OptionsResponse = {
  ok?: boolean;
  error?: string;
  options?: OptionItem[];
};

type CrmModuleClientProps = {
  runtimeInfo: RuntimeClientInfo;
};

const MODULE_KEY = "crm";

export default function CrmModuleClient(props: CrmModuleClientProps) {
  const { runtimeInfo } = props;

  const [schema, setSchema] = useState<ModuleSchema | null>(null);
  const [rows, setRows] = useState<ModuleRecord[]>([]);
  const [clienteOptions, setClienteOptions] = useState<OptionItem[]>([]);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<ModuleRecord | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorText, setErrorText] = useState("");

  async function loadClienteOptions() {
    try {
      const response = await fetch("/api/erp/options?module=clientes", {
        cache: "no-store",
      });
      const data = (await response.json()) as OptionsResponse;

      if (!response.ok || !data.ok) {
        setClienteOptions([]);
        return;
      }

      setClienteOptions(Array.isArray(data.options) ? data.options : []);
    } catch {
      setClienteOptions([]);
    }
  }

  async function loadRows() {
    setIsLoading(true);
    setErrorText("");

    try {
      const response = await fetch("/api/erp/module?module=" + MODULE_KEY, {
        cache: "no-store",
      });

      const data = (await response.json()) as ApiResponse;

      if (!response.ok || !data.ok || !data.schema) {
        throw new Error(data.error || "No se pudo cargar el módulo.");
      }

      const nextSchema: ModuleSchema = {
        ...data.schema,
        fields: data.schema.fields.map((field) => {
          if (field.key === "empresa") {
            return {
              ...field,
              type: "select",
              options: clienteOptions,
            };
          }
          return field;
        }),
      };

      setSchema(nextSchema);
      setRows(Array.isArray(data.items) ? data.items : []);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "No se pudo cargar el módulo.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadClienteOptions();
  }, []);

  useEffect(() => {
    void loadRows();
  }, [clienteOptions.length]);

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return rows;
    }

    return rows.filter((row) => {
      return Object.values(row).some((value) =>
        String(value || "").toLowerCase().includes(normalizedQuery)
      );
    });
  }, [rows, query]);

  const initialValues = useMemo(() => {
    if (!schema) {
      return {};
    }

    if (editingRow) {
      const values: Record<string, string> = {};
      for (const field of schema.fields) {
        values[field.key] = String(editingRow[field.key] || "");
      }
      return values;
    }

    return createEmptyRecordFromSchema(schema);
  }, [schema, editingRow]);

  function handleCreate() {
    setEditingRow(null);
    setErrorText("");
    setIsModalOpen(true);
  }

  function handleEdit(row: ModuleRecord) {
    setEditingRow(row);
    setErrorText("");
    setIsModalOpen(true);
  }

  async function handleDelete(row: ModuleRecord) {
    const confirmed = window.confirm("¿Seguro que quieres borrar esta oportunidad?");
    if (!confirmed) {
      return;
    }

    setErrorText("");

    try {
      const response = await fetch(
        "/api/erp/module?module=" + MODULE_KEY + "&id=" + encodeURIComponent(row.id),
        {
          method: "DELETE",
        }
      );

      const data = (await response.json()) as ApiResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "No se pudo borrar el registro.");
      }

      await loadRows();
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "No se pudo borrar el registro.");
    }
  }

  async function handleSubmit(values: Record<string, string>) {
    setIsSaving(true);
    setErrorText("");

    try {
      const isEdit = !!editingRow;
      const url =
        "/api/erp/module?module=" +
        MODULE_KEY +
        (isEdit ? "&id=" + encodeURIComponent(editingRow!.id) : "");

      const response = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      const data = (await response.json()) as ApiResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "No se pudo guardar el registro.");
      }

      setIsModalOpen(false);
      setEditingRow(null);
      await loadRows();
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "No se pudo guardar el registro.");
    } finally {
      setIsSaving(false);
    }
  }

  const columns = [
    { key: "empresa", label: "Empresa" },
    { key: "contacto", label: "Contacto" },
    {
      key: "fase",
      label: "Fase",
      render: (row: ModuleRecord) => (
        <span
          style={{
            border: "1px solid #ddd",
            borderRadius: 999,
            padding: "4px 10px",
            background: "#fafafa",
            display: "inline-block",
          }}
        >
          {row.fase || ""}
        </span>
      ),
    },
    { key: "valorEstimado", label: "Valor estimado" },
    { key: "fechaSeguimiento", label: "Seguimiento" },
  ];

  return (
    <main style={{ padding: 24, fontFamily: "Arial, sans-serif", maxWidth: 1300, margin: "0 auto" }}>
      <div style={{ marginBottom: 16 }}>
        <Link href="/" style={{ textDecoration: "none" }}>
          &lt;- Volver al dashboard
        </Link>
      </div>

      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 32, marginBottom: 8 }}>
          {schema?.title || "CRM"}
        </h1>
        <p style={{ marginBottom: 8 }}>
          Gestión real de pipeline comercial del ERP activo.
        </p>
        <p style={{ margin: 0, opacity: 0.8 }}>
          Cliente activo: <strong>{runtimeInfo.displayName}</strong> · {runtimeInfo.clientId}
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.9fr 1fr", gap: 16, alignItems: "start" }}>
        <section style={{ display: "grid", gap: 16 }}>
          <div
            style={{
              border: "1px solid #ddd",
              borderRadius: 16,
              background: "#fff",
              padding: 16,
              display: "grid",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por empresa, contacto, fase, valor o siguiente paso..."
                style={{
                  flex: "1 1 320px",
                  border: "1px solid #ccc",
                  borderRadius: 10,
                  padding: "10px 12px",
                  fontFamily: "inherit",
                }}
              />

              <button
                onClick={() => {
                  void loadClienteOptions();
                  void loadRows();
                }}
                style={{
                  border: "1px solid #ddd",
                  background: "#fff",
                  borderRadius: 10,
                  padding: "10px 12px",
                  cursor: "pointer",
                }}
              >
                Recargar
              </button>
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
          </div>

          <ModuleGrid
            title={isLoading ? "Cargando..." : "CRM"}
            rows={filteredRows}
            columns={columns}
            emptyText="Todavía no hay oportunidades registradas."
            onCreate={handleCreate}
            onEdit={handleEdit}
            onDelete={(row) => void handleDelete(row)}
          />
        </section>

        <aside style={{ display: "grid", gap: 16 }}>
          <section style={{ border: "1px solid #ddd", borderRadius: 16, background: "#fff", padding: 16 }}>
            <h3 style={{ marginTop: 0 }}>Resumen</h3>
            <p><strong>Total registros:</strong> {rows.length}</p>
            <p><strong>Filtrados:</strong> {filteredRows.length}</p>
            <p><strong>Clientes disponibles:</strong> {clienteOptions.length}</p>
            <p><strong>Sector:</strong> {runtimeInfo.sector}</p>
            <p><strong>BusinessType:</strong> {runtimeInfo.businessType || "general"}</p>
          </section>

          <section style={{ border: "1px solid #ddd", borderRadius: 16, background: "#fff", padding: 16 }}>
            <h3 style={{ marginTop: 0 }}>Qué ya puedes hacer</h3>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              <li>Relacionar oportunidades con clientes reales.</li>
              <li>Editar fase, valor estimado y siguiente paso.</li>
              <li>Borrar registros.</li>
              <li>Buscar sobre la rejilla.</li>
            </ul>
          </section>
        </aside>
      </div>

      {schema ? (
        <ModuleForm
          title={editingRow ? "Editar oportunidad" : "Nueva oportunidad"}
          fields={schema.fields}
          initialValues={initialValues}
          submitLabel={editingRow ? "Guardar cambios" : "Crear oportunidad"}
          isOpen={isModalOpen}
          isSaving={isSaving}
          errorText={errorText}
          onClose={() => {
            setIsModalOpen(false);
            setEditingRow(null);
            setErrorText("");
          }}
          onSubmit={(values) => void handleSubmit(values)}
        />
      ) : null}
    </main>
  );
}