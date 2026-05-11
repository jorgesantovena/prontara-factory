"use client";

import { useEffect, useState } from "react";

/**
 * Tour interactivo de bienvenida (H9-B4).
 *
 * Se muestra la primera vez que el usuario carga el panel.
 * 6 pasos en overlay simple. Persiste en localStorage al completar.
 *
 * Diseño minimal: card centrada con paso actual + indicador + botones.
 * No usa biblioteca externa (sin Joyride/Driver) — se mantiene en el bundle.
 */

const TOUR_KEY = "prontara-tour-completed";

const STEPS = [
  {
    title: "Bienvenido a Prontara",
    body: "Te enseñamos en 30 segundos lo más útil. Puedes saltar en cualquier momento.",
    icon: "👋",
  },
  {
    title: "TopBar — siempre arriba",
    body: "Saluda con tu nombre, te muestra la fecha, deja cambiar de empresa, ver notificaciones y abrir esta ayuda con el botón ?",
    icon: "🔝",
  },
  {
    title: "Sidebar — agrupada por categorías",
    body: "Operación, Administración, Comunicación, Reportes y Configuración. Cada módulo en su sitio. En móvil se oculta tras la hamburguesa.",
    icon: "📂",
  },
  {
    title: "Dashboard — KPIs reales de tu sector",
    body: "Aquí ves los indicadores que importan a tu negocio. Las cifras se calculan con tus datos en tiempo real.",
    icon: "📊",
  },
  {
    title: "Accesos rápidos — los botones grandes",
    body: "Lo que más usas: nuevo cliente, nueva factura, imputar horas, lo que sea. Un clic y listo.",
    icon: "⚡",
  },
  {
    title: "Buscador global — pulsa /",
    body: "Encuentra cualquier cosa en cualquier módulo en milisegundos. Cliente, factura, tarea, lo que sea.",
    icon: "🔍",
  },
];

export default function FirstTimeTour() {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const done = window.localStorage.getItem(TOUR_KEY);
      if (!done) {
        // Pequeño delay para que la UI se asiente antes
        setTimeout(() => setVisible(true), 800);
      }
    } catch {
      /* ignore */
    }
  }, []);

  function complete() {
    try { window.localStorage.setItem(TOUR_KEY, "1"); } catch { /* ignore */ }
    setVisible(false);
  }

  if (!visible) return null;
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(15,23,42,0.65)",
      zIndex: 200,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20,
      fontFamily: "system-ui, -apple-system, sans-serif",
    }}>
      <div style={{
        background: "#ffffff",
        borderRadius: 16,
        padding: 32,
        maxWidth: 480,
        width: "100%",
        boxShadow: "0 30px 80px rgba(0,0,0,0.3)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#1d4ed8", letterSpacing: 0.5, textTransform: "uppercase" }}>
            Paso {step + 1} de {STEPS.length}
          </div>
          <button type="button" onClick={complete} style={{ border: "none", background: "transparent", color: "#64748b", fontSize: 13, cursor: "pointer" }}>
            Saltar tour
          </button>
        </div>

        <div style={{ fontSize: 48, marginBottom: 16, textAlign: "center" }}>{current.icon}</div>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", margin: "0 0 12px 0", textAlign: "center" }}>
          {current.title}
        </h2>
        <p style={{ fontSize: 15, color: "#475569", lineHeight: 1.55, margin: "0 0 24px 0", textAlign: "center" }}>
          {current.body}
        </p>

        {/* Indicador de progreso */}
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 20 }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              width: i === step ? 24 : 8,
              height: 8,
              background: i <= step ? "#1d4ed8" : "#e5e7eb",
              borderRadius: 4,
              transition: "width 0.2s, background 0.2s",
            }} />
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
          <button
            type="button"
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0}
            style={{
              padding: "10px 18px",
              border: "1px solid #d1d5db",
              background: "#ffffff",
              color: "#475569",
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 14,
              cursor: step === 0 ? "not-allowed" : "pointer",
              opacity: step === 0 ? 0.4 : 1,
            }}
          >
            ← Anterior
          </button>
          <button
            type="button"
            onClick={() => isLast ? complete() : setStep(step + 1)}
            style={{
              padding: "10px 18px",
              border: "none",
              background: "#1d4ed8",
              color: "#ffffff",
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
              flex: 1,
            }}
          >
            {isLast ? "¡Empezar!" : "Siguiente →"}
          </button>
        </div>
      </div>
    </div>
  );
}
