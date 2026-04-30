/**
 * Evaluador de reglas de lifecycle.
 *
 * Para cada tenant calcula qué eventos están "listos" para enviarse ahora
 * mismo. La idempotencia se garantiza consultando
 * `data/saas/lifecycle/<clientId>.json` antes de decir "pendiente":
 * si ya se envió ese event antes, no vuelve a salir — excepto los
 * recordatorios basados en fecha (trial-7d/trial-1d) que pueden repetirse
 * en campañas distintas pero con el mismo ventana (no nos interesa
 * repetir dentro de la misma ventana).
 *
 * Las reglas viven aquí como funciones puras sobre el estado actual.
 */
import fs from "node:fs";
import path from "node:path";
import { writeJsonAtomic } from "@/lib/saas/fs-atomic";
import type { BillingSubscriptionRecord } from "@/lib/saas/billing-definition";
import type { TrialState } from "@/lib/saas/trial-store";
import { listTenantClientsIndex, type TenantClientIndexItem } from "@/lib/saas/tenant-clients-index";
import { listTenantAccounts } from "@/lib/saas/account-store";
import {
  LIFECYCLE_EVENTS,
  daysUntil,
  type LifecycleContext,
  type LifecycleEventKey,
} from "@/lib/saas/lifecycle-catalog";

export type LifecycleSentRecord = {
  event: LifecycleEventKey;
  sentAt: string;
  recipient: string;
};

export type LifecycleTenantState = {
  clientId: string;
  sent: LifecycleSentRecord[];
  updatedAt: string;
};

export type PendingLifecycleEvent = {
  clientId: string;
  slug: string;
  displayName: string;
  event: LifecycleEventKey;
  reason: string;
  recipient: {
    email: string;
    name: string;
  };
  rendered: {
    subject: string;
    text: string;
  };
};

function projectRoot(): string {
  return process.cwd();
}

function getLifecycleDir(): string {
  const dir = path.join(projectRoot(), "data", "saas", "lifecycle");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getLifecycleFilePath(clientId: string): string {
  return path.join(getLifecycleDir(), clientId + ".json");
}

export function readLifecycleState(clientId: string): LifecycleTenantState {
  const filePath = getLifecycleFilePath(clientId);
  if (!fs.existsSync(filePath)) {
    return { clientId, sent: [], updatedAt: new Date(0).toISOString() };
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (!parsed || typeof parsed !== "object") {
      return { clientId, sent: [], updatedAt: new Date(0).toISOString() };
    }
    const sent = Array.isArray(parsed.sent) ? (parsed.sent as LifecycleSentRecord[]) : [];
    return {
      clientId,
      sent,
      updatedAt: String(parsed.updatedAt || new Date().toISOString()),
    };
  } catch {
    return { clientId, sent: [], updatedAt: new Date(0).toISOString() };
  }
}

export function recordLifecycleSent(input: {
  clientId: string;
  event: LifecycleEventKey;
  recipient: string;
}): LifecycleTenantState {
  const current = readLifecycleState(input.clientId);
  const next: LifecycleTenantState = {
    clientId: input.clientId,
    sent: [
      ...current.sent,
      {
        event: input.event,
        sentAt: new Date().toISOString(),
        recipient: input.recipient,
      },
    ],
    updatedAt: new Date().toISOString(),
  };
  writeJsonAtomic(getLifecycleFilePath(input.clientId), next);
  return next;
}

function wasEventSent(state: LifecycleTenantState, event: LifecycleEventKey): boolean {
  return state.sent.some((s) => s.event === event);
}

function wasEventSentWithinDays(
  state: LifecycleTenantState,
  event: LifecycleEventKey,
  days: number,
  now: Date,
): boolean {
  const cutoff = now.getTime() - days * 24 * 60 * 60 * 1000;
  return state.sent.some((s) => {
    if (s.event !== event) return false;
    const t = Date.parse(s.sentAt);
    return Number.isFinite(t) && t >= cutoff;
  });
}

function readTrialOnDisk(clientId: string): TrialState | null {
  const filePath = path.join(projectRoot(), "data", "saas", "trial", clientId + ".json");
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as TrialState;
  } catch {
    return null;
  }
}

function readSubscriptionOnDisk(clientId: string): BillingSubscriptionRecord | null {
  const filePath = path.join(projectRoot(), "data", "saas", "billing", clientId + ".json");
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as BillingSubscriptionRecord;
  } catch {
    return null;
  }
}

function resolveRecipient(
  tenant: TenantClientIndexItem,
  subscription: BillingSubscriptionRecord | null,
): { email: string; name: string } | null {
  // Prioridad 1: billing email si no es el default sintético (tiene @).
  if (subscription?.billingEmail && !subscription.billingEmail.endsWith(".local")) {
    return { email: subscription.billingEmail, name: tenant.displayName };
  }

  // Prioridad 2: primera cuenta admin/owner activa.
  const accounts = listTenantAccounts(tenant.clientId);
  const firstAdmin =
    accounts.find((a) => a.role === "owner" && a.status === "active") ||
    accounts.find((a) => a.role === "admin" && a.status === "active") ||
    accounts[0];
  if (firstAdmin && firstAdmin.email) {
    return {
      email: firstAdmin.email,
      name: firstAdmin.fullName || tenant.displayName,
    };
  }

  // Prioridad 3: fallback al billing email aunque sea sintético.
  if (subscription?.billingEmail) {
    return { email: subscription.billingEmail, name: tenant.displayName };
  }

  return null;
}

function renderEvent(
  key: LifecycleEventKey,
  ctx: LifecycleContext,
): { subject: string; text: string } | null {
  const def = LIFECYCLE_EVENTS.find((e) => e.key === key);
  if (!def) return null;
  return def.render(ctx);
}

export function evaluatePendingEvents(): PendingLifecycleEvent[] {
  const now = new Date();
  const tenants = listTenantClientsIndex();
  const pending: PendingLifecycleEvent[] = [];

  for (const tenant of tenants) {
    const trial = readTrialOnDisk(tenant.clientId);
    const subscription = readSubscriptionOnDisk(tenant.clientId);
    const state = readLifecycleState(tenant.clientId);
    const recipient = resolveRecipient(tenant, subscription);
    if (!recipient) continue;

    const ctx: LifecycleContext = {
      tenant: {
        clientId: tenant.clientId,
        slug: tenant.slug,
        displayName: tenant.displayName,
      },
      trial,
      subscription,
      recipient,
      now,
    };

    const candidates: Array<{ key: LifecycleEventKey; reason: string } | null> = [];

    // trial-reminder-7d — trial activo, vence en ~7 días (6/7/8). No reenvío dentro de 5 días.
    if (
      trial &&
      trial.status === "active" &&
      !subscription?.currentPlanKey.startsWith("starter") &&
      !subscription?.currentPlanKey.startsWith("growth") &&
      !subscription?.currentPlanKey.startsWith("pro")
    ) {
      const d = daysUntil(trial.expiresAt, now);
      if (d >= 6 && d <= 8 && !wasEventSentWithinDays(state, "trial-reminder-7d", 5, now)) {
        candidates.push({
          key: "trial-reminder-7d",
          reason: "Trial vence en " + d + " días.",
        });
      }

      // trial-reminder-1d — vence en ≤ 1 día. No reenviar dentro de 2 días.
      if (d >= 0 && d <= 1 && !wasEventSentWithinDays(state, "trial-reminder-1d", 2, now)) {
        candidates.push({
          key: "trial-reminder-1d",
          reason: "Trial vence en " + d + " día" + (d === 1 ? "" : "s") + ".",
        });
      }
    }

    // trial-expired — trial ya expired y el tenant NO tiene plan de pago activo. Una sola vez.
    if (
      trial &&
      trial.status === "expired" &&
      (!subscription ||
        subscription.currentPlanKey === "trial" ||
        subscription.status === "trialing" ||
        subscription.status === "cancelled") &&
      !wasEventSent(state, "trial-expired")
    ) {
      candidates.push({
        key: "trial-expired",
        reason: "Trial expirado y sin plan de pago.",
      });
    }

    // subscription-activated — hay subscription activa con plan de pago y nunca se notificó.
    if (
      subscription &&
      subscription.status === "active" &&
      subscription.currentPlanKey !== "trial" &&
      !wasEventSent(state, "subscription-activated")
    ) {
      candidates.push({
        key: "subscription-activated",
        reason: "Plan " + subscription.currentPlanKey + " activo sin notificación previa.",
      });
    }

    // subscription-cancelled — status cancelled o scheduled_cancel y no se notificó.
    if (
      subscription &&
      (subscription.status === "cancelled" || subscription.status === "scheduled_cancel") &&
      !wasEventSent(state, "subscription-cancelled")
    ) {
      candidates.push({
        key: "subscription-cancelled",
        reason:
          subscription.status === "scheduled_cancel"
            ? "Cancelación programada sin notificación."
            : "Suscripción cancelada sin notificación.",
      });
    }

    // reactivation-invite — cancelada hace ≥ 30 días, sin nuevo plan de pago, una vez.
    if (
      subscription &&
      subscription.status === "cancelled" &&
      subscription.updatedAt &&
      Date.now() - Date.parse(subscription.updatedAt) >= 30 * 24 * 60 * 60 * 1000 &&
      !wasEventSent(state, "reactivation-invite")
    ) {
      candidates.push({
        key: "reactivation-invite",
        reason: "Cancelada hace ≥ 30 días, sin reactivación.",
      });
    }

    for (const c of candidates) {
      if (!c) continue;
      const rendered = renderEvent(c.key, ctx);
      if (!rendered) continue;
      pending.push({
        clientId: tenant.clientId,
        slug: tenant.slug,
        displayName: tenant.displayName,
        event: c.key,
        reason: c.reason,
        recipient,
        rendered,
      });
    }
  }

  return pending;
}

export function listAllLifecycleState(): LifecycleTenantState[] {
  const dir = getLifecycleDir();
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  const out: LifecycleTenantState[] = [];
  for (const f of files) {
    const clientId = f.replace(/\.json$/, "");
    out.push(readLifecycleState(clientId));
  }
  return out;
}
