import Link from "next/link";

/**
 * Nav pública compartida por /verticales, /precios, /como-funciona, /faq,
 * /contacto y /legal/*. Server Component — no state, solo links. El CTA
 * primary va a /alta para reforzar el proceso 100% online.
 *
 * Para los links legales del footer, usar `<PublicFooter />` aparte.
 */
export default function PublicNav({ current }: { current?: string }) {
  const links: Array<{ href: string; label: string; key: string }> = [
    { href: "/verticales", label: "Verticales", key: "verticales" },
    { href: "/precios", label: "Precios", key: "precios" },
    { href: "/como-funciona", label: "Cómo funciona", key: "como-funciona" },
    { href: "/faq", label: "FAQ", key: "faq" },
    { href: "/contacto", label: "Contacto", key: "contacto" },
  ];

  return (
    <header
      style={{
        background: "rgba(255,255,255,0.85)",
        backdropFilter: "blur(6px)",
        borderBottom: "1px solid #e5e7eb",
        padding: "14px 24px",
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}
    >
      <nav
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          gap: 20,
          flexWrap: "wrap",
        }}
      >
        <Link
          href="/verticales"
          style={{
            textDecoration: "none",
            color: "#1d4ed8",
            fontSize: 20,
            fontWeight: 800,
            letterSpacing: -0.5,
          }}
        >
          Prontara
        </Link>
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", flex: 1 }}>
          {links.map((l) => (
            <Link
              key={l.key}
              href={l.href}
              style={{
                textDecoration: "none",
                fontSize: 14,
                fontWeight: current === l.key ? 700 : 500,
                color: current === l.key ? "#1d4ed8" : "#374151",
                borderBottom: current === l.key ? "2px solid #1d4ed8" : "2px solid transparent",
                paddingBottom: 2,
              }}
            >
              {l.label}
            </Link>
          ))}
        </div>
        <Link
          href="/alta"
          style={{
            textDecoration: "none",
            background: "#1d4ed8",
            color: "#fff",
            padding: "8px 16px",
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          Empezar gratis
        </Link>
      </nav>
    </header>
  );
}
