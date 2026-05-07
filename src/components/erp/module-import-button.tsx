"use client";

import { useRef, useState } from "react";

/**
 * Botón "↑ Importar CSV" reusable para cualquier módulo del ERP genérico
 * (CORE-05). Sube el archivo CSV a /api/erp/module-import?modulo=X y
 * muestra el resumen del resultado.
 */
type Props = {
  modulo: string;
  /** Callback opcional tras importación exitosa (típicamente reload). */
  onAfterImport?: () => void;
};

export default function ModuleImportButton({ modulo, onAfterImport }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".csv")) {
      alert("Solo archivos CSV.");
      event.target.value = "";
      return;
    }

    const confirmed = window.confirm(
      "¿Importar el CSV '" +
        file.name +
        "' al módulo " +
        modulo +
        "?\n\nLas filas se crearán como registros nuevos. " +
        "Asegúrate de que la primera fila contiene los nombres de los campos.",
    );
    if (!confirmed) {
      event.target.value = "";
      return;
    }

    setBusy(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(
        "/api/erp/module-import?modulo=" + encodeURIComponent(modulo),
        { method: "POST", body: formData },
      );
      const data = await response.json();
      if (!response.ok || !data.ok) {
        alert("Error al importar: " + (data.error || "desconocido"));
        return;
      }
      const errores = Array.isArray(data.errores) ? data.errores : [];
      const erroresSummary = errores.length > 0
        ? "\n\n" + errores.length + " errores:\n" +
          errores
            .slice(0, 5)
            .map((e: { fila: number; error: string }) => "  Fila " + e.fila + ": " + e.error)
            .join("\n") +
          (errores.length > 5 ? "\n  (...)" : "")
        : "";
      alert(
        "Importadas " +
          data.creados +
          " filas de " +
          data.total +
          "." +
          erroresSummary,
      );
      if (onAfterImport) onAfterImport();
      else if (typeof window !== "undefined") window.location.reload();
    } catch (err) {
      alert("Error: " + (err instanceof Error ? err.message : "desconocido"));
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        onChange={handleFile}
        style={{ display: "none" }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        style={{
          border: "1px solid #d1d5db",
          borderRadius: 8,
          background: "#ffffff",
          color: "#374151",
          padding: "10px 14px",
          cursor: busy ? "not-allowed" : "pointer",
          fontWeight: 600,
          fontSize: 13,
          whiteSpace: "nowrap",
          opacity: busy ? 0.6 : 1,
        }}
        title={"Importar CSV al módulo " + modulo}
      >
        {busy ? "Importando..." : "↑ Importar CSV"}
      </button>
    </>
  );
}
