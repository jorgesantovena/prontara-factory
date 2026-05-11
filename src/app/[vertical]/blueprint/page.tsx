import Link from "next/link";
import { listBlueprints } from "@/lib/factory/blueprint-registry";
import { assembleGenerationFromBlueprint } from "@/lib/factory/generation-assembler";

export const dynamic = "force-dynamic";

export default function BlueprintPage() {
  const blueprints = listBlueprints();

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
          Fase 5
        </div>
        <h1 style={{ marginTop: 0, marginBottom: 10, fontSize: 30 }}>
          Blueprint y configuración real
        </h1>
        <p style={{ margin: 0, color: "#4b5563", maxWidth: 940 }}>
          Aquí puedes revisar la nueva base estructural: company size, entidades, flujos,
          prioridades de dashboard, reglas de landing, branding, textos, campos, labels,
          módulos y demo data. La idea es que la factory empiece a ensamblar soluciones
          en vez de programarlas a mano.
        </p>
      </section>

      <section
        style={{
          display: "grid",
          gap: 18,
        }}
      >
        {blueprints.map((blueprint) => {
          const assembly = assembleGenerationFromBlueprint(blueprint);

          return (
            <article
              key={blueprint.businessType}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 16,
                background: "#ffffff",
                padding: 18,
                display: "grid",
                gap: 16,
              }}
            >
              <div>
                <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>
                  {blueprint.businessType}
                </div>
                <h2 style={{ marginTop: 0, marginBottom: 8, fontSize: 24 }}>
                  {blueprint.branding.displayName}
                </h2>
                <p style={{ margin: 0, color: "#4b5563" }}>
                  Sector: {blueprint.sectorLabel} · Business type: {blueprint.businessTypeLabel} ·
                  Company size: {blueprint.companySize}
                </p>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: 12,
                }}
              >
                <div style={{ border: "1px solid #eef2f7", borderRadius: 12, padding: 12, background: "#fafafa" }}>
                  <strong>Módulos</strong>
                  <div>{assembly.summary.enabledModuleCount} activos / {assembly.summary.moduleCount}</div>
                </div>
                <div style={{ border: "1px solid #eef2f7", borderRadius: 12, padding: 12, background: "#fafafa" }}>
                  <strong>Entidades</strong>
                  <div>{assembly.summary.entityCount}</div>
                </div>
                <div style={{ border: "1px solid #eef2f7", borderRadius: 12, padding: 12, background: "#fafafa" }}>
                  <strong>Flujos</strong>
                  <div>{assembly.summary.flowCount}</div>
                </div>
                <div style={{ border: "1px solid #eef2f7", borderRadius: 12, padding: 12, background: "#fafafa" }}>
                  <strong>Dashboard</strong>
                  <div>{assembly.summary.dashboardPriorityCount} prioridades</div>
                </div>
                <div style={{ border: "1px solid #eef2f7", borderRadius: 12, padding: 12, background: "#fafafa" }}>
                  <strong>Landing</strong>
                  <div>{assembly.summary.landingRuleCount} reglas</div>
                </div>
                <div style={{ border: "1px solid #eef2f7", borderRadius: 12, padding: 12, background: "#fafafa" }}>
                  <strong>Demo data</strong>
                  <div>{assembly.summary.demoDataModuleCount} módulos</div>
                </div>
              </div>

              <div
                style={{
                  border: "1px solid #eef2f7",
                  borderRadius: 12,
                  background: "#fafafa",
                  padding: 14,
                  display: "grid",
                  gap: 8,
                }}
              >
                <div><strong>Welcome:</strong> {blueprint.texts.welcomeHeadline}</div>
                <div><strong>Asistente:</strong> {blueprint.texts.assistantSuggestion}</div>
                <div><strong>Color:</strong> {blueprint.branding.accentColor}</div>
                <div><strong>Logo hint:</strong> {blueprint.branding.logoHint}</div>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Link
                  href={"/api/factory/blueprint?businessType=" + encodeURIComponent(blueprint.businessType)}
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
                  Ver blueprint API
                </Link>

                <Link
                  href={"/api/factory/assemble?businessType=" + encodeURIComponent(blueprint.businessType)}
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
                  Ver assembly API
                </Link>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}