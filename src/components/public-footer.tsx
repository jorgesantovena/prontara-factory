import Link from "next/link";

/**
 * Footer público minimalista con enlaces legales, contacto y disclaimer.
 * Se monta al final de las páginas públicas (verticales, precios, etc.).
 */
export default function PublicFooter() {
  const year = new Date().getFullYear();
  return (
    <footer
      style={{
        borderTop: "1px solid #e5e7eb",
        background: "#f8fafc",
        padding: "32px 24px",
        marginTop: 40,
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 24,
          flexWrap: "wrap",
        }}
      >
        <div style={{ minWidth: 200 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#1d4ed8", marginBottom: 4 }}>
            Prontara
          </div>
          <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
            ERP online por sector,
            <br />
            con precios claros y sin sorpresas.
          </div>
        </div>

        <div>
          <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 8 }}>
            Producto
          </div>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 6 }}>
            <FooterLink href="/verticales" label="Verticales" />
            <FooterLink href="/precios" label="Precios" />
            <FooterLink href="/como-funciona" label="Cómo funciona" />
            <FooterLink href="/faq" label="FAQ" />
          </ul>
        </div>

        <div>
          <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 8 }}>
            Empresa
          </div>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 6 }}>
            <FooterLink href="/contacto" label="Contacto" />
            <FooterLink href="/alta" label="Empezar prueba" />
            <FooterLink href="/acceso" label="Iniciar sesión" />
          </ul>
        </div>

        <div>
          <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 8 }}>
            Legal
          </div>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 6 }}>
            <FooterLink href="/legal/terminos" label="Términos de servicio" />
            <FooterLink href="/contrato" label="Contrato de servicio" />
            <FooterLink href="/legal/privacidad" label="Privacidad" />
            <FooterLink href="/legal/cookies" label="Cookies" />
          </ul>
        </div>
      </div>

      <div
        style={{
          maxWidth: 1200,
          margin: "24px auto 0",
          paddingTop: 16,
          borderTop: "1px solid #e5e7eb",
          fontSize: 11,
          color: "#9ca3af",
          textAlign: "center",
        }}
      >
        © {year} Prontara. Todos los derechos reservados.
      </div>
    </footer>
  );
}

function FooterLink({ href, label }: { href: string; label: string }) {
  return (
    <li>
      <Link
        href={href}
        style={{
          fontSize: 13,
          color: "#374151",
          textDecoration: "none",
        }}
      >
        {label}
      </Link>
    </li>
  );
}
