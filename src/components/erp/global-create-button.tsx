"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * Botón "+ Crear" global en topbar (H10-E).
 *
 * Lista contextual de creaciones rápidas según el vertical del tenant.
 * Lo usa DashboardTopBar.
 */
const VERTICAL_CREATE_OPTIONS: Record<string, Array<{ href: string; label: string; icon: string }>> = {
  "software-factory": [
    { href: "/clientes", label: "Cliente", icon: "👥" },
    { href: "/proyectos", label: "Proyecto", icon: "🛠️" },
    { href: "/actividades", label: "Imputar horas", icon: "⏱️" },
    { href: "/facturacion", label: "Factura", icon: "💶" },
    { href: "/presupuestos", label: "Propuesta", icon: "📄" },
    { href: "/cau", label: "Ticket CAU", icon: "🎫" },
  ],
  "clinica-dental": [
    { href: "/clientes", label: "Paciente", icon: "👤" },
    { href: "/proyectos", label: "Cita / tratamiento", icon: "📅" },
    { href: "/presupuestos", label: "Presupuesto", icon: "📄" },
    { href: "/facturacion", label: "Factura", icon: "💶" },
    { href: "/documentos", label: "Documento clínico", icon: "📎" },
  ],
  "clinica-veterinaria": [
    { href: "/clientes", label: "Mascota", icon: "🐾" },
    { href: "/proyectos", label: "Cita / cirugía", icon: "📅" },
    { href: "/documentos", label: "Vacuna / informe", icon: "💉" },
    { href: "/facturacion", label: "Factura", icon: "💶" },
  ],
  "colegio": [
    { href: "/clientes", label: "Alumno", icon: "🎓" },
    { href: "/calificaciones", label: "Calificación", icon: "📊" },
    { href: "/asistencia", label: "Pasar lista", icon: "✅" },
    { href: "/comunicaciones", label: "Comunicado", icon: "📢" },
    { href: "/facturacion", label: "Cuota", icon: "💶" },
  ],
  "peluqueria": [
    { href: "/proyectos", label: "Cita", icon: "✂️" },
    { href: "/clientes", label: "Cliente", icon: "👤" },
    { href: "/caja-rapida", label: "Cobro", icon: "💳" },
    { href: "/productos", label: "Producto", icon: "🏷️" },
  ],
  "taller": [
    { href: "/proyectos", label: "Orden de trabajo", icon: "🔧" },
    { href: "/clientes", label: "Vehículo / cliente", icon: "🚗" },
    { href: "/presupuestos", label: "Presupuesto", icon: "📄" },
    { href: "/facturacion", label: "Factura", icon: "💶" },
  ],
  "hosteleria": [
    { href: "/proyectos", label: "Evento", icon: "🎉" },
    { href: "/clientes", label: "Cliente", icon: "👤" },
    { href: "/presupuestos", label: "Presupuesto evento", icon: "📄" },
    { href: "/caja-rapida", label: "Cobro", icon: "💳" },
  ],
  "inmobiliaria": [
    { href: "/proyectos", label: "Inmueble", icon: "🏠" },
    { href: "/clientes", label: "Interesado", icon: "👤" },
    { href: "/presupuestos", label: "Oferta", icon: "💼" },
    { href: "/facturacion", label: "Factura comisión", icon: "💶" },
  ],
  "asesoria": [
    { href: "/proyectos", label: "Encargo", icon: "📋" },
    { href: "/clientes", label: "Cliente", icon: "👤" },
    { href: "/facturacion", label: "Cuota / factura", icon: "💶" },
  ],
  "despacho-abogados": [
    { href: "/proyectos", label: "Caso", icon: "⚖️" },
    { href: "/clientes", label: "Cliente", icon: "👤" },
    { href: "/presupuestos", label: "Honorarios", icon: "📄" },
    { href: "/documentos", label: "Expediente", icon: "📎" },
  ],
};

const FALLBACK_OPTIONS = [
  { href: "/clientes", label: "Cliente", icon: "👤" },
  { href: "/presupuestos", label: "Presupuesto", icon: "📄" },
  { href: "/facturacion", label: "Factura", icon: "💶" },
  { href: "/tareas", label: "Tarea", icon: "✔️" },
  { href: "/tickets", label: "Ticket", icon: "🎫" },
];

export default function GlobalCreateButton({ accent = "#1d4ed8" }: { accent?: string }) {
  const [open, setOpen] = useState(false);
  const [vertical, setVertical] = useState("");

  useEffect(() => {
    fetch("/api/runtime/tenant-config", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d?.config?.businessType) setVertical(String(d.config.businessType));
      })
      .catch(() => undefined);
  }, []);

  const options = VERTICAL_CREATE_OPTIONS[vertical] || FALLBACK_OPTIONS;

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          background: accent,
          color: "#ffffff",
          border: "none",
          borderRadius: 6,
          padding: "6px 12px",
          fontSize: 13,
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        + Crear
      </button>
      {open ? (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
          <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, width: 240, background: "var(--bg-card, #ffffff)", border: "1px solid var(--border, #e5e7eb)", borderRadius: 8, boxShadow: "0 10px 30px rgba(0,0,0,0.1)", zIndex: 50, padding: 4 }}>
            {options.map((o, i) => (
              <Link
                key={i}
                href={o.href + "?action=new"}
                onClick={() => setOpen(false)}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", fontSize: 13, color: "var(--fg, #0f172a)", textDecoration: "none", borderRadius: 4 }}
              >
                <span style={{ fontSize: 16 }}>{o.icon}</span>
                <span style={{ fontWeight: 600 }}>{o.label}</span>
              </Link>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
