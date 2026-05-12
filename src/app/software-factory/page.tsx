import Link from "next/link";

/**
 * Landing comercial del vertical Software Factory.
 *
 * Página pública para que un CEO/CTO de software factory pequeña
 * entienda en 10 segundos por qué Prontara SF es lo suyo.
 *
 * Sin login, sin datos vacíos, sin tutoriales. Solo:
 * hero, dolor, solución, mockup, precio, CTA.
 */

export const metadata = {
  title: "Prontara Software Factory — ERP para empresas de desarrollo",
  description:
    "Bolsa de horas con saldo, pre-facturación con cálculo automático, PDF detalle al cliente, CAU con escalación. Listo en 10 minutos. 14 días gratis sin tarjeta.",
};

const ACCENT = "#2563eb";
const ACCENT_DARK = "#1e40af";

export default function SoftwareFactoryLanding() {
  return (
    <main style={{ fontFamily: "system-ui, -apple-system, sans-serif", color: "#0f172a", minHeight: "100vh", background: "#ffffff" }}>
      <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 32px", borderBottom: "1px solid #f1f5f9", maxWidth: 1280, margin: "0 auto" }}>
        <Link href="/" style={{ textDecoration: "none", color: "#0f172a", fontWeight: 800, fontSize: 18 }}>Prontara</Link>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Link href="/landing?sectorPack=software-factory" style={navLink}>Otros packs</Link>
          <Link href="/acceso?redirectTo=/softwarefactory" style={navLink}>Iniciar sesión</Link>
          <Link href="/alta?sectorPack=software-factory" style={ctaButtonSecondary}>Empezar gratis</Link>
        </div>
      </nav>

      <section style={{ background: "linear-gradient(135deg, " + ACCENT + " 0%, " + ACCENT_DARK + " 100%)", color: "#ffffff", padding: "80px 32px 100px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 48, alignItems: "center" }}>
          <div>
            <div style={{ display: "inline-block", background: "rgba(255,255,255,0.15)", color: "#ffffff", padding: "6px 14px", borderRadius: 999, fontSize: 12, fontWeight: 700, marginBottom: 20, letterSpacing: 0.5 }}>
              ERP PARA SOFTWARE FACTORIES
            </div>
            <h1 style={{ fontSize: 52, fontWeight: 800, lineHeight: 1.05, margin: "0 0 20px 0" }}>
              Tu equipo factura lo que trabaja.<br />
              <span style={{ color: "#bfdbfe" }}>Sin Excel, sin pelearte cada mes.</span>
            </h1>
            <p style={{ fontSize: 19, lineHeight: 1.55, margin: "0 0 32px 0", color: "rgba(255,255,255,0.92)" }}>
              Bolsa de horas con saldo en tiempo real. Pre-facturación que calcula sola contra cuota.
              PDF detalle al cliente con un clic. Verifactu listo. Pensado para software factories de 4 a 20 personas.
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Link href="/alta?sectorPack=software-factory" style={ctaButtonPrimary}>Empieza 14 días gratis</Link>
              <Link href="/software-factory/demo" style={ctaButtonGhost}>Ver demo en vivo</Link>
            </div>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", marginTop: 14 }}>
              Sin tarjeta · Setup en 10 minutos · Datos demo de ejemplo incluidos
            </p>
          </div>

          <div style={{ position: "relative" }}>
            <div style={{ background: "#ffffff", borderRadius: 12, padding: 16, boxShadow: "0 30px 60px rgba(0,0,0,0.3)", color: "#0f172a", fontSize: 11 }}>
              <div style={{ borderBottom: "1px solid #e5e7eb", paddingBottom: 8, marginBottom: 10, color: ACCENT, fontWeight: 700, fontSize: 13 }}>
                Servicios facturables · Abril 2026
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
                <thead>
                  <tr style={{ color: "#475569" }}>
                    <th style={{ textAlign: "left", padding: 4, fontWeight: 700 }}>Cliente</th>
                    <th style={{ textAlign: "right", padding: 4 }}>H.Per</th>
                    <th style={{ textAlign: "right", padding: 4 }}>Bolsa</th>
                    <th style={{ textAlign: "right", padding: 4 }}>A facturar</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderTop: "1px solid #f1f5f9" }}>
                    <td style={{ padding: 5, fontWeight: 600 }}>Almacenes Delca SA</td>
                    <td style={{ padding: 5, textAlign: "right" }}>49,99</td>
                    <td style={{ padding: 5, textAlign: "right" }}>10,00</td>
                    <td style={{ padding: 5, textAlign: "right", color: "#16a34a", fontWeight: 700 }}>2.199 €</td>
                  </tr>
                  <tr style={{ borderTop: "1px solid #f1f5f9" }}>
                    <td style={{ padding: 5, fontWeight: 600 }}>Construcciones Levante</td>
                    <td style={{ padding: 5, textAlign: "right" }}>18,62</td>
                    <td style={{ padding: 5, textAlign: "right" }}>30,00</td>
                    <td style={{ padding: 5, textAlign: "right", color: "#475569" }}>0 €</td>
                  </tr>
                  <tr style={{ borderTop: "1px solid #f1f5f9" }}>
                    <td style={{ padding: 5, fontWeight: 600 }}>Acme Labs</td>
                    <td style={{ padding: 5, textAlign: "right" }}>64,25</td>
                    <td style={{ padding: 5, textAlign: "right" }}>50,00</td>
                    <td style={{ padding: 5, textAlign: "right", color: "#16a34a", fontWeight: 700 }}>855 €</td>
                  </tr>
                  <tr style={{ borderTop: "1px solid #f1f5f9", background: "#f8fafc", fontWeight: 800 }}>
                    <td style={{ padding: 6 }}>Total a facturar</td>
                    <td style={{ padding: 6 }} colSpan={2}></td>
                    <td style={{ padding: 6, textAlign: "right", color: "#16a34a" }}>3.054 €</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div style={{ position: "absolute", bottom: -24, right: -24, background: "#16a34a", color: "#ffffff", padding: "10px 18px", borderRadius: 10, fontSize: 12, fontWeight: 700, boxShadow: "0 10px 25px rgba(22,163,74,0.4)" }}>
              ✓ Calculado automático
            </div>
          </div>
        </div>
      </section>

      <section style={{ padding: "100px 32px", background: "#f8fafc" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <div style={{ display: "inline-block", color: "#dc2626", fontSize: 13, fontWeight: 700, letterSpacing: 0.8, marginBottom: 12 }}>EL PROBLEMA</div>
            <h2 style={{ fontSize: 36, fontWeight: 800, margin: "0 0 16px 0" }}>Cada mes pierdes horas peleándote con esto</h2>
            <p style={{ fontSize: 17, color: "#475569", maxWidth: 680, margin: "0 auto" }}>
              Eres responsable de una software factory pequeña. Tu equipo trabaja, los clientes piden,
              tú miras el calendario y empieza el lío.
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
            {[
              { titulo: "\"¿Cuántas horas le quedan a este cliente?\"", texto: "Bolsas contratadas, sobreconsumo… y tu Excel desactualizado desde marzo." },
              { titulo: "\"¿Qué facturo este mes?\"", texto: "Imputas a mano, cruzas con proyectos, calculas si va contra cuota o aparte. 2 horas perdidas." },
              { titulo: "\"El cliente quiere ver el detalle\"", texto: "Le mandas un Word a pelo o le copias del Excel. La factura no convence y discutes cifras." },
              { titulo: "\"Un técnico ya no está y nadie sabe qué hizo\"", texto: "Las horas que imputó ese mes se pierden. Tu rentabilidad real, también." },
              { titulo: "\"Llega Verifactu y no estás listo\"", texto: "AEAT exige firma XML-DSig. Tu programa de facturas no lo hace o cobra extra." },
              { titulo: "\"Las urgencias se cobran como horario normal\"", texto: "El técnico viene un sábado y facturas a tarifa estándar. Pierdes margen sin notarlo." },
            ].map((p, i) => (
              <div key={i} style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 24 }}>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8, color: "#0f172a" }}>{p.titulo}</div>
                <div style={{ fontSize: 14, color: "#475569", lineHeight: 1.55 }}>{p.texto}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: "100px 32px", background: "#ffffff" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <div style={{ display: "inline-block", color: ACCENT, fontSize: 13, fontWeight: 700, letterSpacing: 0.8, marginBottom: 12 }}>LA SOLUCIÓN</div>
            <h2 style={{ fontSize: 36, fontWeight: 800, margin: "0 0 16px 0" }}>
              Prontara Software Factory hace el trabajo aburrido por ti
            </h2>
            <p style={{ fontSize: 17, color: "#475569", maxWidth: 720, margin: "0 auto" }}>
              Pensado específicamente para software factories pequeñas. Sin opciones que no usarás,
              sin formación que no quieres dar, sin sorpresas en la factura del SaaS.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24 }}>
            {[
              { emoji: "⏱️", titulo: "Bolsa de horas con saldo en tiempo real", texto: "Cada cliente tiene su bolsa contratada (10h/año, 30h/año…). El sistema descuenta automáticamente al imputar y avisa cuando se agota." },
              { emoji: "💸", titulo: "Pre-facturación con 8 columnas", texto: "Mira de un vistazo qué facturar este mes por cliente: horas del periodo, contra cuota, gastadas anteriormente, fuera de bolsa, importe a facturar. Estilo SISPYME." },
              { emoji: "📄", titulo: "PDF detalle al cliente", texto: "Genera el detalle de servicios agrupado por tipo (Análisis, Programación, Soporte…) con bolsa, asterisco facturable y totales. Listo para enviar." },
              { emoji: "🎯", titulo: "CAU con escalación de urgencia", texto: "Tickets de soporte clasificados por aplicación, severidad y urgencia. Cambios Normal→Urgente con coste asociado al contrato del cliente." },
              { emoji: "📊", titulo: "Tipos de contrato configurables", texto: "Mant. Nivel 1, 2, 3, 4, Cuota Axis, Mantenimiento a medida… cada uno con llamadas/mes, recargo nocturno, horas/año, tarifa €/h por tipo de servicio." },
              { emoji: "✅", titulo: "Verifactu real con firma XML-DSig", texto: "Sube tu certificado digital y Prontara firma cada factura con tu identidad fiscal. AEAT contento." },
              { emoji: "📱", titulo: "App móvil para imputar en cliente", texto: "Tu técnico está en casa del cliente, abre el móvil, imputa la tarea con desde/hasta, lugar y descripción. Sincroniza al volver." },
              { emoji: "🏦", titulo: "Remesas SEPA al banco", texto: "Los clientes con domiciliación: genera el XML pain.008 listo para subir a BBVA, Santander, CaixaBank o ING. Sin programar." },
            ].map((f, i) => (
              <div key={i} style={{ padding: 28, border: "1px solid #e5e7eb", borderRadius: 14, background: "#ffffff" }}>
                <div style={{ fontSize: 32, marginBottom: 14 }}>{f.emoji}</div>
                <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 8, color: "#0f172a" }}>{f.titulo}</div>
                <div style={{ fontSize: 14, color: "#475569", lineHeight: 1.6 }}>{f.texto}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: "60px 32px", background: ACCENT, color: "#ffffff" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 32, textAlign: "center" }}>
          {[
            { num: "10 min", label: "Setup completo desde cero" },
            { num: "11 packs", label: "Sectoriales operativos" },
            { num: "0 €", label: "Costes ocultos" },
            { num: "14 días", label: "Prueba gratis sin tarjeta" },
          ].map((s, i) => (
            <div key={i}>
              <div style={{ fontSize: 40, fontWeight: 800, marginBottom: 4 }}>{s.num}</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ padding: "100px 32px", background: "#f8fafc" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", textAlign: "center" }}>
          <div style={{ display: "inline-block", color: ACCENT, fontSize: 13, fontWeight: 700, letterSpacing: 0.8, marginBottom: 12 }}>PRECIO CERRADO</div>
          <h2 style={{ fontSize: 36, fontWeight: 800, margin: "0 0 12px 0" }}>Un plan, todo incluido</h2>
          <p style={{ fontSize: 17, color: "#475569", marginBottom: 40 }}>
            Sin sorpresas, sin upsell, sin "esa función está en el plan superior".
          </p>

          <div style={{ background: "#ffffff", border: "2px solid " + ACCENT, borderRadius: 16, padding: 40, boxShadow: "0 20px 50px rgba(37,99,235,0.15)" }}>
            <div style={{ fontSize: 13, color: ACCENT, fontWeight: 700, letterSpacing: 0.5, marginBottom: 8 }}>PRONTARA SOFTWARE FACTORY</div>
            <div style={{ display: "flex", justifyContent: "center", alignItems: "baseline", gap: 4, marginBottom: 8 }}>
              <span style={{ fontSize: 56, fontWeight: 800, color: "#0f172a" }}>49</span>
              <span style={{ fontSize: 24, fontWeight: 600, color: "#475569" }}>€/mes</span>
            </div>
            <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 32 }}>+ IVA · facturación mensual · cancela cuando quieras</div>

            <div style={{ display: "grid", gap: 12, textAlign: "left", marginBottom: 32, fontSize: 15 }}>
              {[
                "Hasta 20 usuarios incluidos",
                "Bolsa de horas con saldo y pre-facturación 8 columnas",
                "PDF detalle servicios estilo SISPYME",
                "Tipos de contrato configurables (Mant. Nivel 1-4, etc.)",
                "CAU con escalación de urgencia",
                "Verifactu real con firma XML-DSig",
                "Remesas SEPA pain.008",
                "App móvil + PWA instalable",
                "Asistente IA que ejecuta acciones",
                "Soporte en español por email",
              ].map((feat, i) => (
                <div key={i} style={{ display: "flex", gap: 10 }}>
                  <span style={{ color: "#16a34a", fontWeight: 800 }}>✓</span>
                  <span style={{ color: "#0f172a" }}>{feat}</span>
                </div>
              ))}
            </div>

            <Link href="/alta?sectorPack=software-factory" style={{ ...ctaButtonPrimary, display: "block", textAlign: "center", padding: "16px 24px", fontSize: 17, color: "#ffffff", background: ACCENT, border: "2px solid " + ACCENT }}>
              Empieza 14 días gratis
            </Link>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 12 }}>
              Sin tarjeta. Si no te convence, cancela y olvídate.
            </div>
          </div>
        </div>
      </section>

      <section style={{ padding: "80px 32px", textAlign: "center", background: "#0f172a", color: "#ffffff" }}>
        <h2 style={{ fontSize: 32, fontWeight: 800, margin: "0 0 16px 0" }}>
          ¿Listo para dejar de pelearte con Excel?
        </h2>
        <p style={{ fontSize: 17, color: "rgba(255,255,255,0.75)", maxWidth: 540, margin: "0 auto 32px" }}>
          En 10 minutos tienes Prontara SF arrancado con tu cliente piloto cargado y la primera factura preparada.
        </p>
        <Link href="/alta?sectorPack=software-factory" style={{ ...ctaButtonPrimary, padding: "16px 32px", fontSize: 17 }}>
          Crear mi cuenta gratis
        </Link>
        <div style={{ marginTop: 20, fontSize: 13, color: "rgba(255,255,255,0.6)" }}>
          ¿Prefieres ver una demo primero? <Link href="/software-factory/demo" style={{ color: "#bfdbfe", textDecoration: "underline" }}>Pruébala sin alta</Link>
        </div>
      </section>

      <footer style={{ padding: "32px", borderTop: "1px solid #1e293b", background: "#0f172a", color: "rgba(255,255,255,0.6)", textAlign: "center", fontSize: 13 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div>© 2026 Prontara — un producto de SISPYME, S.L.</div>
          <div style={{ display: "flex", gap: 16 }}>
            <Link href="/landing" style={{ color: "rgba(255,255,255,0.6)", textDecoration: "none" }}>Otros verticales</Link>
            <Link href="/status" style={{ color: "rgba(255,255,255,0.6)", textDecoration: "none" }}>Estado</Link>
            <Link href="/acceso" style={{ color: "rgba(255,255,255,0.6)", textDecoration: "none" }}>Iniciar sesión</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

const navLink: React.CSSProperties = {
  color: "#475569",
  textDecoration: "none",
  fontSize: 14,
  fontWeight: 600,
  padding: "8px 12px",
};

const ctaButtonPrimary: React.CSSProperties = {
  background: "#ffffff",
  color: ACCENT,
  padding: "14px 24px",
  borderRadius: 8,
  fontWeight: 700,
  fontSize: 15,
  textDecoration: "none",
  display: "inline-block",
  border: "2px solid #ffffff",
  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
};

const ctaButtonGhost: React.CSSProperties = {
  background: "transparent",
  color: "#ffffff",
  padding: "14px 24px",
  borderRadius: 8,
  fontWeight: 700,
  fontSize: 15,
  textDecoration: "none",
  display: "inline-block",
  border: "2px solid rgba(255,255,255,0.5)",
};

const ctaButtonSecondary: React.CSSProperties = {
  background: ACCENT,
  color: "#ffffff",
  padding: "8px 16px",
  borderRadius: 6,
  fontWeight: 700,
  fontSize: 14,
  textDecoration: "none",
};
