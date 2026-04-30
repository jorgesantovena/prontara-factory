import Link from "next/link";
import { prontaraConfig } from "@/lib/prontara.generated";

const moduleData = prontaraConfig.modules.find((m) => m.key === "timesheets");

export default function ModulePage() {
  const moduleActions = [
    "Crear registro",
    "Editar registro",
    "Eliminar registro",
  ];

  return (
    <main style={{ padding: 24, fontFamily: "Arial, sans-serif", maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ marginBottom: 16 }}>
        <Link href="/" style={{ textDecoration: "none" }}>&lt;- Volver al dashboard</Link>
      </div>

      <h1 style={{ fontSize: 32, marginBottom: 8 }}>{moduleData?.label}</h1>
      <p style={{ marginBottom: 24 }}>{moduleData?.description}</p>

      <div style={{ display: "grid", gridTemplateColumns: "1.8fr 1fr", gap: 16 }}>
        <div style={{ border: "1px solid #ddd", borderRadius: 12, overflow: "hidden", background: "#fff" }}>
          <div style={{ padding: 16, borderBottom: "1px solid #ddd" }}>
            <strong>Registros del modulo</strong>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #ddd", background: "#fafafa" }}>{"Persona"}</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #ddd", background: "#fafafa" }}>{"Proyecto"}</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #ddd", background: "#fafafa" }}>{"Horas"}</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #ddd", background: "#fafafa" }}>{"Tipo"}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #eee" }}>{"Claudia"}</td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #eee" }}>{"Portal clientes"}</td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #eee" }}>{"6.5"}</td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #eee" }}>{"Facturable"}</td>
                </tr>
                <tr>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #eee" }}>{"Diego"}</td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #eee" }}>{"Backoffice clinico"}</td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #eee" }}>{"7.0"}</td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #eee" }}>{"Facturable"}</td>
                </tr>
                <tr>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #eee" }}>{"Marta"}</td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #eee" }}>{"Portal clientes"}</td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #eee" }}>{"2.0"}</td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #eee" }}>{"Interno"}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ display: "grid", gap: 16 }}>
          <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16, background: "#fff" }}>
            <h3 style={{ marginTop: 0 }}>Contexto del ERP</h3>
            <p><strong>Cliente:</strong> {prontaraConfig.displayName}</p>
            <p><strong>Area:</strong> {moduleData?.area}</p>
            <p><strong>Sector:</strong> {prontaraConfig.sector}</p>
            <p><strong>Tamano:</strong> {prontaraConfig.blueprintMeta.companySize || "No definido"}</p>
            <p><strong>Flujo principal:</strong> {prontaraConfig.blueprintMeta.coreFlow.join(" > ") || "No definido"}</p>
          </div>

          <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16, background: "#fff" }}>
            <h3 style={{ marginTop: 0 }}>Acciones simuladas</h3>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {moduleActions.map((actionLabel) => (
                <li key={actionLabel}>{actionLabel}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </main>
  );
}