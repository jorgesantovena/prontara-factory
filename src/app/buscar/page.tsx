"use client";

import { useEffect, useState } from "react";

/**
 * Buscador global — búsqueda cross-módulos del ERP (CORE-04).
 *
 * Llama a /api/erp/global-search?q=X y muestra los hits agrupados por
 * módulo, con link al registro (que en el modelo actual abre el módulo
 * con filtro por id no implementado aún — link al módulo entero).
 */
type ModuleResults = Record<string, Array<Record<string, string>>>;

const MODULE_LABELS: Record<string, string> = {
  clientes: "Clientes",
  crm: "Oportunidades / CRM",
  proyectos: "Proyectos",
  presupuestos: "Presupuestos",
  facturacion: "Facturación",
  documentos: "Documentos",
  tareas: "Tareas",
  tickets: "Tickets",
  productos: "Productos",
};

export default function BuscarPage() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ModuleResults>({});
  const [totalHits, setTotalHits] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (!q || q.trim().length < 2) {
      setResults({});
      setTotalHits(0);
      setSearched(false);
      return;
    }
    let cancelled = false;
    const handler = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(
          "/api/erp/global-search?q=" + encodeURIComponent(q),
          { cache: "no-store" },
        );
        const data = await response.json();
        if (cancelled) return;
        setResults(data?.results || {});
        setTotalHits(Number(data?.totalHits || 0));
        setSearched(true);
      } catch {
        if (!cancelled) {
          setResults({});
          setTotalHits(0);
          setSearched(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300); // debounce
    return () => {
      cancelled = true;
      clearTimeout(handler);
    };
  }, [q]);

  return (
    <main
      style={{
        maxWidth: 1100,
        margin: "0 auto",
        padding: 24,
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <h1 style={{ fontSize: 28, fontWeight: 800, color: "#0f172a", margin: "0 0 16px 0" }}>
        Buscador global
      </h1>
      <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 16 }}>
        Busca cualquier término en clientes, proyectos, facturas, documentos, tareas y más.
      </p>

      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Escribe al menos 2 caracteres..."
        autoFocus
        style={{
          width: "100%",
          padding: "14px 18px",
          fontSize: 16,
          border: "2px solid #d1d5db",
          borderRadius: 12,
          outline: "none",
          boxSizing: "border-box",
          marginBottom: 24,
        }}
      />

      {loading ? <p style={{ color: "#6b7280" }}>Buscando...</p> : null}

      {!loading && searched && totalHits === 0 ? (
        <p style={{ color: "#6b7280", padding: 16, background: "#f9fafb", borderRadius: 8 }}>
          Sin resultados para "{q}".
        </p>
      ) : null}

      {!loading && totalHits > 0 ? (
        <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 12 }}>
          {totalHits} resultado{totalHits === 1 ? "" : "s"} encontrado{totalHits === 1 ? "" : "s"}.
        </p>
      ) : null}

      {Object.entries(results).map(([modulo, hits]) => (
        <section key={modulo} style={{ marginBottom: 28 }}>
          <h2
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: "#0f172a",
              margin: "0 0 8px 0",
              borderBottom: "2px solid #e5e7eb",
              paddingBottom: 6,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>
              {MODULE_LABELS[modulo] || modulo}{" "}
              <span style={{ fontWeight: 400, color: "#6b7280", fontSize: 13 }}>
                ({hits.length})
              </span>
            </span>
            <a
              href={"/" + modulo}
              style={{ fontSize: 13, color: "#1d4ed8", textDecoration: "none", fontWeight: 600 }}
            >
              Ver módulo →
            </a>
          </h2>
          <div style={{ display: "grid", gap: 6 }}>
            {hits.map((h) => (
              <a
                key={String(h.id)}
                href={"/" + modulo}
                style={{
                  display: "block",
                  padding: "10px 14px",
                  background: "#ffffff",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  textDecoration: "none",
                  color: "#0f172a",
                  fontSize: 14,
                }}
              >
                <strong style={{ color: "#0f172a" }}>
                  {firstValue(h, ["nombre", "titulo", "asunto", "numero", "destino", "ruta", "empresa", "alumno", "recurso"]) || "(sin título)"}
                </strong>
                <span style={{ color: "#6b7280", marginLeft: 8 }}>
                  {firstValue(h, ["cliente", "estado", "tipo", "categoria", "concepto", "responsable"]) || ""}
                </span>
              </a>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}

function firstValue(obj: Record<string, string>, keys: string[]): string {
  for (const k of keys) {
    const v = String(obj[k] || "").trim();
    if (v) return v;
  }
  return "";
}
