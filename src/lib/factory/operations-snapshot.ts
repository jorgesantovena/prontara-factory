/**
 * Snapshot operativo consolidado para el panel /factory/operaciones.
 *
 * Consume fuentes ya existentes y las agrega en un único payload:
 *   - getFactoryHealthSnapshot() → tenants, salud, issues
 *   - trial-store → detectar trials expirando en ≤ N días
 *   - provisioning-state-machine → detectar flujos de alta sin terminar
 *   - readRecentAuditEntries → últimas actividades del chat
 *
 * Todas las lecturas son de ficheros JSON locales. No tocamos disco ni
 * ejecutamos nada. Si alguna fuente falla, degradamos con sección vacía
 * pero el snapshot global no rompe.
 */
import fs from "node:fs";
import path from "node:path";
import {
  getFactoryHealthSnapshot,
  type FactoryHealthTenantRow,
} from "@/lib/factory/factory-health";
import {
  listTenantClientsIndex,
  type TenantClientIndexItem,
} from "@/lib/saas/tenant-clients-index";
import {
  getProvisioningStateRecord,
  type ProvisioningStateRecord,
  type ProvisioningState,
} from "@/lib/factory/provisioning-state-machine";
import type { AuditEntry } from "@/lib/factory-chat/audit";
import { readRecentAuditEntriesAsync } from "@/lib/persistence/factory-chat-audit-async";

const TRIAL_ALERT_DAYS = 3;
const CHAT_ACTIVITY_LIMIT = 15;
const CHAT_ACTIVITY_LOOKBACK_DAYS = 2;

export type TrialEndingSoonItem = {
  clientId: string;
  slug: string;
  displayName: string;
  daysRemaining: number;
  expiresAt: string;
  status: "active" | "expired";
};

export type ProvisioningIncidentItem = {
  clientId: string;
  displayName: string;
  slug: string;
  state: ProvisioningState;
  lastTransitionAt: string;
  failureMessage: string | null;
};

export type HealthIncidentItem = {
  clientId: string;
  displayName: string;
  slug: string;
  issueCount: number;
  worstSeverity: "ok" | "info" | "warn" | "danger";
  topIssues: Array<{ label: string; severity: string; detail: string }>;
};

export type ChatActivityItem = {
  at: string;
  actorEmail: string;
  tool: string;
  outcome: "success" | "error" | "skipped";
  durationMs: number;
  touchedPaths?: string[];
  error?: string;
};

export type OperationsSnapshot = {
  generatedAt: string;
  summary: {
    totalTenants: number;
    healthyTenants: number;
    partialTenants: number;
    corruptTenants: number;
    trialsEndingSoon: number;
    provisioningIncidents: number;
    chatErrors24h: number;
  };
  trialsEndingSoon: TrialEndingSoonItem[];
  provisioningIncidents: ProvisioningIncidentItem[];
  healthIncidents: HealthIncidentItem[];
  chatActivity: ChatActivityItem[];
};

function projectRoot(): string {
  return process.cwd();
}

function readTrialOnDisk(clientId: string): {
  status: "active" | "expired";
  expiresAt: string;
} | null {
  const filePath = path.join(projectRoot(), "data", "saas", "trial", clientId + ".json");
  if (!fs.existsSync(filePath)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const status = parsed?.status === "expired" ? "expired" : "active";
    const expiresAt = typeof parsed?.expiresAt === "string" ? parsed.expiresAt : "";
    if (!expiresAt) return null;
    return { status, expiresAt };
  } catch {
    return null;
  }
}

function daysUntil(iso: string, now: number): number {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return Number.POSITIVE_INFINITY;
  return Math.ceil((t - now) / (24 * 60 * 60 * 1000));
}

function severityRank(s: string): number {
  switch (s) {
    case "danger":
      return 3;
    case "warn":
      return 2;
    case "info":
      return 1;
    default:
      return 0;
  }
}

function worstSeverity(
  issues: FactoryHealthTenantRow["issues"],
): "ok" | "info" | "warn" | "danger" {
  let best: "ok" | "info" | "warn" | "danger" = "ok";
  for (const i of issues) {
    if (severityRank(i.severity) > severityRank(best)) {
      best = i.severity as typeof best;
    }
  }
  return best;
}

function buildTrialsEndingSoon(
  tenants: TenantClientIndexItem[],
  now: number,
): TrialEndingSoonItem[] {
  const items: TrialEndingSoonItem[] = [];
  for (const t of tenants) {
    const trial = readTrialOnDisk(t.clientId);
    if (!trial) continue;
    const daysRemaining = daysUntil(trial.expiresAt, now);
    if (daysRemaining > TRIAL_ALERT_DAYS) continue;
    items.push({
      clientId: t.clientId,
      slug: t.slug,
      displayName: t.displayName,
      daysRemaining,
      expiresAt: trial.expiresAt,
      status: trial.status,
    });
  }
  items.sort((a, b) => a.daysRemaining - b.daysRemaining);
  return items;
}

function buildProvisioningIncidents(
  tenants: TenantClientIndexItem[],
): ProvisioningIncidentItem[] {
  const incidents: ProvisioningIncidentItem[] = [];
  for (const t of tenants) {
    let record: ProvisioningStateRecord | null = null;
    try {
      record = getProvisioningStateRecord(t.clientId);
    } catch {
      record = null;
    }
    if (!record) continue;
    if (record.state === "access_ready") continue;
    incidents.push({
      clientId: t.clientId,
      displayName: t.displayName,
      slug: t.slug,
      state: record.state,
      lastTransitionAt: record.lastTransitionAt,
      failureMessage: record.failure?.message || null,
    });
  }
  incidents.sort((a, b) => {
    if (a.state === "failed" && b.state !== "failed") return -1;
    if (b.state === "failed" && a.state !== "failed") return 1;
    return b.lastTransitionAt.localeCompare(a.lastTransitionAt);
  });
  return incidents;
}

function buildHealthIncidents(
  rows: FactoryHealthTenantRow[],
): HealthIncidentItem[] {
  const out: HealthIncidentItem[] = [];
  for (const row of rows) {
    if (!row.issues || row.issues.length === 0) continue;
    out.push({
      clientId: row.clientId,
      displayName: row.displayName,
      slug: row.slug,
      issueCount: row.issues.length,
      worstSeverity: worstSeverity(row.issues),
      topIssues: row.issues.slice(0, 3).map((i) => ({
        label: i.label,
        severity: i.severity,
        detail: i.detail,
      })),
    });
  }
  out.sort((a, b) => severityRank(b.worstSeverity) - severityRank(a.worstSeverity));
  return out;
}

function buildChatActivity(entries: AuditEntry[]): ChatActivityItem[] {
  return entries.slice(0, CHAT_ACTIVITY_LIMIT).map((e) => ({
    at: e.at,
    actorEmail: e.actor.email,
    tool: e.tool,
    outcome: e.outcome,
    durationMs: e.durationMs,
    touchedPaths: e.touchedPaths,
    error: e.error,
  }));
}

function countChatErrors24h(entries: AuditEntry[], now: number): number {
  const windowMs = 24 * 60 * 60 * 1000;
  return entries.filter((e) => {
    if (e.outcome !== "error") return false;
    const t = new Date(e.at).getTime();
    return Number.isFinite(t) && now - t <= windowMs;
  }).length;
}

export async function getOperationsSnapshot(): Promise<OperationsSnapshot> {
  const now = Date.now();
  const tenants = listTenantClientsIndex();
  const health = getFactoryHealthSnapshot();

  const trialsEndingSoon = buildTrialsEndingSoon(tenants, now);
  const provisioningIncidents = buildProvisioningIncidents(tenants);
  const healthIncidents = buildHealthIncidents(health.rows);

  const auditEntries = await readRecentAuditEntriesAsync({
    limit: 200,
    lookbackDays: CHAT_ACTIVITY_LOOKBACK_DAYS,
  });
  const chatActivity = buildChatActivity(auditEntries);
  const chatErrors24h = countChatErrors24h(auditEntries, now);

  return {
    generatedAt: new Date(now).toISOString(),
    summary: {
      totalTenants: health.summary.totalTenants,
      healthyTenants: health.summary.healthyTenants,
      partialTenants: health.summary.partialTenants,
      corruptTenants: health.summary.corruptTenants,
      trialsEndingSoon: trialsEndingSoon.length,
      provisioningIncidents: provisioningIncidents.length,
      chatErrors24h,
    },
    trialsEndingSoon,
    provisioningIncidents,
    healthIncidents,
    chatActivity,
  };
}
