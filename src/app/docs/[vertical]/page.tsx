import Link from "next/link";
import { notFound } from "next/navigation";
import { getDocBySlug, DOC_ARTICLES } from "@/lib/docs/articles";

/**
 * Página de un artículo de docs por vertical (H4-DOCS).
 */
export async function generateStaticParams() {
  return DOC_ARTICLES.map((d) => ({ vertical: d.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ vertical: string }> }) {
  const { vertical } = await params;
  const article = getDocBySlug(vertical);
  if (!article) return { title: "Documentación" };
  return {
    title: article.title,
    description: article.intro.slice(0, 200),
  };
}

export default async function DocsArticlePage({ params }: { params: Promise<{ vertical: string }> }) {
  const { vertical } = await params;
  const article = getDocBySlug(vertical);
  if (!article) notFound();

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "48px 24px", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div style={{ marginBottom: 24, fontSize: 13 }}>
        <Link href="/docs" style={{ color: "#1d4ed8", textDecoration: "none" }}>← Documentación</Link>
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, color: "#1d4ed8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
        {article.vertical}
      </div>
      <h1 style={{ fontSize: 32, fontWeight: 800, color: "#0f172a", margin: "0 0 16px 0", lineHeight: 1.2 }}>
        {article.title}
      </h1>
      <p style={{ fontSize: 17, color: "#475569", lineHeight: 1.6, marginBottom: 36 }}>
        {article.intro}
      </p>

      {article.sections.map((s, i) => (
        <section key={i} style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#0f172a", margin: "0 0 12px 0" }}>{s.heading}</h2>
          {s.paragraphs.map((p, j) => (
            <p key={j} style={{ fontSize: 16, color: "#334155", lineHeight: 1.7, margin: "0 0 12px 0" }}>{p}</p>
          ))}
          {s.bullets ? (
            <ul style={{ paddingLeft: 20, margin: 0 }}>
              {s.bullets.map((b, j) => (
                <li key={j} style={{ fontSize: 16, color: "#334155", lineHeight: 1.7, marginBottom: 4 }}>{b}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}

      <hr style={{ border: 0, borderTop: "1px solid #e5e7eb", marginTop: 40, marginBottom: 24 }} />
      <p style={{ fontSize: 14, color: "#94a3b8", textAlign: "center" }}>
        ¿Te quedó alguna duda? <a href="mailto:hola@prontara.com" style={{ color: "#1d4ed8" }}>Escríbenos</a>.
      </p>
    </main>
  );
}
