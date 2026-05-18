"use client";

import Link from "next/link";
import TenantShell from "@/components/erp/tenant-shell";
import { useCurrentVertical } from "@/lib/saas/use-current-vertical";

/**
 * Placeholder reusable para secciones del ERP cuya página aún no se ha
 * implementado pero que aparecen en el sidebar/maestros porque el sector
 * pack las declara. En lugar de devolver 404, mostramos un mensaje "en
 * construcción" coherente con el resto del UI.
 *
 * TEST-5bis — añadido para evitar 404 en Avisos, Gastos, Vencimientos,
 * Desplazamientos, Empleados y secciones del grupo Maestros que el
 * tester echaba en falta en el menú lateral.
 */
export default function SectionPlaceholder({
  title,
  subtitle,
  hint,
}: {
  title: string;
  subtitle?: string;
  hint?: string;
}) {
  const { link } = useCurrentVertical();
  return (
    <TenantShell>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: 24, fontFamily: "system-ui, -apple-system, sans-serif", color: "#0f172a" }}>
        <div style={{ fontSize: 13, color: "#64748b", marginBottom: 6 }}>
          <Link href={link("")} style={{ color: "#64748b", textDecoration: "none" }}>Inicio</Link>
          <span style={{ margin: "0 6px" }}>/</span>
          <span style={{ color: "#0f172a", fontWeight: 600 }}>{title}</span>
        </div>
        <h1 style={{ margin: "0 0 8px 0", fontSize: 28, fontWeight: 800, letterSpacing: -0.4 }}>{title}</h1>
        {subtitle ? (
          <p style={{ color: "#64748b", fontSize: 14, marginTop: 0, marginBottom: 18 }}>{subtitle}</p>
        ) : null}

        <section style={{ background: "#f8fafc", border: "1px dashed #cbd5e1", borderRadius: 12, padding: 32, textAlign: "center" }}>
          <div style={{ fontSize: 44, marginBottom: 10 }}>🚧</div>
          <h2 style={{ margin: "0 0 8px 0", fontSize: 18, fontWeight: 700, color: "#0f172a" }}>Sección en construcción</h2>
          <p style={{ margin: "0 auto", maxWidth: 520, color: "#475569", fontSize: 13, lineHeight: 1.55 }}>
            {hint || "Estamos terminando esta sección. Pronto podrás gestionar sus datos desde aquí. Si necesitas usar esta función ya, avísanos."}
          </p>
        </section>
      </div>
    </TenantShell>
  );
}
