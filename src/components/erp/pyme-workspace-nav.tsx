import Link from "next/link";

type NavItem = {
  href: string;
  label: string;
  helper: string;
};

const items: NavItem[] = [
  {
    href: "/",
    label: "Inicio",
    helper: "Lo importante para hoy.",
  },
  {
    href: "/clientes",
    label: "Clientes",
    helper: "Empresas y personas con las que trabajas.",
  },
  {
    href: "/presupuestos",
    label: "Propuestas",
    helper: "Presupuestos y ofertas pendientes.",
  },
  {
    href: "/facturacion",
    label: "Facturas",
    helper: "Facturas y cobros a revisar.",
  },
  {
    href: "/proyectos",
    label: "Trabajos",
    helper: "Proyectos o trabajos en marcha.",
  },
  {
    href: "/documentos",
    label: "Documentos",
    helper: "Archivos importantes guardados.",
  },
  {
    href: "/equipo",
    label: "Equipo",
    helper: "Usuarios y permisos del negocio.",
  },
  {
    href: "/ajustes",
    label: "Ajustes",
    helper: "Datos básicos de empresa.",
  },
];

export default function PymeWorkspaceNav() {
  return (
    <section
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 16,
        background: "#ffffff",
        padding: 20,
        display: "grid",
        gap: 16,
      }}
    >
      <div>
        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>
          Menú principal
        </div>
        <h2 style={{ marginTop: 0, marginBottom: 8, fontSize: 24 }}>
          Lo esencial, sin complicarte
        </h2>
        <p style={{ margin: 0, color: "#4b5563" }}>
          Hemos dejado solo los accesos importantes para que cualquier pyme pequeña
          se ubique enseguida.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
        }}
      >
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            style={{
              border: "1px solid #eef2f7",
              borderRadius: 12,
              background: "#fafafa",
              padding: 14,
              textDecoration: "none",
              color: "inherit",
              display: "grid",
              gap: 6,
            }}
          >
            <strong>{item.label}</strong>
            <span style={{ fontSize: 13, color: "#4b5563" }}>{item.helper}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}