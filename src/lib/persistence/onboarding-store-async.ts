/**
 * Wrapper async dual-mode (postgres | filesystem) sobre onboarding-store.
 *
 * En postgres mode usa la tabla `OnboardingState` (con campo stepsJson Json).
 * En filesystem mode delega a las funciones síncronas que escriben
 * `data/saas/onboarding/<clientId>__<accountId>.json`.
 */
import {
  getOrCreateOnboardingState as fsGetOrCreate,
  saveOnboardingState as fsSave,
  markOnboardingStarted as fsMarkStarted,
  completeOnboardingStep as fsCompleteStep,
  completeOnboarding as fsComplete,
  type OnboardingState,
} from "@/lib/saas/onboarding-store";
import { getPersistenceBackend, withPrisma } from "@/lib/persistence/db";

type Row = {
  id: string;
  tenantId: string;
  clientId: string;
  slug: string;
  accountId: string;
  stepsJson: unknown;
  createdAt: Date;
  updatedAt: Date;
};

function rowToState(r: Row): OnboardingState {
  const steps = Array.isArray(r.stepsJson) ? (r.stepsJson as OnboardingState["steps"]) : [];
  // El status no está en la tabla por defecto: lo inferimos del estado de los pasos.
  const allCompleted = steps.length > 0 && steps.every((s) => s.completed);
  const anyStarted = steps.some((s) => s.completed);
  return {
    tenantId: r.tenantId,
    clientId: r.clientId,
    slug: r.slug,
    accountId: r.accountId,
    status: allCompleted ? "completed" : anyStarted ? "in_progress" : "pending",
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    steps,
  };
}

export async function getOrCreateOnboardingStateAsync(input: {
  tenantId: string;
  clientId: string;
  slug: string;
  accountId: string;
}): Promise<OnboardingState> {
  if (getPersistenceBackend() === "postgres") {
    const result = await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        onboardingState: {
          findUnique: (a: {
            where: { clientId_accountId: { clientId: string; accountId: string } };
          }) => Promise<Row | null>;
          create: (a: { data: Record<string, unknown> }) => Promise<Row>;
        };
      };
      const existing = await c.onboardingState.findUnique({
        where: { clientId_accountId: { clientId: input.clientId, accountId: input.accountId } },
      });
      if (existing) return rowToState(existing);
      const created = await c.onboardingState.create({
        data: {
          tenantId: input.tenantId,
          clientId: input.clientId,
          slug: input.slug,
          accountId: input.accountId,
          stepsJson: [
            { key: "welcome", label: "Bienvenida", completed: false },
            { key: "company", label: "Datos de empresa", completed: false },
            { key: "branding", label: "Branding inicial", completed: false },
            { key: "users", label: "Usuarios iniciales", completed: false },
            { key: "modules", label: "Revisión de módulos", completed: false },
          ],
        },
      });
      return rowToState(created);
    });
    if (!result) throw new Error("Postgres onboarding fallback returned null");
    return result;
  }
  return fsGetOrCreate(input);
}

export async function saveOnboardingStateAsync(state: OnboardingState): Promise<OnboardingState> {
  if (getPersistenceBackend() === "postgres") {
    await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        onboardingState: {
          updateMany: (a: {
            where: { clientId: string; accountId: string };
            data: { stepsJson: unknown; slug: string };
          }) => Promise<{ count: number }>;
        };
      };
      await c.onboardingState.updateMany({
        where: { clientId: state.clientId, accountId: state.accountId },
        data: { stepsJson: state.steps, slug: state.slug },
      });
    });
    return state;
  }
  return fsSave(state);
}

export async function markOnboardingStartedAsync(input: {
  tenantId: string;
  clientId: string;
  slug: string;
  accountId: string;
}): Promise<OnboardingState> {
  if (getPersistenceBackend() === "postgres") {
    return await getOrCreateOnboardingStateAsync(input);
  }
  return fsMarkStarted(input);
}

export async function completeOnboardingStepAsync(input: {
  tenantId: string;
  clientId: string;
  slug: string;
  accountId: string;
  stepKey: string;
}): Promise<OnboardingState> {
  if (getPersistenceBackend() === "postgres") {
    const current = await getOrCreateOnboardingStateAsync(input);
    const target = String(input.stepKey || "").trim();
    const now = new Date().toISOString();
    const steps = current.steps.map((s) =>
      s.key === target ? { ...s, completed: true, completedAt: s.completedAt || now } : s,
    );
    return await saveOnboardingStateAsync({ ...current, steps });
  }
  return fsCompleteStep(input);
}

export async function completeOnboardingAsync(input: {
  tenantId: string;
  clientId: string;
  slug: string;
  accountId: string;
}): Promise<OnboardingState> {
  if (getPersistenceBackend() === "postgres") {
    const current = await getOrCreateOnboardingStateAsync(input);
    const now = new Date().toISOString();
    const steps = current.steps.map((s) => ({
      ...s,
      completed: true,
      completedAt: s.completedAt || now,
    }));
    return await saveOnboardingStateAsync({
      ...current,
      status: "completed",
      completedAt: now,
      steps,
    });
  }
  return fsComplete(input);
}

export type { OnboardingState };
