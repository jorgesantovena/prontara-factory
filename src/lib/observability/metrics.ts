/**
 * Métricas opt-in vía OTEL HTTP (H3-ARQ-05).
 *
 * Compatible con cualquier backend que acepte OTLP HTTP/JSON:
 * Datadog, New Relic, Grafana Cloud, Honeycomb, Tempo, Lightstep, etc.
 *
 * Diseño:
 *   - Si `OTEL_EXPORTER_OTLP_ENDPOINT` no está, todo es no-op.
 *   - Métricas se acumulan en memoria y se flusan cada 30s en background.
 *   - 3 tipos: counter (suma), gauge (último valor), histogram (lista).
 *   - Sin SDK — fetch directo al endpoint /v1/metrics. Cero deps.
 *
 * Uso:
 *   import { incrCounter, recordHistogram } from "@/lib/observability/metrics";
 *   incrCounter("erp.module.create", { moduleKey: "facturacion" });
 *   recordHistogram("erp.module.duration_ms", durationMs, { moduleKey: "facturacion" });
 */
import { createLogger } from "@/lib/observability/logger";

const log = createLogger("metrics");

type Labels = Record<string, string>;

type CounterEntry = { count: number; labels: Labels };
type GaugeEntry = { value: number; labels: Labels; ts: number };
type HistogramEntry = { values: number[]; labels: Labels };

const counters = new Map<string, CounterEntry[]>();
const gauges = new Map<string, GaugeEntry[]>();
const histograms = new Map<string, HistogramEntry[]>();

let started = false;

function getEndpoint(): string | null {
  const endpoint = String(process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "").trim();
  if (!endpoint) return null;
  return endpoint.replace(/\/+$/, "") + "/v1/metrics";
}

function labelsKey(labels: Labels): string {
  const keys = Object.keys(labels).sort();
  return keys.map((k) => k + "=" + labels[k]).join("|");
}

function findEntry<T extends { labels: Labels }>(arr: T[], labels: Labels): T | undefined {
  const k = labelsKey(labels);
  return arr.find((e) => labelsKey(e.labels) === k);
}

export function incrCounter(name: string, labels: Labels = {}, by = 1): void {
  if (!getEndpoint()) return;
  ensureStarted();
  const arr = counters.get(name) || [];
  const existing = findEntry(arr, labels);
  if (existing) {
    existing.count += by;
  } else {
    arr.push({ count: by, labels });
    counters.set(name, arr);
  }
}

export function setGauge(name: string, value: number, labels: Labels = {}): void {
  if (!getEndpoint()) return;
  ensureStarted();
  const arr = gauges.get(name) || [];
  const existing = findEntry(arr, labels);
  const ts = Date.now();
  if (existing) {
    existing.value = value;
    existing.ts = ts;
  } else {
    arr.push({ value, labels, ts });
    gauges.set(name, arr);
  }
}

export function recordHistogram(name: string, value: number, labels: Labels = {}): void {
  if (!getEndpoint()) return;
  ensureStarted();
  const arr = histograms.get(name) || [];
  const existing = findEntry(arr, labels);
  if (existing) {
    existing.values.push(value);
    // Cap a 1000 valores por bucket — evita explotar memoria.
    if (existing.values.length > 1000) existing.values = existing.values.slice(-1000);
  } else {
    arr.push({ values: [value], labels });
    histograms.set(name, arr);
  }
}

function ensureStarted(): void {
  if (started) return;
  started = true;
  // Flush periódico cada 30s — solo en runtime con setInterval (no funciona
  // en serverless edge). En Vercel funcs Node corre durante la vida del lambda warm.
  if (typeof setInterval === "function") {
    setInterval(() => {
      void flush().catch((err) => log.warn("metrics flush failed", { err: String(err) }));
    }, 30_000).unref?.();
  }
}

/**
 * Manda lo acumulado al endpoint OTLP y limpia. Llamable manualmente
 * desde lambdas de corta vida (después de cada request). En cron tick
 * se llama también para no perder métricas de la última iteración.
 */
export async function flush(): Promise<void> {
  const endpoint = getEndpoint();
  if (!endpoint) return;
  if (counters.size === 0 && gauges.size === 0 && histograms.size === 0) return;

  const metrics: Array<Record<string, unknown>> = [];
  const nowNs = Date.now() * 1_000_000;

  for (const [name, entries] of counters.entries()) {
    metrics.push({
      name,
      sum: {
        dataPoints: entries.map((e) => ({
          attributes: toAttributes(e.labels),
          asInt: e.count,
          timeUnixNano: String(nowNs),
        })),
        aggregationTemporality: 2, // delta
        isMonotonic: true,
      },
    });
  }
  for (const [name, entries] of gauges.entries()) {
    metrics.push({
      name,
      gauge: {
        dataPoints: entries.map((e) => ({
          attributes: toAttributes(e.labels),
          asDouble: e.value,
          timeUnixNano: String(e.ts * 1_000_000),
        })),
      },
    });
  }
  for (const [name, entries] of histograms.entries()) {
    metrics.push({
      name,
      histogram: {
        dataPoints: entries.map((e) => {
          const sum = e.values.reduce((a, b) => a + b, 0);
          return {
            attributes: toAttributes(e.labels),
            count: String(e.values.length),
            sum,
            min: Math.min(...e.values),
            max: Math.max(...e.values),
            timeUnixNano: String(nowNs),
          };
        }),
        aggregationTemporality: 2,
      },
    });
  }

  const body = {
    resourceMetrics: [
      {
        resource: {
          attributes: toAttributes({
            "service.name": "prontara-factory",
            "service.version": process.env.VERCEL_GIT_COMMIT_SHA || "dev",
            "deployment.environment": process.env.NODE_ENV || "production",
          }),
        },
        scopeMetrics: [{ scope: { name: "prontara.minimal", version: "1.0.0" }, metrics }],
      },
    ],
  };

  const apiKey = process.env.OTEL_EXPORTER_OTLP_HEADERS_API_KEY || "";
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers["api-key"] = apiKey;

  // Limpiamos antes del fetch — si falla, perdemos esa ventana, pero no
  // doblamos en la siguiente.
  counters.clear();
  gauges.clear();
  histograms.clear();

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } catch (err) {
    log.warn("OTLP push failed: " + (err instanceof Error ? err.message : String(err)));
  } finally {
    clearTimeout(timer);
  }
}

function toAttributes(labels: Labels): Array<{ key: string; value: { stringValue: string } }> {
  return Object.entries(labels).map(([k, v]) => ({
    key: k,
    value: { stringValue: String(v) },
  }));
}

export function isMetricsEnabled(): boolean {
  return getEndpoint() !== null;
}
