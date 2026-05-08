"use client";

import { useEffect, useRef } from "react";

/**
 * Render de gráfico para reportes con Chart.js cargado por CDN (H2-CHART).
 *
 * Soporta bar / line / pie. Recibe datos del agrupador del report-engine
 * (groups: [{ key, count }, ...]). Si no hay groups o chartType=none
 * devuelve null.
 */
type Group = { key: string; count: number };

type Props = {
  chartType: "none" | "bar" | "line" | "pie";
  groups: Group[];
  title?: string;
  accentColor?: string;
};

declare global {
  interface Window {
    Chart?: unknown;
  }
}

const CHART_CDN = "https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js";

let chartScriptPromise: Promise<void> | null = null;
function loadChartJs(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.Chart) return Promise.resolve();
  if (chartScriptPromise) return chartScriptPromise;
  chartScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = CHART_CDN;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      chartScriptPromise = null;
      reject(new Error("No se pudo cargar Chart.js."));
    };
    document.head.appendChild(script);
  });
  return chartScriptPromise;
}

export default function ReportChart({ chartType, groups, title, accentColor }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Almacenamos la instancia chart para destruirla al re-renderizar
  const chartInstanceRef = useRef<{ destroy: () => void } | null>(null);

  useEffect(() => {
    if (chartType === "none") return;
    if (!groups || groups.length === 0) return;
    let cancelled = false;

    (async () => {
      try {
        await loadChartJs();
        if (cancelled) return;
        const ChartCtor = (window as unknown as { Chart: new (...a: unknown[]) => { destroy: () => void } }).Chart;
        if (!ChartCtor || !canvasRef.current) return;

        // Destruir instancia anterior si existe
        if (chartInstanceRef.current) {
          chartInstanceRef.current.destroy();
          chartInstanceRef.current = null;
        }

        const ctx = canvasRef.current.getContext("2d");
        if (!ctx) return;

        const labels = groups.map((g) => g.key);
        const values = groups.map((g) => g.count);
        const baseColor = accentColor || "#1d4ed8";
        const palette = generatePalette(baseColor, groups.length);

        chartInstanceRef.current = new ChartCtor({
          type: chartType,
          data: {
            labels,
            datasets: [
              {
                label: title || "Cantidad",
                data: values,
                backgroundColor: chartType === "pie" ? palette : baseColor + "cc",
                borderColor: baseColor,
                borderWidth: chartType === "line" ? 2 : 1,
                tension: 0.2,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: chartType === "pie" },
              title: title ? { display: true, text: title } : undefined,
            },
            scales:
              chartType === "pie"
                ? undefined
                : {
                    y: { beginAtZero: true, ticks: { precision: 0 } },
                  },
          },
        });
      } catch {
        // si falla la carga, dejamos placeholder
      }
    })();

    return () => {
      cancelled = true;
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [chartType, groups, title, accentColor]);

  if (chartType === "none") return null;
  if (!groups || groups.length === 0) return null;

  return (
    <div style={{ position: "relative", height: 320, marginBottom: 20, padding: 12, background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 12 }}>
      <canvas ref={canvasRef} />
    </div>
  );
}

/**
 * Paleta derivada del color base — para gráficos pie con varias slices.
 */
function generatePalette(baseHex: string, count: number): string[] {
  // Generamos N colores con HSL girando 360/count grados desde el base.
  const hsl = hexToHsl(baseHex);
  if (!hsl) return Array(count).fill(baseHex);
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const h = (hsl.h + (360 / count) * i) % 360;
    out.push(hslToHex(h, hsl.s, Math.min(60, hsl.l + 5)));
  }
  return out;
}

function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return null;
  const r = parseInt(m[1], 16) / 255;
  const g = parseInt(m[2], 16) / 255;
  const b = parseInt(m[3], 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h *= 60;
  }
  return { h, s: s * 100, l: l * 100 };
}

function hslToHex(h: number, s: number, l: number): string {
  const sl = s / 100;
  const ll = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sl * Math.min(ll, 1 - ll);
  const f = (n: number) => {
    const c = ll - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return Math.round(c * 255).toString(16).padStart(2, "0");
  };
  return "#" + f(0) + f(8) + f(4);
}
