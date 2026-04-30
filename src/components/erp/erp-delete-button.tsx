"use client";

import { useState } from "react";

export default function ErpDeleteButton({
  label,
  confirmText,
  onDelete,
}: {
  label?: string;
  confirmText: string;
  onDelete: () => Promise<void> | void;
}) {
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    const confirmed = window.confirm(confirmText);
    if (!confirmed) {
      return;
    }

    setBusy(true);
    try {
      await onDelete();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      style={{
        border: "1px solid #ef4444",
        borderRadius: 10,
        background: "#ffffff",
        color: "#b91c1c",
        padding: "8px 12px",
        cursor: "pointer",
        fontWeight: 700,
      }}
    >
      {busy ? "Borrando..." : label || "Borrar"}
    </button>
  );
}