"use client";

import { useEffect } from "react";

/**
 * Panel lateral deslizable (slide-over) — entra desde la derecha y se
 * superpone sobre la lista, con un backdrop oscuro detrás.
 *
 * Uso:
 *   <SlideOverPanel
 *     open={editing !== null}
 *     onClose={() => setEditing(null)}
 *     title="Editar cliente"
 *     footer={<button onClick={save}>Guardar</button>}
 *   >
 *     <YourForm ... />
 *   </SlideOverPanel>
 *
 * Diferencia respecto al modal popup que existía antes: aquí el usuario
 * sigue viendo la lista detrás (contexto preservado) y el panel tiene
 * espacio vertical real para formularios largos con varias secciones.
 */
export type SlideOverPanelProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Texto pequeño bajo el título — útil para "Editando: María Ruiz" */
  subtitle?: string;
  /** Ancho del panel: por defecto 480px, "lg" lo lleva a 640. */
  size?: "md" | "lg";
  /** Contenido del panel (formulario, ficha, lo que sea). */
  children: React.ReactNode;
  /** Footer pegado abajo: típicamente botones Cancelar / Guardar. */
  footer?: React.ReactNode;
};

export default function SlideOverPanel(props: SlideOverPanelProps) {
  const { open, onClose, title, subtitle, size = "md", children, footer } = props;

  // Cerrar con Escape.
  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Bloquear scroll del body cuando está abierto.
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (open) {
      const previous = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = previous;
      };
    }
    return undefined;
  }, [open]);

  if (!open) return null;

  const width = size === "lg" ? 640 : 480;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15, 23, 42, 0.45)",
          zIndex: 90,
          animation: "prontaraFadeIn 0.15s ease-out",
        }}
      />

      {/* Panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          width: "min(" + width + "px, 95vw)",
          height: "100vh",
          background: "#ffffff",
          boxShadow: "-10px 0 40px rgba(0,0,0,0.18)",
          zIndex: 100,
          display: "flex",
          flexDirection: "column",
          animation: "prontaraSlideIn 0.18s ease-out",
        }}
      >
        <header
          style={{
            padding: "18px 24px 16px",
            borderBottom: "1px solid #e5e7eb",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 12,
            flexShrink: 0,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 18, color: "#0f172a" }}>{title}</h2>
            {subtitle ? (
              <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>{subtitle}</div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            style={{
              border: "none",
              background: "transparent",
              fontSize: 24,
              lineHeight: 1,
              cursor: "pointer",
              color: "#6b7280",
              padding: 4,
            }}
          >
            ×
          </button>
        </header>

        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "20px 24px 24px",
          }}
        >
          {children}
        </div>

        {footer ? (
          <footer
            style={{
              padding: "14px 24px",
              borderTop: "1px solid #e5e7eb",
              background: "#f9fafb",
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
              flexShrink: 0,
            }}
          >
            {footer}
          </footer>
        ) : null}
      </aside>

      <style>{`
        @keyframes prontaraFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes prontaraSlideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </>
  );
}
