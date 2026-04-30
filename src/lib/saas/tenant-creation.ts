/**
 * Creación de un tenant nuevo desde la web (alta 100% online).
 *
 * Hasta ahora la creación se hacía con scripts PowerShell. Esta lib mete el
 * flujo dentro de runtime de Next.js para que un visitante pueda llegar a
 * /alta, rellenar el form y tener su entorno listo automáticamente.
 *
 * Lo que hace (dual-mode filesystem | postgres):
 *   1. Genera clientId único (estandar-YYYYMMDDhhmmss).
 *   2. Persiste la definición del tenant (filesystem: .prontara/clients/<id>.json,
 *      postgres: tabla Tenant con definition Json).
 *   3. Crea cuenta admin con password temporal vía wrapper async.
 *   4. Inicializa trial state (14 días) vía wrapper async.
 *   5. Crea subscription en estado pending_checkout vía wrapper async.
 *   6. Inicializa onboarding state (filesystem por ahora; postgres TODO).
 *   7. Devuelve {clientId, slug, adminEmail, temporaryPassword, activationUrl}.
 *
 * El temporaryPassword viaja en el response para que el siguiente paso
 * (mandar email o redirigir a checkout) lo incluya. NUNCA se guarda en log.
 */
import fs from "node:fs";
import path from "node:path";
import { writeJsonAtomic } from "@/lib/saas/fs-atomic";
import {
  createTenantAccount,
  generateTemporaryPassword,
} from "@/lib/saas/account-store";
import {
  listTenantAccountsAsync,
  saveTenantAccountsAsync,
} from "@/lib/persistence/account-store-async";
import { getOrCreateTrialStateAsync } from "@/lib/persistence/trial-store-async";
import { getOrCreateOnboardingState } from "@/lib/saas/onboarding-store";
import {
  getOrCreateBillingSubscriptionAsync,
  saveBillingSubscriptionAsync,
} from "@/lib/persistence/billing-store-async";
import { getSectorPackByKey } from "@/lib/factory/sector-pack-registry";
import { invalidateFactoryDashboardCache } from "@/lib/factory/factory-dashboard";
import { getPersistenceBackend, withPrisma } from "@/lib/persistence/db";

export type CreateTenantInput = {
  companyName: string;
  contactName: string;
  email: string;
  phone?: string;
  /** slug deseado por el cliente. Si choca con uno existente, se sufija. */
  desiredSlug?: string;
  sector: string;
  businessType: string;
  companySize?: string;
};

export type CreateTenantResult = {
  ok: boolean;
  clientId: string;
  tenantId: string;
  slug: string;
  displayName: string;
  adminEmail: string;
  /** Password temporal en claro — solo viaja en el response, no se loggea. */
  temporaryPassword: string;
  trialExpiresAt: string;
  activationUrl: string;
  errors?: string[];
};

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,60}$/;

function projectRoot(): string {
  return process.cwd();
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function tenantsDir(): string {
  const dir = path.join(projectRoot(), ".prontara", "clients");
  ensureDir(dir);
  return dir;
}

function tenantDataDir(clientId: string): string {
  const dir = path.join(projectRoot(), ".prontara", "data", clientId);
  ensureDir(dir);
  return dir;
}

function generateClientId(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    "estandar-" +
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds())
  );
}

function slugify(value: string): string {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function existingSlugs(): Promise<Set<string>> {
  const out = new Set<string>();
  if (getPersistenceBackend() === "postgres") {
    const rows = await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        tenant: {
          findMany: (a: { select: { slug: true; displayName: true } }) => Promise<
            Array<{ slug: string; displayName: string }>
          >;
        };
      };
      return await c.tenant.findMany({ select: { slug: true, displayName: true } });
    });
    for (const r of rows || []) {
      if (r.slug) out.add(r.slug.toLowerCase());
      const fromName = slugify(r.displayName || "");
      if (fromName) out.add(fromName);
    }
    return out;
  }
  const dir = tenantsDir();
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".json")) continue;
    try {
      const def = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
      if (def?.slug) out.add(String(def.slug).toLowerCase());
      const fromName = slugify(String(def?.displayName || ""));
      if (fromName) out.add(fromName);
    } catch {
      // ignoramos ficheros corruptos
    }
  }
  return out;
}

async function ensureUniqueSlug(desired: string): Promise<string> {
  const taken = await existingSlugs();
  let candidate = desired;
  if (!candidate || !SLUG_RE.test(candidate)) candidate = "tenant";
  if (!taken.has(candidate)) return candidate;
  let i = 2;
  while (taken.has(candidate + "-" + i)) i++;
  return candidate + "-" + i;
}

function validateInput(input: CreateTenantInput): string[] {
  const errors: string[] = [];
  if (!input.companyName || input.companyName.trim().length < 2) {
    errors.push("El nombre de empresa es obligatorio.");
  }
  if (!input.contactName || input.contactName.trim().length < 2) {
    errors.push("El nombre de contacto es obligatorio.");
  }
  if (!input.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    errors.push("Email no válido.");
  }
  if (!input.businessType || !getSectorPackByKey(input.businessType)) {
    errors.push("businessType no válido — no existe vertical con esa key.");
  }
  if (!input.sector || input.sector.trim().length < 2) {
    errors.push("Sector requerido.");
  }
  return errors;
}

async function persistTenantDefinition(definition: {
  clientId: string;
  slug: string;
  displayName: string;
  sector: string;
  businessType: string;
  companySize: string;
  branding: Record<string, unknown>;
  modules: string[];
  blueprintVersion: string;
  createdAt: string;
  updatedAt: string;
  provisioning: Record<string, unknown>;
  sampleData: Record<string, unknown>;
  updates: unknown[];
  renameMap: Record<string, unknown>;
}): Promise<void> {
  if (getPersistenceBackend() === "postgres") {
    await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        tenant: {
          create: (a: { data: Record<string, unknown> }) => Promise<{ id: string }>;
        };
      };
      // El id de la tabla es cuid pero usamos clientId como identidad pública.
      await c.tenant.create({
        data: {
          clientId: definition.clientId,
          slug: definition.slug,
          displayName: definition.displayName,
          sector: definition.sector,
          businessType: definition.businessType,
          companySize: definition.companySize,
          blueprintVersion: definition.blueprintVersion,
          definition,
          brandingJson: definition.branding,
          status: "provisioning",
        },
      });
    });
    return;
  }
  writeJsonAtomic(
    path.join(tenantsDir(), definition.clientId + ".json"),
    definition,
  );
  // Asegurar el directorio de datos (vacío inicialmente).
  tenantDataDir(definition.clientId);
}

async function resolveTenantId(clientId: string): Promise<string> {
  if (getPersistenceBackend() === "postgres") {
    const result = await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        tenant: {
          findUnique: (a: {
            where: { clientId: string };
            select: { id: true };
          }) => Promise<{ id: string } | null>;
        };
      };
      return await c.tenant.findUnique({
        where: { clientId },
        select: { id: true },
      });
    });
    return result?.id || clientId;
  }
  return clientId;
}

export async function createTenantFromAlta(
  input: CreateTenantInput,
): Promise<CreateTenantResult> {
  const errors = validateInput(input);
  const displayName = input.companyName.trim();
  const baseSlug = slugify(input.desiredSlug || displayName);

  if (errors.length > 0) {
    return {
      ok: false,
      clientId: "",
      tenantId: "",
      slug: baseSlug,
      displayName,
      adminEmail: input.email,
      temporaryPassword: "",
      trialExpiresAt: "",
      activationUrl: "",
      errors,
    };
  }

  const clientId = generateClientId();
  const slug = await ensureUniqueSlug(baseSlug);

  // 1. Tenant definition file (filesystem) o tabla Tenant (postgres)
  const pack = getSectorPackByKey(input.businessType);
  const now = new Date().toISOString();
  const definition = {
    clientId,
    slug,
    displayName,
    sector: input.sector.trim(),
    businessType: input.businessType.trim(),
    companySize: input.companySize?.trim() || "small",
    branding: {
      displayName,
      sector: input.sector.trim(),
      businessType: input.businessType.trim(),
      accentColor: pack?.branding.accentColor,
    },
    modules: pack?.modules.filter((m) => m.enabled).map((m) => m.moduleKey) || [],
    blueprintVersion: "0.1.0",
    createdAt: now,
    updatedAt: now,
    provisioning: {
      source: "alta-online",
      createdBy: input.email,
    },
    sampleData: {},
    updates: [],
    renameMap: {},
  };
  await persistTenantDefinition(definition);

  // En postgres usamos el id (cuid) generado por Prisma como tenantId
  // de las tablas relacionadas; en filesystem el "tenantId" coincide con clientId.
  const tenantId = await resolveTenantId(clientId);

  // 2. Cuenta admin (async, soporta postgres)
  const temporaryPassword = generateTemporaryPassword();
  const adminAccount = createTenantAccount({
    tenantId,
    clientId,
    slug,
    email: input.email.trim().toLowerCase(),
    fullName: input.contactName.trim(),
    role: "owner",
    status: "active",
    temporaryPassword,
    mustChangePassword: true,
  });
  const existing = await listTenantAccountsAsync(clientId);
  await saveTenantAccountsAsync(clientId, [...existing, adminAccount]);

  // 3. Trial state
  const trial = await getOrCreateTrialStateAsync({
    tenantId,
    clientId,
    slug,
  });

  // 4. Subscription
  const subscription = await getOrCreateBillingSubscriptionAsync({
    tenantId,
    clientId,
    slug,
    displayName,
  });
  await saveBillingSubscriptionAsync({
    ...subscription,
    billingEmail: input.email.trim().toLowerCase(),
    updatedAt: new Date().toISOString(),
  });

  // 5. Onboarding state — todavía solo filesystem; en postgres mode haría
  //    falta un wrapper async que aún no existe (TODO A6). Para evitar
  //    fallar, lo intentamos en filesystem y si falla seguimos: el
  //    onboarding no es crítico para el alta, se puede crear en el primer
  //    login si no existe.
  try {
    getOrCreateOnboardingState({
      tenantId,
      clientId,
      slug,
      accountId: adminAccount.id,
    });
  } catch (err) {
    console.warn("[tenant-creation] onboarding init falló, se inicializará en login", {
      clientId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // 6. Invalidar caché del dashboard Factory
  invalidateFactoryDashboardCache();

  const baseUrl = String(
    process.env.PRONTARA_APP_BASE_URL || "http://localhost:3000",
  ).replace(/\/+$/, "");
  const activationUrl =
    baseUrl + "/acceso?tenant=" + encodeURIComponent(slug);

  return {
    ok: true,
    clientId,
    tenantId,
    slug,
    displayName,
    adminEmail: adminAccount.email,
    temporaryPassword,
    trialExpiresAt: trial.expiresAt,
    activationUrl,
  };
}
