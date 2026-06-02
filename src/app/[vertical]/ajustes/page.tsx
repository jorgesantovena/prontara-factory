"use client";

import Link from "next/link";
import TenantShell from "@/components/erp/tenant-shell";
import { useCurrentVertical } from "@/lib/saas/use-current-vertical";

/**
 * TEST-17 bis 2 D — Pedro reporta "Ajustes" del MP no funciona.
 * Antes la página intentaba renderizar ModuleCrudPage con
 * getModuleUiDefinition("ajustes"), camino que estaba roto.
 *
 * El nuevo /ajustes es un hub que enumera las sub-secciones de
 * configuración que sí tienen página propia (Mi cuenta, Campos
 * personalizados, Workflows, Integraciones, etc.). Cada tarjeta
 * lleva a su ruta concreta.
 */
type Item = { href: string; label: string; description: string; icon: string };

const ITEMS: Item[] = [
  { href: "ajustes-cuenta", label: "Mi cuenta", description: "Datos de tu usuario y tu organización.", icon: "👤" },
  { href: "ajustes-campos", label: "Campos personalizados", description: "Añade o modifica los campos que ves en los formularios.", icon: "🧩" },
  { href: "workflows", label: "Workflows", description: "Reglas automáticas cuando cambia un registro.", icon: "🔀" },
  { href: "integraciones", label: "Integraciones", description: "Conexión con servicios externos (email, pasarela de pago, IA, SSO).", icon: "🔌" },
  { href: "etiquetas", label: "Etiquetas", description: "Define etiquetas reutilizables para clasificar registros.", icon: "🏷" },
  { href: "plantillas", label: "Plantillas", description: "Plantillas de email y documentos.", icon: "📑" },
];

export default function AjustesPage() {
  const { link } = useCurrentVertical();
  return (
    <TenantShell>
      <div style={{ maxWidth: 960, margin: "0 auto", color: "#0f172a", fontFamily: "system-ui, -apple-system, sans-serif" }}>
        <h1 style={{ margin: "0 0 6px 0", fontSize: 22, fontWeight: 800, letterSpacing: -0.3 }}>Ajustes</h1>
        <p style={{ margin: "0 0 18px 0", color: "#64748b", fontSize: 13 }}>
          Configuración del tenant. Elige la sección que quieras editar.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
          {ITEMS.map((it) => (
            <Link
              key={it.href}
              href={link(it.href)}
              style={{
                display: "flex", gap: 12, alignItems: "flex-start",
                background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 12,
                padding: 16, textDecoration: "none", color: "inherit", cursor: "pointer",
              }}
            >
              <span style={{ fontSize: 22 }}>{it.icon}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>{it.label}</span>
                <span style={{ display: "block", fontSize: 12, color: "#64748b", lineHeight: 1.4 }}>{it.description}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </TenantShell>
  );
}
