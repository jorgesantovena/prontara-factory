/**
 * Logger estructurado de Prontara.
 *
 * Emite cada log como una línea JSON con campos comunes (timestamp, level,
 * msg, scope) + cualquier contexto que se le pase. Esto permite que Vercel
 * Log Drains (BetterStack / Logtail / etc.) los indexe por campo y se
 * puedan filtrar por request_id, tenant_id, error code, etc.
 *
 * Uso típico:
 *
 *   import { createLogger } from "@/lib/observability/logger";
 *   const log = createLogger("stripe-webhook");
 *   log.info("event received", { eventId, type });
 *   log.error("activation failed", { eventId, error: err.message });
 *
 * En desarrollo (NODE_ENV=development) imprime con formato legible para no
 * volver loca a la persona que mira la terminal. En producción siempre JSON.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogContext = Record<string, unknown>;

export type Logger = {
  scope: string;
  debug: (msg: string, context?: LogContext) => void;
  info: (msg: string, context?: LogContext) => void;
  warn: (msg: string, context?: LogContext) => void;
  error: (msg: string, context?: LogContext) => void;
  /** Devuelve un nuevo logger con campos extra que se incluyen en CADA log. */
  child: (extra: LogContext) => Logger;
};

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function getMinLevel(): LogLevel {
  const env = String(process.env.PRONTARA_LOG_LEVEL || "").toLowerCase();
  if (env in LEVEL_RANK) return env as LogLevel;
  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

function isPretty(): boolean {
  // En dev imprime legible; en prod siempre JSON (mejor para indexar).
  return process.env.NODE_ENV !== "production" && process.env.PRONTARA_LOG_FORMAT !== "json";
}

function emit(level: LogLevel, scope: string, msg: string, ctx: LogContext): void {
  if (LEVEL_RANK[level] < LEVEL_RANK[getMinLevel()]) return;

  const record = {
    ts: new Date().toISOString(),
    level,
    scope,
    msg,
    ...ctx,
  };

  if (isPretty()) {
    const color =
      level === "error"
        ? "\x1b[31m"
        : level === "warn"
          ? "\x1b[33m"
          : level === "info"
            ? "\x1b[36m"
            : "\x1b[90m";
    const reset = "\x1b[0m";
    const ctxStr = Object.keys(ctx).length > 0 ? " " + JSON.stringify(ctx) : "";
    const line =
      color + level.toUpperCase().padEnd(5) + reset +
      " [" + scope + "] " + msg + ctxStr;
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
  } else {
    const json = JSON.stringify(record);
    if (level === "error") console.error(json);
    else if (level === "warn") console.warn(json);
    else console.log(json);
  }
}

export function createLogger(scope: string, base?: LogContext): Logger {
  const baseCtx: LogContext = base || {};
  return {
    scope,
    debug(msg, ctx) {
      emit("debug", scope, msg, { ...baseCtx, ...(ctx || {}) });
    },
    info(msg, ctx) {
      emit("info", scope, msg, { ...baseCtx, ...(ctx || {}) });
    },
    warn(msg, ctx) {
      emit("warn", scope, msg, { ...baseCtx, ...(ctx || {}) });
    },
    error(msg, ctx) {
      emit("error", scope, msg, { ...baseCtx, ...(ctx || {}) });
    },
    child(extra) {
      return createLogger(scope, { ...baseCtx, ...extra });
    },
  };
}
