"use client";

import { useEffect, useState } from "react";

/**
 * Portal del cliente final (SF-11).
 *
 * Pensado para cuentas con rol=clienteFinal: ven SOLO sus propios
 * justificantes y pueden descargar el PDF. Sin acceso al resto del ERP.
 *
 * Filtrado actual (MVP): match exacto entre `session.fullName` y el
 * campo `cliente` del justificante. La convención es que la cuenta
 * clienteFinal se cree con fullName = razón social del cliente
 * registrado en el módulo "clientes" (ej. "Acme Labs"). Ese mismo
 * string aparece como `cliente` en cada justificante emitido.
 *
 * Iteración futura: añadir un campo `clienteVinculadoId` explícito en
 * TenantAccount para que el match no dependa del nombre.
 *
 * Esta página es accesible para cualquier rol (no la cierra para que
 * el operador la pueda inspeccionar), pero filtra por session.fullName.
 * Para cuentas no clienteFinal, el filtrado dará lista completa si
 * fullName coincide con algún cliente, o vacío si no.
 */

type Justificante = Record<string, string>;

type DashboardResponse = {
  ok?: boolean;
  tenant?: {
    displayName?: string;
    accentColor?: string;
  };
};

type SessionInfo = {
  fullName: string;
  email: string;
  role: string;
};

export default function PortalClienteJustificantesPage() {
  const [items, setItems] = useState<Justificante[]>([]);
  const [tenantName, setTenantName] = useState("Tu portal");
  const [accentColor, setAccentColor] = useState("#1d4ed8");
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // 1. Obtenemos branding básico del tenant.
        const dashRes = await fetch("/api/runtime/dashboard", { cache: "no-store" });
        const dashData = (await dashRes.json()) as DashboardResponse;
        if (!cancelled && dashData?.ok && dashData.tenant) {
          setTenantName(dashData.tenant.displayName || "Tu portal");
          if (dashData.tenant.accentColor) setAccentColor(dashData.tenant.accentColor);
        }

        // 2. Obtenemos info de la sesión actual.
        const sessionRes = await fetch("/api/runtime/session", { cache: "no-store" });
        const sessionData = await sessionRes.json();
        const sessionUser = sessionData?.session || null;
        if (!cancelled && sessionData?.ok && sessionUser) {
          setSession({
            fullName: String(sessionUser.fullName || ""),
            email: String(sessionUser.email || ""),
            role: String(sessionUser.role || ""),
          });
        }

        // 3. Cargamos los justificantes.
        const justRes = await fetch("/api/erp/module?module=justificantes", {
          cache: "no-store",
        });
        const justData = await justRes.json();
        if (!cancelled && justRes.ok && justData?.ok) {
          const all = (justData.rows || []) as Justificante[];
          // Filtrado por nombre del cliente vinculado a la cuenta.
          const filterName = String(sessionUser?.fullName || "")
            .trim()
            .toLowerCase();
          const filtered =
            sessionUser?.role === "clienteFinal" && filterName
              ? all.filter(
                  (j) =>
                    String(j.cliente || "").trim().toLowerCase() === filterName,
                )
              : all;
          setItems(filtered);
        } else if (!cancelled) {
          setError(justData?.error || "No se pudo cargar la lista.");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Error inesperado.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function buildPdfUrl(j: Justificante): string {
    const params = new URLSearchParams({
      numero: String(j.numero || ""),
      proyecto: String(j.proyecto || ""),
      fecha: String(j.fecha || ""),
      horas: String(j.horas || ""),
      trabajos: String(j.trabajos || ""),
      estado: String(j.estado || ""),
      personaResponsable: String(j.personaResponsable || ""),
      personaCliente: String(j.personaCliente || ""),
      version: String(j.version || ""),
      notas: String(j.notas || ""),
    });
    return "/api/erp/justificante-pdf?" + params.toString();
  }

  return (
    <main
      style={{
        maxWidth: 980,
        margin: "0 auto",
        padding: 24,
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <header style={{ marginBottom: 24, borderBottom: "1px solid #e5e7eb", paddingBottom: 16 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: accentColor, margin: 0 }}>
          {tenantName}
        </h1>
        <p style={{ margin: "4px 0 0 0", color: "#6b7280", fontSize: 14 }}>
          Portal del cliente · Justificantes
        </p>
        {session ? (
          <p style={{ margin: "8px 0 0 0", color: "#374151", fontSize: 13 }}>
            Sesión: <strong>{session.fullName}</strong> ({session.email})
            {session.role === "clienteFinal" ? " · Cliente" : " · Operador"}
          </p>
        ) : null}
      </header>

      {error ? (
        <div
          style={{
            border: "1px solid #fecaca",
            background: "#fef2f2",
            color: "#991b1b",
            borderRadius: 8,
            padding: 12,
            marginBottom: 16,
          }}
        >
          {error}
        </div>
      ) : null}

      {loading ? (
        <p style={{ color: "#6b7280" }}>Cargando justificantes...</p>
      ) : items.length === 0 ? (
        <p style={{ color: "#6b7280" }}>
          Aún no tienes justificantes asociados. Cuando se emita uno a tu nombre,
          aparecerá aquí con un enlace para descargarlo.
        </p>
      ) : (
        <section
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            overflow: "hidden",
            background: "#ffffff",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                <th style={{ textAlign: "left", padding: "10px 14px", fontSize: 12, color: "#6b7280" }}>Nº</th>
                <th style={{ textAlign: "left", padding: "10px 14px", fontSize: 12, color: "#6b7280" }}>Proyecto</th>
                <th style={{ textAlign: "left", padding: "10px 14px", fontSize: 12, color: "#6b7280" }}>Fecha</th>
                <th style={{ textAlign: "right", padding: "10px 14px", fontSize: 12, color: "#6b7280" }}>Horas</th>
                <th style={{ textAlign: "right", padding: "10px 14px", fontSize: 12, color: "#6b7280" }}>PDF</th>
              </tr>
            </thead>
            <tbody>
              {items.map((j) => (
                <tr key={String(j.id || j.numero)} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "10px 14px", fontWeight: 600 }}>{String(j.numero || "—")}</td>
                  <td style={{ padding: "10px 14px" }}>{String(j.proyecto || "—")}</td>
                  <td style={{ padding: "10px 14px" }}>{String(j.fecha || "—")}</td>
                  <td style={{ padding: "10px 14px", textAlign: "right" }}>{String(j.horas || "—")}</td>
                  <td style={{ padding: "10px 14px", textAlign: "right" }}>
                    <a
                      href={buildPdfUrl(j)}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        border: "1px solid " + accentColor,
                        borderRadius: 6,
                        padding: "5px 10px",
                        fontSize: 12,
                        fontWeight: 700,
                        color: accentColor,
                        textDecoration: "none",
                      }}
                    >
                      ↓ PDF
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}
