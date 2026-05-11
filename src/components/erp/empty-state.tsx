"use client";

import Link from "next/link";

/**
 * Estado vacío reutilizable (H10-H).
 *
 * Cuando un listado/módulo está vacío, en vez de "no hay datos" se
 * muestra un mensaje contextual con un CTA primario y otro secundario
 * (típicamente "Crear" + "Importar").
 */
export type EmptyStateProps = {
  emoji?: string;
  title: string;
  description?: string;
  primary?: { label: string; href: string };
  secondary?: { label: string; href: string };
};

export default function EmptyState({
  emoji = "📭",
  title,
  description,
  primary,
  secondary,
}: EmptyStateProps) {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "60px 24px",
      background: "var(--bg-card, #ffffff)",
      border: "1px dashed var(--border, #cbd5e1)",
      borderRadius: 12,
      textAlign: "center",
      minHeight: 280,
      fontFamily: "system-ui, -apple-system, sans-serif",
    }}>
      <div style={{ fontSize: 56, marginBottom: 16, opacity: 0.7 }}>{emoji}</div>
      <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--fg, #0f172a)", margin: "0 0 8px 0" }}>{title}</h3>
      {description ? (
        <p style={{ fontSize: 14, color: "var(--fg-muted, #475569)", maxWidth: 480, margin: "0 0 20px 0", lineHeight: 1.5 }}>{description}</p>
      ) : null}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
        {primary ? (
          <Link href={primary.href} style={{ background: "#1d4ed8", color: "#ffffff", padding: "10px 20px", borderRadius: 8, textDecoration: "none", fontWeight: 700, fontSize: 14 }}>
            {primary.label}
          </Link>
        ) : null}
        {secondary ? (
          <Link href={secondary.href} style={{ background: "transparent", color: "var(--fg, #0f172a)", padding: "10px 20px", borderRadius: 8, textDecoration: "none", fontWeight: 600, fontSize: 14, border: "1px solid var(--border, #d1d5db)" }}>
            {secondary.label}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Catálogo de empty states por módulo. Usar:
 *   <EmptyState {...emptyStateFor("clientes")} />
 */
export function emptyStateFor(moduleKey: string): EmptyStateProps {
  const map: Record<string, EmptyStateProps> = {
    clientes: { emoji: "👥", title: "Aún no tienes clientes", description: "Crea tu primer cliente o importa una lista desde Excel.", primary: { label: "Crear cliente", href: "/clientes?action=new" }, secondary: { label: "Importar Excel", href: "/importar" } },
    facturacion: { emoji: "💶", title: "Aún no has emitido facturas", description: "Crea tu primera factura o emítela desde un proyecto.", primary: { label: "Crear factura", href: "/facturacion?action=new" } },
    presupuestos: { emoji: "📄", title: "Aún no tienes presupuestos", description: "Crea tu primera propuesta para enviársela al cliente.", primary: { label: "Crear presupuesto", href: "/presupuestos?action=new" } },
    proyectos: { emoji: "🛠️", title: "Aún no tienes proyectos", description: "Da de alta el primero y empieza a imputar horas.", primary: { label: "Crear proyecto", href: "/proyectos?action=new" } },
    tareas: { emoji: "✔️", title: "Sin tareas pendientes", description: "Crea una tarea o asigna una al equipo.", primary: { label: "Crear tarea", href: "/tareas?action=new" } },
    actividades: { emoji: "⏱️", title: "Sin actividades imputadas", description: "Imputa tu primera actividad de hoy.", primary: { label: "Imputar horas", href: "/actividades?action=new" } },
    productos: { emoji: "🏷️", title: "Catálogo vacío", description: "Crea tu primer producto o servicio.", primary: { label: "Crear producto", href: "/productos?action=new" }, secondary: { label: "Importar catálogo", href: "/importar" } },
    crm: { emoji: "🎯", title: "Aún no tienes oportunidades", description: "Registra tu primer lead y empieza a hacer seguimiento.", primary: { label: "Nueva oportunidad", href: "/crm?action=new" } },
    documentos: { emoji: "📎", title: "Sin documentos", description: "Sube tu primer documento o asocialo a un cliente.", primary: { label: "Subir documento", href: "/documentos?action=new" } },
  };
  return map[moduleKey] || { title: "Aún no hay datos en este módulo", description: "Empieza creando el primer registro." };
}
