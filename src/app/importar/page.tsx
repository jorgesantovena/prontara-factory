"use client";

import { useState } from "react";

/**
 * Importador inteligente Excel/CSV (H6-IMPORT).
 *
 * 4 pasos:
 *   1. Subir archivo
 *   2. Confirmar moduleKey
 *   3. Revisar mapeo sugerido (columna → fieldKey)
 *   4. Importar y ver resumen
 */
type Step = 1 | 2 | 3 | 4;

type FileData = {
  name: string;
  headers: string[];
  rows: Record<string, string>[];
};

type Suggestion = {
  moduleKey: string;
  moduleConfidence: number;
  mapping: Record<string, string>;
  mappingConfidence: number;
  availableFields: Array<{ fieldKey: string; label: string }>;
};

const COMMON_MODULES = [
  "clientes", "facturacion", "presupuestos", "productos", "proyectos",
  "tareas", "tickets", "compras", "caja", "bodegas", "kardex", "documentos", "reservas",
];

export default function ImportarPage() {
  const [step, setStep] = useState<Step>(1);
  const [file, setFile] = useState<FileData | null>(null);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [moduleKey, setModuleKey] = useState("");
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ created: number; failed: number; errors: string[] } | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    setError("");
    try {
      const text = await f.text();
      const parsed = parseCSV(text);
      if (parsed.headers.length === 0) {
        setError("No se detectaron columnas. ¿Es CSV válido?");
        return;
      }
      setFile({ name: f.name, headers: parsed.headers, rows: parsed.rows });

      const r = await fetch("/api/runtime/import/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: f.name, headers: parsed.headers }),
      });
      const data = await r.json();
      if (r.ok && data.ok) {
        setSuggestion(data);
        setModuleKey(data.moduleKey);
        setMapping(data.mapping);
        setStep(2);
      } else {
        setError(data.error || "Error sugiriendo mapeo.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error leyendo archivo.");
    } finally {
      setBusy(false);
    }
  }

  async function refreshSuggestion(newModule: string) {
    if (!file) return;
    setBusy(true);
    try {
      const r = await fetch("/api/runtime/import/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, headers: file.headers, moduleKey: newModule }),
      });
      const data = await r.json();
      if (r.ok && data.ok) {
        setSuggestion(data);
        setMapping(data.mapping);
      }
    } finally {
      setBusy(false);
    }
  }

  async function doImport() {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/runtime/import/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleKey, rows: file.rows, mapping }),
      });
      const data = await r.json();
      if (r.ok && data.ok) {
        setResult({ created: data.created, failed: data.failed, errors: data.errors });
        setStep(4);
      } else {
        setError(data.error || "Error importando.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: 24, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, color: "#0f172a", margin: "0 0 8px 0" }}>Importar desde Excel/CSV</h1>
      <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 20 }}>
        Sube tu archivo, te sugerimos en qué módulo va y cómo mapear las columnas. Tú confirmas y se importa.
      </p>

      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        {[1, 2, 3, 4].map((n) => (
          <div key={n} style={{
            flex: 1,
            padding: 10,
            borderRadius: 6,
            background: step >= n ? "#1d4ed8" : "#e5e7eb",
            color: step >= n ? "#ffffff" : "#475569",
            fontSize: 12,
            fontWeight: 700,
            textAlign: "center",
          }}>
            {n}. {["Subir", "Módulo", "Mapeo", "Resumen"][n - 1]}
          </div>
        ))}
      </div>

      {error ? <div style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 13 }}>{error}</div> : null}

      {step === 1 ? (
        <section style={{ border: "2px dashed #cbd5e1", borderRadius: 12, padding: 32, background: "#f8fafc", textAlign: "center" }}>
          <p style={{ color: "#475569" }}>Selecciona un archivo CSV (UTF-8, separador coma o punto-y-coma).</p>
          <input type="file" accept=".csv,.txt" onChange={handleFile} disabled={busy} style={{ marginTop: 10 }} />
          <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 16 }}>
            Para Excel: en Excel haz "Guardar como" → CSV UTF-8 antes de subir.
          </p>
        </section>
      ) : null}

      {step === 2 && suggestion && file ? (
        <section style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 18, background: "#ffffff" }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginTop: 0 }}>Confirma el módulo destino</h2>
          <p style={{ color: "#6b7280", fontSize: 13 }}>
            Detectamos <code>{suggestion.moduleKey}</code> ({Math.round(suggestion.moduleConfidence * 100)}% confianza).
            Si no es correcto, cámbialo:
          </p>
          <select
            value={moduleKey}
            onChange={(e) => { setModuleKey(e.target.value); refreshSuggestion(e.target.value); }}
            style={{ padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14, marginTop: 8 }}
          >
            {COMMON_MODULES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <div style={{ marginTop: 12, fontSize: 13, color: "#475569" }}>
            Archivo: <strong>{file.name}</strong> — {file.rows.length} filas, {file.headers.length} columnas
          </div>
          <button type="button" onClick={() => setStep(3)} style={btnPrimary}>Siguiente →</button>
        </section>
      ) : null}

      {step === 3 && suggestion && file ? (
        <section style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 18, background: "#ffffff" }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginTop: 0 }}>Revisa el mapeo de columnas</h2>
          <p style={{ color: "#6b7280", fontSize: 13 }}>
            Cada columna de tu archivo a qué campo va. Las que no quieras importar, déjalas en "(ignorar)".
          </p>
          <div style={{ display: "grid", gap: 8, marginTop: 16 }}>
            {file.headers.map((h) => (
              <div key={h} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, alignItems: "center" }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{h}</div>
                <select
                  value={mapping[h] || ""}
                  onChange={(e) => setMapping({ ...mapping, [h]: e.target.value })}
                  style={{ padding: "6px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13 }}
                >
                  <option value="">(ignorar)</option>
                  {suggestion.availableFields.map((f) => (
                    <option key={f.fieldKey} value={f.fieldKey}>{f.label} ({f.fieldKey})</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button type="button" onClick={() => setStep(2)} style={btnSecondary}>← Atrás</button>
            <button type="button" onClick={doImport} disabled={busy} style={btnPrimary}>
              {busy ? "Importando…" : "Importar " + file.rows.length + " filas"}
            </button>
          </div>
        </section>
      ) : null}

      {step === 4 && result ? (
        <section style={{ border: "1px solid " + (result.failed > 0 ? "#fde68a" : "#bbf7d0"), borderRadius: 12, padding: 18, background: result.failed > 0 ? "#fffbeb" : "#f0fdf4" }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 12px 0" }}>
            {result.failed > 0 ? "Importación parcial" : "Importación completada"}
          </h2>
          <p style={{ fontSize: 14 }}>
            <strong style={{ color: "#16a34a" }}>{result.created} registros creados</strong>
            {result.failed > 0 ? <> · <strong style={{ color: "#dc2626" }}>{result.failed} fallaron</strong></> : null}
          </p>
          {result.errors.length > 0 ? (
            <details style={{ marginTop: 8 }}>
              <summary style={{ cursor: "pointer", fontSize: 13 }}>Ver errores ({result.errors.length})</summary>
              <ul style={{ marginTop: 8, fontSize: 12, color: "#991b1b" }}>
                {result.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </details>
          ) : null}
          <button type="button" onClick={() => { setStep(1); setFile(null); setSuggestion(null); setResult(null); }} style={btnPrimary}>
            Importar otro archivo
          </button>
        </section>
      ) : null}
    </main>
  );
}

/**
 * Parser CSV minimal — soporta separador , o ; y comillas dobles.
 * Para casos complejos, recomendamos pre-convertir el Excel.
 */
function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };
  const sep = (lines[0].match(/;/g) || []).length > (lines[0].match(/,/g) || []).length ? ";" : ",";
  const splitLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
        else inQuote = !inQuote;
      } else if (c === sep && !inQuote) {
        out.push(cur); cur = "";
      } else {
        cur += c;
      }
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };
  const headers = splitLine(lines[0]);
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = splitLine(lines[i]);
    const obj: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = values[j] || "";
    }
    rows.push(obj);
  }
  return { headers, rows };
}

const btnPrimary: React.CSSProperties = {
  marginTop: 16,
  border: "none",
  background: "#1d4ed8",
  color: "#ffffff",
  borderRadius: 8,
  padding: "10px 18px",
  fontWeight: 700,
  fontSize: 14,
  cursor: "pointer",
};

const btnSecondary: React.CSSProperties = {
  marginTop: 16,
  border: "1px solid #d1d5db",
  background: "#ffffff",
  color: "#475569",
  borderRadius: 8,
  padding: "10px 18px",
  fontWeight: 700,
  fontSize: 14,
  cursor: "pointer",
};
