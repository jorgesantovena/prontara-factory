"use client";

import { useEffect, useState } from "react";

/**
 * Portal de la familia (SCHOOL-07).
 *
 * Filtra por session.fullName == campo cliente/familia/alumno (según
 * módulo). Pensado para cuentas con rol=familia. Convención: la cuenta
 * familia se crea con fullName = razón social de la familia (ej.
 * "Familia Romero"). Los alumnos se vinculan a esa familia por su
 * campo `familia` en el módulo clientes.
 */
type Row = Record<string, string>;

export default function PortalFamiliaPage() {
  const [session, setSession] = useState<{ fullName: string; email: string; role: string } | null>(null);
  const [alumnos, setAlumnos] = useState<Row[]>([]);
  const [recibos, setRecibos] = useState<Row[]>([]);
  const [comunicaciones, setComunicaciones] = useState<Row[]>([]);
  const [eventos, setEventos] = useState<Row[]>([]);
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

        const familia = String(u?.fullName || "").trim().toLowerCase();
        const [cRes, fRes, comRes, evRes] = await Promise.all([
          fetch("/api/erp/module?module=clientes", { cache: "no-store" }),
          fetch("/api/erp/module?module=facturacion", { cache: "no-store" }),
          fetch("/api/erp/module?module=comunicaciones", { cache: "no-store" }),
          fetch("/api/erp/module?module=eventos", { cache: "no-store" }),
        ]);
        const cData = await cRes.json();
        const fData = await fRes.json();
        const comData = await comRes.json();
        const evData = await evRes.json();
        if (cancelled) return;

        const allClientes = Array.isArray(cData?.rows) ? cData.rows : [];
        // Alumnos cuya familia coincide
        const misAlumnos = familia
          ? allClientes.filter(
              (c: Row) =>
                String(c.tipo || "").toLowerCase() === "alumno" &&
                String(c.familia || "").trim().toLowerCase() === familia,
            )
          : [];
        setAlumnos(misAlumnos);

        const misRecibos = familia
          ? (Array.isArray(fData?.rows) ? fData.rows : []).filter(
              (r: Row) => String(r.cliente || "").trim().toLowerCase() === familia,
            )
          : [];
        setRecibos(misRecibos);

        // Comunicaciones: lista las recientes (sin filtrar destinatarios — el filtro semántico es complejo)
        setComunicaciones((Array.isArray(comData?.rows) ? comData.rows : []).slice(0, 5));
        setEventos((Array.isArray(evData?.rows) ? evData.rows : []).slice(0, 5));
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

  const recibosVencidos = recibos.filter((r) => {
    const e = String(r.estado || "").toLowerCase();
    return e === "vencida" || e === "vencido" || e === "devuelto";
  });

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: 24, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <header style={{ marginBottom: 24, borderBottom: "1px solid #e5e7eb", paddingBottom: 16 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: accentColor, margin: 0 }}>{tenantName}</h1>
        <p style={{ margin: "4px 0 0 0", color: "#6b7280", fontSize: 14 }}>Portal de familia</p>
        {session ? (
          <p style={{ margin: "8px 0 0 0", color: "#374151", fontSize: 13 }}>
            Sesión: <strong>{session.fullName}</strong> ({session.email})
          </p>
        ) : null}
      </header>

      {loading ? <p>Cargando información de la familia...</p> : null}

      {recibosVencidos.length > 0 ? (
        <div style={{ border: "1px solid #fecaca", background: "#fef2f2", borderRadius: 8, padding: 12, marginBottom: 20 }}>
          <strong style={{ color: "#991b1b" }}>Atención:</strong> tienes {recibosVencidos.length} recibo(s) vencido(s).
          Por favor regulariza desde /facturacion o contacta con secretaría.
        </div>
      ) : null}

      <Section title="Mis alumnos" color={accentColor}>
        {alumnos.length === 0 ? (
          <Empty text="No tenemos alumnos vinculados a tu cuenta. Contacta con secretaría si esto es un error." />
        ) : (
          <SimpleTable
            rows={alumnos}
            cols={[
              { key: "nombre", label: "Nombre" },
              { key: "curso", label: "Curso" },
              { key: "fecha_nacimiento", label: "F. nacimiento" },
              { key: "estado", label: "Estado" },
            ]}
          />
        )}
      </Section>

      <Section title="Mis recibos" color={accentColor}>
        {recibos.length === 0 ? (
          <Empty text="No hay recibos registrados a tu nombre." />
        ) : (
          <SimpleTable
            rows={recibos.slice(0, 12)}
            cols={[
              { key: "numero", label: "Nº" },
              { key: "concepto", label: "Concepto" },
              { key: "importe", label: "Importe" },
              { key: "estado", label: "Estado" },
            ]}
          />
        )}
      </Section>

      <Section title="Comunicaciones recientes" color={accentColor}>
        {comunicaciones.length === 0 ? (
          <Empty text="Sin comunicaciones recientes." />
        ) : (
          <SimpleTable
            rows={comunicaciones}
            cols={[
              { key: "asunto", label: "Asunto" },
              { key: "destinatarios", label: "Destinatarios" },
              { key: "fechaEnvio", label: "Enviado" },
              { key: "canal", label: "Canal" },
            ]}
          />
        )}
      </Section>

      <Section title="Próximos eventos" color={accentColor}>
        {eventos.length === 0 ? (
          <Empty text="Sin eventos próximos." />
        ) : (
          <SimpleTable
            rows={eventos}
            cols={[
              { key: "titulo", label: "Evento" },
              { key: "fechaInicio", label: "Cuándo" },
              { key: "tipo", label: "Tipo" },
              { key: "alcance", label: "Alcance" },
            ]}
          />
        )}
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
