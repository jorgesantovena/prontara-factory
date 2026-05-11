"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * Wizard de onboarding inicial (H9-B1).
 *
 * 5 pasos guiados que se adaptan al sector pack del tenant:
 *   1. Datos de tu empresa
 *   2. Sedes y horarios
 *   3. Usuarios y permisos
 *   4. Catálogo inicial (sector-específico)
 *   5. Importar datos / cargar demo
 *
 * Persiste el progreso en localStorage. Al completar redirige a /.
 */
type Vertical = string;
type StepStatus = "pending" | "current" | "done";

type Step = {
  key: string;
  num: number;
  title: string;
  description: string;
  cta: string;
  href?: string;
  hint?: string;
};

const BASE_STEPS: Step[] = [
  { key: "empresa", num: 1, title: "Datos de tu empresa", description: "Nombre, CIF, dirección, IBAN. Lo que aparecerá en tus facturas y emails.", cta: "Configurar mi empresa", href: "/ajustes" },
  { key: "sedes", num: 2, title: "Sedes y empresas internas", description: "Si tienes varias sedes o razones sociales, configúralas. Si no, salta este paso.", cta: "Gestionar sedes", href: "/ajustes" },
  { key: "usuarios", num: 3, title: "Usuarios y permisos", description: "Invita a tu equipo, asigna roles. Cada uno verá solo lo que necesita.", cta: "Invitar equipo", href: "/equipo" },
  { key: "catalogo", num: 4, title: "Catálogo inicial", description: "Define lo que vendes/haces (servicios, productos, contratos según vertical).", cta: "Configurar catálogo", href: "/productos" },
  { key: "datos", num: 5, title: "Importar tus datos", description: "Sube tu Excel de clientes/facturas y Prontara mapea automáticamente.", cta: "Importar Excel/CSV", href: "/importar" },
];

const VERTICAL_STEP_OVERRIDES: Record<Vertical, Partial<Record<string, Partial<Step>>>> = {
  "software-factory": {
    catalogo: { title: "Tipos de servicio + tarifas", description: "Define qué tipos de servicio facturas (Análisis, Programación, Soporte…) y la tarifa €/h de cada uno.", cta: "Configurar tipos de servicio", href: "/tipos-servicio" },
  },
  "clinica-dental": {
    catalogo: { title: "Tratamientos y doctores", description: "Define los tratamientos que ofreces y da de alta tu equipo médico.", cta: "Configurar tratamientos", href: "/empleados" },
  },
  "clinica-veterinaria": {
    catalogo: { title: "Servicios y veterinarios", description: "Define vacunaciones, cirugías, consultas y da de alta tu equipo.", cta: "Configurar servicios", href: "/empleados" },
  },
  "colegio": {
    catalogo: { title: "Año lectivo + grados + asignaturas", description: "Configura el calendario académico y la estructura del centro.", cta: "Configurar año lectivo", href: "/ajustes" },
  },
  "peluqueria": {
    catalogo: { title: "Servicios + profesionales", description: "Define los servicios que ofreces y da de alta a tus profesionales.", cta: "Configurar servicios", href: "/productos" },
  },
  "taller": {
    catalogo: { title: "Servicios + tarifas mano de obra", description: "Define los servicios que ofreces y la tarifa de mano de obra.", cta: "Configurar servicios", href: "/productos" },
  },
  "hosteleria": {
    catalogo: { title: "Carta + tipos de evento", description: "Configura tu carta y los tipos de evento (boda, comunión, empresa).", cta: "Configurar carta", href: "/productos" },
  },
  "inmobiliaria": {
    catalogo: { title: "Tipos de inmueble + comisiones", description: "Define tipos de inmueble y la comisión que cobras por venta/alquiler.", cta: "Configurar comisiones", href: "/ajustes" },
  },
  "asesoria": {
    catalogo: { title: "Tipos de cuota + tarifas", description: "Configura cuotas mensuales (autónomo/PYME/empresa) y tarifas de encargos puntuales.", cta: "Configurar cuotas", href: "/ajustes" },
  },
  "despacho-abogados": {
    catalogo: { title: "Materias + tarifas honorarios", description: "Define materias (civil, penal, mercantil…) y tarifas de honorarios por hora o caso.", cta: "Configurar honorarios", href: "/ajustes" },
  },
};

export default function OnboardingWizard() {
  const [vertical, setVertical] = useState<Vertical>("generic");
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [tenantName, setTenantName] = useState("");

  useEffect(() => {
    fetch("/api/runtime/tenant-config", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d?.config?.businessType) setVertical(d.config.businessType);
        if (d?.config?.branding?.displayName) setTenantName(d.config.branding.displayName);
      })
      .catch(() => undefined);

    try {
      const saved = window.localStorage.getItem("prontara-onboarding-done");
      if (saved) setCompleted(new Set(JSON.parse(saved)));
    } catch { /* ignore */ }
  }, []);

  function markDone(key: string) {
    const next = new Set(completed);
    next.add(key);
    setCompleted(next);
    try {
      window.localStorage.setItem("prontara-onboarding-done", JSON.stringify([...next]));
    } catch { /* ignore */ }
  }

  function getStep(key: string): Step {
    const base = BASE_STEPS.find((s) => s.key === key)!;
    const override = VERTICAL_STEP_OVERRIDES[vertical]?.[key];
    return { ...base, ...override };
  }

  const steps = BASE_STEPS.map((s) => getStep(s.key));
  const doneCount = steps.filter((s) => completed.has(s.key)).length;
  const progressPct = Math.round((doneCount / steps.length) * 100);
  const allDone = doneCount === steps.length;

  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: 32, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div style={{ marginBottom: 32 }}>
        <Link href="/" style={{ color: "#1d4ed8", textDecoration: "none", fontSize: 13 }}>← Saltar y entrar al panel</Link>
      </div>

      <h1 style={{ fontSize: 32, fontWeight: 800, color: "#0f172a", margin: "0 0 8px 0" }}>
        Bienvenido{tenantName ? " a " + tenantName : ""}
      </h1>
      <p style={{ fontSize: 16, color: "#475569", marginBottom: 24 }}>
        En 5 pasos tienes Prontara configurado y operativo. Tarda menos de 10 minutos.
      </p>

      {/* Barra de progreso */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13, color: "#475569", fontWeight: 600 }}>
          <span>{doneCount} de {steps.length} pasos completados</span>
          <span>{progressPct}%</span>
        </div>
        <div style={{ height: 8, background: "#e5e7eb", borderRadius: 4, overflow: "hidden" }}>
          <div style={{ height: "100%", width: progressPct + "%", background: allDone ? "#16a34a" : "#1d4ed8", transition: "width 0.3s" }} />
        </div>
      </div>

      {allDone ? (
        <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 12, padding: 24, textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🎉</div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "#166534", margin: "0 0 8px 0" }}>¡Listo!</h2>
          <p style={{ color: "#166534", marginBottom: 16 }}>Tu Prontara está configurado. Ya puedes empezar a operar.</p>
          <Link href="/" style={{ display: "inline-block", background: "#16a34a", color: "#ffffff", padding: "12px 24px", borderRadius: 8, textDecoration: "none", fontWeight: 700 }}>
            Ir al panel →
          </Link>
        </div>
      ) : null}

      <div style={{ display: "grid", gap: 12 }}>
        {steps.map((s) => {
          const done = completed.has(s.key);
          return (
            <div key={s.key} style={{
              background: done ? "#f0fdf4" : "#ffffff",
              border: "1px solid " + (done ? "#bbf7d0" : "#e5e7eb"),
              borderRadius: 12,
              padding: 20,
              display: "grid",
              gridTemplateColumns: "48px 1fr auto",
              gap: 16,
              alignItems: "center",
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: "50%",
                background: done ? "#16a34a" : "#e5e7eb",
                color: done ? "#ffffff" : "#475569",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 800, fontSize: 16,
              }}>
                {done ? "✓" : s.num}
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>{s.title}</div>
                <div style={{ fontSize: 13, color: "#475569" }}>{s.description}</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {!done ? (
                  <>
                    <Link href={s.href || "/"} style={{ background: "#1d4ed8", color: "#ffffff", padding: "8px 14px", borderRadius: 6, fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
                      {s.cta}
                    </Link>
                    <button type="button" onClick={() => markDone(s.key)} style={{ background: "#ffffff", color: "#475569", padding: "8px 12px", borderRadius: 6, fontSize: 13, border: "1px solid #d1d5db", cursor: "pointer", fontWeight: 600 }}>
                      Marcar hecho
                    </button>
                  </>
                ) : (
                  <button type="button" onClick={() => { const n = new Set(completed); n.delete(s.key); setCompleted(n); try { window.localStorage.setItem("prontara-onboarding-done", JSON.stringify([...n])); } catch { /* ignore */ } }} style={{ background: "transparent", color: "#16a34a", padding: "8px 12px", fontSize: 13, border: "1px solid #bbf7d0", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
                    Rehacer
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 32, padding: 18, background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 12, fontSize: 13, color: "#92400e" }}>
        <strong>Consejo:</strong> tu Prontara ya viene cargado con datos de ejemplo de tu sector. Puedes empezar a explorar antes de configurar nada — y borrar los demos cuando quieras.
      </div>
    </main>
  );
}
