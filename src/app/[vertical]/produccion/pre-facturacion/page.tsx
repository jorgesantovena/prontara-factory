"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import TenantShell from "@/components/erp/tenant-shell";

/**
 * Pre-facturación — Facturación.pptx (Pedro).
 *
 * Una línea por contrato. Columnas:
 *   Contrato | Cliente | Nivel | Modelo | Periodo | Bolsa | Horas |
 *   Cubiertas | Exceso | Importe | Exceso € | Acciones
 *
 * Filtro por periodo (YYYY-MM) + tipo (Mensual/Trimestral/Anual/
 * Discreto) + estado (Pendientes / Prefacturados / Todos).
 */
type Linea = {
  cliente: string;
  contrato: string;
  nivel: string;
  modelo: string;
  periodo: string;
  bolsaContratada: number;
  hPeriodo: number;
  hFacturable: number;
  hCubiertasPorCuota: number;
  hExceso: number;
  hGastadasAnteriores: number;
  hImputadasCliente: number;
  hOtrasFacturadas: number;
  saldoBolsa: number;
  hAFacturar: number;
  tarifaHora: number;
  importe: number;
  importeExceso: number;
  bolsaConcepto: string;
  tareasIncluidas: number;
  estado: "pendiente" | "prefacturada" | "facturada";
};

type TipoPeriodo = "mensual" | "trimestral" | "anual" | "discreto";

export default function PreFacturacionPage() {
  // TEST-20 G — Pedro: "En Periodo dividir en dos campos: Período (Mensual,
  // Trimestral, Anual, Discreto) y Fecha (mm de aaaa)". El selector controla
  // la ventana temporal y el input de fecha fija la referencia (mm/aaaa).
  // En modo "discreto" la fecha se deshabilita porque el rango lo elige el
  // usuario manualmente más adelante (futuro selector de rango).
  const [tipoPeriodo, setTipoPeriodo] = useState<TipoPeriodo>("mensual");
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
      const params = new URLSearchParams();
      params.set("periodo", periodo);
      params.set("tipoPeriodo", tipoPeriodo);
      const r = await fetch("/api/erp/prefacturacion?" + params.toString(), { cache: "no-store" });
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
  useEffect(() => { load(); }, [periodo, tipoPeriodo]);

  // TEST-17 bis B — Ordenar por alfabético de cliente.
  const visibles = lineas
    .filter((l) => estadoFiltro === "todos" || l.estado === estadoFiltro)
    .slice()
    .sort((a, b) => {
      const ca = String(a.cliente || "").toLowerCase();
      const cb = String(b.cliente || "").toLowerCase();
      return ca < cb ? -1 : ca > cb ? 1 : 0;
    });

  return (
    <TenantShell>
      <div style={{ maxWidth: 1400, margin: "0 auto", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {/* TEST-17 bis B — Pedro: el título decía "Servicios facturables"
          (concepto antiguo), debe ser "Tareas facturables". */}
      <h1 style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", margin: "0 0 8px 0" }}>Tareas facturables</h1>
      <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 16 }}>
        Pre-facturación del periodo. Una línea por contrato: Cuotas (importe fijo), Horas (h × precio) y Bonos (compra puntual). El exceso sobre la bolsa se factura aparte.
      </p>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
        <label style={{ fontSize: 12, color: "#475569", fontWeight: 700 }}>Período:</label>
        <select
          value={tipoPeriodo}
          onChange={(e) => setTipoPeriodo(e.target.value as TipoPeriodo)}
          style={ipt}
        >
          <option value="mensual">Mensual</option>
          <option value="trimestral">Trimestral</option>
          <option value="anual">Anual</option>
          <option value="discreto">Discreto</option>
        </select>
        <label style={{ fontSize: 12, color: "#475569", fontWeight: 700, marginLeft: 12 }}>Fecha:</label>
        <input
          type="month"
          value={periodo}
          onChange={(e) => setPeriodo(e.target.value)}
          disabled={tipoPeriodo === "discreto"}
          style={{ ...ipt, opacity: tipoPeriodo === "discreto" ? 0.5 : 1 }}
          title={tipoPeriodo === "discreto" ? "En modo Discreto el rango se elegirá manualmente" : "Mes y año de referencia"}
        />
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
              <Th>Contrato</Th>
              <Th>Cliente</Th>
              <Th>Nivel</Th>
              <Th>Modelo</Th>
              <Th>Periodo</Th>
              <Th align="right">Bolsa</Th>
              <Th align="right">Horas</Th>
              <Th align="right">Cubiertas</Th>
              <Th align="right">Exceso</Th>
              <Th align="right">Saldo</Th>
              <Th align="right">Importe</Th>
              <Th align="right">Exceso €</Th>
              <Th>Acciones</Th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((l) => (
              <tr key={l.contrato + "-" + l.cliente} style={{ borderTop: "1px solid #f1f5f9" }}>
                <Td><strong>{l.contrato}</strong></Td>
                <Td>{l.cliente}</Td>
                <Td>{l.nivel}</Td>
                <Td style={{ textTransform: "capitalize" }}>{l.modelo}</Td>
                <Td style={{ textTransform: "capitalize" }}>{l.periodo}</Td>
                <Td align="right">{l.bolsaContratada.toFixed(2)}</Td>
                <Td align="right" style={{ color: "#1d4ed8", fontWeight: 700 }}>{l.hFacturable.toFixed(2)}</Td>
                <Td align="right">{l.hCubiertasPorCuota.toFixed(2)}</Td>
                <Td align="right" style={{ color: l.hExceso > 0 ? "#dc2626" : "#94a3b8", fontWeight: l.hExceso > 0 ? 700 : 400 }}>{l.hExceso.toFixed(2)}</Td>
                <Td align="right" style={{ color: l.saldoBolsa > 0 ? "#16a34a" : "#dc2626", fontWeight: 700 }}>{l.saldoBolsa.toFixed(2)}</Td>
                <Td align="right" style={{ fontWeight: 700 }}>{l.importe.toFixed(2)} €</Td>
                <Td align="right" style={{ color: l.importeExceso > 0 ? "#dc2626" : "#94a3b8", fontWeight: l.importeExceso > 0 ? 700 : 400 }}>{l.importeExceso > 0 ? l.importeExceso.toFixed(2) + " €" : "—"}</Td>
                <Td>
                  <Link
                    href={"/api/erp/detalle-servicios-pdf?cliente=" + encodeURIComponent(l.cliente) + "&periodo=" + periodo + "&contrato=" + encodeURIComponent(l.contrato)}
                    target="_blank"
                    style={{ fontSize: 10, color: "#1d4ed8", fontWeight: 700, textDecoration: "none", border: "1px solid #cbd5e1", padding: "3px 8px", borderRadius: 4 }}
                  >
                    PDF
                  </Link>
                </Td>
              </tr>
            ))}
            {visibles.length === 0 && !loading ? (
              <tr><td colSpan={13} style={{ padding: 32, textAlign: "center", color: "#94a3b8" }}>Sin contratos con actividad este periodo.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
      </div>
    </TenantShell>
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
