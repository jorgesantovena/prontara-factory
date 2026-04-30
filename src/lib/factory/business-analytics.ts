/**
 * Agregador de métricas de negocio para /factory/analiticas.
 *
 * Lee las suscripciones persistidas en `data/saas/billing/<clientId>.json`
 * y las facturas embebidas para calcular:
 *
 *   - MRR actual (€ por mes) y MRR por plan.
 *   - Tendencia MRR últimos 6 meses (reconstruida a partir de createdAt/cancelAt).
 *   - Churn rate últimos 30 días.
 *   - LTV medio entre tenants con ingreso > 0.
 *   - Top 5 tenants por ingreso acumulado.
 *   - Desglose del funnel: trial, activo, scheduled_cancel, cancelado.
 *
 * Las tendencias son aproximadas: usan el estado actual + fechas de la
 * suscripción para reconstruir un pasado plausible. No son un histórico
 * auditado (eso requeriría snapshots diarios que no existen todavía).
 */
import fs from "node:fs";
import path from "node:path";
import type {
  BillingPlanKey,
  BillingSubscriptionRecord,
  BillingSubscriptionStatus,
} from "@/lib/saas/billing-definition";
import { getBillingCatalog } from "@/lib/saas/billing-store";
import { listTenantClientsIndex } from "@/lib/saas/tenant-clients-index";

const PAYING_STATUSES: BillingSubscriptionStatus[] = ["active", "scheduled_cancel"];
const TREND_MONTHS = 6;
const CHURN_WINDOW_DAYS = 30;
const TOP_TENANTS_LIMIT = 5;

export type MrrByPlanRow = {
  planKey: BillingPlanKey;
  planLabel: string;
  activeCount: number;
  mrrCents: number;
};

export type MrrMonthPoint = {
  label: string;
  month: string;
  mrrCents: number;
  activeCount: number;
};

export type TopTenantRow = {
  clientId: string;
  slug: string;
  displayName: string;
  planKey: BillingPlanKey;
  status: BillingSubscriptionStatus;
  totalPaidCents: number;
  invoiceCount: number;
};

export type SubscriptionStatusBreakdown = {
  trialing: number;
  active: number;
  scheduledCancel: number;
  cancelled: number;
  pendingCheckout: number;
};

export type BusinessAnalyticsSnapshot = {
  generatedAt: string;
  currency: "EUR";
  summary: {
    totalTenants: number;
    payingTenants: number;
    mrrCents: number;
    arrCents: number;
    churnRate30d: number;
    ltvAvgCents: number;
    /** Ingresos por setup fees en lo que va de mes actual (no recurrente). */
    nonRecurringMonthCents: number;
  };
  statusBreakdown: SubscriptionStatusBreakdown;
  mrrByPlan: MrrByPlanRow[];
  mrrTrend: MrrMonthPoint[];
  topTenants: TopTenantRow[];
};

function projectRoot(): string {
  return process.cwd();
}

function readSubscriptionOnDisk(clientId: string): BillingSubscriptionRecord | null {
  const filePath = path.join(projectRoot(), "data", "saas", "billing", clientId + ".json");
  if (!fs.existsSync(filePath)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as BillingSubscriptionRecord;
  } catch {
    return null;
  }
}

function loadAllSubscriptions(): BillingSubscriptionRecord[] {
  const tenants = listTenantClientsIndex();
  const out: BillingSubscriptionRecord[] = [];
  for (const t of tenants) {
    const sub = readSubscriptionOnDisk(t.clientId);
    if (sub) out.push(sub);
  }
  return out;
}

/**
 * Precio mensual recurrente de la suscripción según el modelo real:
 * soporte = (12 € por usuario concurrente facturado) × users.
 * Solo se cuenta si supportActive=true.
 */
function monthlyRecurringCents(sub: BillingSubscriptionRecord): number {
  if (!sub.supportActive) return 0;
  const catalog = getBillingCatalog();
  const plan = catalog.find((p) => p.key === sub.currentPlanKey);
  const perUser = plan?.supportMonthlyCentsPerUser ?? 0;
  const users = Math.max(1, sub.concurrentUsersBilled || 0);
  return perUser * users;
}

function labelOfPlan(planKey: BillingPlanKey): string {
  const catalog = getBillingCatalog();
  const plan = catalog.find((p) => p.key === planKey);
  return plan ? plan.label : planKey;
}

/**
 * True si esta suscripción factura recurrentemente (soporte activo) al
 * cierre del mes target. Trial nunca cuenta. Plan de pago sin soporte
 * tampoco (han pagado el alta pero no contrataron mantenimiento).
 */
function wasActiveAtEndOfMonth(
  sub: BillingSubscriptionRecord,
  monthEnd: Date,
): boolean {
  if (sub.currentPlanKey === "trial") return false;
  if (!sub.supportActive) return false;

  const created = Date.parse(sub.createdAt);
  if (!Number.isFinite(created) || created > monthEnd.getTime()) return false;

  if (sub.cancelAt) {
    const cancelled = Date.parse(sub.cancelAt);
    if (Number.isFinite(cancelled) && cancelled <= monthEnd.getTime()) return false;
  }

  if (sub.status === "cancelled") {
    const updated = Date.parse(sub.updatedAt);
    if (Number.isFinite(updated) && updated <= monthEnd.getTime()) return false;
  }

  return true;
}

function mrrCentsAtDate(
  subs: BillingSubscriptionRecord[],
  date: Date,
): { mrrCents: number; activeCount: number } {
  let mrrCents = 0;
  let activeCount = 0;
  for (const sub of subs) {
    if (!wasActiveAtEndOfMonth(sub, date)) continue;
    mrrCents += monthlyRecurringCents(sub);
    activeCount += 1;
  }
  return { mrrCents, activeCount };
}

function buildTrend(subs: BillingSubscriptionRecord[], now: Date): MrrMonthPoint[] {
  const points: MrrMonthPoint[] = [];
  const currentMonth = now.getUTCMonth();
  const currentYear = now.getUTCFullYear();
  for (let i = TREND_MONTHS - 1; i >= 0; i--) {
    const targetYear = currentYear + Math.floor((currentMonth - i) / 12);
    const targetMonth = ((currentMonth - i) % 12 + 12) % 12;
    // Fin del mes target, 23:59:59 UTC.
    const monthEnd = new Date(Date.UTC(targetYear, targetMonth + 1, 0, 23, 59, 59));
    const { mrrCents, activeCount } = mrrCentsAtDate(subs, monthEnd);
    const label = monthEnd.toLocaleString("es", { month: "short", year: "2-digit" });
    points.push({
      label,
      month: targetYear + "-" + String(targetMonth + 1).padStart(2, "0"),
      mrrCents,
      activeCount,
    });
  }
  return points;
}

function currentMrrByPlan(subs: BillingSubscriptionRecord[]): MrrByPlanRow[] {
  const now = new Date();
  const byKey = new Map<BillingPlanKey, { count: number; cents: number }>();
  for (const sub of subs) {
    if (!wasActiveAtEndOfMonth(sub, now)) continue;
    const existing = byKey.get(sub.currentPlanKey) || { count: 0, cents: 0 };
    existing.count += 1;
    existing.cents += monthlyRecurringCents(sub);
    byKey.set(sub.currentPlanKey, existing);
  }
  const rows: MrrByPlanRow[] = [];
  for (const [planKey, agg] of byKey.entries()) {
    rows.push({
      planKey,
      planLabel: labelOfPlan(planKey),
      activeCount: agg.count,
      mrrCents: agg.cents,
    });
  }
  rows.sort((a, b) => b.mrrCents - a.mrrCents);
  return rows;
}

/**
 * Suma de setup fees cobrados en lo que va de mes actual. No es MRR; es
 * ingreso no recurrente que se reporta aparte para no inflar las métricas
 * de subscription health.
 */
function setupFeesThisMonth(subs: BillingSubscriptionRecord[], now: Date): number {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  let total = 0;
  for (const sub of subs) {
    for (const inv of sub.invoices || []) {
      if (inv.status !== "paid") continue;
      const ts = Date.parse(inv.createdAt);
      if (!Number.isFinite(ts) || ts < monthStart.getTime()) continue;
      total += inv.amountCents;
    }
  }
  return total;
}

function computeStatusBreakdown(
  subs: BillingSubscriptionRecord[],
): SubscriptionStatusBreakdown {
  const out: SubscriptionStatusBreakdown = {
    trialing: 0,
    active: 0,
    scheduledCancel: 0,
    cancelled: 0,
    pendingCheckout: 0,
  };
  for (const s of subs) {
    switch (s.status) {
      case "trialing":
        out.trialing += 1;
        break;
      case "active":
        out.active += 1;
        break;
      case "scheduled_cancel":
        out.scheduledCancel += 1;
        break;
      case "cancelled":
        out.cancelled += 1;
        break;
      case "pending_checkout":
        out.pendingCheckout += 1;
        break;
    }
  }
  return out;
}

function computeChurnRate30d(
  subs: BillingSubscriptionRecord[],
  now: Date,
): number {
  const windowStart = now.getTime() - CHURN_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  // Activos al inicio de la ventana: los que cumplían wasActiveAtEndOfMonth
  // en ese momento. "Activos" aquí = de pago (no trial, no cancelled ya).
  const windowStartDate = new Date(windowStart);
  let atRisk = 0;
  for (const sub of subs) {
    if (wasActiveAtEndOfMonth(sub, windowStartDate)) atRisk += 1;
  }
  if (atRisk === 0) return 0;

  let churned = 0;
  for (const sub of subs) {
    const cancelDate =
      sub.status === "cancelled"
        ? Date.parse(sub.updatedAt)
        : sub.cancelAt
          ? Date.parse(sub.cancelAt)
          : null;
    if (!cancelDate || !Number.isFinite(cancelDate)) continue;
    if (cancelDate >= windowStart && cancelDate <= now.getTime()) {
      // Solo cuenta como churn si antes era de pago.
      if (sub.currentPlanKey !== "trial") churned += 1;
    }
  }
  return atRisk > 0 ? churned / atRisk : 0;
}

function sumPaidInvoicesCents(sub: BillingSubscriptionRecord): {
  totalCents: number;
  invoiceCount: number;
} {
  let totalCents = 0;
  let invoiceCount = 0;
  for (const inv of sub.invoices || []) {
    if (inv.status === "paid") {
      totalCents += inv.amountCents;
      invoiceCount += 1;
    }
  }
  return { totalCents, invoiceCount };
}

function computeLtvAvgCents(subs: BillingSubscriptionRecord[]): number {
  let totalCents = 0;
  let tenantCount = 0;
  for (const sub of subs) {
    const { totalCents: paid } = sumPaidInvoicesCents(sub);
    if (paid > 0) {
      totalCents += paid;
      tenantCount += 1;
    }
  }
  return tenantCount === 0 ? 0 : Math.round(totalCents / tenantCount);
}

function computeTopTenants(
  subs: BillingSubscriptionRecord[],
): TopTenantRow[] {
  const rows: TopTenantRow[] = [];
  for (const sub of subs) {
    const { totalCents, invoiceCount } = sumPaidInvoicesCents(sub);
    if (totalCents === 0) continue;
    rows.push({
      clientId: sub.clientId,
      slug: sub.slug,
      displayName: sub.displayName,
      planKey: sub.currentPlanKey,
      status: sub.status,
      totalPaidCents: totalCents,
      invoiceCount,
    });
  }
  rows.sort((a, b) => b.totalPaidCents - a.totalPaidCents);
  return rows.slice(0, TOP_TENANTS_LIMIT);
}

export function getBusinessAnalyticsSnapshot(): BusinessAnalyticsSnapshot {
  const now = new Date();
  const subs = loadAllSubscriptions();

  const statusBreakdown = computeStatusBreakdown(subs);
  const mrrByPlan = currentMrrByPlan(subs);
  const mrrCentsCurrent = mrrByPlan.reduce((acc, r) => acc + r.mrrCents, 0);
  const mrrTrend = buildTrend(subs, now);
  const topTenants = computeTopTenants(subs);
  const churnRate30d = computeChurnRate30d(subs, now);
  const ltvAvgCents = computeLtvAvgCents(subs);
  const nonRecurringMonthCents = setupFeesThisMonth(subs, now);

  const payingTenants = subs.filter((s) =>
    PAYING_STATUSES.includes(s.status) && s.currentPlanKey !== "trial",
  ).length;

  return {
    generatedAt: now.toISOString(),
    currency: "EUR",
    summary: {
      totalTenants: subs.length,
      payingTenants,
      mrrCents: mrrCentsCurrent,
      arrCents: mrrCentsCurrent * 12,
      churnRate30d,
      ltvAvgCents,
      nonRecurringMonthCents,
    },
    statusBreakdown,
    mrrByPlan,
    mrrTrend,
    topTenants,
  };
}
