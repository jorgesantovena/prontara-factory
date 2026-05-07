"use client";

import { useEffect, useState } from "react";

/**
 * Panel "Generar boletín" para el módulo /calificaciones del vertical
 * colegio (SCHOOL-05). Permite seleccionar alumno + periodo y abrir el
 * PDF del boletín en una pestaña nueva.
 *
 * Solo se renderiza si businessType=colegio. En otros verticales
 * devuelve null silenciosamente.
 */
type AlumnoOption = { value: string; label: string };

const PERIODOS = [
  { value: "1T", label: "1er trimestre" },
  { value: "2T", label: "2º trimestre" },
  { value: "3T", label: "3er trimestre" },
  { value: "final", label: "Final" },
];

export default function ColegioBoletinLauncher() {
  const [businessType, setBusinessType] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [alumnos, setAlumnos] = useState<AlumnoOption[]>([]);
  const [alumno, setAlumno] = useState("");
  const [periodo, setPeriodo] = useState("2T");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cfg = await fetch("/api/runtime/tenant-config", { cache: "no-store" });
        const cfgData = await cfg.json();
        if (cancelled) return;
        const bt = String(cfgData?.config?.businessType || "")
          .trim()
          .toLowerCase();
        setBusinessType(bt || null);

        if (bt === "colegio") {
          const opts = await fetch("/api/erp/options?module=clientes", {
            cache: "no-store",
          });
          const optsData = await opts.json();
          if (!cancelled && optsData?.ok && Array.isArray(optsData.options)) {
            setAlumnos(optsData.options);
          }
        }
      } catch {
        if (!cancelled) setBusinessType(null);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!loaded) return null;
  if (businessType !== "colegio") return null;

  const canGenerate = !!alumno && !!periodo;
  const href = canGenerate
    ? "/api/colegio/boletin-pdf?alumno=" +
      encodeURIComponent(alumno) +
      "&periodo=" +
      encodeURIComponent(periodo)
    : "#";

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <select
        value={alumno}
        onChange={(e) => setAlumno(e.target.value)}
        style={{
          border: "1px solid #d1d5db",
          borderRadius: 6,
          padding: "8px 10px",
          fontSize: 13,
          minWidth: 180,
        }}
      >
        <option value="">— Alumno —</option>
        {alumnos.map((a) => (
          <option key={a.value} value={a.value}>
            {a.label}
          </option>
        ))}
      </select>
      <select
        value={periodo}
        onChange={(e) => setPeriodo(e.target.value)}
        style={{
          border: "1px solid #d1d5db",
          borderRadius: 6,
          padding: "8px 10px",
          fontSize: 13,
        }}
      >
        {PERIODOS.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>
      <a
        href={href}
        target={canGenerate ? "_blank" : undefined}
        rel="noopener noreferrer"
        onClick={(e) => {
          if (!canGenerate) e.preventDefault();
        }}
        style={{
          border: "1px solid #7c3aed",
          background: canGenerate ? "#7c3aed" : "#e5e7eb",
          color: canGenerate ? "#ffffff" : "#9ca3af",
          borderRadius: 8,
          padding: "10px 14px",
          fontSize: 13,
          fontWeight: 700,
          textDecoration: "none",
          cursor: canGenerate ? "pointer" : "not-allowed",
          whiteSpace: "nowrap",
        }}
      >
        ↓ Boletín PDF
      </a>
    </div>
  );
}
