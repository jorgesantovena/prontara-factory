"use client";

import { useEffect, useState } from "react";

/**
 * Portal del estudiante (SCHOOL-07).
 *
 * Filtra por session.fullName == campo alumno de cada módulo. Pensado
 * para cuentas con rol=estudiante. La cuenta se crea con fullName =
 * nombre completo del alumno.
 */
type Row = Record<string, string>;

export default function PortalEstudiantePage() {
  const [session, setSession] = useState<{ fullName: string; email: string; role: string } | null>(null);
  const [calificaciones, setCalificaciones] = useState<Row[]>([]);
  const [asistencia, setAsistencia] = useState<Row[]>([]);
  const [horarios, setHorarios] = useState<Row[]>([]);
  const [tenantName, setTenantName] = useState("Centro educativo");
  const [accentColor, setAccentColor] = useState("#7c3aed");
  const [miCurso, setMiCurso] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [sRes, dRes] = await Promise.all([
          fetch("/api/runtime/session", { cache: "no-store" }),
          fetch("/api/runtime/dashboard", { cache: "no-store" }),
        ]);
        const sData = await sRes.json();
        const dData = await dRes.json();
        if (cancelled) return;
        const u = sData?.session || null;
        if (u) setSession({ fullName: String(u.fullName || ""), email: String(u.email || ""), role: String(u.role || "") });
        if (dData?.tenant) {
          setTenantName(dData.tenant.displayName || "Centro educativo");
          if (dData.tenant.accentColor) setAccentColor(dData.tenant.accentColor);
        }

        const me = String(u?.fullName || "").trim().toLowerCase();
        const [cRes, aRes, hRes, alumRes] = await Promise.all([
          fetch("/api/erp/module?module=calificaciones", { cache: "no-store" }),
          fetch("/api/erp/module?module=asistencia", { cache: "no-store" }),
          fetch("/api/erp/module?module=horarios", { cache: "no-store" }),
          fetch("/api/erp/module?module=clientes", { cache: "no-store" }),
        ]);
        const cData = await cRes.json();
        const aData = await aRes.json();
        const hData = await hRes.json();
        const alumData = await alumRes.json();
        if (cancelled) return;

        // Resolver mi curso
        const allClientes = Array.isArray(alumData?.rows) ? alumData.rows : [];
        const yo = allClientes.find(
          (c: Row) => String(c.nombre || "").trim().toLowerCase() === me,
        );
        const cursoYo = String(yo?.curso || "").trim();
        setMiCurso(cursoYo);

        const filterByMe = (arr: Row[]) =>
          me ? arr.filter((r) => String(r.alumno || "").trim().toLowerCase() === me) : arr;
        setCalificaciones(filterByMe(Array.isArray(cData?.rows) ? cData.rows : []));
        setAsistencia(filterByMe(Array.isArray(aData?.rows) ? aData.rows : []));

        // Horarios filtrados por mi curso
        const allHorarios = Array.isArray(hData?.rows) ? hData.rows : [];
        const misHorarios = cursoYo
          ? allHorarios.filter((h: Row) => String(h.curso || "").trim() === cursoYo)
          : [];
        setHorarios(misHorarios);
      } catch {
        // silencioso
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // KPIs propios
  const totalAsistencia = asistencia.length;
  const presentes = asistencia.filter((a) => String(a.estado || "").toLowerCase() === "presente").length;
  const pctPresencia = totalAsistencia > 0 ? Math.round((presentes / totalAsistencia) * 100) : 0;
  const aprobadas = calificaciones.filter((c) => parseFloat(String(c.nota || "0").replace(",", ".")) >= 5).length;

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: 24, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <header style={{ marginBottom: 24, borderBottom: "1px solid #e5e7eb", paddingBottom: 16 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: accentColor, margin: 0 }}>{tenantName}</h1>
        <p style={{ margin: "4px 0 0 0", color: "#6b7280", fontSize: 14 }}>
          Portal del estudiante {miCurso ? "· " + miCurso : ""}
        </p>
        {session ? (
          <p style={{ margin: "8px 0 0 0", color: "#374151", fontSize: 13 }}>
            Sesión: <strong>{session.fullName}</strong> ({session.email})
          </p>
        ) : null}
      </header>

      {loading ? <p>Cargando datos del estudiante...</p> : null}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 24 }}>
        <Kpi label="Mis notas" value={String(calificaciones.length)} hint={aprobadas + " aprobadas"} accent={accentColor} />
        <Kpi label="Mi presencia" value={pctPresencia + "%"} hint={presentes + "/" + totalAsistencia + " días"} accent={accentColor} />
        <Kpi label="Mis horas" value={String(horarios.length)} hint="franjas en horario" accent={accentColor} />
      </div>

      <Section title="Mis calificaciones" color={accentColor}>
        {calificaciones.length === 0 ? (
          <Empty text="Aún no hay notas publicadas." />
        ) : (
          <SimpleTable
            rows={calificaciones}
            cols={[
              { key: "asignatura", label: "Asignatura" },
              { key: "periodo", label: "Periodo" },
              { key: "tipoEvaluacion", label: "Tipo" },
              { key: "nota", label: "Nota" },
              { key: "observaciones", label: "Observaciones" },
            ]}
          />
        )}
      </Section>

      <Section title="Mi asistencia (últimas)" color={accentColor}>
        {asistencia.length === 0 ? (
          <Empty text="Sin registros de asistencia todavía." />
        ) : (
          <SimpleTable
            rows={asistencia.slice(0, 10)}
            cols={[
              { key: "fecha", label: "Fecha" },
              { key: "curso", label: "Curso" },
              { key: "estado", label: "Estado" },
              { key: "motivo", label: "Motivo" },
            ]}
          />
        )}
      </Section>

      <Section title="Mi horario" color={accentColor}>
        {horarios.length === 0 ? (
          <Empty text="No tenemos horario asignado a tu curso todavía." />
        ) : (
          <SimpleTable
            rows={horarios}
            cols={[
              { key: "diaSemana", label: "Día" },
              { key: "horaInicio", label: "Inicio" },
              { key: "horaFin", label: "Fin" },
              { key: "asignatura", label: "Asignatura" },
              { key: "docente", label: "Docente" },
              { key: "aula", label: "Aula" },
            ]}
          />
        )}
      </Section>
    </main>
  );
}

function Kpi({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent: string }) {
  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 14, background: "#ffffff" }}>
      <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: accent, marginTop: 4 }}>{value}</div>
      {hint ? <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{hint}</div> : null}
    </div>
  );
}

function Section({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", margin: "0 0 12px 0", borderLeft: "4px solid " + color, paddingLeft: 10 }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p style={{ color: "#6b7280", fontSize: 14, margin: 0, padding: 12, background: "#f9fafb", borderRadius: 8 }}>{text}</p>;
}

function SimpleTable({ rows, cols }: { rows: Row[]; cols: Array<{ key: string; label: string }> }) {
  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden", background: "#ffffff" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
            {cols.map((c) => (
              <th key={c.key} style={{ textAlign: "left", padding: "8px 12px", fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.4 }}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={String(r.id || i)} style={{ borderBottom: "1px solid #f3f4f6" }}>
              {cols.map((c) => (
                <td key={c.key} style={{ padding: "10px 12px" }}>
                  {String(r[c.key] || "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
