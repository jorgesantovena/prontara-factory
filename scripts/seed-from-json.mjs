#!/usr/bin/env node
/**
 * Migra los datos de Prontara desde los ficheros JSON locales a la base de
 * datos Postgres (Neon). Se ejecuta UNA VEZ por entorno antes de cambiar
 * PRONTARA_PERSISTENCE a "postgres".
 *
 * Lee:
 *   - .prontara/clients/<clientId>.json    → Tenant
 *   - data/saas/accounts/<clientId>.json   → TenantAccount
 *   - data/saas/billing/<clientId>.json    → BillingSubscription + BillingInvoice
 *   - data/saas/trial/<clientId>.json      → TrialState
 *   - data/saas/onboarding/<clientId>__<accountId>.json → OnboardingState
 *   - data/saas/lifecycle/<clientId>.json  → LifecycleState
 *   - data/saas/vertical-overrides/<key>.json → VerticalOverride
 *   - data/saas/leads/<id>.json            → Lead
 *
 * Variables de entorno necesarias:
 *   DATABASE_URL   conexión Postgres (Neon)
 *
 * Idempotente: usa upserts. Re-ejecutar es seguro.
 *
 * Uso:
 *   $env:DATABASE_URL = "postgresql://..."
 *   node scripts/seed-from-json.mjs
 *
 * Para dry-run sin escribir:
 *   node scripts/seed-from-json.mjs --dry-run
 */
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");

if (!process.env.DATABASE_URL) {
  console.error("ERROR: Falta DATABASE_URL en el entorno.");
  console.error("PowerShell: $env:DATABASE_URL = \"postgresql://...\"");
  process.exit(1);
}

let prisma;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaClient } = await import("@prisma/client");
  prisma = new PrismaClient();
} catch (err) {
  console.error("ERROR: No se pudo cargar Prisma Client. ¿Has corrido `pnpm prisma generate`?");
  console.error(err);
  process.exit(1);
}

const projectRoot = process.cwd();

function readJsonSafe(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (err) {
    console.warn("  ! No se pudo leer " + filePath + ": " + err.message);
    return null;
  }
}

function listJsonFiles(dir) {
  const abs = path.join(projectRoot, dir);
  if (!fs.existsSync(abs)) return [];
  return fs
    .readdirSync(abs)
    .filter((f) => f.endsWith(".json"))
    .map((f) => ({ name: f, full: path.join(abs, f) }));
}

// ============ Tenants ============
async function migrateTenants() {
  const dir = path.join(projectRoot, ".prontara", "clients");
  if (!fs.existsSync(dir)) {
    console.log("  ↪ Sin .prontara/clients/ — saltando tenants.");
    return 0;
  }
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"));
  let count = 0;
  for (const f of files) {
    const def = readJsonSafe(path.join(dir, f));
    if (!def || !def.clientId) continue;
    const slug = String(def.slug || def.tenantSlug || def.clientId).trim() || def.clientId;
    const branding = def.branding || {};
    const tenantId = String(def.tenantId || def.id || def.clientId);
    if (DRY_RUN) {
      console.log("  ✓ would upsert tenant " + def.clientId);
    } else {
      await prisma.tenant.upsert({
        where: { clientId: def.clientId },
        update: {
          slug,
          legacyTenantId: tenantId !== def.clientId ? tenantId : null,
          displayName: String(branding.displayName || def.displayName || def.clientId),
          shortName: branding.shortName || null,
          sector: branding.sector || def.sector || null,
          businessType: branding.businessType || def.businessType || null,
          companySize: def.companySize || null,
          blueprintVersion: def.blueprintVersion || null,
          definition: def,
          brandingJson: branding,
          status: def.status || "ready",
        },
        create: {
          clientId: def.clientId,
          slug,
          legacyTenantId: tenantId !== def.clientId ? tenantId : null,
          displayName: String(branding.displayName || def.displayName || def.clientId),
          shortName: branding.shortName || null,
          sector: branding.sector || def.sector || null,
          businessType: branding.businessType || def.businessType || null,
          companySize: def.companySize || null,
          blueprintVersion: def.blueprintVersion || null,
          definition: def,
          brandingJson: branding,
          status: def.status || "ready",
        },
      });
    }
    count++;
  }
  return count;
}

async function getTenantInternalId(clientId) {
  if (DRY_RUN) return "dry-run-" + clientId;
  const t = await prisma.tenant.findUnique({ where: { clientId } });
  return t?.id;
}

// ============ Accounts ============
async function migrateAccounts() {
  const files = listJsonFiles("data/saas/accounts");
  let count = 0;
  for (const file of files) {
    const arr = readJsonSafe(file.full);
    if (!Array.isArray(arr)) continue;
    const clientId = file.name.replace(/\.json$/, "");
    const tenantInternalId = await getTenantInternalId(clientId);
    if (!tenantInternalId) {
      console.warn("  ! Tenant '" + clientId + "' no existe, saltando accounts.");
      continue;
    }
    for (const acc of arr) {
      if (!acc || !acc.id) continue;
      if (DRY_RUN) {
        console.log("  ✓ would upsert account " + acc.email + " of " + clientId);
      } else {
        await prisma.tenantAccount.upsert({
          where: { id: acc.id },
          update: {
            email: String(acc.email || "").toLowerCase(),
            fullName: String(acc.fullName || ""),
            role: String(acc.role || "owner"),
            status: String(acc.status || "active"),
            passwordHash: String(acc.passwordHash || ""),
            temporaryPassword: String(acc.temporaryPassword || ""),
            mustChangePassword: Boolean(acc.mustChangePassword),
            lastProvisionedAt: acc.lastProvisionedAt ? new Date(acc.lastProvisionedAt) : null,
          },
          create: {
            id: acc.id,
            tenantId: tenantInternalId,
            clientId,
            slug: String(acc.slug || ""),
            email: String(acc.email || "").toLowerCase(),
            fullName: String(acc.fullName || ""),
            role: String(acc.role || "owner"),
            status: String(acc.status || "active"),
            passwordHash: String(acc.passwordHash || ""),
            temporaryPassword: String(acc.temporaryPassword || ""),
            mustChangePassword: Boolean(acc.mustChangePassword),
            createdAt: acc.createdAt ? new Date(acc.createdAt) : new Date(),
            updatedAt: acc.updatedAt ? new Date(acc.updatedAt) : new Date(),
            lastProvisionedAt: acc.lastProvisionedAt ? new Date(acc.lastProvisionedAt) : null,
          },
        });
      }
      count++;
    }
  }
  return count;
}

// ============ Billing ============
async function migrateBilling() {
  const files = listJsonFiles("data/saas/billing");
  let subCount = 0;
  let invCount = 0;
  for (const file of files) {
    const sub = readJsonSafe(file.full);
    if (!sub || !sub.clientId) continue;
    const tenantInternalId = await getTenantInternalId(sub.clientId);
    if (!tenantInternalId) continue;

    if (DRY_RUN) {
      console.log("  ✓ would upsert subscription of " + sub.clientId);
    } else {
      const subscriptionRow = await prisma.billingSubscription.upsert({
        where: { clientId: sub.clientId },
        update: {
          slug: sub.slug || "",
          displayName: sub.displayName || "",
          billingEmail: sub.billingEmail || "",
          currentPlanKey: sub.currentPlanKey || "trial",
          status: sub.status || "trialing",
          autoRenew: Boolean(sub.autoRenew),
          seats: Number(sub.seats || 2),
          setupFeePaidCents: Number(sub.setupFeePaidCents || 0),
          concurrentUsersBilled: Number(sub.concurrentUsersBilled || 1),
          supportActive: Boolean(sub.supportActive),
          renewsAt: sub.renewsAt ? new Date(sub.renewsAt) : new Date(),
          cancelAt: sub.cancelAt ? new Date(sub.cancelAt) : null,
          stripeCustomerId: sub.stripeCustomerId || null,
          stripeSubscriptionId: sub.stripeSubscriptionId || null,
          lastCheckoutIntent: sub.lastCheckoutIntent || null,
        },
        create: {
          tenantId: tenantInternalId,
          clientId: sub.clientId,
          slug: sub.slug || "",
          displayName: sub.displayName || "",
          billingEmail: sub.billingEmail || "",
          currentPlanKey: sub.currentPlanKey || "trial",
          status: sub.status || "trialing",
          autoRenew: Boolean(sub.autoRenew),
          seats: Number(sub.seats || 2),
          setupFeePaidCents: Number(sub.setupFeePaidCents || 0),
          concurrentUsersBilled: Number(sub.concurrentUsersBilled || 1),
          supportActive: Boolean(sub.supportActive),
          renewsAt: sub.renewsAt ? new Date(sub.renewsAt) : new Date(),
          cancelAt: sub.cancelAt ? new Date(sub.cancelAt) : null,
          stripeCustomerId: sub.stripeCustomerId || null,
          stripeSubscriptionId: sub.stripeSubscriptionId || null,
          lastCheckoutIntent: sub.lastCheckoutIntent || null,
          createdAt: sub.createdAt ? new Date(sub.createdAt) : new Date(),
          updatedAt: sub.updatedAt ? new Date(sub.updatedAt) : new Date(),
        },
      });
      subCount++;

      for (const inv of sub.invoices || []) {
        if (!inv.id) continue;
        await prisma.billingInvoice.upsert({
          where: { id: inv.id },
          update: {
            concept: inv.concept || "",
            amountCents: Number(inv.amountCents || 0),
            currency: inv.currency || "EUR",
            status: inv.status || "issued",
            stripeCheckoutSessionId: inv.stripeCheckoutSessionId || null,
            stripeSubscriptionId: inv.stripeSubscriptionId || null,
          },
          create: {
            id: inv.id,
            subscriptionId: subscriptionRow.id,
            tenantId: tenantInternalId,
            clientId: sub.clientId,
            slug: inv.slug || sub.slug || "",
            planKey: inv.planKey || sub.currentPlanKey || "trial",
            concept: inv.concept || "",
            amountCents: Number(inv.amountCents || 0),
            currency: inv.currency || "EUR",
            status: inv.status || "issued",
            stripeCheckoutSessionId: inv.stripeCheckoutSessionId || null,
            stripeSubscriptionId: inv.stripeSubscriptionId || null,
            createdAt: inv.createdAt ? new Date(inv.createdAt) : new Date(),
          },
        });
        invCount++;
      }
    }
  }
  return { subCount, invCount };
}

// ============ Trial ============
async function migrateTrial() {
  const files = listJsonFiles("data/saas/trial");
  let count = 0;
  for (const file of files) {
    const t = readJsonSafe(file.full);
    if (!t || !t.clientId) continue;
    const tenantInternalId = await getTenantInternalId(t.clientId);
    if (!tenantInternalId) continue;
    if (DRY_RUN) {
      console.log("  ✓ would upsert trial of " + t.clientId);
    } else {
      await prisma.trialState.upsert({
        where: { clientId: t.clientId },
        update: {
          slug: t.slug || "",
          status: t.status || "active",
          trialDays: Number(t.trialDays || 14),
          daysRemaining: Number(t.daysRemaining || 0),
          expiresAt: t.expiresAt ? new Date(t.expiresAt) : new Date(),
        },
        create: {
          tenantId: tenantInternalId,
          clientId: t.clientId,
          slug: t.slug || "",
          status: t.status || "active",
          trialDays: Number(t.trialDays || 14),
          daysRemaining: Number(t.daysRemaining || 0),
          expiresAt: t.expiresAt ? new Date(t.expiresAt) : new Date(),
          createdAt: t.createdAt ? new Date(t.createdAt) : new Date(),
        },
      });
    }
    count++;
  }
  return count;
}

// ============ Vertical overrides ============
async function migrateVerticalOverrides() {
  const files = listJsonFiles("data/saas/vertical-overrides");
  let count = 0;
  for (const file of files) {
    const ov = readJsonSafe(file.full);
    if (!ov || !ov.key) continue;
    if (DRY_RUN) {
      console.log("  ✓ would upsert override " + ov.key);
    } else {
      await prisma.verticalOverride.upsert({
        where: { packKey: ov.key },
        update: {
          payloadJson: ov,
          updatedBy: ov.updatedBy || null,
        },
        create: {
          packKey: ov.key,
          payloadJson: ov,
          updatedBy: ov.updatedBy || null,
        },
      });
    }
    count++;
  }
  return count;
}

// ============ Leads ============
async function migrateLeads() {
  const files = listJsonFiles("data/saas/leads");
  let count = 0;
  for (const file of files) {
    const lead = readJsonSafe(file.full);
    if (!lead || !lead.id) continue;
    if (DRY_RUN) {
      console.log("  ✓ would upsert lead " + lead.id);
    } else {
      await prisma.lead.upsert({
        where: { id: lead.id },
        update: {
          name: lead.name || "",
          email: lead.email || "",
          company: lead.company || "",
          phone: lead.phone || "",
          message: lead.message || "",
          sourceVertical: lead.sourceVertical || null,
          status: lead.status || "new",
          userAgent: lead.userAgent || "",
          ip: lead.ip || "",
        },
        create: {
          id: lead.id,
          name: lead.name || "",
          email: lead.email || "",
          company: lead.company || "",
          phone: lead.phone || "",
          message: lead.message || "",
          sourceVertical: lead.sourceVertical || null,
          status: lead.status || "new",
          userAgent: lead.userAgent || "",
          ip: lead.ip || "",
          createdAt: lead.createdAt ? new Date(lead.createdAt) : new Date(),
          updatedAt: lead.updatedAt ? new Date(lead.updatedAt) : new Date(),
        },
      });
    }
    count++;
  }
  return count;
}

async function main() {
  console.log(DRY_RUN ? "\n=== DRY RUN — sin escribir nada ===\n" : "\n=== Migrando JSON → Postgres ===\n");

  console.log("Tenants:");
  const tenantCount = await migrateTenants();
  console.log("  → " + tenantCount + " tenants procesados\n");

  console.log("Accounts:");
  const accountCount = await migrateAccounts();
  console.log("  → " + accountCount + " accounts procesados\n");

  console.log("Billing subscriptions + invoices:");
  const { subCount, invCount } = await migrateBilling();
  console.log("  → " + subCount + " subscriptions, " + invCount + " invoices\n");

  console.log("Trial state:");
  const trialCount = await migrateTrial();
  console.log("  → " + trialCount + " trial states\n");

  console.log("Vertical overrides:");
  const overrideCount = await migrateVerticalOverrides();
  console.log("  → " + overrideCount + " overrides\n");

  console.log("Leads:");
  const leadCount = await migrateLeads();
  console.log("  → " + leadCount + " leads\n");

  console.log("=== Hecho ===");
  if (!DRY_RUN) {
    console.log("\nAhora puedes poner PRONTARA_PERSISTENCE=postgres en el entorno");
    console.log("y reiniciar la app. Los datos están en Postgres.\n");
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  if (prisma) await prisma.$disconnect();
  process.exit(1);
});
