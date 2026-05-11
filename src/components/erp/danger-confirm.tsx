"use client";

import { useState, useEffect } from "react";

/**
 * Modal de confirmación para acciones peligrosas (H10-I).
 *
 * Pide al usuario que escriba un literal (por defecto "ELIMINAR" o el
 * nombre del registro) antes de habilitar el botón de confirmación.
 *
 * Uso:
 *   <DangerConfirm
 *     open={open}
 *     onClose={...}
 *     onConfirm={async () => { await borrar(); }}
 *     title="Eliminar Almacenes Delca SA"
 *     description="Se borrarán todos los datos del cliente. No se puede deshacer."
 *     mustType="ELIMINAR"
 *     confirmLabel="Eliminar definitivamente"
 *   />
 */
export default function DangerConfirm({
  open,
  onClose,
  onConfirm,
  title,
  description,
  mustType = "ELIMINAR",
  confirmLabel = "Eliminar",
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description?: string;
  mustType?: string;
  confirmLabel?: string;
}) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setTyped("");
      setBusy(false);
    }
  }, [open]);

  if (!open) return null;
  const enabled = typed.trim() === mustType.trim();

  async function handleConfirm() {
    if (!enabled || busy) return;
    setBusy(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.65)", zIndex: 150 }} />
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        background: "var(--bg-card, #ffffff)", borderRadius: 12, padding: 28,
        width: "min(480px, 92%)", zIndex: 151,
        boxShadow: "0 30px 80px rgba(0,0,0,0.3)",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
        <h2 style={{ margin: "0 0 8px 0", fontSize: 20, fontWeight: 800, color: "#dc2626" }}>{title}</h2>
        {description ? (
          <p style={{ margin: "0 0 16px 0", fontSize: 14, color: "var(--fg-muted, #475569)", lineHeight: 1.5 }}>{description}</p>
        ) : null}
        <p style={{ margin: "0 0 8px 0", fontSize: 13, color: "var(--fg, #0f172a)" }}>
          Para confirmar, escribe <code style={{ background: "#fef2f2", color: "#991b1b", padding: "2px 6px", borderRadius: 4, fontWeight: 700 }}>{mustType}</code>
        </p>
        <input
          type="text"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoFocus
          style={{
            width: "100%",
            padding: "10px 12px",
            border: "1px solid " + (enabled ? "#16a34a" : "var(--border, #d1d5db)"),
            borderRadius: 6,
            fontSize: 14,
            fontFamily: "monospace",
            boxSizing: "border-box",
            marginBottom: 16,
          }}
        />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button type="button" onClick={onClose} style={{ padding: "10px 16px", border: "1px solid var(--border, #d1d5db)", background: "transparent", color: "var(--fg, #0f172a)", borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!enabled || busy}
            style={{
              padding: "10px 16px",
              border: "none",
              background: enabled ? "#dc2626" : "#cbd5e1",
              color: "#ffffff",
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 700,
              cursor: enabled && !busy ? "pointer" : "not-allowed",
            }}
          >
            {busy ? "Procesando…" : confirmLabel}
          </button>
        </div>
      </div>
    </>
  );
}
