"use client";

import { useEffect, useState } from "react";
import TenantShell from "@/components/erp/tenant-shell";

/**
 * Pre-facturación — TEST 19 (Pedro).
 *
 * Diálogo previo con dos parámetros:
 *   - Modelo: Cuota / Horas
 *   - Periodo: Mensual / Trimestral / Semestral / Anual / Discreto
 *
 * Devuelve una línea por contrato. Caso A (Cuota): Importe=Bolsa×Precio.
 * Caso B (Horas, solo Tipo M, Periodo Mensual):
 * Importe = max(0, Consumo − Bolsa − Facturadas) × Precio.
 */
type Linea = {
  caso: "A" | "B";
  contrato: string;
  cliente: string;
  tipoNivel: string;
  subtipo: string;
  periodo: string;
  modelo: "cuota" | "horas";
  bolsa: number;
  precio: number;
  consumo: number;
  facturadas: number;
  horasAFacturar: number;
  importe: number;
  notas: string;
};

type Modelo = "cuota" | "horas" | "desplazamiento";
type Periodo = "mensual" | "trimestral" | "semestral" | "anual" | "discreto";

const PERIODO_LABEL: Record<Periodo, string> = {
  mensual: "Mensual",
  trimestral: "Trimestral",
  semestral: "Semestral",
  anual: "Anual",
  discreto: "Discreto",
};

export default function PreFacturacionPage() {
  const [modelo, setModelo] = useState<Modelo>("cuota");
  const [periodo, setPeriodo] = useState<Periodo>("mensual");
  // Test 19 bis G — Fecha (mes a facturar), formato "YYYY-MM". Se inicializa
  // al mes actual en cliente (en un effect, para no romper la hidratación).
  const [fecha, setFecha] = useState("");
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [totales, setTotales] = useState<{ contratos: number; clientes: number; horasAFacturar: number; importe: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ejecutado, setEjecutado] = useState(false);

  async function ejecutar() {
    setLoading(true);
    setError("");
    setEjecutado(true);
    try {
      const params = new URLSearchParams();
      params.set("modelo", modelo);
      params.set("periodo", periodo);
      if (fecha) params.set("fecha", fecha);
      const r = await fetch("/api/erp/prefacturacion?" + params.toString(), { cache: "no-store" });
      const data = await r.json();
      if (r.ok && data.ok) {
        setLineas((data.lineas || []) as Linea[]);
        setTotales(data.totales);
      } else {
        setError(data.error || "Error.");
        setLineas([]);
        setTotales(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
      setLineas([]);
      setTotales(null);
    } finally {
      setLoading(false);
    }
  }
  // Test 19 bis G — Inicializa la Fecha al mes actual en cliente (en effect,
  // para no romper la hidratación con SSR).
  useEffect(() => { if (!fecha) setFecha(new Date().toISOString().slice(0, 7)); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  // Auto-ejecutar al montar para que se vean líneas por defecto.
  useEffect(() => { ejecutar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  // Pedro 21-06 — El Caso B (excesos) ya NO se limita a Mensual: el periodo
  // elegido acota la ventana de Tareas (N meses hacia atrás). Sin forzado.

  const visibles = lineas
    .slice()
    .sort((a, b) => {
      const ca = String(a.cliente || "").toLowerCase();
      const cb = String(b.cliente || "").toLowerCase();
      return ca < cb ? -1 : ca > cb ? 1 : 0;
    });

  return (
    <TenantShell>
      <div style={{ maxWidth: 1400, margin: "0 auto", fontFamily: "system-ui, -apple-system, sans-serif" }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", margin: "0 0 8px 0" }}>Pre-facturación</h1>
        <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 16 }}>
          {modelo === "cuota"
            ? "Cuotas / Tarifa plana / Mantenimiento contra errores. Una línea por contrato del periodo. El Valor del Nivel es ANUAL: Importe = Valor anual × fracción del periodo (trimestral ¼, semestral ½, anual 1)."
            : "Excesos sobre cuota de mantenimiento (Tipo M). El Consumo es un contador del contrato que se acumula solo con cada Tarea. Importe = (Consumo − Bolsa − Facturadas) × Precio. El periodo acota el detalle por proyecto."}
        </p>

        {/* Diálogo de parámetros (TEST 19 Pedro). */}
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16, flexWrap: "wrap", padding: 14, border: "1px solid #e5e7eb", background: "#f8fafc", borderRadius: 8 }}>
          <label style={{ fontSize: 12, color: "#475569", fontWeight: 700 }}>Modelo:</label>
          <select value={modelo} onChange={(e) => setModelo(e.target.value as Modelo)} style={ipt}>
            <option value="cuota">Cuota</option>
            <option value="horas">Horas (excesos)</option>
            <option value="desplazamiento">Desplazamiento (Km)</option>
          </select>
          <label style={{ fontSize: 12, color: "#475569", fontWeight: 700, marginLeft: 12 }}>Periodo:</label>
          <select
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value as Periodo)}
            style={ipt}
            title="Frecuencia del periodo. En Horas (excesos) acota el detalle por proyecto a N meses hacia atrás (Mensual=1, Trimestral=3, Semestral=6, Anual=12)."
          >
            <option value="mensual">Mensual</option>
            <option value="trimestral">Trimestral</option>
            <option value="semestral">Semestral</option>
            <option value="anual">Anual</option>
            <option value="discreto">Discreto</option>
          </select>
          <label style={{ fontSize: 12, color: "#475569", fontWeight: 700, marginLeft: 12 }}>Fecha (mes):</label>
          <input
            type="month"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            style={ipt}
            title="Mes de referencia (fin de la ventana). En Horas acota el detalle por proyecto a las Tareas de los N meses anteriores según el periodo (el Consumo total es el contador del contrato)."
          />
          <button type="button" onClick={ejecutar} style={btnPrimary} disabled={loading}>
            {loading ? "Calculando…" : "Ejecutar pre-facturación"}
          </button>
        </div>

        {error ? <div style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 13 }}>{error}</div> : null}

        {totales ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
            <Kpi label="Contratos a facturar" value={String(totales.contratos)} accent="#1d4ed8" />
            <Kpi label="Clientes" value={String(totales.clientes)} accent="#0891b2" />
            <Kpi label="Horas a facturar" value={totales.horasAFacturar.toFixed(2)} accent="#a16207" />
            <Kpi label="Importe total" value={totales.importe.toFixed(2) + " €"} accent="#16a34a" />
          </div>
        ) : null}

        <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 8, background: "#ffffff" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead style={{ background: "#f8fafc" }}>
              <tr>
                <Th>Contrato</Th>
                <Th>Cliente</Th>
                <Th>Tipo</Th>
                <Th>Subtipo</Th>
                <Th>Periodo</Th>
                <Th align="right">Bolsa</Th>
                <Th align="right">Precio</Th>
                <Th align="right">{modelo === "horas" ? "Consumo" : ""}</Th>
                <Th align="right">{modelo === "horas" ? "Facturadas" : ""}</Th>
                <Th align="right">{modelo === "horas" ? "Exceso (h)" : "Horas"}</Th>
                <Th align="right">Importe</Th>
                <Th>Notas</Th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((l) => (
                <tr key={l.contrato} style={{ borderTop: "1px solid #f1f5f9" }}>
                  <Td><strong>{l.contrato}</strong></Td>
                  <Td>{l.cliente}</Td>
                  <Td>{l.tipoNivel}</Td>
                  <Td>{l.subtipo}</Td>
                  <Td style={{ textTransform: "capitalize" }}>{PERIODO_LABEL[l.periodo as Periodo] || l.periodo}</Td>
                  <Td align="right">{l.bolsa.toFixed(2)}</Td>
                  <Td align="right">{l.precio.toFixed(2)}</Td>
                  <Td align="right">{modelo === "horas" ? l.consumo.toFixed(2) : ""}</Td>
                  <Td align="right">{modelo === "horas" ? l.facturadas.toFixed(2) : ""}</Td>
                  <Td align="right" style={{ color: modelo === "horas" ? "#dc2626" : "#1d4ed8", fontWeight: 700 }}>{l.horasAFacturar.toFixed(2)}</Td>
                  <Td align="right" style={{ fontWeight: 700, color: "#16a34a" }}>{l.importe.toFixed(2)} €</Td>
                  <Td style={{ color: "#6b7280", fontSize: 11 }}>{l.notas}</Td>
                </tr>
              ))}
              {visibles.length === 0 && !loading && ejecutado ? (
                <tr><td colSpan={12} style={{ padding: 32, textAlign: "center", color: "#94a3b8" }}>{modelo === "horas" ? "Ningún contrato con exceso para emitir." : "Ningún contrato con el periodo seleccionado."}</td></tr>
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

const ipt: React.CSSProperties = { padding: "6px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13 };
const btnPrimary: React.CSSProperties = { padding: "6px 14px", border: "1px solid #1d4ed8", background: "#2563eb", color: "#fff", borderRadius: 6, fontSize: 13, cursor: "pointer", fontWeight: 700, marginLeft: "auto" };
