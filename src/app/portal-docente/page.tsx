"use client";

import { useEffect, useState } from "react";

/**
 * Portal del docente (SCHOOL-07).
 *
 * Filtra por session.fullName == campo docente de cada módulo. Pensado
 * para cuentas con rol=docente, aunque cualquier usuario puede acceder
 * y ve la info que coincida con su nombre.
 */
type Row = Record<string, string>;

export default function PortalDocentePage() {
  const [session, setSession] = useState<{ fullName: string; email: string; role: string } | null>(null);
  const [horarios, setHorarios] = useState<Row[]>([]);
  const [planeaciones, setPlaneaciones] = useState<Row[]>([]);
  const [calificaciones, setCalificaciones] = useState<Row[]>([]);
  const [tenantName, setTenantName] = useState("Centro educativo");
  const [accentColor, setAccentColor] = useState("#7c3aed");
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
        const [hRes, pRes, cRes] = await Promise.all([
          fetch("/api/erp/module?module=horarios", { cache: "no-store" }),
          fetch("/api/erp/module?module=planeaciones", { cache: "no-store" }),
          fetch("/api/erp/module?module=calificaciones", { cache: "no-store" }),
        ]);
        const hData = await hRes.json();
        const pData = await pRes.json();
        const cData = await cRes.json();
        if (cancelled) return;
        const filterByDocente = (arr: Row[]) =>
          me ? arr.filter((r) => String(r.docente || "").trim().toLowerCase() === me) : arr;
        setHorarios(filterByDocente(Array.isArray(hData?.rows) ? hData.rows : []));
        setPlaneaciones(filterByDocente(Array.isArray(pData?.rows) ? pData.rows : []));
        setCalificaciones(Array.isArray(cData?.rows) ? cData.rows : []);
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

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: 24, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <header style={{ marginBottom: 24, borderBottom: "1px solid #e5e7eb", paddingBottom: 16 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: accentColor, margin: 0 }}>{tenantName}</h1>
        <p style={{ margin: "4px 0 0 0", color: "#6b7280", fontSize: 14 }}>Portal del docente</p>
        {session ? (
          <p style={{ margin: "8px 0 0 0", color: "#374151", fontSize: 13 }}>
            Sesión: <strong>{session.fullName}</strong> ({session.email}) · Rol: {session.role || "—"}
          </p>
        ) : null}
      </header>

      {loading ? <p>Cargando datos del docente...</p> : null}

      <Section title="Mi horario semanal" color={accentColor}>
        {horarios.length === 0 ? (
          <Empty text="No tienes horario asignado todavía. Tu coordinador puede asignártelo desde /horarios." />
        ) : (
          <SimpleTable
            rows={horarios}
            cols={[
              { key: "diaSemana", label: "Día" },
              { key: "horaInicio", label: "Inicio" },
              { key: "horaFin", label: "Fin" },
              { key: "asignatura", label: "Asignatura" },
              { key: "curso", label: "Curso" },
              { key: "aula", label: "Aula" },
            ]}
          />
        )}
      </Section>

      <Section title="Mis planeaciones" color={accentColor}>
        {planeaciones.length === 0 ? (
          <Empty text="No tienes planeaciones registradas. Crea una desde /planeaciones." />
        ) : (
          <SimpleTable
            rows={planeaciones}
            cols={[
              { key: "asignatura", label: "Asignatura" },
              { key: "curso", label: "Curso" },
              { key: "periodo", label: "Periodo" },
              { key: "estado", label: "Estado" },
            ]}
          />
        )}
      </Section>

      <Section title="Calificaciones recientes" color={accentColor}>
        {calificaciones.length === 0 ? (
          <Empty text="No hay calificaciones registradas todavía." />
        ) : (
          <SimpleTable
            rows={calificaciones.slice(0, 10)}
            cols={[
              { key: "alumno", label: "Alumno" },
              { key: "asignatura", label: "Asignatura" },
              { key: "periodo", label: "Periodo" },
              { key: "tipoEvaluacion", label: "Tipo" },
              { key: "nota", label: "Nota" },
            ]}
          />
        )}
        <p style={{ marginTop: 12, fontSize: 13 }}>
          <a href="/calificaciones" style={{ color: accentColor, fontWeight: 600 }}>
            Ir a /calificaciones para registrar nuevas notas →
          </a>
        </p>
      </Section>
    </main>
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
