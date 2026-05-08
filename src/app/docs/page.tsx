import Link from "next/link";
import { DOC_ARTICLES } from "@/lib/docs/articles";

/**
 * Página índice de documentación pública (H4-DOCS).
 *
 * Lista los artículos por vertical con un breve resumen. Es estática
 * (Server Component) y se cachea por defecto.
 */
export const metadata = {
  title: "Documentación",
  description: "Documentación pública de Prontara — guías por vertical y conceptos clave del ERP.",
};

export default function DocsIndexPage() {
  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: "48px 24px", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div style={{ marginBottom: 36 }}>
        <h1 style={{ fontSize: 36, fontWeight: 800, color: "#0f172a", margin: "0 0 12px 0" }}>
          Documentación
        </h1>
        <p style={{ color: "#475569", fontSize: 16, lineHeight: 1.6, margin: 0 }}>
          Guías por sector y conceptos clave para sacar el máximo partido a Prontara desde el primer día.
        </p>
      </div>

      <h2 style={{ fontSize: 13, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 12px 0" }}>
        Por vertical
      </h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14 }}>
        {DOC_ARTICLES.map((art) => (
          <Link
            key={art.slug}
            href={"/docs/" + art.slug}
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              padding: 20,
              background: "#ffffff",
              textDecoration: "none",
              color: "inherit",
              display: "block",
              transition: "border-color 0.15s, transform 0.15s",
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: "#1d4ed8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
              {art.vertical}
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: "#0f172a", margin: "0 0 8px 0" }}>{art.title}</h3>
            <p style={{ fontSize: 14, color: "#475569", margin: 0, lineHeight: 1.5 }}>{art.intro.slice(0, 180)}…</p>
          </Link>
        ))}
      </div>

      <p style={{ marginTop: 40, color: "#94a3b8", fontSize: 13, textAlign: "center" }}>
        ¿Falta documentación de algo concreto? <a href="mailto:hola@prontara.com" style={{ color: "#1d4ed8" }}>Cuéntanoslo</a>.
      </p>
    </main>
  );
}
