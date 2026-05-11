"use client";

import { useEffect } from "react";
import RecordDetail from "@/components/erp/record-detail";

/**
 * Drawer lateral para mostrar detalle rápido de un registro (H10-C).
 *
 * Usado en cualquier listado: al hacer clic en una fila se abre por la
 * derecha sin perder el contexto de la lista. Cierra con Esc o clic fuera.
 */
export default function RecordDrawer({
  open,
  onClose,
  moduleKey,
  recordId,
  record,
  accent = "#1d4ed8",
}: {
  open: boolean;
  onClose: () => void;
  moduleKey: string;
  recordId: string;
  record: Record<string, unknown> & { id: string } | null;
  accent?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [open, onClose]);

  if (!open || !record) return null;

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0,
          background: "rgba(15,23,42,0.4)",
          zIndex: 90,
        }}
      />
      {/* Drawer */}
      <aside style={{
        position: "fixed", top: 0, right: 0, bottom: 0,
        width: "min(720px, 95%)",
        background: "var(--bg, #ffffff)",
        boxShadow: "-10px 0 40px rgba(0,0,0,0.15)",
        zIndex: 95,
        overflowY: "auto",
      }}>
        <RecordDetail
          moduleKey={moduleKey}
          recordId={recordId}
          record={record}
          onClose={onClose}
          accent={accent}
        />
      </aside>
    </>
  );
}
