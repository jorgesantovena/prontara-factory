"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * Pre-facturación estilo SISPYME (H7-S2).
 *
 * Tabla con 8 columnas: cliente | bolsa | H. Periodo | H. Fact | H. contra Cuota |
 * H. Gast. anteriores | H. Imp. Cliente | H. Otras Fact | A Facturar | Importe.
 * Filtro por periodo (YYYY-MM) y por estado (Pendientes / Prefacturados / Todos).
 */
type Linea = {
  cliente: string;
  bolsaConcepto: string;
  bolsaContratada: number;
  hPeriodo: number;
  hFacturable: number;
  hContraCuota: number;
  hFueraBolsa: number;
  hGastadasAnteriores: number;
  hImputadasCliente: number;
  hOtrasFacturadas: number;
  saldo: number;
  hAFacturar: number;
  tarifaHora: number;
  importe: number;
  tareasIncluidas: number;
  estado: "pendiente" | "prefacturada" | "facturada";
};

export default function PreFacturacionPage() {
  const [periodo, setPeriodo] = useState(new Date().toISOString().slice(0, 7));
  const [estadoFiltro, setEstadoFiltro] = useState<"pendiente" | "prefacturada" | "todos">("todos");
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [totales, setTotales] = useState<{ clientesActivos: number; horasPeriodo: number; importe: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/erp/prefacturacion?periodo=" + encodeURIComponent(periodo), { cache: "no-store" });
      const data = await r.json();
      if (r.ok && data.ok) {
        setLineas((data.lineas || []) as Linea[]);
        setTotales(data.totales);
      } else {
        setError(data.error || "Error.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, [periodo]);

  const visibles = lineas.filter((l) => estadoFiltro === "todos" || l.estado === estadoFiltro);

  return (
    <main style={{ maxWidth: 1400, margin: "0 auto", padding: 24, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", margin: "0 0 8px 0" }}>Servicios facturables</h1>
      <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 16 }}>
        Pre-facturación del periodo. Compara horas trabajadas, contra cuota y a facturar para cada cliente.
      </p>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
        <label style={{ fontSize: 12, color: "#475569", fontWeight: 700 }}>Periodo:</label>
        <input type="month" value={periodo} onChange={(e) => setPeriodo(e.target.value)} style={ipt} />
        <label style={{ fontSize: 12, color: "#475569", fontWeight: 700, marginLeft: 12 }}>Estado:</label>
        <select value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value as typeof estadoFiltro)} style={ipt}>
          <option value="todos">Todos</option>
          <option value="pendiente">Pendientes</option>
          <option value="prefacturada">Prefacturados</option>
        </select>
        <button type="button" onClick={load} style={btn}>↻ Recargar</button>
      </div>

      {error ? <div style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 13 }}>{error}</div> : null}
      {loading ? <p>Cargando…</p> : null}

      {totales ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
          <Kpi label="Clientes con actividad" value={String(totales.clientesActivos)} accent="#1d4ed8" />
          <Kpi label="Horas periodo" value={totales.horasPeriodo.toFixed(2)} accent="#0891b2" />
          <Kpi label="A facturar" value={totales.importe.toFixed(2) + " €"} accent="#16a34a" />
        </div>
      ) : null}

      <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 8, background: "#ffffff" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead style={{ background: "#f8fafc" }}>
            <tr>
              <Th>Cliente</Th>
              <Th>Bolsa</Th>
              <Th align="right">H. Periodo</Th>
              <Th align="right">H. Fact</Th>
              <Th align="right">H. contra C.</Th>
              <Th align="right">H. Gast. ant.</Th>
              <Th align="right">H. Imp. C.</Th>
              <Th align="right">H. Otras Fact</Th>
              <Th align="right">Saldo</Th>
              <Th align="right">A Facturar</Th>
              <Th align="right">Importe</Th>
              <Th>Acciones</Th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((l) => (
              <tr key={l.cliente} style={{ borderTop: "1px solid #f1f5f9" }}>
                <Td><strong>{l.cliente}</strong></Td>
                <Td><span style={{ fontSize: 10, color: "#6b7280" }}>{l.bolsaConcepto}</span><br />{l.bolsaContratada}h/año</Td>
                <Td align="right">{l.hPeriodo.toFixed(2)}</Td>
                <Td align="right" style={{ color: "#1d4ed8", fontWeight: 700 }}>{l.hFacturable.toFixed(2)}</Td>
                <Td align="right">{l.hContraCuota.toFixed(2)}</Td>
                <Td align="right">{l.hGastadasAnteriores.toFixed(2)}</Td>
                <Td align="right">{l.hImputadasCliente.toFixed(2)}</Td>
                <Td align="right">{l.hOtrasFacturadas.toFixed(2)}</Td>
                <Td align="right" style={{ color: l.saldo > 0 ? "#16a34a" : "#dc2626", fontWeight: 700 }}>{l.saldo.toFixed(2)}</Td>
                <Td align="right" style={{ color: "#16a34a", fontWeight: 700 }}>{l.hAFacturar.toFixed(2)}</Td>
                <Td align="right" style={{ fontWeight: 700 }}>{l.importe.toFixed(2)} €</Td>
                <Td>
                  <Link
                    href={"/api/erp/detalle-servicios-pdf?cliente=" + encodeURIComponent(l.cliente) + "&periodo=" + periodo}
                    target="_blank"
                    style={{ fontSize: 10, color: "#1d4ed8", fontWeight: 700, textDecoration: "none", border: "1px solid #cbd5e1", padding: "3px 8px", borderRadius: 4 }}
                  >
                    PDF
                  </Link>
                </Td>
              </tr>
            ))}
            {visibles.length === 0 && !loading ? (
              <tr><td colSpan={12} style={{ padding: 32, textAlign: "center", color: "#94a3b8" }}>Sin actividad este periodo.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </main>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: "left" | "right" }) {
  return <th style={{ padding: "8px 10px", textAlign: align || "left", fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: 0.4 }}>{children}</th>;
}
function Td({ children, align, style }: { children: React.ReactNode; align?: "left" | "right"; style?: React.CSSProperties }) {
  return <td style={{ padding: "8px 10px", textAlign: align || "left", ...style }}>{children}</td>;
}
function Kpi({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 12, background: "#ffffff" }}>
      <div style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: accent, marginTop: 4 }}>{value}</div>
    </div>
  );
}

const ipt: React.CSSProperties = {
  padding: "6px 10px",
  border: "1px solid #d1d5db",
  borderRadius: 6,
  fontSize: 13,
};
const btn: React.CSSProperties = {
  padding: "6px 12px",
  border: "1px solid #d1d5db",
  background: "#ffffff",
  borderRadius: 6,
  fontSize: 13,
  cursor: "pointer",
  fontWeight: 600,
};
