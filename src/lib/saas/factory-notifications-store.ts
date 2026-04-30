/**
 * Almacén filesystem de notificaciones internas del operador (`/factory`).
 *
 * Es la fuente sync. Para producción (Vercel) las notificaciones viven en
 * Postgres a través del wrapper `factory-notifications-store-async.ts`.
 * En desarrollo local con `PRONTARA_PERSISTENCE=filesystem` se persisten
 * aquí, un fichero JSON por notificación bajo `data/saas/notifications/`.
 *
 * Eventos típicos: alta de un cliente, pago recibido, trial expira, fallo
 * de pago, cliente cancela, error del webhook. La idea es que el operador
 * pueda mirar /factory/notificaciones y enterarse de qué ha pasado en su
 * SaaS sin tener que abrir logs de Stripe ni tocar la base de datos.
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { writeJsonAtomic } from "@/lib/saas/fs-atomic";

export type FactoryNotificationType =
  | "alta_created"
  | "payment_received"
  | "trial_expiring"
  | "trial_expired"
  | "payment_failed"
  | "tenant_cancelled"
  | "webhook_error"
  // Tipos del saga de compensación post-pago (ARQ-7):
  | "activation_failed_no_refund"
  | "activation_failed_refunded"
  | "manual";

export type FactoryNotificationSeverity = "info" | "success" | "warning" | "error";

export type FactoryNotification = {
  id: string;
  type: FactoryNotificationType;
  severity: FactoryNotificationSeverity;
  title: string;
  message: string;
  metadata: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
};

export type CreateNotificationInput = {
  type: FactoryNotificationType;
  severity?: FactoryNotificationSeverity;
  title: string;
  message: string;
  metadata?: Record<string, unknown> | null;
};

function projectRoot(): string {
  return process.cwd();
}

function getNotificationsDir(): string {
  const dir = path.join(projectRoot(), "data", "saas", "notifications");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function notificationFilePath(id: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(id)) {
    throw new Error("id de notificación inválido.");
  }
  return path.join(getNotificationsDir(), id + ".json");
}

function defaultSeverityFor(type: FactoryNotificationType): FactoryNotificationSeverity {
  switch (type) {
    case "alta_created":
    case "payment_received":
      return "success";
    case "trial_expiring":
      return "info";
    case "trial_expired":
    case "tenant_cancelled":
      return "warning";
    case "payment_failed":
    case "webhook_error":
      return "error";
    default:
      return "info";
  }
}

export function createNotification(input: CreateNotificationInput): FactoryNotification {
  const now = new Date().toISOString();
  const id =
    "ntf-" +
    now.slice(0, 10).replace(/-/g, "") +
    "-" +
    randomUUID().slice(0, 8);

  const record: FactoryNotification = {
    id,
    type: input.type,
    severity: input.severity || defaultSeverityFor(input.type),
    title: String(input.title || "").trim().slice(0, 200) || "(sin título)",
    message: String(input.message || "").trim().slice(0, 4000),
    metadata: input.metadata ?? null,
    readAt: null,
    createdAt: now,
  };

  writeJsonAtomic(notificationFilePath(id), record);
  return record;
}

export type ListNotificationsOptions = {
  limit?: number;
  /** Si se pasa, solo devuelve no leídas. */
  unreadOnly?: boolean;
};

export function listNotifications(
  options: ListNotificationsOptions = {},
): FactoryNotification[] {
  const dir = getNotificationsDir();
  if (!fs.existsSync(dir)) return [];

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .reverse();

  const limit = Math.max(1, Math.min(options.limit || 100, 500));
  const out: FactoryNotification[] = [];
  for (const file of files) {
    if (out.length >= limit) break;
    try {
      const parsed = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
      if (!parsed || typeof parsed !== "object") continue;
      if (options.unreadOnly && parsed.readAt) continue;
      out.push(parsed as FactoryNotification);
    } catch {
      // ignoramos ficheros corruptos
    }
  }
  return out;
}

export function countUnreadNotifications(): number {
  return listNotifications({ unreadOnly: true, limit: 500 }).length;
}

export function markNotificationRead(id: string): FactoryNotification {
  const filePath = notificationFilePath(id);
  if (!fs.existsSync(filePath)) {
    throw new Error("Notificación no encontrada.");
  }
  const current = JSON.parse(fs.readFileSync(filePath, "utf8")) as FactoryNotification;
  if (current.readAt) return current;
  const next: FactoryNotification = {
    ...current,
    readAt: new Date().toISOString(),
  };
  writeJsonAtomic(filePath, next);
  return next;
}

export function markAllNotificationsRead(): number {
  const all = listNotifications({ unreadOnly: true, limit: 500 });
  for (const n of all) {
    markNotificationRead(n.id);
  }
  return all.length;
}
