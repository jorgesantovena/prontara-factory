"use client";

/**
 * Botón "↓ CSV" reusable para cualquier módulo del ERP genérico (SCHOOL-04).
 * Llama a /api/erp/module-export?modulo=X&format=csv y descarga el CSV.
 */
type Props = {
  modulo: string;
  label?: string;
};

export default function ModuleExportButton({ modulo, label }: Props) {
  const href =
    "/api/erp/module-export?modulo=" + encodeURIComponent(modulo) + "&format=csv";
  return (
    <a
      href={href}
      download
      style={{
        border: "1px solid #d1d5db",
        borderRadius: 8,
        background: "#ffffff",
        color: "#374151",
        padding: "10px 14px",
        cursor: "pointer",
        fontWeight: 600,
        fontSize: 13,
        textDecoration: "none",
        whiteSpace: "nowrap",
      }}
      title={"Descargar todos los registros de " + modulo + " como archivo CSV (compatible con Excel)"}
    >
      {/* TEST-2.11 — copy más claro. Mantenemos CSV pero con icono y tooltip. */}
      {label || "↓ Exportar a Excel"}
    </a>
  );
}
