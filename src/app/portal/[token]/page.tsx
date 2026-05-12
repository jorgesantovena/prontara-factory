import { notFound } from "next/navigation";
import { withPrisma } from "@/lib/persistence/db";
import { listModuleRecordsAsync } from "@/lib/persistence/active-client-data-store-async";

/**
 * Portal cliente público (H15-C #5).
 *
 * URL: /portal/<magic-token> — sin login. El cliente final ve sus
 * tickets CAU + facturas + proyectos. No requiere cuenta interna ni
 * gestión de password.
 *
 * Si el token es inválido / caducado / revocado → 404.
 */
export const dynamic = "force-dynamic";

type Access = {
  id: string;
  tenantId: string;
  clientId: string;
  clienteRefId: string;
  contactEmail: string;
  contactName: string;
  expiresAt: Date;
  active: boolean;
};

async function resolveAccess(token: string): Promise<Access | null> {
  try {
    return await withPrisma(async (prisma) => {
      const c = prisma as unknown as { clientPortalAccess: { findUnique: (a: { where: { magicToken: string } }) => Promise<Access | null> } };
      return await c.clientPortalAccess.findUnique({ where: { magicToken: token } });
    });
  } catch { return null; }
}

export default async function PortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const access = await resolveAccess(token);
  if (!access || !access.active || access.expiresAt < new Date()) {
    notFound();
  }

  // Cargar datos del cliente (cliente record + tickets + facturas + proyectos)
  const [clientes, ticketsAll, facturasAll, proyectosAll] = await Promise.all([
    listModuleRecordsAsync("clientes", access.clientId).catch(() => []),
    listModuleRecordsAsync("cau", access.clientId).catch(() => []),
    listModuleRecordsAsync("facturacion", access.clientId).catch(() => []),
    listModuleRecordsAsync("proyectos", access.clientId).catch(() => []),
  ]);

  const cliente = (clientes as Array<Record<string, string>>).find((c) => c.id === access.clienteRefId);
  const clienteNombre = cliente?.nombre || cliente?.razonSocial || access.contactName;

  const tickets = (ticketsAll as Array<Record<string, string>>).filter((t) => String(t.cliente || "") === clienteNombre);
  const facturas = (facturasAll as Array<Record<string, string>>).filter((f) => String(f.cliente || "") === clienteNombre);
  const proyectos = (proyectosAll as Array<Record<string, string>>).filter((p) => String(p.cliente || "") === clienteNombre);

  // Mark visit
  withPrisma(async (prisma) => {
    const c = prisma as unknown as { clientPortalAccess: { update: (a: { where: { id: string }; data: { lastSeenAt: Date } }) => Promise<unknown> } };
    return await c.clientPortalAccess.update({ where: { id: access.id }, data: { lastSeenAt: new Date() } });
  }).catch(() => undefined);

  return (
    <main style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "system-ui, -apple-system, sans-serif", color: "#0f172a", padding: "32px 24px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <header style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Portal cliente</div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800 }}>Hola, {access.contactName.split(/\s+/)[0] || "Cliente"}</h1>
          <p style={{ color: "#64748b", marginTop: 4 }}>{clienteNombre} · Acceso seguro · {access.contactEmail}</p>
        </header>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 24 }}>
          <Stat label="Tickets abiertos" value={tickets.filter((t) => !["resuelto", "cerrado"].includes(String(t.estado || "").toLowerCase())).length} tone="warn" />
          <Stat label="Facturas pendientes" value={facturas.filter((f) => String(f.estado || "").toLowerCase() !== "cobrada").length} tone="bad" />
          <Stat label="Proyectos activos" value={proyectos.filter((p) => String(p.estado || "").toLowerCase() === "activo").length} tone="good" />
        </div>

        <section style={cardStyle}>
          <h2 style={h2Style}>Tickets recientes</h2>
          {tickets.length === 0 ? <Empty text="No tienes tickets abiertos." /> : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead><tr style={{ borderBottom: "1px solid #f1f5f9", color: "#64748b" }}>
                <th style={th}>Asunto</th><th style={th}>Aplicación</th><th style={th}>Severidad</th><th style={th}>Estado</th><th style={th}>Fecha</th>
              </tr></thead>
              <tbody>
                {tickets.slice(0, 10).map((t) => (
                  <tr key={t.id} style={{ borderBottom: "1px solid #f8fafc" }}>
                    <td style={td}><strong>{t.asunto || "—"}</strong></td>
                    <td style={td}>{t.aplicacion || "—"}</td>
                    <td style={td}>{t.severidad || "—"}</td>
                    <td style={td}>{t.estado || "—"}</td>
                    <td style={td}>{t.createdAt ? new Date(t.createdAt).toLocaleDateString("es-ES") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section style={cardStyle}>
          <h2 style={h2Style}>Facturas</h2>
          {facturas.length === 0 ? <Empty text="Sin facturas." /> : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead><tr style={{ borderBottom: "1px solid #f1f5f9", color: "#64748b" }}>
                <th style={th}>Número</th><th style={th}>Concepto</th><th style={th}>Importe</th><th style={th}>Estado</th>
              </tr></thead>
              <tbody>
                {facturas.slice(0, 10).map((f) => (
                  <tr key={f.id} style={{ borderBottom: "1px solid #f8fafc" }}>
                    <td style={td}>{f.numero || "—"}</td>
                    <td style={td}>{f.concepto || "—"}</td>
                    <td style={td}><strong>{f.importe || "—"} €</strong></td>
                    <td style={td}>{f.estado || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <footer style={{ marginTop: 30, fontSize: 11, color: "#94a3b8", textAlign: "center" }}>
          Acceso seguro — válido hasta {new Date(access.expiresAt).toLocaleDateString("es-ES")}.
          Si tienes dudas, escribe a tu contacto habitual.
        </footer>
      </div>
    </main>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "good" | "warn" | "bad" }) {
  const colors = { good: "#15803d", warn: "#a16207", bad: "#dc2626" };
  return (
    <div style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 16 }}>
      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: colors[tone] }}>{value}</div>
    </div>
  );
}
function Empty({ text }: { text: string }) { return <div style={{ color: "#94a3b8", padding: 16, textAlign: "center", fontSize: 13 }}>{text}</div>; }

const cardStyle: React.CSSProperties = { background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 18, marginBottom: 18 };
const h2Style: React.CSSProperties = { margin: "0 0 14px 0", fontSize: 16, fontWeight: 700 };
const th: React.CSSProperties = { textAlign: "left", padding: "8px 10px", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 };
const td: React.CSSProperties = { padding: "10px", verticalAlign: "middle" };
