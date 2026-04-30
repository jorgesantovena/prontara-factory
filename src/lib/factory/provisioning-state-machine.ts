import fs from "node:fs";
import path from "node:path";
import { writeJsonAtomic } from "@/lib/saas/fs-atomic";

/**
 * Explicit provisioning state machine.
 *
 * Before this module, the "status" of a client provisioning was inferred from
 * the presence of loose files across the filesystem (signup/*.json,
 * orders/*.json, accounts/*.json, tenants/*.json, ...). That made the state
 * implicit, hard to debug, and impossible to tell apart cases like
 * "we intentionally skipped the activation email" vs "the email step failed".
 *
 * This module introduces an explicit, typed state machine persisted to
 *   data/saas/provisioning/<clientId>.json
 *
 * Legal transitions are enforced: callers cannot jump from `created` straight
 * to `access_ready` without going through the intermediate steps. Every
 * transition is timestamped and recorded in the history log so that the
 * Factory dashboard can show a real timeline of what happened, with reasons.
 *
 * The legacy reporter in factory-provisioning.ts keeps working. New code and
 * any pipeline mutations should go through `recordProvisioningTransition`.
 */

export type ProvisioningState =
  | "created"
  | "account_created"
  | "tenant_created"
  | "runtime_ready"
  | "email_ready"
  | "email_sent"
  | "access_ready"
  | "failed";

export type ProvisioningTransitionReason = {
  code?: string;
  message?: string;
  failedStep?: ProvisioningState;
};

export type ProvisioningHistoryEntry = {
  at: string;
  from: ProvisioningState | null;
  to: ProvisioningState;
  reason?: ProvisioningTransitionReason;
  metadata?: Record<string, unknown>;
};

export type ProvisioningStateRecord = {
  clientId: string;
  state: ProvisioningState;
  lastTransitionAt: string;
  createdAt: string;
  updatedAt: string;
  failure?: ProvisioningTransitionReason | null;
  history: ProvisioningHistoryEntry[];
};

/**
 * Allowed forward transitions. `failed` is reachable from every non-terminal
 * state. The happy path is a strict left-to-right progression.
 */
const LEGAL_TRANSITIONS: Record<ProvisioningState, ProvisioningState[]> = {
  created: ["account_created", "failed"],
  account_created: ["tenant_created", "failed"],
  tenant_created: ["runtime_ready", "failed"],
  runtime_ready: ["email_ready", "failed"],
  email_ready: ["email_sent", "failed"],
  email_sent: ["access_ready", "failed"],
  access_ready: [],
  failed: [
    // Allow explicit recovery: an operator can restart the pipeline from any
    // earlier step once the root cause is fixed.
    "created",
    "account_created",
    "tenant_created",
    "runtime_ready",
    "email_ready",
    "email_sent",
    "access_ready",
  ],
};

function getProvisioningFilePath(clientId: string): string {
  const safe = String(clientId || "").trim();
  if (!safe) {
    throw new Error("clientId is required for provisioning state.");
  }
  return path.join(
    process.cwd(),
    "data",
    "saas",
    "provisioning",
    safe + ".json"
  );
}

function readStateRecord(clientId: string): ProvisioningStateRecord | null {
  const filePath = getProvisioningFilePath(clientId);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as ProvisioningStateRecord;
  } catch {
    return null;
  }
}

export function getProvisioningStateRecord(
  clientId: string
): ProvisioningStateRecord | null {
  return readStateRecord(clientId);
}

export function getProvisioningState(clientId: string): ProvisioningState | null {
  return readStateRecord(clientId)?.state || null;
}

export type RecordTransitionInput = {
  clientId: string;
  to: ProvisioningState;
  reason?: ProvisioningTransitionReason;
  metadata?: Record<string, unknown>;
  /**
   * If true, allow transitions that do not appear in LEGAL_TRANSITIONS. Only
   * the factory hardening / repair scripts should pass this.
   */
  allowForced?: boolean;
};

/**
 * Records a transition atomically. Throws if the transition is not legal.
 */
export function recordProvisioningTransition(
  input: RecordTransitionInput
): ProvisioningStateRecord {
  const now = new Date().toISOString();
  const current = readStateRecord(input.clientId);

  const from = current?.state || null;
  const to = input.to;

  if (current && !input.allowForced) {
    const legal = LEGAL_TRANSITIONS[current.state] || [];
    if (!legal.includes(to) && to !== current.state) {
      throw new Error(
        "Illegal provisioning transition: " +
          current.state +
          " -> " +
          to +
          " (clientId=" +
          input.clientId +
          ")"
      );
    }
  }

  const historyEntry: ProvisioningHistoryEntry = {
    at: now,
    from,
    to,
    reason: input.reason,
    metadata: input.metadata,
  };

  const next: ProvisioningStateRecord = {
    clientId: input.clientId,
    state: to,
    lastTransitionAt: now,
    createdAt: current?.createdAt || now,
    updatedAt: now,
    failure: to === "failed" ? input.reason || null : null,
    history: [...(current?.history || []), historyEntry].slice(-50),
  };

  writeJsonAtomic(getProvisioningFilePath(input.clientId), next);
  return next;
}

export function isTerminalState(state: ProvisioningState): boolean {
  return state === "access_ready" || state === "failed";
}
