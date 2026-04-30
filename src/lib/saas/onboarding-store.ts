import fs from "node:fs";
import path from "node:path";
import { writeJsonAtomic } from "@/lib/saas/fs-atomic";

export type OnboardingState = {
  tenantId: string;
  clientId: string;
  slug: string;
  accountId: string;
  status: "pending" | "in_progress" | "completed";
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  steps: Array<{
    key: string;
    label: string;
    completed: boolean;
    completedAt?: string;
  }>;
};

function ensureDirectory(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function getProjectRoot(): string {
  return /*turbopackIgnore: true*/ process.cwd();
}

function getOnboardingRootDir(): string {
  const dirPath = path.join(getProjectRoot(), "data", "saas", "onboarding");
  ensureDirectory(dirPath);
  return dirPath;
}

function normalizeClientId(clientId: string): string {
  const safeClientId = String(clientId || "").trim();
  if (!safeClientId) {
    throw new Error("Falta clientId para resolver onboarding.");
  }

  return safeClientId;
}

function normalizeAccountId(accountId: string): string {
  const safeAccountId = String(accountId || "").trim();
  if (!safeAccountId) {
    throw new Error("Falta accountId para resolver onboarding.");
  }

  return safeAccountId;
}

function getOnboardingFilePath(clientId: string, accountId: string): string {
  return path.join(
    getOnboardingRootDir(),
    normalizeClientId(clientId) + "__" + normalizeAccountId(accountId) + ".json"
  );
}

function readOnboardingStateSafe(filePath: string): OnboardingState | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw) as OnboardingState;
  } catch {
    return null;
  }
}

function writeOnboardingState(filePath: string, value: OnboardingState) {
  writeJsonAtomic(filePath, value);
}

function buildDefaultSteps(): OnboardingState["steps"] {
  return [
    {
      key: "welcome",
      label: "Bienvenida",
      completed: false,
    },
    {
      key: "company",
      label: "Datos de empresa",
      completed: false,
    },
    {
      key: "branding",
      label: "Branding inicial",
      completed: false,
    },
    {
      key: "users",
      label: "Usuarios iniciales",
      completed: false,
    },
    {
      key: "modules",
      label: "Revisión de módulos",
      completed: false,
    },
  ];
}

export function getOrCreateOnboardingState(input: {
  tenantId: string;
  clientId: string;
  slug: string;
  accountId: string;
}): OnboardingState {
  const filePath = getOnboardingFilePath(input.clientId, input.accountId);
  const existing = readOnboardingStateSafe(filePath);

  if (existing) {
    return existing;
  }

  const now = new Date().toISOString();

  const created: OnboardingState = {
    tenantId: input.tenantId,
    clientId: normalizeClientId(input.clientId),
    slug: String(input.slug || "").trim(),
    accountId: normalizeAccountId(input.accountId),
    status: "pending",
    createdAt: now,
    updatedAt: now,
    steps: buildDefaultSteps(),
  };

  writeOnboardingState(filePath, created);
  return created;
}

export function saveOnboardingState(state: OnboardingState): OnboardingState {
  const normalized: OnboardingState = {
    ...state,
    clientId: normalizeClientId(state.clientId),
    accountId: normalizeAccountId(state.accountId),
    slug: String(state.slug || "").trim(),
    updatedAt: new Date().toISOString(),
  };

  writeOnboardingState(
    getOnboardingFilePath(normalized.clientId, normalized.accountId),
    normalized
  );

  return normalized;
}

export function markOnboardingStarted(input: {
  tenantId: string;
  clientId: string;
  slug: string;
  accountId: string;
}): OnboardingState {
  const current = getOrCreateOnboardingState(input);
  const now = new Date().toISOString();

  return saveOnboardingState({
    ...current,
    status: current.status === "completed" ? "completed" : "in_progress",
    startedAt: current.startedAt || now,
  });
}

export function completeOnboardingStep(input: {
  tenantId: string;
  clientId: string;
  slug: string;
  accountId: string;
  stepKey: string;
}): OnboardingState {
  const current = markOnboardingStarted(input);
  const now = new Date().toISOString();
  const targetKey = String(input.stepKey || "").trim();

  const steps = current.steps.map((step) => {
    if (step.key !== targetKey) {
      return step;
    }

    return {
      ...step,
      completed: true,
      completedAt: step.completedAt || now,
    };
  });

  const allCompleted =
    steps.length > 0 && steps.every((step) => step.completed);

  return saveOnboardingState({
    ...current,
    status: allCompleted ? "completed" : "in_progress",
    completedAt: allCompleted ? now : current.completedAt,
    steps,
  });
}

export function completeOnboarding(input: {
  tenantId: string;
  clientId: string;
  slug: string;
  accountId: string;
}): OnboardingState {
  const current = markOnboardingStarted(input);
  const now = new Date().toISOString();

  return saveOnboardingState({
    ...current,
    status: "completed",
    completedAt: now,
    steps: current.steps.map((step) => ({
      ...step,
      completed: true,
      completedAt: step.completedAt || now,
    })),
  });
}

/**
 * ---------------------------------------------------------------------------
 * UI-facing onboarding state used by the ERP "primeros pasos" panel.
 *
 * This is a separate persistence namespace from the workflow state above:
 * the workflow state tracks backend steps (status / startedAt / completedAt),
 * while this one tracks user-interaction preferences (dismissed, manual
 * overrides per step). Keeping them in separate files prevents either side
 * from overwriting the other when the UI sends partial updates.
 * ---------------------------------------------------------------------------
 */

export type OnboardingUiState = {
  clientId: string;
  accountId: string;
  dismissed: boolean;
  manualDoneMap: Record<string, boolean>;
  createdAt: string;
  updatedAt: string;
};

function getOnboardingUiRootDir(): string {
  const dirPath = path.join(getProjectRoot(), "data", "saas", "onboarding-ui");
  ensureDirectory(dirPath);
  return dirPath;
}

function getOnboardingUiFilePath(clientId: string, accountId: string): string {
  return path.join(
    getOnboardingUiRootDir(),
    normalizeClientId(clientId) + "__" + normalizeAccountId(accountId) + ".json"
  );
}

function readOnboardingUiStateSafe(filePath: string): OnboardingUiState | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw) as OnboardingUiState;
  } catch {
    return null;
  }
}

export function getOnboardingState(
  clientId: string,
  accountId: string
): OnboardingUiState {
  const filePath = getOnboardingUiFilePath(clientId, accountId);
  const existing = readOnboardingUiStateSafe(filePath);

  if (existing) {
    return existing;
  }

  const now = new Date().toISOString();
  const defaults: OnboardingUiState = {
    clientId: normalizeClientId(clientId),
    accountId: normalizeAccountId(accountId),
    dismissed: false,
    manualDoneMap: {},
    createdAt: now,
    updatedAt: now,
  };

  return defaults;
}

export function saveOnboardingUiState(input: {
  clientId: string;
  accountId: string;
  dismissed?: boolean;
  manualDoneMap?: Record<string, boolean>;
}): OnboardingUiState {
  const filePath = getOnboardingUiFilePath(input.clientId, input.accountId);
  const existing = readOnboardingUiStateSafe(filePath);
  const now = new Date().toISOString();

  const next: OnboardingUiState = {
    clientId: normalizeClientId(input.clientId),
    accountId: normalizeAccountId(input.accountId),
    dismissed: Boolean(input.dismissed ?? existing?.dismissed ?? false),
    manualDoneMap: {
      ...(existing?.manualDoneMap || {}),
      ...(input.manualDoneMap || {}),
    },
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  writeJsonAtomic(filePath, next);
  return next;
}