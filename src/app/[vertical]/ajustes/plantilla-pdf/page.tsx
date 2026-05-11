"use client";

import { useEffect, useState } from "react";

/**
 * Editor de plantilla PDF (H6-PDF-EDITOR).
 *
 * 4 huecos editables por el tenant: logo URL, color primario, pie de
 * factura, mensaje pie, IBAN. Preview en vivo.
 */
type Template = {
  logoUrl: string;
  primaryColor: string;
  pieFactura: string;
  mensajePie: string;
  mostrarBancos: boolean;
  iban: string;
};

export default function PlantillaPdfPage() {
  const [tpl, setTpl] = useState<Template | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [savedHint, setSavedHint] = useState("");

  async function load() {
    const r = await fetch("/api/runtime/pdf-template", { cache: "no-store" });
    const data = await r.json();
    if (r.ok && data.ok) setTpl(data.template as Template);
    else setError(data.error || "Error.");
  }
  useEffect(() => { load(); }, []);

  async function save() {
    if (!tpl) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/runtime/pdf-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tpl),
      });
      const data = await r.json();
      if (r.ok && data.ok) {
        setSavedHint("✓ Guardado");
        setTimeout(() => setSavedHint(""), 1500);
      } else {
        setError(data.error || "Error.");
      }
    } finally {
      setBusy(false);
    }
  }

  if (!tpl) return <main style={{ padding: 24 }}>Cargando…</main>;

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: 24, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, color: "#0f172a", margin: "0 0 8px 0" }}>Plantilla PDF</h1>
      <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 20 }}>
        Personaliza tus facturas y presupuestos con tu logo, color y mensaje. Los cambios se aplican a todos los PDF que generes.
      </p>

      {error ? <div style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 13 }}>{error}</div> : null}
      {savedHint ? <div style={{ border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#166534", borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 13 }}>{savedHint}</div> : null}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <section style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 18, background: "#ffffff" }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 12px 0" }}>Editar</h2>
          <Field label="Logo (URL)">
            <input value={tpl.logoUrl} onChange={(e) => setTpl({ ...tpl, logoUrl: e.target.value })} placeholder="https://…/logo.png" style={ipt} />
          </Field>
          <Field label="Color principal">
            <input type="color" value={tpl.primaryColor} onChange={(e) => setTpl({ ...tpl, primaryColor: e.target.value })} style={{ ...ipt, width: 80, height: 40, padding: 4 }} />
          </Field>
          <Field label="Pie de factura">
            <input value={tpl.pieFactura} onChange={(e) => setTpl({ ...tpl, pieFactura: e.target.value })} placeholder="Razón social · CIF · Dirección" style={ipt} />
          </Field>
          <Field label="Mensaje pie">
            <textarea value={tpl.mensajePie} onChange={(e) => setTpl({ ...tpl, mensajePie: e.target.value })} rows={2} style={{ ...ipt, width: "100%", boxSizing: "border-box" }} />
          </Field>
          <Field label="Mostrar IBAN para transferencia">
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
              <input type="checkbox" checked={tpl.mostrarBancos} onChange={(e) => setTpl({ ...tpl, mostrarBancos: e.target.checked })} />
              Sí
            </label>
          </Field>
          {tpl.mostrarBancos ? (
            <Field label="IBAN">
              <input value={tpl.iban} onChange={(e) => setTpl({ ...tpl, iban: e.target.value })} placeholder="ES12 3456 7890 1234 5678 9012" style={ipt} />
            </Field>
          ) : null}
          <button type="button" onClick={save} disabled={busy} style={{ marginTop: 16, border: "none", background: "#1d4ed8", color: "#ffffff", borderRadius: 8, padding: "10px 18px", fontWeight: 700, fontSize: 14, cursor: busy ? "not-allowed" : "pointer" }}>
            {busy ? "Guardando…" : "Guardar cambios"}
          </button>
        </section>

        <section style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 18, background: "#ffffff" }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 12px 0" }}>Vista previa</h2>
          <div style={{ border: "1px solid " + tpl.primaryColor, borderRadius: 8, padding: 24, background: "#fafafa", minHeight: 480, fontSize: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 24 }}>
              {tpl.logoUrl ? <img src={tpl.logoUrl} alt="logo" style={{ maxHeight: 60 }} /> : <div style={{ background: tpl.primaryColor + "22", color: tpl.primaryColor, padding: "6px 12px", borderRadius: 4, fontWeight: 700 }}>TU LOGO</div>}
              <div style={{ textAlign: "right", color: "#475569", fontSize: 11 }}>FACTURA</div>
            </div>
            <h3 style={{ color: tpl.primaryColor, fontSize: 22, marginBottom: 8 }}>FAC-2026-001</h3>
            <p style={{ color: "#475569", marginBottom: 24 }}>Cliente ejemplo S.L.<br />CIF: B12345678</p>
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24 }}>
              <thead>
                <tr style={{ background: tpl.primaryColor + "11" }}>
                  <th style={{ padding: 8, textAlign: "left", borderBottom: "1px solid " + tpl.primaryColor }}>Concepto</th>
                  <th style={{ padding: 8, textAlign: "right", borderBottom: "1px solid " + tpl.primaryColor }}>Importe</th>
                </tr>
              </thead>
              <tbody>
                <tr><td style={{ padding: 8 }}>Servicio profesional</td><td style={{ padding: 8, textAlign: "right" }}>1.000,00 €</td></tr>
                <tr><td style={{ padding: 8 }}>IVA 21%</td><td style={{ padding: 8, textAlign: "right" }}>210,00 €</td></tr>
                <tr style={{ fontWeight: 700, color: tpl.primaryColor }}><td style={{ padding: 8 }}>Total</td><td style={{ padding: 8, textAlign: "right" }}>1.210,00 €</td></tr>
              </tbody>
            </table>
            {tpl.mostrarBancos && tpl.iban ? (
              <p style={{ fontSize: 11, color: "#475569" }}>Transferencia: <strong>{tpl.iban}</strong></p>
            ) : null}
            <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 24, fontStyle: "italic" }}>{tpl.mensajePie}</p>
            <hr style={{ border: 0, borderTop: "1px solid " + tpl.primaryColor + "44", margin: "16px 0 8px" }} />
            <p style={{ fontSize: 10, color: "#94a3b8", textAlign: "center" }}>{tpl.pieFactura}</p>
          </div>
        </section>
      </div>
    </main>
  );
}

const ipt: React.CSSProperties = {
  padding: "8px 10px",
  border: "1px solid #d1d5db",
  borderRadius: 6,
  fontSize: 13,
  fontFamily: "inherit",
  width: "100%",
  boxSizing: "border-box",
  marginBottom: 4,
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 4, marginBottom: 12 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: "#475569", textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</span>
      {children}
    </label>
  );
}
