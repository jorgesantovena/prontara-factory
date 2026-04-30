"use client";

import type { UiStatusTone } from "@/lib/erp/ui-contracts";

function resolveTone(value: string): UiStatusTone {
  const normalized = String(value || "").trim().toLowerCase();

  if (["activo", "active", "ok", "vigente", "ganado", "firmado", "cerrado"].includes(normalized)) {
    return "ok";
  }

  if (["pendiente", "enviado", "abierto", "contactado", "propuesta", "planificado", "emitida"].includes(normalized)) {
    return "info";
  }

  if (["seguimiento", "en_riesgo", "vencida", "warn"].includes(normalized)) {
    return "warn";
  }

  if (["bloqueado", "cancelado", "cancelled", "perdido", "inactivo"].includes(normalized)) {
    return "danger";
  }

  return "neutral";
}

function toneStyles(tone: UiStatusTone) {
  if (tone === "ok") {
    return { bg: "#dcfce7", color: "#166534" };
  }
  if (tone === "info") {
    return { bg: "#dbeafe", color: "#1d4ed8" };
  }
  if (tone === "warn") {
    return { bg: "#fef3c7", color: "#92400e" };
  }
  if (tone === "danger") {
    return { bg: "#fee2e2", color: "#991b1b" };
  }
  return { bg: "#f3f4f6", color: "#374151" };
}

export default function EntityStatusBadge({ value }: { value: string }) {
  const styles = toneStyles(resolveTone(value));

  return (
    <span
      style={{
        display: "inline-block",
        padding: "4px 8px",
        borderRadius: 999,
        background: styles.bg,
        color: styles.color,
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      {String(value || "Sin estado")}
    </span>
  );
}