/**
 * Modelo de precios real (post-refactor):
 *   - Pago único de alta (setupFeeCents) por contratar el plan.
 *   - Soporte mensual variable: 12 € por usuario concurrente, opcional.
 *
 * Los planes legacy starter/growth/pro se mapean al leer ficheros antiguos
 * en migración (ver migrateLegacyPlanKey en billing-store.ts).
 */
export type BillingPlanKey = "trial" | "basico" | "estandar" | "premium";

export type LegacyBillingPlanKey = "starter" | "growth" | "pro";

export type BillingSubscriptionStatus =
  | "trialing"
  | "active"
  | "scheduled_cancel"
  | "cancelled"
  | "pending_checkout"
  | "past_due";

export type BillingLimitValue = number | null;

export type BillingPlanDefinition = {
  key: BillingPlanKey;
  label: string;
  description: string;
  commercialTag: string;
  /** Pago único por contratar el plan. 0 para trial. */
  setupFeeCents: number;
  /** Coste de soporte por usuario concurrente al mes en céntimos. null para trial. */
  supportMonthlyCentsPerUser: number | null;
  /** Stripe Price ID one-time del setup fee. */
  stripeSetupPriceId?: string;
  includedUsers: BillingLimitValue;
  includedClientes: BillingLimitValue;
  includedFacturasMes: BillingLimitValue;
  includedDocumentos: BillingLimitValue;
  featured?: boolean;
};

export type BillingInvoiceStatus = "issued" | "paid" | "void";
export type BillingInvoiceRecord = {
  id: string;
  tenantId: string;
  clientId: string;
  slug: string;
  planKey: BillingPlanKey;
  concept: string;
  amountCents: number;
  currency: "EUR";
  status: BillingInvoiceStatus;
  createdAt: string;
  stripeCheckoutSessionId?: string;
  stripeSubscriptionId?: string;
};

export type BillingCheckoutIntent = {
  sessionId: string;
  planKey: BillingPlanKey;
  createdAt: string;
  mode: "checkout";
  successUrl: string;
  cancelUrl: string;
};

export type BillingSubscriptionRecord = {
  tenantId: string;
  clientId: string;
  slug: string;
  displayName: string;
  billingEmail: string;
  currentPlanKey: BillingPlanKey;
  status: BillingSubscriptionStatus;
  autoRenew: boolean;
  seats: number;
  createdAt: string;
  updatedAt: string;
  renewsAt: string;
  cancelAt?: string;
  invoices: BillingInvoiceRecord[];
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  lastCheckoutIntent?: BillingCheckoutIntent | null;
  /** Cuánto se ha cobrado por el alta. 0 hasta que el setup fee esté pagado. */
  setupFeePaidCents: number;
  /** Usuarios concurrentes que se facturan en soporte. */
  concurrentUsersBilled: number;
  /** Si el soporte mensual está activo (genera MRR). */
  supportActive: boolean;
};

export type BillingUsageSnapshot = {
  users: number;
  clientes: number;
  facturasMes: number;
  documentos: number;
};

export type BillingLimitCheck = {
  key: "users" | "clientes" | "facturasMes" | "documentos";
  label: string;
  used: number;
  limit: BillingLimitValue;
  withinLimit: boolean;
};

export type BillingOverview = {
  tenantId: string;
  clientId: string;
  slug: string;
  displayName: string;
  catalog: BillingPlanDefinition[];
  subscription: BillingSubscriptionRecord;
  currentPlan: BillingPlanDefinition;
  usage: BillingUsageSnapshot;
  limits: BillingLimitCheck[];
  accessAllowed: boolean;
  checkoutConfigured: boolean;
  canUpgrade: boolean;
  canDowngrade: boolean;
  canCancel: boolean;
};

export type StripeCheckoutResolved = {
  ok: boolean;
  paid: boolean;
  sessionId: string;
  customerId?: string;
  subscriptionId?: string;
  amountTotalCents?: number;
  currency?: string;
  statusText: string;
};