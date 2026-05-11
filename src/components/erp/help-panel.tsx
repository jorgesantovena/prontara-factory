"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";

/**
 * Panel de ayuda contextual flotante (H9-B3).
 *
 * Se abre cuando el usuario pulsa "?" en la TopBar (custom event
 * "prontara-help-open"). Muestra:
 *   - Tip rápido del módulo actual (basado en pathname)
 *   - Atajos de teclado universales
 *   - FAQ general
 *   - Enlace a docs públicas + soporte
 *
 * Render al final del árbol — flotante absoluto, sin afectar layout.
 */

const TIPS_POR_RUTA: Record<string, { titulo: string; contenido: string; cta?: { label: string; href: string } }> = {
  "/": { titulo: "El panel del día a día", contenido: "Aquí ves los KPIs de tu negocio, accesos rápidos y actividad reciente. Todo se calcula en tiempo real con tus datos." },
  "/clientes": { titulo: "Gestión de clientes", contenido: "Da de alta clientes con su email, teléfono y datos fiscales. Los puedes filtrar por tipo, zona o grupo. Importar desde Excel funciona siempre." },
  "/proyectos": { titulo: "Proyectos y trabajos", contenido: "Cada proyecto tiene cliente, responsable, fechas, estado y bolsa de horas si aplica. Las actividades imputadas descuentan automáticamente de la bolsa." },
  "/facturacion": { titulo: "Facturación", contenido: "Crea facturas con número correlativo automático. Si tienes Verifactu activo, se firmará y enviará al AEAT al pulsar 'Emitir'." },
  "/presupuestos": { titulo: "Presupuestos / propuestas", contenido: "Crea presupuestos con concepto e importe. Cuando el cliente firma, marca como 'firmado' para liberar la facturación." },
  "/actividades": { titulo: "Imputación de horas", contenido: "Cada actividad tiene fecha, empleado, cliente, hora desde/hasta y se calcula el tiempo automáticamente. Marca 'contra-bolsa' o 'fuera-bolsa' para que la pre-facturación lo procese bien." },
  "/produccion/pre-facturacion": { titulo: "Pre-facturación estilo SISPYME", contenido: "Tabla con 8 columnas que te dice qué facturar este mes por cliente. Pulsa 'PDF' en la fila para generar el detalle de servicios." },
  "/importar": { titulo: "Importar desde Excel/CSV", contenido: "Sube tu archivo, te sugerimos qué módulo es y mapeamos automáticamente las columnas. Tú confirmas y se importa." },
  "/integraciones": { titulo: "Integraciones", contenido: "Activa Stripe, Google Calendar, WhatsApp Business, Mailchimp, Slack o Zapier. Cada una es opt-in." },
  "/calendario": { titulo: "Calendario unificado", contenido: "Mezcla tareas, reservas, citas y caja en un solo grid mensual. Filtra por módulo o por usuario." },
  "/vista-kanban": { titulo: "Vista Kanban", contenido: "Arrastra las tarjetas entre columnas para cambiar su estado. El cambio se persiste automáticamente." },
  "/workflows": { titulo: "Automatizaciones", contenido: "Crea reglas tipo 'cuando una factura cambie a vencida, mandar email al cliente'. Las acciones se ejecutan solas." },
  "/ajustes-campos": { titulo: "Campos personalizados", contenido: "Añade campos extra a cualquier módulo sin tocar código. Aparecen automáticamente en formularios y tablas." },
};

const FAQ = [
  { q: "¿Puedo importar mis datos desde Excel?", a: "Sí, en /importar. Te sugiere el módulo y mapea las columnas automáticamente." },
  { q: "¿Los datos son míos?", a: "100%. Puedes exportarlos en JSON desde /api/factory/gdpr/export en cualquier momento." },
  { q: "¿Cómo invito a mi equipo?", a: "En /equipo. Puedes asignar roles distintos a cada uno (admin, manager, staff, etc.)." },
  { q: "¿Funciona desde el móvil?", a: "Sí. La app es PWA — instálala desde el navegador móvil y queda como una app nativa." },
  { q: "¿Tengo soporte?", a: "Sí, escribe a hola@prontara.com y respondemos en horas hábiles." },
];

export default function HelpPanel() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("prontara-help-open", handler);
    return () => window.removeEventListener("prontara-help-open", handler);
  }, []);

  if (!open) return null;

  // Resolver tip según ruta — match exacto o por prefijo
  let tip = TIPS_POR_RUTA[pathname] || null;
  if (!tip) {
    for (const [ruta, t] of Object.entries(TIPS_POR_RUTA)) {
      if (ruta !== "/" && pathname.startsWith(ruta)) {
        tip = t;
        break;
      }
    }
  }

  return (
    <div style={{
      position: "fixed", top: 0, right: 0, bottom: 0,
      width: "min(440px, 100%)",
      background: "var(--bg, #ffffff)",
      borderLeft: "1px solid var(--border, #e5e7eb)",
      boxShadow: "-10px 0 30px rgba(0,0,0,0.08)",
      zIndex: 100,
      overflowY: "auto",
      fontFamily: "system-ui, -apple-system, sans-serif",
    }}>
      <div style={{ padding: 18, borderBottom: "1px solid var(--border, #e5e7eb)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "var(--fg, #0f172a)" }}>Ayuda</h2>
        <button type="button" onClick={() => setOpen(false)} style={{ border: "none", background: "transparent", fontSize: 22, color: "var(--fg-muted, #64748b)", cursor: "pointer", padding: 0, width: 32, height: 32 }}>×</button>
      </div>

      <div style={{ padding: 18 }}>
        {/* Tip contextual */}
        {tip ? (
          <section style={{ background: "var(--bg-secondary, #eff6ff)", border: "1px solid #bfdbfe", borderRadius: 10, padding: 14, marginBottom: 18 }}>
            <div style={{ fontSize: 11, color: "#1d4ed8", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
              En esta página
            </div>
            <h3 style={{ margin: "0 0 6px 0", fontSize: 15, fontWeight: 700, color: "var(--fg, #0f172a)" }}>{tip.titulo}</h3>
            <p style={{ margin: 0, fontSize: 13, color: "var(--fg-muted, #475569)", lineHeight: 1.5 }}>{tip.contenido}</p>
            {tip.cta ? (
              <Link href={tip.cta.href} style={{ display: "inline-block", marginTop: 10, color: "#1d4ed8", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>
                {tip.cta.label} →
              </Link>
            ) : null}
          </section>
        ) : null}

        {/* Atajos */}
        <section style={{ marginBottom: 18 }}>
          <h3 style={{ margin: "0 0 10px 0", fontSize: 12, fontWeight: 700, color: "var(--fg-muted, #475569)", textTransform: "uppercase", letterSpacing: 0.5 }}>
            Atajos universales
          </h3>
          <div style={{ display: "grid", gap: 6, fontSize: 12 }}>
            {[
              { key: "?", desc: "Abrir esta ayuda" },
              { key: "Esc", desc: "Cerrar paneles abiertos" },
              { key: "/", desc: "Buscador global" },
              { key: "g + d", desc: "Ir al panel principal" },
              { key: "g + c", desc: "Ir a clientes" },
              { key: "g + f", desc: "Ir a facturas" },
            ].map((a, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border, #f1f5f9)" }}>
                <code style={{ background: "var(--bg-secondary, #f8fafc)", padding: "2px 8px", borderRadius: 4, fontSize: 11, fontFamily: "monospace" }}>{a.key}</code>
                <span style={{ color: "var(--fg-muted, #475569)" }}>{a.desc}</span>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section style={{ marginBottom: 18 }}>
          <h3 style={{ margin: "0 0 10px 0", fontSize: 12, fontWeight: 700, color: "var(--fg-muted, #475569)", textTransform: "uppercase", letterSpacing: 0.5 }}>
            Preguntas frecuentes
          </h3>
          {FAQ.map((f, i) => (
            <details key={i} style={{ marginBottom: 6, padding: "8px 10px", background: "var(--bg-secondary, #f8fafc)", borderRadius: 6 }}>
              <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 13, color: "var(--fg, #0f172a)" }}>{f.q}</summary>
              <p style={{ margin: "8px 0 0 0", fontSize: 12, color: "var(--fg-muted, #475569)", lineHeight: 1.5 }}>{f.a}</p>
            </details>
          ))}
        </section>

        {/* Soporte */}
        <section style={{ background: "var(--bg-secondary, #f8fafc)", borderRadius: 10, padding: 14, fontSize: 13 }}>
          <div style={{ fontWeight: 700, marginBottom: 6, color: "var(--fg, #0f172a)" }}>¿Necesitas más?</div>
          <div style={{ color: "var(--fg-muted, #475569)", marginBottom: 10 }}>
            Documentación completa, vídeos y tutoriales sectoriales.
          </div>
          <Link href="/docs" style={{ color: "#1d4ed8", fontWeight: 700, textDecoration: "none", marginRight: 16 }}>
            Documentación →
          </Link>
          <a href="mailto:hola@prontara.com" style={{ color: "#1d4ed8", fontWeight: 700, textDecoration: "none" }}>
            hola@prontara.com
          </a>
        </section>
      </div>
    </div>
  );
}
