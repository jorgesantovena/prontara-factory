import Link from "next/link";
import { listSectorPacks } from "@/lib/factory/sector-pack-registry";

export const dynamic = "force-dynamic";

export default function PacksSectorialesPage() {
  const packs = listSectorPacks();

  return (
    <main
      style={{
        padding: 24,
        display: "grid",
        gap: 24,
        fontFamily: "Arial, sans-serif",
        background: "#f8fafc",
      }}
    >
      <section
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 16,
          background: "#ffffff",
          padding: 20,
        }}
      >
        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>
          Fase 10.2
        </div>
        <h1 style={{ marginTop: 0, marginBottom: 10, fontSize: 30 }}>
          Primeros packs sectoriales
        </h1>
        <p style={{ margin: 0, color: "#4b5563", maxWidth: 920 }}>
          Ya están definidos los seis primeros verticales base: clínica dental,
          software factory, gimnasio, peluquería, taller y colegio. Cada pack
          incluye módulos, labels, renameMap, entidades propias, formularios,
          tablas, dashboard, demo data, landing, branding y copy del asistente.
        </p>
      </section>

      <section
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 16,
          background: "#ffffff",
          padding: 20,
          display: "grid",
          gap: 10,
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 20 }}>
          Resumen general
        </div>
        <div style={{ color: "#374151" }}>
          Packs disponibles: <strong>{packs.length}</strong>
        </div>
        <div style={{ color: "#4b5563" }}>
          El objetivo es poder sacar verticales con rapidez sin rehacer la base técnica.
        </div>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 18,
        }}
      >
        {packs.map((pack) => (
          <article
            key={pack.key}
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 16,
              background: "#ffffff",
              padding: 18,
              display: "grid",
              gap: 14,
            }}
          >
            <div>
              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>
                {pack.key}
              </div>
              <h2 style={{ marginTop: 0, marginBottom: 8, fontSize: 22 }}>
                {pack.label}
              </h2>
              <p style={{ margin: 0, color: "#4b5563" }}>{pack.description}</p>
            </div>

            <div>
              <strong>Módulos</strong>
              <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                {pack.modules.map((item) => (
                  <span
                    key={item.moduleKey}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 999,
                      background: "#eef2ff",
                      color: "#3730a3",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    {item.label}
                  </span>
                ))}
              </div>
            </div>

            <div style={{ display: "grid", gap: 6, color: "#374151", fontSize: 14 }}>
              <div><strong>Labels:</strong> {Object.keys(pack.labels).length}</div>
              <div><strong>RenameMap:</strong> {Object.keys(pack.renameMap).length}</div>
              <div><strong>Entidades propias:</strong> {pack.entities.length}</div>
              <div><strong>Campos:</strong> {pack.fields.length}</div>
              <div><strong>Columnas de tabla:</strong> {pack.tableColumns.length}</div>
              <div><strong>Dashboard:</strong> {pack.dashboardPriorities.length}</div>
              <div><strong>Demo data:</strong> {pack.demoData.length} módulos</div>
            </div>

            <div
              style={{
                border: "1px solid #eef2f7",
                borderRadius: 12,
                background: "#fafafa",
                padding: 12,
                display: "grid",
                gap: 6,
              }}
            >
              <div><strong>Landing:</strong> {pack.landing.headline}</div>
              <div><strong>Branding:</strong> {pack.branding.displayName}</div>
              <div><strong>Asistente:</strong> {pack.assistantCopy.suggestion}</div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link
                href={"/api/factory/sector-pack-preview?pack=" + encodeURIComponent(pack.key)}
                style={{
                  border: "1px solid #d1d5db",
                  borderRadius: 10,
                  padding: "10px 14px",
                  textDecoration: "none",
                  color: "#111827",
                  background: "#ffffff",
                  fontWeight: 700,
                }}
              >
                Ver preview API
              </Link>

              <Link
                href="/api/factory/sector-packs"
                style={{
                  border: "1px solid #111827",
                  borderRadius: 10,
                  padding: "10px 14px",
                  textDecoration: "none",
                  color: "#ffffff",
                  background: "#111827",
                  fontWeight: 700,
                }}
              >
                Ver catálogo
              </Link>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}