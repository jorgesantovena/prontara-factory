"use client";

import { useEffect, useState } from "react";
import TenantShell from "@/components/erp/tenant-shell";

/**
 * Parte de Servicios — Pedro 22-06.
 *
 * Elige Cliente + Mes y genera el "Parte de Servicios" (estado de cuenta) en
 * PDF: tabla de tareas del periodo, total de tiempo y firmas. Es el documento
 * que se envía al cliente.
 */
export default function ParteServiciosPage() {
  const [clientes, setClientes] = useState<Array<{ value: string; label: string }>>([]);
  const [cliente, setCliente] = useState("");
  const [mes, setMes] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/erp/options?module=clientes", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (d?.ok && Array.isArray(d.options)) setClientes(d.options); })
      .catch(() => undefined);
    if (!mes) setMes(new Date().toISOString().slice(0, 7));
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  function generar() {
    setError("");
    if (!cliente) { setError("Elige un cliente."); return; }
    const params = new URLSearchParams({ cliente, periodo: mes });
    window.open("/api/erp/parte-servicios-pdf?" + params.toString(), "_blank");
  }

  return (
    <TenantShell>
      <div style={{ maxWidth: 900, margin: "0 auto", fontFamily: "system-ui, -apple-system, sans-serif" }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", margin: "0 0 8px 0" }}>Parte de Servicios</h1>
        <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 16 }}>
          Documento de estado de cuenta para enviar al cliente: los trabajos del mes (Trabajador, Fecha, Tiempo, Proyecto, Asunto y Observaciones), con el total de tiempo y firmas.
        </p>

        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16, flexWrap: "wrap", padding: 14, border: "1px solid #e5e7eb", background: "#f8fafc", borderRadius: 8 }}>
          <label style={{ fontSize: 12, color: "#475569", fontWeight: 700 }}>Cliente:</label>
          <select value={cliente} onChange={(e) => setCliente(e.target.value)} style={ipt}>
            <option value="">Selecciona…</option>
            {clientes.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <label style={{ fontSize: 12, color: "#475569", fontWeight: 700, marginLeft: 12 }}>Mes:</label>
          <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} style={ipt} />
          <button type="button" onClick={generar} style={btnPrimary}>Generar parte (PDF)</button>
        </div>

        {error ? <div style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", borderRadius: 8, padding: 12, fontSize: 13 }}>{error}</div> : null}
      </div>
    </TenantShell>
  );
}

const ipt: React.CSSProperties = { padding: "6px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13 };
const btnPrimary: React.CSSProperties = { padding: "6px 14px", border: "1px solid #1d4ed8", background: "#2563eb", color: "#fff", borderRadius: 6, fontSize: 13, cursor: "pointer", fontWeight: 700, marginLeft: "auto" };
