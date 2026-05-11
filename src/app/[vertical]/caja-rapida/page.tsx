"use client";

import { useState } from "react";

/**
 * Caja rápida (H6-MOBILE).
 *
 * Vista mobile-first pulgar-friendly: una columna, botones grandes,
 * acción dominante "COBRAR". Para uso en mostrador / consulta.
 */
const METODOS = [
  { id: "efectivo", label: "Efectivo", icon: "€" },
  { id: "tarjeta", label: "Tarjeta", icon: "💳" },
  { id: "bizum", label: "Bizum", icon: "📱" },
  { id: "transferencia", label: "Transf.", icon: "🏦" },
];

export default function CajaRapidaPage() {
  const [importe, setImporte] = useState("");
  const [concepto, setConcepto] = useState("");
  const [metodo, setMetodo] = useState("efectivo");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [savedHint, setSavedHint] = useState("");

  function pad(n: string) { setImporte((s) => s + n); }
  function clear() { setImporte(""); }
  function back() { setImporte((s) => s.slice(0, -1)); }

  async function cobrar() {
    if (!importe || Number(importe) <= 0) {
      setError("Indica un importe.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/erp/module", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "create",
          moduleKey: "caja",
          payload: {
            ticket: "T-" + Date.now(),
            concepto: concepto || "Cobro mostrador",
            importe: importe + " EUR",
            metodoPago: metodo,
            fecha: new Date().toISOString().slice(0, 10),
            estado: "cobrado",
          },
        }),
      });
      const data = await r.json();
      if (r.ok && data.ok) {
        setSavedHint("✓ Cobrado " + importe + "€ en " + metodo);
        setImporte("");
        setConcepto("");
        setTimeout(() => setSavedHint(""), 2500);
      } else {
        setError(data.error || "Error.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: 16, fontFamily: "system-ui, -apple-system, sans-serif", background: "#f1f5f9", minHeight: "100vh" }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", margin: "0 0 12px 0", textAlign: "center" }}>Caja rápida</h1>

      {error ? <div style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", borderRadius: 8, padding: 10, marginBottom: 8, fontSize: 13 }}>{error}</div> : null}
      {savedHint ? <div style={{ border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#166534", borderRadius: 8, padding: 10, marginBottom: 8, fontSize: 13, textAlign: "center", fontWeight: 700 }}>{savedHint}</div> : null}

      <div style={{ background: "#ffffff", borderRadius: 12, padding: 16, marginBottom: 12 }}>
        <div style={{ fontSize: 36, fontWeight: 800, color: "#0f172a", textAlign: "right", padding: "12px 16px", background: "#f8fafc", borderRadius: 8, minHeight: 60 }}>
          {importe || "0"} €
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 12 }}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
            <button key={n} type="button" onClick={() => pad(String(n))} style={padBtn}>{n}</button>
          ))}
          <button type="button" onClick={() => pad(".")} style={padBtn}>.</button>
          <button type="button" onClick={() => pad("0")} style={padBtn}>0</button>
          <button type="button" onClick={back} style={{ ...padBtn, background: "#fef3c7", color: "#92400e" }}>←</button>
        </div>
        <button type="button" onClick={clear} style={{ ...padBtn, marginTop: 8, width: "100%", background: "#fee2e2", color: "#991b1b", height: 44 }}>Borrar</button>
      </div>

      <input
        value={concepto}
        onChange={(e) => setConcepto(e.target.value)}
        placeholder="Concepto (opcional)"
        style={{ width: "100%", padding: "12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 16, marginBottom: 12, boxSizing: "border-box" }}
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 12 }}>
        {METODOS.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMetodo(m.id)}
            style={{
              padding: 12,
              border: "2px solid " + (metodo === m.id ? "#1d4ed8" : "#e5e7eb"),
              background: metodo === m.id ? "#eff6ff" : "#ffffff",
              borderRadius: 8,
              fontSize: 11,
              fontWeight: 700,
              color: metodo === m.id ? "#1d4ed8" : "#475569",
              cursor: "pointer",
              minHeight: 64,
            }}
          >
            <div style={{ fontSize: 20, marginBottom: 2 }}>{m.icon}</div>
            {m.label}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={cobrar}
        disabled={busy || !importe}
        style={{
          width: "100%",
          padding: "20px",
          border: "none",
          background: busy || !importe ? "#94a3b8" : "#16a34a",
          color: "#ffffff",
          borderRadius: 12,
          fontSize: 22,
          fontWeight: 800,
          cursor: busy || !importe ? "not-allowed" : "pointer",
          minHeight: 64,
        }}
      >
        {busy ? "Cobrando…" : "COBRAR " + (importe || "0") + " €"}
      </button>
    </main>
  );
}

const padBtn: React.CSSProperties = {
  height: 56,
  border: "1px solid #e5e7eb",
  background: "#ffffff",
  color: "#0f172a",
  borderRadius: 8,
  fontSize: 22,
  fontWeight: 700,
  cursor: "pointer",
};
