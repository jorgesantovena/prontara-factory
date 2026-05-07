"use client";

import { useEffect, useState } from "react";

/**
 * Botón "Emitir mes" para el módulo de facturas del vertical Software
 * Factory (SF-02). Llama a /api/erp/billing-emit, muestra resumen y
 * pide al usuario que recargue para ver las facturas nuevas.
 *
 * Por ahora opera con defaults: mes actual UTC, todos los clientes con
 * horas pendientes. En iteraciones siguientes se puede añadir un panel
 * con selector de mes y cliente concreto.
 */
type EmittedInvoice = {
  cliente: string;
  numero: string;
  importe: number;
  horas: number;
};

type EmitResponse = {
  ok: boolean;
  mes?: string;
  facturas?: EmittedInvoice[];
  totalImporte?: number;
  totalActividadesMarcadas?: number;
  notas?: string[];
  error?: string;
};

function buildPreviousMonth(): string {
  // Default sensible: mes anterior al actual UTC. Es la convención típica de
  // facturación B2B: a primeros de mes se emiten las facturas del mes pasado.
  const now = new Date();
  const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const yyyy = prev.getUTCFullYear();
  const mm = String(prev.getUTCMonth() + 1).padStart(2, "0");
  return yyyy + "-" + mm;
}

export default function EmitMonthlyButton({ onAfterEmit }: { onAfterEmit?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [mes, setMes] = useState<string>(buildPreviousMonth());
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackKind, setFeedbackKind] = useState<"ok" | "error" | "info">("info");
  // SF-18: el botón solo aplica al vertical software-factory (cruza
  // módulo "actividades" inexistente en los demás packs). Hasta que
  // sepamos el businessType del tenant logueado, no renderizamos nada
  // para evitar el flash de un botón que va a desaparecer.
  const [businessType, setBusinessType] = useState<string | null>(null);
  const [businessTypeLoaded, setBusinessTypeLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/runtime/tenant-config", {
          cache: "no-store",
        });
        const data = await response.json();
        if (cancelled) return;
        const bt = String(data?.config?.businessType || "").trim().toLowerCase();
        setBusinessType(bt || null);
      } catch {
        if (!cancelled) setBusinessType(null);
      } finally {
        if (!cancelled) setBusinessTypeLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleEmit() {
    const confirmed = window.confirm(
      "Se generará una factura por cada cliente con horas pendientes del mes " +
        mes +
        "." +
        "\n\nLas actividades incluidas se marcarán como facturadas y no podrán emitirse de nuevo." +
        "\n\n¿Continuar?",
    );
    if (!confirmed) return;

    setBusy(true);
    setFeedback(null);

    try {
      const response = await fetch("/api/erp/billing-emit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mes }),
      });
      const data = (await response.json()) as EmitResponse;

      if (!response.ok || !data.ok) {
        setFeedbackKind("error");
        setFeedback(data.error || "No se pudo emitir las facturas.");
        return;
      }

      const facturas = Array.isArray(data.facturas) ? data.facturas : [];
      if (facturas.length === 0) {
        setFeedbackKind("info");
        const detalle = (data.notas && data.notas[0]) || "Sin actividades pendientes este mes.";
        setFeedback(detalle);
        return;
      }

      const totalEur = (data.totalImporte || 0).toFixed(2);
      const numeros = facturas.map((f) => f.numero).join(", ");
      setFeedbackKind("ok");
      setFeedback(
        "Emitidas " +
          facturas.length +
          " facturas (" +
          numeros +
          ") por un total de " +
          totalEur +
          " EUR. " +
          (data.totalActividadesMarcadas || 0) +
          " actividades marcadas como facturadas.",
      );

      if (onAfterEmit) onAfterEmit();
    } catch (err) {
      setFeedbackKind("error");
      setFeedback(err instanceof Error ? err.message : "Error inesperado al emitir.");
    } finally {
      setBusy(false);
    }
  }

  const palette =
    feedbackKind === "ok"
      ? { border: "#bbf7d0", bg: "#f0fdf4", color: "#166534" }
      : feedbackKind === "error"
        ? { border: "#fecaca", bg: "#fef2f2", color: "#991b1b" }
        : { border: "#bfdbfe", bg: "#eff6ff", color: "#1e3a8a" };

  // SF-18: render condicional. Hasta que sepamos el businessType, no
  // pintamos nada; si no es software-factory, tampoco.
  if (!businessTypeLoaded) return null;
  if (businessType !== "software-factory") return null;

  return (
    <div style={{ display: "grid", gap: 8, justifyItems: "end" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <label
          style={{
            fontSize: 12,
            color: "#6b7280",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          Mes
          <input
            type="month"
            value={mes}
            onChange={(event) => setMes(event.target.value)}
            disabled={busy}
            style={{
              border: "1px solid #d1d5db",
              borderRadius: 6,
              padding: "6px 8px",
              fontSize: 13,
              fontFamily: "inherit",
            }}
          />
        </label>
        <a
          href={mes ? "/api/erp/billing-export?mes=" + encodeURIComponent(mes) + "&format=csv" : "#"}
          onClick={(event) => {
            if (!mes) event.preventDefault();
          }}
          download
          style={{
            border: "1px solid #d1d5db",
            borderRadius: 8,
            background: "#ffffff",
            color: "#374151",
            padding: "10px 14px",
            cursor: mes ? "pointer" : "not-allowed",
            fontWeight: 600,
            fontSize: 13,
            textDecoration: "none",
            whiteSpace: "nowrap",
            opacity: mes ? 1 : 0.5,
          }}
          title="Descarga un CSV con todas las horas pendientes de facturar del mes seleccionado"
        >
          Descargar CSV
        </a>
        <button
          type="button"
          onClick={handleEmit}
          disabled={busy || !mes}
          style={{
            border: "1px solid #1d4ed8",
            borderRadius: 8,
            background: "#ffffff",
            color: "#1d4ed8",
            padding: "10px 16px",
            cursor: busy ? "not-allowed" : "pointer",
            fontWeight: 700,
            fontSize: 14,
            opacity: busy ? 0.7 : 1,
            whiteSpace: "nowrap",
          }}
          title="Genera una factura por cada cliente con horas pendientes del mes seleccionado"
        >
          {busy ? "Emitiendo..." : "Emitir mes"}
        </button>
      </div>

      {feedback ? (
        <div
          style={{
            border: "1px solid " + palette.border,
            background: palette.bg,
            color: palette.color,
            borderRadius: 8,
            padding: "8px 12px",
            fontSize: 13,
            maxWidth: 480,
          }}
        >
          {feedback}
        </div>
      ) : null}
    </div>
  );
}
