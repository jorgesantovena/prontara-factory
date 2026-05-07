/**
 * Wrapper async dual-mode (postgres | filesystem) sobre billing-store.
 *
 * Las funciones son async pero, en filesystem mode, simplemente envuelven
 * llamadas síncronas. En postgres mode hacen Prisma queries.
 *
 * Nota: NO duplicamos toda la lógica de migración legacy y validaciones —
 * delegamos a los helpers sync para esos cálculos y persistimos el resultado.
 */
import {
  getOrCreateBillingSubscription as fsGetOrCreate,
  saveBillingSubscription as fsSave,
  readBillingSubscription as fsRead,
  activatePaidPlan as fsActivate,
} from "@/lib/saas/billing-store";
import type {
  BillingPlanKey,
  BillingSubscriptionRecord,
} from "@/lib/saas/billing-definition";
import { getPersistenceBackend, withPrisma } from "@/lib/persistence/db";

type SubscriptionRow = {
  id: string;
  tenantId: string;
  clientId: string;
  slug: string;
  displayName: string;
  billingEmail: string;
  currentPlanKey: string;
  status: string;
  autoRenew: boolean;
  seats: number;
  setupFeePaidCents: number;
  concurrentUsersBilled: number;
  supportActive: boolean;
  renewsAt: Date;
  cancelAt: Date | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  lastCheckoutIntent: unknown;
  createdAt: Date;
  updatedAt: Date;
  invoices: InvoiceRow[];
};

type InvoiceRow = {
  id: string;
  subscriptionId: string;
  tenantId: string;
  clientId: string;
  slug: string;
  planKey: string;
  concept: string;
  amountCents: number;
  currency: string;
  status: string;
  stripeCheckoutSessionId: string | null;
  stripeSubscriptionId: string | null;
  createdAt: Date;
};

function rowToRecord(row: SubscriptionRow): BillingSubscriptionRecord {
  return {
    tenantId: row.tenantId,
    clientId: row.clientId,
    slug: row.slug,
    displayName: row.displayName,
    billingEmail: row.billingEmail,
    currentPlanKey: row.currentPlanKey as BillingPlanKey,
    status: row.status as BillingSubscriptionRecord["status"],
    autoRenew: row.autoRenew,
    seats: row.seats,
    setupFeePaidCents: row.setupFeePaidCents,
    concurrentUsersBilled: row.concurrentUsersBilled,
    supportActive: row.supportActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    renewsAt: row.renewsAt.toISOString(),
    cancelAt: row.cancelAt ? row.cancelAt.toISOString() : undefined,
    stripeCustomerId: row.stripeCustomerId || undefined,
    stripeSubscriptionId: row.stripeSubscriptionId || undefined,
    lastCheckoutIntent:
      (row.lastCheckoutIntent as BillingSubscriptionRecord["lastCheckoutIntent"]) ||
      null,
    invoices: (row.invoices || []).map((inv) => ({
      id: inv.id,
      tenantId: inv.tenantId,
      clientId: inv.clientId,
      slug: inv.slug,
      planKey: inv.planKey as BillingPlanKey,
      concept: inv.concept,
      amountCents: inv.amountCents,
      currency: "EUR",
      status: inv.status as BillingSubscriptionRecord["invoices"][number]["status"],
      stripeCheckoutSessionId: inv.stripeCheckoutSessionId || undefined,
      stripeSubscriptionId: inv.stripeSubscriptionId || undefined,
      createdAt: inv.createdAt.toISOString(),
    })),
  };
}

async function readSubscriptionPg(
  clientId: string,
): Promise<BillingSubscriptionRecord | null> {
  const result = await withPrisma(async (prisma) => {
    const c = prisma as unknown as {
      billingSubscription: {
        findUnique: (a: {
          where: { clientId: string };
          include: { invoices: { orderBy: { createdAt: "desc" } } };
        }) => Promise<SubscriptionRow | null>;
      };
    };
    return await c.billingSubscription.findUnique({
      where: { clientId },
      include: { invoices: { orderBy: { createdAt: "desc" } } },
    });
  });
  return result ? rowToRecord(result) : null;
}

async function writeSubscriptionPg(
  record: BillingSubscriptionRecord,
): Promise<void> {
  await withPrisma(async (prisma) => {
    const c = prisma as unknown as {
      $transaction: (ops: unknown[]) => Promise<unknown>;
      billingSubscription: {
        upsert: (a: {
          where: { clientId: string };
          create: Record<string, unknown>;
          update: Record<string, unknown>;
        }) => Promise<{ id: string }>;
      };
      billingInvoice: {
        deleteMany: (a: { where: { clientId: string } }) => unknown;
        create: (a: { data: Record<string, unknown> }) => unknown;
      };
    };
    const upserted = await c.billingSubscription.upsert({
      where: { clientId: record.clientId },
      create: {
        tenantId: record.tenantId,
        clientId: record.clientId,
        slug: record.slug,
        displayName: record.displayName,
        billingEmail: record.billingEmail,
        currentPlanKey: record.currentPlanKey,
        status: record.status,
        autoRenew: record.autoRenew,
        seats: record.seats,
        setupFeePaidCents: record.setupFeePaidCents,
        concurrentUsersBilled: record.concurrentUsersBilled,
        supportActive: record.supportActive,
        renewsAt: new Date(record.renewsAt),
        cancelAt: record.cancelAt ? new Date(record.cancelAt) : null,
        stripeCustomerId: record.stripeCustomerId || null,
        stripeSubscriptionId: record.stripeSubscriptionId || null,
        lastCheckoutIntent: record.lastCheckoutIntent || null,
      },
      update: {
        slug: record.slug,
        displayName: record.displayName,
        billingEmail: record.billingEmail,
        currentPlanKey: record.currentPlanKey,
        status: record.status,
        autoRenew: record.autoRenew,
        seats: record.seats,
        setupFeePaidCents: record.setupFeePaidCents,
        concurrentUsersBilled: record.concurrentUsersBilled,
        supportActive: record.supportActive,
        renewsAt: new Date(record.renewsAt),
        cancelAt: record.cancelAt ? new Date(record.cancelAt) : null,
        stripeCustomerId: record.stripeCustomerId || null,
        stripeSubscriptionId: record.stripeSubscriptionId || null,
        lastCheckoutIntent: record.lastCheckoutIntent || null,
      },
    });
    const ops: unknown[] = [
      c.billingInvoice.deleteMany({ where: { clientId: record.clientId } }),
    ];
    for (const inv of record.invoices) {
      ops.push(
        c.billingInvoice.create({
          data: {
            id: inv.id,
            subscriptionId: upserted.id,
            tenantId: inv.tenantId,
            clientId: inv.clientId,
            slug: inv.slug,
            planKey: inv.planKey,
            concept: inv.concept,
            amountCents: inv.amountCents,
            currency: inv.currency,
            status: inv.status,
            stripeCheckoutSessionId: inv.stripeCheckoutSessionId || null,
            stripeSubscriptionId: inv.stripeSubscriptionId || null,
            createdAt: new Date(inv.createdAt),
          },
        }),
      );
    }
    await c.$transaction(ops);
  });
}

export async function readBillingSubscriptionAsync(
  clientId: string,
): Promise<BillingSubscriptionRecord | null> {
  if (getPersistenceBackend() === "postgres") {
    return readSubscriptionPg(clientId);
  }
  return fsRead(clientId);
}

/**
 * Construye un BillingSubscriptionRecord por defecto (plan trial, 14 días)
 * SIN tocar filesystem. Es el equivalente puro del default que monta
 * `getOrCreateBillingSubscription` en billing-store.ts pero sin el
 * `mkdirSync + writeFileSync` que rompe en Vercel serverless (SF-15).
 */
function buildDefaultSubscriptionRecord(input: {
  tenantId: string;
  clientId: string;
  slug: string;
  displayName: string;
}): BillingSubscriptionRecord {
  const safeSlug = String(input.slug || "tenant")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
  const billingEmail = "billing@" + safeSlug + ".local";
  const now = new Date();
  const renewsAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  return {
    tenantId: input.tenantId,
    clientId: input.clientId,
    slug: input.slug,
    displayName: input.displayName,
    billingEmail,
    currentPlanKey: "trial",
    status: "trialing",
    autoRenew: true,
    seats: 2,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    renewsAt: renewsAt.toISOString(),
    invoices: [],
    lastCheckoutIntent: null,
    setupFeePaidCents: 0,
    concurrentUsersBilled: 1,
    supportActive: false,
  };
}

export async function getOrCreateBillingSubscriptionAsync(input: {
  tenantId: string;
  clientId: string;
  slug: string;
  displayName: string;
}): Promise<BillingSubscriptionRecord> {
  if (getPersistenceBackend() === "postgres") {
    const existing = await readSubscriptionPg(input.clientId);
    if (existing) return existing;
    // SF-15: NO usar fsGetOrCreate en serverless — toca filesystem read-only.
    // Construimos los defaults inline y persistimos solo a Postgres.
    const created = buildDefaultSubscriptionRecord(input);
    await writeSubscriptionPg(created);
    return created;
  }
  return fsGetOrCreate(input);
}

export async function saveBillingSubscriptionAsync(
  record: BillingSubscriptionRecord,
): Promise<void> {
  if (getPersistenceBackend() === "postgres") {
    await writeSubscriptionPg(record);
    return;
  }
  fsSave(record);
}

/**
 * Helper de alto nivel — duplica la lógica de activatePaidPlan pero async.
 * En filesystem delega a la función sync.
 */
export async function activatePaidPlanAsync(input: {
  tenantId: string;
  clientId: string;
  slug: string;
  displayName: string;
  planKey: BillingPlanKey;
  stripeCheckoutSessionId: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  amountTotalCents?: number;
}): Promise<BillingSubscriptionRecord> {
  if (getPersistenceBackend() === "postgres") {
    // Usamos el helper sync para construir el resultado, pero lo persistimos
    // en postgres tras leer/calcular el estado actual desde postgres.
    const current = await getOrCreateBillingSubscriptionAsync(input);
    // Llamamos al helper sync con el estado actual y un fake-write para que
    // calcule la mutación; luego replicamos a postgres.
    // Como activatePaidPlan llama a saveBillingSubscription internamente,
    // no podemos usarlo directamente. Replicamos aquí la lógica mínima.
    const { getPlanDefinition } = await import("@/lib/saas/billing-store");
    const plan = getPlanDefinition(input.planKey);
    const now = new Date();
    const renewsAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const next: BillingSubscriptionRecord = {
      ...current,
      displayName: input.displayName,
      currentPlanKey: plan.key,
      status: "active",
      autoRenew: true,
      seats:
        plan.includedUsers == null
          ? Math.max(current.seats, 20)
          : Math.min(Math.max(current.seats, 1), plan.includedUsers),
      updatedAt: now.toISOString(),
      renewsAt: renewsAt.toISOString(),
      cancelAt: undefined,
      stripeCustomerId: input.stripeCustomerId || current.stripeCustomerId,
      stripeSubscriptionId: input.stripeSubscriptionId || current.stripeSubscriptionId,
      lastCheckoutIntent: null,
      setupFeePaidCents: input.amountTotalCents ?? plan.setupFeeCents,
      concurrentUsersBilled: Math.max(current.concurrentUsersBilled, 1),
      supportActive: true,
      invoices: [
        {
          id: "inv-" + Date.now().toString(36),
          tenantId: input.tenantId,
          clientId: input.clientId,
          slug: input.slug,
          planKey: plan.key,
          concept: "Alta plan " + plan.label,
          amountCents: Number.isFinite(input.amountTotalCents)
            ? Number(input.amountTotalCents)
            : plan.setupFeeCents,
          currency: "EUR",
          status: "paid",
          stripeCheckoutSessionId: input.stripeCheckoutSessionId,
          stripeSubscriptionId: input.stripeSubscriptionId,
          createdAt: now.toISOString(),
        },
        ...current.invoices,
      ],
    };
    await writeSubscriptionPg(next);
    return next;
  }
  return fsActivate(input);
}
