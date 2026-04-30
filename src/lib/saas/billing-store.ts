import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type {
  BillingCheckoutIntent,
  BillingInvoiceRecord,
  BillingPlanDefinition,
  BillingPlanKey,
  BillingSubscriptionRecord,
} from "@/lib/saas/billing-definition";
import { writeJsonAtomic } from "@/lib/saas/fs-atomic";

/**
 * Catálogo de planes (modelo real desde abril 2026):
 *   - Pago único de alta por plan.
 *   - Soporte mensual opcional: 12 €/usuario concurrente para todos los planes.
 *
 * Trial mantiene su semántica: 14 días, sin cargo, sin soporte.
 */
const SUPPORT_PRICE_PER_USER_CENTS = 1200;

const BILLING_CATALOG: BillingPlanDefinition[] = [
  {
    key: "trial",
    label: "Trial",
    description: "Prueba inicial de Prontara para arrancar y validar el entorno.",
    commercialTag: "Prueba 14 días",
    setupFeeCents: 0,
    supportMonthlyCentsPerUser: null,
    includedUsers: 2,
    includedClientes: 25,
    includedFacturasMes: 25,
    includedDocumentos: 50,
  },
  {
    key: "basico",
    label: "Básico",
    description: "Plan base para arrancar con un vertical sin complicaciones.",
    commercialTag: "Para arrancar",
    setupFeeCents: 59000,
    supportMonthlyCentsPerUser: SUPPORT_PRICE_PER_USER_CENTS,
    stripeSetupPriceId: process.env.STRIPE_SETUP_PRICE_BASICO || "",
    includedUsers: 2,
    includedClientes: 250,
    includedFacturasMes: 150,
    includedDocumentos: 500,
  },
  {
    key: "estandar",
    label: "Estándar",
    description: "Plan recomendado: branding propio, ajustes del vertical y más usuarios.",
    commercialTag: "El más elegido",
    setupFeeCents: 99000,
    supportMonthlyCentsPerUser: SUPPORT_PRICE_PER_USER_CENTS,
    stripeSetupPriceId: process.env.STRIPE_SETUP_PRICE_ESTANDAR || "",
    includedUsers: 5,
    includedClientes: 1000,
    includedFacturasMes: 600,
    includedDocumentos: 2500,
    featured: true,
  },
  {
    key: "premium",
    label: "Premium",
    description: "Plan avanzado con personalización a fondo, integraciones y migración incluida.",
    commercialTag: "Personalizable",
    setupFeeCents: 149000,
    supportMonthlyCentsPerUser: SUPPORT_PRICE_PER_USER_CENTS,
    stripeSetupPriceId: process.env.STRIPE_SETUP_PRICE_PREMIUM || "",
    includedUsers: null,
    includedClientes: null,
    includedFacturasMes: null,
    includedDocumentos: null,
  },
];

/**
 * Mapea claves legacy (starter/growth/pro) a las nuevas (basico/estandar/premium)
 * cuando se lee un fichero de suscripción persistido antes del refactor.
 * No-op para claves nuevas o trial.
 */
export function migrateLegacyPlanKey(key: string): BillingPlanKey {
  switch (key) {
    case "starter":
      return "basico";
    case "growth":
      return "estandar";
    case "pro":
      return "premium";
    case "trial":
    case "basico":
    case "estandar":
    case "premium":
      return key;
    default:
      // Cualquier valor desconocido cae a basico para no romper.
      return "basico";
  }
}

function ensureDirectory(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function getProjectRoot(): string {
  return /*turbopackIgnore: true*/ process.cwd();
}

function getBillingRootDir(): string {
  const dirPath = path.join(getProjectRoot(), "data", "saas", "billing");
  ensureDirectory(dirPath);
  return dirPath;
}

function normalizeClientId(clientId: string): string {
  const safeClientId = String(clientId || "").trim();
  if (!safeClientId) {
    throw new Error("Falta clientId para resolver billing.");
  }

  return safeClientId;
}

function getBillingFilePath(clientId: string): string {
  return path.join(getBillingRootDir(), normalizeClientId(clientId) + ".json");
}

function addDays(base: Date, days: number) {
  const next = new Date(base.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

/**
 * Lee y MIGRA a la vez: si el fichero está en formato legacy (starter/growth/pro
 * o sin los campos nuevos del modelo de pago único + soporte), lo upgrade-a en
 * memoria. La escritura subsiguiente lo dejará persistido en el formato nuevo.
 */
function readSubscriptionSafe(filePath: string): BillingSubscriptionRecord | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<BillingSubscriptionRecord> & {
      currentPlanKey?: string;
    };

    const migratedPlanKey = migrateLegacyPlanKey(String(parsed.currentPlanKey || "trial"));
    const seats = Number.isFinite(parsed.seats) ? Number(parsed.seats) : 2;

    const migrated: BillingSubscriptionRecord = {
      tenantId: String(parsed.tenantId || ""),
      clientId: String(parsed.clientId || ""),
      slug: String(parsed.slug || ""),
      displayName: String(parsed.displayName || ""),
      billingEmail: String(parsed.billingEmail || ""),
      currentPlanKey: migratedPlanKey,
      status: (parsed.status as BillingSubscriptionRecord["status"]) || "trialing",
      autoRenew: parsed.autoRenew ?? true,
      seats,
      createdAt: String(parsed.createdAt || new Date().toISOString()),
      updatedAt: String(parsed.updatedAt || new Date().toISOString()),
      renewsAt: String(parsed.renewsAt || new Date().toISOString()),
      cancelAt: parsed.cancelAt,
      invoices: Array.isArray(parsed.invoices) ? parsed.invoices : [],
      stripeCustomerId: parsed.stripeCustomerId,
      stripeSubscriptionId: parsed.stripeSubscriptionId,
      lastCheckoutIntent: parsed.lastCheckoutIntent ?? null,
      // Campos nuevos del modelo real — defaults razonables para registros legacy.
      setupFeePaidCents:
        typeof parsed.setupFeePaidCents === "number"
          ? parsed.setupFeePaidCents
          : parsed.status === "active"
            ? // Si ya estaba activo en el modelo viejo, asumimos que pagó el setup
              // del plan equivalente (mejor aproximación posible sin más datos).
              getPlanDefinition(migratedPlanKey).setupFeeCents
            : 0,
      concurrentUsersBilled:
        typeof parsed.concurrentUsersBilled === "number" && parsed.concurrentUsersBilled > 0
          ? parsed.concurrentUsersBilled
          : Math.max(1, seats),
      supportActive:
        typeof parsed.supportActive === "boolean"
          ? parsed.supportActive
          : parsed.status === "active",
    };

    return migrated;
  } catch {
    return null;
  }
}

function writeSubscription(filePath: string, value: BillingSubscriptionRecord) {
  writeJsonAtomic(filePath, value);
}

function buildDefaultBillingEmail(slug: string): string {
  const safe = String(slug || "tenant")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".");

  return "billing@" + safe.replace(/^\.+|\.+$/g, "") + ".local";
}

function createInvoice(input: {
  tenantId: string;
  clientId: string;
  slug: string;
  planKey: BillingPlanKey;
  concept: string;
  amountCents: number;
  stripeCheckoutSessionId?: string;
  stripeSubscriptionId?: string;
  status?: "issued" | "paid" | "void";
}): BillingInvoiceRecord {
  return {
    id: randomUUID(),
    tenantId: input.tenantId,
    clientId: input.clientId,
    slug: input.slug,
    planKey: input.planKey,
    concept: input.concept,
    amountCents: input.amountCents,
    currency: "EUR",
    status: input.status || (input.amountCents > 0 ? "issued" : "paid"),
    createdAt: new Date().toISOString(),
    stripeCheckoutSessionId: input.stripeCheckoutSessionId,
    stripeSubscriptionId: input.stripeSubscriptionId,
  };
}

export function getBillingCatalog(): BillingPlanDefinition[] {
  return BILLING_CATALOG;
}

export function isStripeCheckoutConfigured(): boolean {
  return Boolean(
    String(process.env.STRIPE_SECRET_KEY || "").trim() &&
      String(process.env.APP_BASE_URL || "").trim() &&
      BILLING_CATALOG
        .filter((item) => item.key !== "trial")
        .every((item) => String(item.stripeSetupPriceId || "").trim())
  );
}

export function getPlanDefinition(planKey: BillingPlanKey): BillingPlanDefinition {
  const found = BILLING_CATALOG.find((item) => item.key === planKey);
  if (!found) {
    throw new Error("No existe el plan solicitado: " + planKey);
  }

  return found;
}

export function getOrCreateBillingSubscription(input: {
  tenantId: string;
  clientId: string;
  slug: string;
  displayName: string;
}): BillingSubscriptionRecord {
  const filePath = getBillingFilePath(input.clientId);
  const existing = readSubscriptionSafe(filePath);

  if (existing) {
    return existing;
  }

  const now = new Date();
  const next: BillingSubscriptionRecord = {
    tenantId: input.tenantId,
    clientId: input.clientId,
    slug: input.slug,
    displayName: input.displayName,
    billingEmail: buildDefaultBillingEmail(input.slug),
    currentPlanKey: "trial",
    status: "trialing",
    autoRenew: true,
    seats: 2,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    renewsAt: addDays(now, 14).toISOString(),
    invoices: [],
    lastCheckoutIntent: null,
    setupFeePaidCents: 0,
    concurrentUsersBilled: 1,
    supportActive: false,
  };

  writeSubscription(filePath, next);
  return next;
}

export function saveBillingSubscription(record: BillingSubscriptionRecord) {
  writeSubscription(getBillingFilePath(record.clientId), record);
}

export function setBillingCheckoutIntent(input: {
  tenantId: string;
  clientId: string;
  slug: string;
  displayName: string;
  intent: BillingCheckoutIntent;
}) {
  const current = getOrCreateBillingSubscription(input);

  const next: BillingSubscriptionRecord = {
    ...current,
    updatedAt: new Date().toISOString(),
    status: current.currentPlanKey === "trial" ? "trialing" : current.status,
    lastCheckoutIntent: input.intent,
  };

  saveBillingSubscription(next);
  return next;
}

export function activatePaidPlan(input: {
  tenantId: string;
  clientId: string;
  slug: string;
  displayName: string;
  planKey: BillingPlanKey;
  stripeCheckoutSessionId: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  amountTotalCents?: number;
}) {
  const current = getOrCreateBillingSubscription(input);
  const plan = getPlanDefinition(input.planKey);
  const now = new Date();

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
    renewsAt: addDays(now, 30).toISOString(),
    cancelAt: undefined,
    stripeCustomerId: input.stripeCustomerId || current.stripeCustomerId,
    stripeSubscriptionId: input.stripeSubscriptionId || current.stripeSubscriptionId,
    lastCheckoutIntent: null,
    invoices: [...current.invoices],
    setupFeePaidCents: input.amountTotalCents ?? plan.setupFeeCents,
    // Soporte se activa al pagar el setup. El operador puede ajustar
    // concurrentUsersBilled luego desde el panel.
    concurrentUsersBilled: Math.max(current.concurrentUsersBilled, 1),
    supportActive: true,
  };

  next.invoices.unshift(
    createInvoice({
      tenantId: next.tenantId,
      clientId: next.clientId,
      slug: next.slug,
      planKey: plan.key,
      concept: "Alta plan " + plan.label,
      amountCents: Number.isFinite(input.amountTotalCents)
        ? Number(input.amountTotalCents)
        : plan.setupFeeCents,
      stripeCheckoutSessionId: input.stripeCheckoutSessionId,
      stripeSubscriptionId: input.stripeSubscriptionId,
      status: "paid",
    })
  );

  saveBillingSubscription(next);
  return next;
}

export function scheduleSubscriptionCancel(input: {
  tenantId: string;
  clientId: string;
  slug: string;
  displayName: string;
}) {
  const current = getOrCreateBillingSubscription(input);

  if (current.currentPlanKey === "trial") {
    const nextTrial: BillingSubscriptionRecord = {
      ...current,
      status: "cancelled",
      autoRenew: false,
      updatedAt: new Date().toISOString(),
      cancelAt: new Date().toISOString(),
    };

    saveBillingSubscription(nextTrial);
    return nextTrial;
  }

  const next: BillingSubscriptionRecord = {
    ...current,
    status: "scheduled_cancel",
    autoRenew: false,
    updatedAt: new Date().toISOString(),
    cancelAt: current.renewsAt,
  };

  saveBillingSubscription(next);
  return next;
}

export function getSubscriptionAccessAllowed(record: BillingSubscriptionRecord): boolean {
  if (record.status === "active" || record.status === "trialing") {
    return true;
  }

  if (record.status === "scheduled_cancel") {
    return new Date(record.renewsAt).getTime() >= Date.now();
  }

  return false;
}

// ---------------------------------------------------------------------------
// Soporte mensual: activación / desactivación / ajuste de usuarios facturados
// ---------------------------------------------------------------------------

export type SetSupportConfigInput = {
  clientId: string;
  supportActive?: boolean;
  concurrentUsersBilled?: number;
};

/**
 * Actualiza la configuración de soporte mensual de un tenant. Sin Stripe:
 * solo cambia el estado interno. La facturación real depende del Price ID
 * de soporte recurring que decidas activar en Stripe (ver issueSupportInvoice).
 */
export function setSupportConfig(input: SetSupportConfigInput): BillingSubscriptionRecord {
  const filePath = getBillingFilePath(input.clientId);
  const current = readSubscriptionSafe(filePath);
  if (!current) {
    throw new Error(
      "No existe suscripción para clientId '" +
        input.clientId +
        "'. Crea una primero con getOrCreateBillingSubscription.",
    );
  }

  const next: BillingSubscriptionRecord = {
    ...current,
    supportActive:
      typeof input.supportActive === "boolean" ? input.supportActive : current.supportActive,
    concurrentUsersBilled:
      typeof input.concurrentUsersBilled === "number" && input.concurrentUsersBilled > 0
        ? Math.floor(input.concurrentUsersBilled)
        : current.concurrentUsersBilled,
    updatedAt: new Date().toISOString(),
  };

  saveBillingSubscription(next);
  return next;
}

// ---------------------------------------------------------------------------
// Facturas
// ---------------------------------------------------------------------------

export type IssueSupportInvoiceInput = {
  clientId: string;
  /** Etiqueta del periodo facturado, p.ej. "2026-04" o "Abril 2026". */
  periodLabel: string;
  /** Override del importe (en céntimos). Si no, calcula 12€ × usuarios. */
  amountCentsOverride?: number;
  /** Estado inicial de la factura. Por defecto issued (pendiente de cobro). */
  status?: "issued" | "paid" | "void";
};

/**
 * Genera una factura de soporte mensual basada en el plan y los usuarios
 * concurrentes facturados del tenant. La añade al record de la suscripción
 * y devuelve el record actualizado. NO contacta a Stripe: la integración
 * real con Stripe Invoicing API queda como siguiente paso opcional.
 */
export function issueSupportInvoice(
  input: IssueSupportInvoiceInput,
): { subscription: BillingSubscriptionRecord; invoice: BillingInvoiceRecord } {
  const filePath = getBillingFilePath(input.clientId);
  const current = readSubscriptionSafe(filePath);
  if (!current) {
    throw new Error("No existe suscripción para clientId '" + input.clientId + "'.");
  }

  const plan = getPlanDefinition(current.currentPlanKey);
  const perUser = plan.supportMonthlyCentsPerUser ?? 0;
  const computed = perUser * Math.max(1, current.concurrentUsersBilled);
  const amountCents =
    typeof input.amountCentsOverride === "number" && input.amountCentsOverride > 0
      ? Math.floor(input.amountCentsOverride)
      : computed;

  const invoice: BillingInvoiceRecord = createInvoice({
    tenantId: current.tenantId,
    clientId: current.clientId,
    slug: current.slug,
    planKey: current.currentPlanKey,
    concept:
      "Soporte " +
      plan.label +
      " · " +
      input.periodLabel +
      " · " +
      current.concurrentUsersBilled +
      " usuarios concurrentes",
    amountCents,
    status: input.status || "issued",
  });

  const next: BillingSubscriptionRecord = {
    ...current,
    invoices: [invoice, ...current.invoices],
    updatedAt: new Date().toISOString(),
  };

  saveBillingSubscription(next);
  return { subscription: next, invoice };
}

export function updateInvoiceStatus(input: {
  clientId: string;
  invoiceId: string;
  status: "issued" | "paid" | "void";
}): BillingSubscriptionRecord {
  const filePath = getBillingFilePath(input.clientId);
  const current = readSubscriptionSafe(filePath);
  if (!current) throw new Error("No existe suscripción.");

  const idx = current.invoices.findIndex((i) => i.id === input.invoiceId);
  if (idx < 0) throw new Error("Factura no encontrada.");

  const updatedInvoices = current.invoices.slice();
  updatedInvoices[idx] = { ...updatedInvoices[idx], status: input.status };

  const next: BillingSubscriptionRecord = {
    ...current,
    invoices: updatedInvoices,
    updatedAt: new Date().toISOString(),
  };
  saveBillingSubscription(next);
  return next;
}

export function readBillingSubscription(clientId: string): BillingSubscriptionRecord | null {
  return readSubscriptionSafe(getBillingFilePath(clientId));
}