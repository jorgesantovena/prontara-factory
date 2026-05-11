"use client";

import { useEffect, useState } from "react";

/**
 * Panel lateral del login (H9-B2).
 *
 * Si en la URL hay ?tenant=slug o ?sectorPack=key, intenta resolver el
 * vertical y mostrar a la derecha del formulario un panel con:
 *   - Color del vertical
 *   - Mensaje de valor
 *   - Lista de módulos clave
 *
 * Sin sesión iniciada — todo cliente. Solo decora.
 */

const VERTICAL_PANELS: Record<string, { displayName: string; accentColor: string; tagline: string; bullets: string[] }> = {
  "software-factory": {
    displayName: "Prontara Software Factory",
    accentColor: "#2563eb",
    tagline: "Tu equipo factura lo que trabaja. Sin Excel.",
    bullets: ["Bolsa de horas con saldo", "Pre-facturación 8 columnas", "PDF detalle estilo SISPYME", "CAU + Verifactu"],
  },
  "clinica-dental": {
    displayName: "Prontara Dental",
    accentColor: "#0f766e",
    tagline: "Pacientes, citas, RX y facturación en un solo entorno.",
    bullets: ["Agenda con doctor + duración", "Presupuestos firmables", "Historia clínica completa", "Facturación con IVA"],
  },
  "clinica-veterinaria": {
    displayName: "Prontara Veterinaria",
    accentColor: "#16a34a",
    tagline: "La clínica veterinaria, organizada al detalle.",
    bullets: ["Mascotas con propietario", "Vacunas con recordatorio", "Cirugías y tratamientos", "Facturación al propietario"],
  },
  "colegio": {
    displayName: "Prontara Colegio",
    accentColor: "#7c3aed",
    tagline: "Centraliza matrículas, notas y comunicación familiar.",
    bullets: ["Calificaciones con boletín PDF", "Asistencia diaria", "Portal docente / familia / estudiante", "Becas y comunicaciones"],
  },
  "peluqueria": {
    displayName: "Prontara Peluquería",
    accentColor: "#db2777",
    tagline: "Agenda, caja y clientes desde un solo sitio.",
    bullets: ["Reservas online", "Caja diaria con métodos", "Clientes con histórico", "Recordatorios automáticos"],
  },
  "taller": {
    displayName: "Prontara Taller",
    accentColor: "#ea580c",
    tagline: "Vehículos, reparaciones y facturación sin papel.",
    bullets: ["Vehículos con histórico", "Mano de obra + recambios", "Mantenimientos programados", "Facturación con IVA"],
  },
  "veterinaria": {
    displayName: "Prontara Veterinaria",
    accentColor: "#16a34a",
    tagline: "La clínica veterinaria, organizada al detalle.",
    bullets: ["Mascotas con propietario", "Vacunas con recordatorio", "Cirugías y tratamientos", "Facturación al propietario"],
  },
  "despacho-abogados": {
    displayName: "Prontara Legal",
    accentColor: "#1e40af",
    tagline: "El despacho, organizado por casos.",
    bullets: ["Casos por materia", "Plazos procesales", "Expedientes asociados", "Honorarios y facturas"],
  },
  "hosteleria": {
    displayName: "Prontara Hostelería",
    accentColor: "#d97706",
    tagline: "El restaurante, sin perder una reserva.",
    bullets: ["Eventos con menú", "Clientes habituales con preferencias", "Captación de bodas y empresas", "Caja con métodos"],
  },
  "inmobiliaria": {
    displayName: "Prontara Inmobiliaria",
    accentColor: "#0891b2",
    tagline: "Tu cartera y tus contactos, un solo lugar.",
    bullets: ["Cartera de inmuebles", "Propietarios e interesados", "Ofertas con seguimiento", "Comisiones y documentación"],
  },
  "asesoria": {
    displayName: "Prontara Asesoría",
    accentColor: "#57534e",
    tagline: "Tu asesoría, sin perder un plazo.",
    bullets: ["Cuotas mensuales por cliente", "Encargos con responsable y plazo", "Modelos AEAT y nóminas", "Captación a cliente fijo"],
  },
};

function readVerticalFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const sp = new URLSearchParams(window.location.search);
  const sectorPack = sp.get("sectorPack");
  if (sectorPack) return sectorPack;
  const tenant = sp.get("tenant");
  if (!tenant) return null;
  // Best-effort: si el slug coincide con algún vertical conocido
  const lower = tenant.toLowerCase();
  for (const k of Object.keys(VERTICAL_PANELS)) {
    if (lower.includes(k.replace("-", ""))) return k;
  }
  return null;
}

export default function LoginSidePanel() {
  const [vertical, setVertical] = useState<string | null>(null);

  useEffect(() => {
    setVertical(readVerticalFromUrl());
  }, []);

  if (!vertical || !VERTICAL_PANELS[vertical]) return null;
  const data = VERTICAL_PANELS[vertical];

  return (
    <aside style={{
      flex: 1,
      minHeight: "100vh",
      background: "linear-gradient(135deg, " + data.accentColor + " 0%, " + data.accentColor + "dd 100%)",
      color: "#ffffff",
      padding: "60px 48px",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      fontFamily: "system-ui, -apple-system, sans-serif",
    }}
    className="prontara-login-side">
      <div style={{ maxWidth: 460 }}>
        <div style={{ display: "inline-block", background: "rgba(255,255,255,0.18)", padding: "5px 12px", borderRadius: 999, fontSize: 11, fontWeight: 700, marginBottom: 18, letterSpacing: 0.5 }}>
          {data.displayName.toUpperCase()}
        </div>
        <h2 style={{ fontSize: 32, fontWeight: 800, margin: "0 0 16px 0", lineHeight: 1.15 }}>
          {data.tagline}
        </h2>
        <p style={{ fontSize: 15, color: "rgba(255,255,255,0.85)", marginBottom: 28, lineHeight: 1.5 }}>
          Inicia sesión para entrar a tu panel de gestión sectorial.
        </p>
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
          {data.bullets.map((b, i) => (
            <li key={i} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
              <span style={{ color: "#bbf7d0", fontWeight: 800 }}>✓</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .prontara-login-side { display: none !important; }
        }
      `}</style>
    </aside>
  );
}
