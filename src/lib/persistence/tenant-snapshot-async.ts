/**
 * Snapshot ligero de un tenant para el chat de Factory en producción.
 *
 * En filesystem mode delegamos al getFactoryClientDetail heavyweight
 * legacy (lee múltiples JSON: cliente, billing, trial, onboarding,
 * lifecycle, dashboard). En Postgres mode, hacemos en paralelo las
 * consultas necesarias y devolvemos un snapshot compacto.
 *
 * No intentamos replicar 1:1 todo lo que devuelve getFactoryClientDetail
 * (que tiene ~30 campos y mezcla métricas calculadas con estado). El
 * chat normalmente necesita responder a preguntas como:
 *   - "¿qué plan tiene este tenant?"
 *   - "¿cuándo se dio de alta?"
 *   - "¿está en trial o ya pagó?"
 *   - "¿cuántas cuentas tiene?"
 *   - "¿qué vertical/sector?"
 *
 * Para eso no hace falta el heavyweight. Si Jorge pide un detalle
 * más profundo desde el chat, se puede ampliar este snapshot.
 */
import { getPersistenceBackend, withPrisma } from "@/lib/persistence/db";
import { getFactoryClientDetail } from "@/lib/factory/factory-client-detail";

export type TenantSnapshotAsync = {
  ok: boolean;
  clientId: string;
  tenantId?: string;
  slug?: string;
  displayName?: string;
  status?: string;
  sector?: string | null;
  businessType?: string | null;
  branding?: {
    displayName?: string;
    accentColor?: string;
    sector?: string;
    businessType?: string;
  };
  createdAt?: string;
  updatedAt?: string;
  accounts: Array<{
    email: string;
    fullName: string;
    role: string;
    status: string;
    mustChangePassword: boolean;
  }>;
  subscription: {
    planKey: string;
    status: string;
    autoRenew: boolean;
    seats: number;
    setupFeePaidCents: number;
    supportActive: boolean;
    renewsAt: string | null;
    cancelAt: string | null;
  } | null;
  trial: {
    status: string;
    daysRemaining: number;
    expiresAt: string;
  } | null;
  onboarding: {
    accountId: string;
    stepsTotal: number;
    stepsCompleted: number;
  } | null;
  lifecycle: {
    sentEvents: string[];
  } | null;
  invoices: {
    total: number;
    paid: number;
    issued: number;
  };
  notes?: string[];
};

type TenantRow = {
  id: string;
  clientId: string;
  slug: string;
  displayName: string;
  status: string;
  sector: string | null;
  businessType: string | null;
  brandingJson: unknown;
  createdAt: Date;
  updatedAt: Date;
};

type AccountRow = {
  email: string;
  fullName: string;
  role: string;
  status: string;
  mustChangePassword: boolean;
};

type SubscriptionRow = {
  currentPlanKey: string;
  status: string;
  autoRenew: boolean;
  seats: number;
  setupFeePaidCents: number;
  supportActive: boolean;
  renewsAt: Date;
  cancelAt: Date | null;
};

type TrialRow = {
  status: string;
  daysRemaining: number;
  expiresAt: Date;
};

type OnboardingRow = {
  accountId: string;
  stepsJson: unknown;
};

type LifecycleRow = {
  sentJson: unknown;
};

type InvoiceCountRow = {
  status: string;
  _count: { _all: number };
};

export async function getTenantSnapshotAsync(
  clientId: string,
): Promise<TenantSnapshotAsync> {
  if (getPersistenceBackend() === "filesystem") {
    // En filesystem usamos el detalle pesado original y devolvemos un
    // shape compatible con el async (sin todos los campos extra).
    const heavy = await getFactoryClientDetail(clientId);
    return {
      ok: heavy.ok,
      clientId: heavy.clientId,
      tenantId: heavy.tenantId,
      slug: heavy.slug,
      displayName: heavy.displayName,
      sector: heavy.assignedVertical?.sector || null,
      businessType: heavy.assignedVertical?.businessType || null,
      branding: heavy.branding
        ? {
            displayName: heavy.branding.displayName,
            accentColor: heavy.branding.accentColor,
          }
        : undefined,
      accounts: [],
      subscription: heavy.subscription
        ? {
            planKey: heavy.subscription.plan,
            status: heavy.subscription.status,
            autoRenew: true,
            seats: 0,
            setupFeePaidCents: 0,
            supportActive: false,
            renewsAt: heavy.subscription.updatedAt,
            cancelAt: null,
          }
        : null,
      trial: null,
      onboarding: null,
      lifecycle: null,
      invoices: { total: 0, paid: 0, issued: 0 },
      notes: ["Snapshot construido desde filesystem (modo dev)."],
    };
  }

  const result = await withPrisma(async (prisma) => {
    const c = prisma as unknown as {
      tenant: {
        findUnique: (a: {
          where: { clientId: string };
          select: {
            id: true;
            clientId: true;
            slug: true;
            displayName: true;
            status: true;
            sector: true;
            businessType: true;
            brandingJson: true;
            createdAt: true;
            updatedAt: true;
          };
        }) => Promise<TenantRow | null>;
      };
      tenantAccount: {
        findMany: (a: {
          where: { clientId: string };
          select: {
            email: true;
            fullName: true;
            role: true;
            status: true;
            mustChangePassword: true;
          };
          orderBy: { createdAt: "asc" };
        }) => Promise<AccountRow[]>;
      };
      billingSubscription: {
        findUnique: (a: {
          where: { clientId: string };
          select: {
            currentPlanKey: true;
            status: true;
            autoRenew: true;
            seats: true;
            setupFeePaidCents: true;
            supportActive: true;
            renewsAt: true;
            cancelAt: true;
          };
        }) => Promise<SubscriptionRow | null>;
      };
      trialState: {
        findUnique: (a: {
          where: { clientId: string };
          select: { status: true; daysRemaining: true; expiresAt: true };
        }) => Promise<TrialRow | null>;
      };
      onboardingState: {
        findFirst: (a: {
          where: { clientId: string };
          select: { accountId: true; stepsJson: true };
          orderBy: { updatedAt: "desc" };
        }) => Promise<OnboardingRow | null>;
      };
      lifecycleState: {
        findUnique: (a: {
          where: { clientId: string };
          select: { sentJson: true };
        }) => Promise<LifecycleRow | null>;
      };
      billingInvoice: {
        groupBy: (a: {
          by: ["status"];
          where: { clientId: string };
          _count: { _all: true };
        }) => Promise<InvoiceCountRow[]>;
      };
    };

    const tenant = await c.tenant.findUnique({
      where: { clientId },
      select: {
        id: true,
        clientId: true,
        slug: true,
        displayName: true,
        status: true,
        sector: true,
        businessType: true,
        brandingJson: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!tenant) return null;

    const [accounts, subscription, trial, onboarding, lifecycle, invoices] =
      await Promise.all([
        c.tenantAccount.findMany({
          where: { clientId },
          select: {
            email: true,
            fullName: true,
            role: true,
            status: true,
            mustChangePassword: true,
          },
          orderBy: { createdAt: "asc" },
        }),
        c.billingSubscription.findUnique({
          where: { clientId },
          select: {
            currentPlanKey: true,
            status: true,
            autoRenew: true,
            seats: true,
            setupFeePaidCents: true,
            supportActive: true,
            renewsAt: true,
            cancelAt: true,
          },
        }),
        c.trialState.findUnique({
          where: { clientId },
          select: { status: true, daysRemaining: true, expiresAt: true },
        }),
        c.onboardingState.findFirst({
          where: { clientId },
          select: { accountId: true, stepsJson: true },
          orderBy: { updatedAt: "desc" },
        }),
        c.lifecycleState.findUnique({
          where: { clientId },
          select: { sentJson: true },
        }),
        c.billingInvoice.groupBy({
          by: ["status"],
          where: { clientId },
          _count: { _all: true },
        }),
      ]);

    return { tenant, accounts, subscription, trial, onboarding, lifecycle, invoices };
  });

  if (!result) {
    return {
      ok: false,
      clientId,
      accounts: [],
      subscription: null,
      trial: null,
      onboarding: null,
      lifecycle: null,
      invoices: { total: 0, paid: 0, issued: 0 },
      notes: ["No existe tenant con clientId='" + clientId + "' en Postgres."],
    };
  }

  const branding =
    result.tenant.brandingJson && typeof result.tenant.brandingJson === "object"
      ? (result.tenant.brandingJson as Record<string, unknown>)
      : {};

  const onboardingSteps = Array.isArray(result.onboarding?.stepsJson)
    ? (result.onboarding!.stepsJson as Array<{ done?: boolean }>)
    : [];

  const sentEvents = Array.isArray(result.lifecycle?.sentJson)
    ? (result.lifecycle!.sentJson as Array<unknown>).map((e) => String(e))
    : [];

  const invoiceCounts = result.invoices || [];
  const issuedCount = invoiceCounts.find((i) => i.status === "issued")
    ?._count._all || 0;
  const paidCount = invoiceCounts.find((i) => i.status === "paid")
    ?._count._all || 0;

  return {
    ok: true,
    clientId: result.tenant.clientId,
    tenantId: result.tenant.id,
    slug: result.tenant.slug,
    displayName: result.tenant.displayName,
    status: result.tenant.status,
    sector: result.tenant.sector,
    businessType: result.tenant.businessType,
    branding: {
      displayName: typeof branding.displayName === "string"
        ? (branding.displayName as string)
        : result.tenant.displayName,
      accentColor: typeof branding.accentColor === "string"
        ? (branding.accentColor as string)
        : undefined,
      sector: typeof branding.sector === "string"
        ? (branding.sector as string)
        : result.tenant.sector || undefined,
      businessType: typeof branding.businessType === "string"
        ? (branding.businessType as string)
        : result.tenant.businessType || undefined,
    },
    createdAt: result.tenant.createdAt.toISOString(),
    updatedAt: result.tenant.updatedAt.toISOString(),
    accounts: (result.accounts || []).map((a) => ({
      email: a.email,
      fullName: a.fullName,
      role: a.role,
      status: a.status,
      mustChangePassword: a.mustChangePassword,
    })),
    subscription: result.subscription
      ? {
          planKey: result.subscription.currentPlanKey,
          status: result.subscription.status,
          autoRenew: result.subscription.autoRenew,
          seats: result.subscription.seats,
          setupFeePaidCents: result.subscription.setupFeePaidCents,
          supportActive: result.subscription.supportActive,
          renewsAt: result.subscription.renewsAt.toISOString(),
          cancelAt: result.subscription.cancelAt
            ? result.subscription.cancelAt.toISOString()
            : null,
        }
      : null,
    trial: result.trial
      ? {
          status: result.trial.status,
          daysRemaining: result.trial.daysRemaining,
          expiresAt: result.trial.expiresAt.toISOString(),
        }
      : null,
    onboarding: result.onboarding
      ? {
          accountId: result.onboarding.accountId,
          stepsTotal: onboardingSteps.length,
          stepsCompleted: onboardingSteps.filter((s) => s.done === true).length,
        }
      : null,
    lifecycle: result.lifecycle ? { sentEvents } : null,
    invoices: {
      total: issuedCount + paidCount,
      paid: paidCount,
      issued: issuedCount,
    },
  };
}
