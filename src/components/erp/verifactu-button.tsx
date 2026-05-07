"use client";

import { useState } from "react";

/**
 * Botón "Verifactu" para cada fila de facturas (SF-12, stub).
 *
 * Pulsar prepara el payload XML y lo guarda en VerifactuSubmission
 * con status="prepared". El envío real a AEAT (firma XML-DSig + POST
 * al web service) es trabajo posterior — ver docs/verifactu-pendientes.md.
 *
 * Tras éxito muestra un feedback breve indicando que el payload
 * quedó preparado.
 */
type FacturaRow = Record<string, string>;

export default function VerifactuButton({ factura }: { factura: FacturaRow }) {
  const [busy, setBusy] = useState(false);

  async function handleClick(event: React.MouseEvent) {
    event.stopPropagation();

    const id = String(factura?.id || "").trim();
    if (!id) {
      alert("Esta factura no tiene id, no se puede preparar Verifactu.");
      return;
    }

    const numero = String(factura?.numero || "(sin número)");
    const confirmed = window.confirm(
      "Preparar el envío Verifactu para la factura " +
        numero +
        "?\n\nSe genera el payload XML según el esquema AEAT y se guarda como 'preparado'. " +
        "El envío real al web service AEAT requiere certificado digital (queda pendiente).",
    );
    if (!confirmed) return;

    setBusy(true);
    try {
      const response = await fetch("/api/erp/verifactu-emit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ facturaId: id }),
      });
      const data = await response.json();

      if (!response.ok || !data.ok) {
        alert("Error: " + (data.error || "no se pudo preparar."));
        return;
      }

      const msg = data.existing
        ? "Ya había un envío preparado para esta factura — no se creó uno nuevo."
        : "Payload Verifactu preparado correctamente. Pendiente de firma + envío real (ver docs/verifactu-pendientes.md).";
      alert(msg);
    } catch (err) {
      alert(
        "Error: " + (err instanceof Error ? err.message : "fallo desconocido"),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      title="Prepara el envío a Verifactu de la AEAT (sin enviar todavía)"
      style={{
        border: "1px solid #7c3aed",
        borderRadius: 6,
        background: "#ffffff",
        padding: "6px 12px",
        cursor: busy ? "not-allowed" : "pointer",
        fontSize: 12,
        fontWeight: 600,
        color: "#7c3aed",
        marginRight: 6,
        opacity: busy ? 0.6 : 1,
      }}
    >
      {busy ? "Preparando..." : "Verifactu"}
    </button>
  );
}
