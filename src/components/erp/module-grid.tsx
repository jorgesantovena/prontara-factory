"use client";

type Column<T> = {
  key: keyof T | string;
  label: string;
  render?: (row: T) => React.ReactNode;
};

type ModuleGridProps<T extends { id: string }> = {
  title: string;
  rows: T[];
  columns: Column<T>[];
  emptyText?: string;
  onCreate: () => void;
  onEdit: (row: T) => void;
  onDelete: (row: T) => void;
};

export function ModuleGrid<T extends { id: string }>(props: ModuleGridProps<T>) {
  const { title, rows, columns, emptyText, onCreate, onEdit, onDelete } = props;

  return (
    <section style={{ border: "1px solid #ddd", borderRadius: 16, background: "#fff", overflow: "hidden" }}>
      <div
        style={{
          padding: 16,
          borderBottom: "1px solid #eee",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 22 }}>{title}</h2>
        </div>

        <button
          onClick={onCreate}
          style={{
            border: "1px solid #111",
            background: "#111",
            color: "#fff",
            borderRadius: 10,
            padding: "10px 14px",
            cursor: "pointer",
          }}
        >
          Nuevo
        </button>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={String(column.key)}
                  style={{
                    textAlign: "left",
                    padding: "12px 14px",
                    borderBottom: "1px solid #ddd",
                    background: "#fafafa",
                    whiteSpace: "nowrap",
                  }}
                >
                  {column.label}
                </th>
              ))}
              <th
                style={{
                  textAlign: "left",
                  padding: "12px 14px",
                  borderBottom: "1px solid #ddd",
                  background: "#fafafa",
                  whiteSpace: "nowrap",
                }}
              >
                Acciones
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + 1}
                  style={{ padding: 18, borderBottom: "1px solid #eee", opacity: 0.7 }}
                >
                  {emptyText || "No hay registros todavía."}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  {columns.map((column) => (
                    <td
                      key={String(column.key)}
                      style={{
                        padding: "12px 14px",
                        borderBottom: "1px solid #eee",
                        verticalAlign: "top",
                      }}
                    >
                      {column.render
                        ? column.render(row)
                        : String((row as Record<string, unknown>)[String(column.key)] ?? "")}
                    </td>
                  ))}

                  <td
                    style={{
                      padding: "12px 14px",
                      borderBottom: "1px solid #eee",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        onClick={() => onEdit(row)}
                        style={{
                          border: "1px solid #ddd",
                          background: "#fff",
                          borderRadius: 8,
                          padding: "8px 10px",
                          cursor: "pointer",
                        }}
                      >
                        Editar
                      </button>

                      <button
                        onClick={() => onDelete(row)}
                        style={{
                          border: "1px solid #b91c1c",
                          background: "#fff",
                          color: "#b91c1c",
                          borderRadius: 8,
                          padding: "8px 10px",
                          cursor: "pointer",
                        }}
                      >
                        Borrar
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}