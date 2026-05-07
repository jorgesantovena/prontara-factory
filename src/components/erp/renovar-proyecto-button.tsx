"use client";

import { useState } from "react";

/**
 * Botón "Renovar" que se inyecta en cada fila de la tabla de proyectos
 * del vertical Software Factory (SF-05). Al pulsarlo:
 *   1. Confirma con el operador.
 *   2. POST a /api/erp/proyecto-renovar con el id del proyecto.
 *   3. Tras éxito, recarga la página para que aparezca el proyecto nuevo.
 *
 * Se renderiza incrustado dentro de la celda "Acciones" junto a los
 * botones Editar/Borrar del componente genérico.
 */
type ProyectoRow = Record<string, string>;

export default function RenovarProyectoButton({
  proyecto,
  onAfterRenew,
}: {
  proyecto: ProyectoRow;
  onAfterRenew?: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function handleRenew(event: React.MouseEvent) {
    event.stopPropagation();

    const id = String(proyecto?.id || "").trim();
    if (!id) {
      alert("Este proyecto no tiene id, no se puede renovar.");
      return;
    }

    const nombre = String(proyecto?.nombre || "(sin nombre)");
    const confirmed = window.confirm(
      "Crear renovación del proyecto '" +
        nombre +
        "'?\n\nSe creará un proyecto nuevo continuación con las mismas condiciones, " +
        "fecha de inicio = día siguiente al fin del actual (o hoy) y duración igual al " +
        "original. Podrás editarlo después.",
    );
    if (!confirmed) return;

    setBusy(true);
    try {
      const response = await fetch("/api/erp/proyecto-renovar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proyectoId: id }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        alert("No se pudo renovar: " + (data.error || "error desconocido"));
        return;
      }
      // Mensaje breve y recarga para que el operador vea el nuevo proyecto
      // en la lista. Si onAfterRenew está presente, lo llamamos antes.
      if (onAfterRenew) onAfterRenew();
      else if (typeof window !== "undefined") window.location.reload();
    } catch (err) {
      alert(
        "Error renovando: " +
          (err instanceof Error ? err.message : "desconocido"),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleRenew}
      disabled={busy}
      title="Crear proyecto nuevo continuación"
      style={{
        border: "1px solid #1d4ed8",
        borderRadius: 6,
        background: "#ffffff",
        padding: "6px 12px",
        cursor: busy ? "not-allowed" : "pointer",
        fontSize: 12,
        fontWeight: 600,
        color: "#1d4ed8",
        marginRight: 6,
        opacity: busy ? 0.6 : 1,
      }}
    >
      {busy ? "Renovando..." : "Renovar"}
    </button>
  );
}
