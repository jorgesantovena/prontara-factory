/**
 * Captura de errores en producción (H1-STAB-01).
 *
 * Diseño:
 *   - Si `SENTRY_DSN` está definido, envía cada error capturado al
 *     endpoint `/api/PROJECT_ID/envelope/` de Sentry vía `fetch` directo
 *     (sin SDK — un dep menos, build más ligero).
 *   - Si `SENTRY_DSN` no está definido, hace no-op silencioso. Esto
 *     permite que producción funcione sin Sentry y que se active
 *     simplemente añadiendo la env var en Vercel.
 *   - NUNCA lanza. Si falla el envío a Sentry, lo logueamos en consola
 *     y seguimos. Bajo NINGÚN concepto la captura de errores debe
 *     romper la respuesta a un usuario.
 *   - Fire-and-forget — `captureError` devuelve void, no se espera.
 *     Internamente programa el envío en microtask y captura cualquier
 *     fallo de red.
 *
 * Eventos extra: `captureMessage(level, message, ctx)` para warnings
 * que no son errores propiamente dichos.
 *
 * Sentry "envelope" format: ver
 *   https://develop.sentry.dev/sdk/data-model/envelopes/
 *
 * El DSN de Sentry tiene el formato:
 *   https://<PUBLIC_KEY>@oXXX.ingest.sentry.io/<PROJECT_ID>
 */
import { createLogger } from "@/lib/observability/logger";

const log = createLogger("error-capture");

type ParsedDsn = {
  endpoint: string;
  publicKey: string;
  projectId: string;
};

let parsed: ParsedDsn | null | undefined; // undefined = not parsed yet, null = no DSN

function getDsn(): ParsedDsn | null {
  if (parsed !== undefined) return parsed;
  const dsn = String(process.env.SENTRY_DSN || "").trim();
  if (!dsn) {
    parsed = null;
    return null;
  }
  try {
    const url = new URL(dsn);
    const publicKey = url.username;
    const projectId = url.pathname.replace(/^\/+/, "").split("/")[0];
    if (!publicKey || !projectId) {
      log.warn("SENTRY_DSN malformado — captura desactivada");
      parsed = null;
      return null;
    }
    const endpoint = url.origin + "/api/" + projectId + "/envelope/";
    parsed = { endpoint, publicKey, projectId };
    return parsed;
  } catch {
    log.warn("SENTRY_DSN no es URL válida — captura desactivada");
    parsed = null;
    return null;
  }
}

export type CaptureContext = {
  /** ID del request, tenant, módulo, endpoint, etc. */
  tags?: Record<string, string>;
  /** Datos adicionales (request body, params, etc) — sin PII si es posible. */
  extra?: Record<string, unknown>;
  /** Email o id del usuario afectado (opcional, scrub si es muy sensible). */
  user?: { id?: string; email?: string };
  /** Nombre del endpoint o función que falló (e.g. "/api/erp/module"). */
  scope?: string;
};

/**
 * Captura un error y lo manda a Sentry si está configurado. Fire-and-forget.
 * Siempre loguea con `log.error` aunque no haya Sentry, para no perder
 * la traza en logs Vercel.
 */
export function captureError(error: unknown, context: CaptureContext = {}): void {
  // Log siempre (sea o no haya Sentry) — lo verán en Vercel logs.
  const errMessage = error instanceof Error ? error.message : String(error);
  const errStack = error instanceof Error ? error.stack : undefined;
  log.error("captured error: " + errMessage, {
    scope: context.scope,
    stack: errStack,
    tags: context.tags,
    extra: context.extra,
  });

  const dsn = getDsn();
  if (!dsn) return;

  // Fire-and-forget — no await
  void sendToSentry(dsn, error, context).catch((err) => {
    log.warn("Sentry envío falló silenciosamente: " + (err instanceof Error ? err.message : String(err)));
  });
}

/**
 * Captura un mensaje de nivel arbitrario (info / warning / error) sin
 * que tenga que ser una excepción. Útil para warnings importantes.
 */
export function captureMessage(
  level: "info" | "warning" | "error",
  message: string,
  context: CaptureContext = {},
): void {
  log[level === "warning" ? "warn" : level](message, {
    scope: context.scope,
    tags: context.tags,
    extra: context.extra,
  });

  const dsn = getDsn();
  if (!dsn) return;

  void sendMessageToSentry(dsn, level, message, context).catch((err) => {
    log.warn("Sentry envío falló silenciosamente: " + (err instanceof Error ? err.message : String(err)));
  });
}

async function sendToSentry(
  dsn: ParsedDsn,
  error: unknown,
  context: CaptureContext,
): Promise<void> {
  const eventId = randomEventId();
  const event = buildErrorEvent(eventId, error, context);
  await postEnvelope(dsn, eventId, event);
}

async function sendMessageToSentry(
  dsn: ParsedDsn,
  level: "info" | "warning" | "error",
  message: string,
  context: CaptureContext,
): Promise<void> {
  const eventId = randomEventId();
  const event: Record<string, unknown> = {
    event_id: eventId,
    timestamp: Date.now() / 1000,
    platform: "node",
    level,
    message: { formatted: message },
    environment: process.env.NODE_ENV || "production",
    server_name: process.env.VERCEL_REGION || "unknown",
    tags: context.tags,
    extra: context.extra,
    user: context.user,
    transaction: context.scope,
  };
  await postEnvelope(dsn, eventId, event);
}

function buildErrorEvent(
  eventId: string,
  error: unknown,
  context: CaptureContext,
): Record<string, unknown> {
  const isError = error instanceof Error;
  const type = isError ? error.constructor.name : "Error";
  const value = isError ? error.message : String(error);
  const stack = isError && error.stack ? parseStack(error.stack) : [];
  return {
    event_id: eventId,
    timestamp: Date.now() / 1000,
    platform: "node",
    level: "error",
    environment: process.env.NODE_ENV || "production",
    server_name: process.env.VERCEL_REGION || "unknown",
    release: process.env.VERCEL_GIT_COMMIT_SHA || undefined,
    transaction: context.scope,
    exception: {
      values: [
        {
          type,
          value,
          stacktrace: { frames: stack },
        },
      ],
    },
    tags: context.tags,
    extra: context.extra,
    user: context.user,
  };
}

function parseStack(stack: string): Array<Record<string, unknown>> {
  // Mejor esfuerzo — Sentry acepta lo que le des. Solo extraemos frames básicos.
  const lines = stack.split("\n").slice(1); // skip first line (the message)
  const frames: Array<Record<string, unknown>> = [];
  for (const line of lines) {
    const m = /^\s*at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/.exec(line) || /^\s*at\s+(.+?):(\d+):(\d+)/.exec(line);
    if (!m) continue;
    if (m.length === 5) {
      frames.push({
        function: m[1],
        filename: m[2],
        lineno: parseInt(m[3], 10),
        colno: parseInt(m[4], 10),
        in_app: !m[2].includes("node_modules"),
      });
    } else {
      frames.push({
        filename: m[1],
        lineno: parseInt(m[2], 10),
        colno: parseInt(m[3], 10),
        in_app: !m[1].includes("node_modules"),
      });
    }
  }
  // Sentry quiere los frames en orden ascendente (origen primero)
  return frames.reverse();
}

async function postEnvelope(
  dsn: ParsedDsn,
  eventId: string,
  event: Record<string, unknown>,
): Promise<void> {
  const envelopeHeader = JSON.stringify({
    event_id: eventId,
    sent_at: new Date().toISOString(),
    sdk: { name: "prontara.minimal", version: "1.0.0" },
  });
  const itemHeader = JSON.stringify({ type: "event" });
  const itemBody = JSON.stringify(event);
  const body = envelopeHeader + "\n" + itemHeader + "\n" + itemBody + "\n";

  const auth =
    "Sentry sentry_version=7," +
    "sentry_client=prontara.minimal/1.0," +
    "sentry_key=" + dsn.publicKey;

  // Timeout 3s — no queremos bloquear ningún flujo si Sentry está caído.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 3000);
  try {
    await fetch(dsn.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-sentry-envelope",
        "X-Sentry-Auth": auth,
      },
      body,
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function randomEventId(): string {
  // 32 hex chars sin guiones — formato Sentry event_id
  let out = "";
  const chars = "0123456789abcdef";
  for (let i = 0; i < 32; i++) {
    out += chars.charAt(Math.floor(Math.random() * 16));
  }
  return out;
}

/**
 * ¿Está activada la captura?
 */
export function isErrorCaptureEnabled(): boolean {
  return getDsn() !== null;
}
