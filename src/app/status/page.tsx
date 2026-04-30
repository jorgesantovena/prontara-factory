"use client";

import { useEffect, useState } from "react";
import PublicNav from "@/components/public-nav";
import PublicFooter from "@/components/public-footer";

/**
 * Status page pública de Prontara.
 *
 * Llama a /api/health (público) y muestra el estado de los componentes
 * críticos. Pensado para:
 *   - Comprobar de un vistazo si Stripe/Resend/DB están vivos.
 *   - Compartir con clientes ante quejas ("ahora mismo todo verde").
 *   - Dar un endpoint de health a servicios externos (statuscake, etc.).
 *
 * Refresco manual con botón. Auto-refresh cada 60s para no bombardear
 * cuando esta pestaña se queda abierta.
 */

type ComponentStatus = {
  key: string;
  label: string;
  state: "ok" | "warn" | "down";
  detail: string;
  durationMs?: number;
};

type HealthResponse = {
  ok: boolean;
  overall: "ok" | "warn" | "down";
  components: ComponentStatus[];
  checkedAt: string;
};

function STATE_LABEL(state: "ok" | "warn" | "down") {
  if (state === "ok") return "Operativo";
  if (state === "warn") return "Advertencia";
  return "Caído";
}

function STATE_COLORS(state: "ok" | "warn" | "down") {
  if (state === "ok") return { bg: "#dcfce7", border: "#bbf7d0", color: "#166534", dot: "#16a34a" };
  if (state === "warn") return { bg: "#fef3c7", border: "#fde68a", color: "#92400e", dot: "#d97706" };
  return { bg: "#fee2e2", border: "#fecaca", color: "#991b1b", dot: "#dc2626" };
}

export default function StatusPage() {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/health", { cache: "no-store" });
      const d = (await res.json()) as HealthResponse;
      if (!res.ok) {
        throw new Error("La API de health respondió con error.");
      }
      setData(d);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error consultando estado.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
    const handle = setInterval(() => void load(), 60_000);
    return () => clearInterval(handle);
  }, []);

  const overallColors = data ? STATE_COLORS(data.overall) : STATE_COLORS("warn");

  return (
    <main style={{ fontFamily: "Arial, sans-serif", color: "#111827", background: "#ffffff", minHeight: "100vh" }}>
      <PublicNav />

      <article style={{ maxWidth: 820, margin: "0 auto", padding: "48px 24px" }}>
        <h1 style={{ fontSize: 32, marginTop: 0, color: "#0f172a" }}>Estado del servicio</h1>
        <p style={{ color: "#4b5563", fontSize: 15, lineHeight: 1.6 }}>
          Estado en tiempo real de los componentes que sostienen Prontara: la base de datos,
          el cobro Stripe, el envío de emails, el chat IA y la sesión segura. Esta página se
          refresca cada 60 segundos.
        </p>

        {/* Estado global */}
        {data ? (
          <section
            style={{
              background: overallColors.bg,
              border: "1px solid " + overallColors.border,
              borderRadius: 14,
              padding: 24,
              marginTop: 24,
              display: "flex",
              alignItems: "center",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                width: 16,
                height: 16,
                borderRadius: 999,
                background: overallColors.dot,
                flexShrink: 0,
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: overallColors.color }}>
                {data.overall === "ok"
                  ? "Todos los sistemas operativos"
                  : data.overall === "warn"
                    ? "Con avisos"
                    : "Hay un sistema caído"}
              </div>
              <div style={{ fontSize: 13, color: overallColors.color, opacity: 0.85, marginTop: 4 }}>
                Última comprobación: {new Date(data.checkedAt).toLocaleString("es-ES")}
              </div>
            </div>
            <button
              type="button"
              onClick={() => void load()}
              disabled={busy}
              style={{
                background: "#ffffff",
                border: "1px solid " + overallColors.border,
                color: overallColors.color,
                padding: "10px 16px",
                borderRadius: 10,
                cursor: busy ? "not-allowed" : "pointer",
                fontWeight: 600,
                fontSize: 13,
                opacity: busy ? 0.6 : 1,
              }}
            >
              {busy ? "Comprobando…" : "Refrescar"}
            </button>
          </section>
        ) : null}

        {error ? (
          <div
            style={{
              border: "1px solid #fecaca",
              background: "#fef2f2",
              color: "#991b1b",
              borderRadius: 10,
              padding: 14,
              marginTop: 16,
              fontSize: 14,
            }}
          >
            {error}
          </div>
        ) : null}

        {/* Tabla de componentes */}
        {data ? (
          <section style={{ marginTop: 24, display: "grid", gap: 8 }}>
            <h2 style={{ fontSize: 18, color: "#0f172a", marginBottom: 4 }}>Componentes</h2>
            {data.components.map((c) => {
              const colors = STATE_COLORS(c.state);
              return (
                <article
                  key={c.key}
                  style={{
                    background: "#ffffff",
                    border: "1px solid #e5e7eb",
                    borderRadius: 10,
                    padding: 14,
                    display: "flex",
                    gap: 14,
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 999,
                      background: colors.dot,
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                      <strong style={{ fontSize: 15, color: "#0f172a" }}>{c.label}</strong>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "2px 10px",
                          borderRadius: 999,
                          background: colors.bg,
                          color: colors.color,
                          border: "1px solid " + colors.border,
                        }}
                      >
                        {STATE_LABEL(c.state)}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: "#4b5563", marginTop: 4 }}>{c.detail}</div>
                    {typeof c.durationMs === "number" ? (
                      <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>
                        Comprobación: {c.durationMs} ms
                      </div>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </section>
        ) : null}

        {/* Footer info */}
        <section style={{ marginTop: 32, padding: 16, background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10, fontSize: 13, color: "#6b7280" }}>
          <p style={{ margin: 0, lineHeight: 1.6 }}>
            <strong style={{ color: "#374151" }}>Para integraciones:</strong> el endpoint{" "}
            <code style={{ background: "#ffffff", padding: "2px 6px", borderRadius: 4, fontSize: 12 }}>
              /api/health
            </code>{" "}
            devuelve un JSON con la misma información que ves en esta página. Es público, no
            requiere autenticación, y se puede usar desde servicios de monitorización externos.
          </p>
        </section>
      </article>

      <PublicFooter />
    </main>
  );
}
