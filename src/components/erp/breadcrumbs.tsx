"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Breadcrumbs (H10-J).
 *
 * Auto-generados del pathname. Soporta nested routes y hace un mapeo
 * humano de los segmentos conocidos.
 */

const SEGMENT_LABELS: Record<string, string> = {
  "": "Inicio",
  clientes: "Clientes",
  proyectos: "Proyectos",
  presupuestos: "Presupuestos",
  facturacion: "Facturas",
  documentos: "Documentos",
  actividades: "Actividades",
  tareas: "Tareas",
  tickets: "Tickets",
  cau: "CAU",
  produccion: "Producción",
  "pre-facturacion": "Pre-facturación",
  agenda: "Agenda",
  "agenda-hoy": "Agenda hoy",
  "caja-rapida": "Caja",
  calendario: "Calendario",
  "vista-kanban": "Kanban",
  "vista-gantt": "Gantt",
  importar: "Importar",
  buscar: "Buscador",
  reportes: "Reportes",
  workflows: "Workflows",
  ajustes: "Ajustes",
  "ajustes-cuenta": "Mi cuenta",
  "ajustes-campos": "Campos personalizados",
  integraciones: "Integraciones",
  mensajes: "Mensajes",
  onboarding: "Onboarding",
  empleados: "Empleados",
  equipo: "Equipo",
  crm: "Oportunidades",
  productos: "Productos",
  bodegas: "Bodegas",
  kardex: "Kardex",
  caja: "Caja",
  reservas: "Reservas",
  encuestas: "Encuestas",
  etiquetas: "Etiquetas",
  plantillas: "Plantillas",
  compras: "Compras",
  gastos: "Gastos",
  desplazamientos: "Desplazamientos",
  albaranes: "Albaranes",
  "vencimientos-factura": "Vencimientos",
  "tarifas-generales": "Tarifas",
  "tarifas-especiales": "Tarifas especiales",
  "clases-condicion": "Clases condición",
  "formas-pago": "Formas de pago",
  "cuentas-bancarias": "Cuentas bancarias",
  "puntos-venta": "Puntos de venta",
  "tipos-cliente": "Tipos cliente",
  "tipos-servicio": "Tipos servicio",
  "tipos-urgencia": "Urgencias",
  "actividades-catalogo": "Catálogo actividades",
  "zonas-comerciales": "Zonas",
  "grupos-empresa": "Grupos",
  "avisos-programados": "Avisos",
  "plantilla-pdf": "Plantilla PDF",
  aprobaciones: "Aprobaciones",
};

function humanLabel(segment: string): string {
  if (SEGMENT_LABELS[segment]) return SEGMENT_LABELS[segment];
  // Capitalize y reemplazar guiones
  return segment
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function Breadcrumbs() {
  const pathname = usePathname() || "/";
  if (pathname === "/" || pathname === "") return null;

  const segments = pathname.split("/").filter(Boolean);
  const items: Array<{ href: string; label: string }> = [{ href: "/", label: "Inicio" }];
  let acc = "";
  for (const s of segments) {
    acc += "/" + s;
    items.push({ href: acc, label: humanLabel(s) });
  }
  // No mostrar si solo hay 1 nivel (ya está claro por la página)
  if (items.length <= 1) return null;

  return (
    <nav aria-label="Breadcrumb" style={{ padding: "8px 24px", borderBottom: "1px solid var(--border, #f1f5f9)", background: "var(--bg, #ffffff)", fontSize: 12 }}>
      <ol style={{ display: "flex", flexWrap: "wrap", gap: 6, listStyle: "none", margin: 0, padding: 0 }}>
        {items.map((it, i) => {
          const isLast = i === items.length - 1;
          return (
            <li key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {i > 0 ? <span style={{ color: "var(--fg-muted, #94a3b8)" }}>/</span> : null}
              {isLast ? (
                <span style={{ color: "var(--fg, #0f172a)", fontWeight: 600 }}>{it.label}</span>
              ) : (
                <Link href={it.href} style={{ color: "var(--fg-muted, #475569)", textDecoration: "none" }}>{it.label}</Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
