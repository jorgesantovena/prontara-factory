-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "legacyTenantId" TEXT,
    "displayName" TEXT NOT NULL,
    "shortName" TEXT,
    "sector" TEXT,
    "businessType" TEXT,
    "companySize" TEXT,
    "blueprintVersion" TEXT,
    "definition" JSONB NOT NULL DEFAULT '{}',
    "brandingJson" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'provisioning',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantAccount" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "temporaryPassword" TEXT NOT NULL DEFAULT '',
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastProvisionedAt" TIMESTAMP(3),

    CONSTRAINT "TenantAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingSubscription" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "billingEmail" TEXT NOT NULL,
    "currentPlanKey" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "autoRenew" BOOLEAN NOT NULL DEFAULT true,
    "seats" INTEGER NOT NULL DEFAULT 2,
    "setupFeePaidCents" INTEGER NOT NULL DEFAULT 0,
    "concurrentUsersBilled" INTEGER NOT NULL DEFAULT 1,
    "supportActive" BOOLEAN NOT NULL DEFAULT false,
    "renewsAt" TIMESTAMP(3) NOT NULL,
    "cancelAt" TIMESTAMP(3),
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "lastCheckoutIntent" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingInvoice" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "planKey" TEXT NOT NULL,
    "concept" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "status" TEXT NOT NULL,
    "stripeCheckoutSessionId" TEXT,
    "stripeSubscriptionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrialState" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "trialDays" INTEGER NOT NULL DEFAULT 14,
    "daysRemaining" INTEGER NOT NULL DEFAULT 14,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrialState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingState" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "stepsJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LifecycleState" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "sentJson" JSONB NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LifecycleState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerticalOverride" (
    "id" TEXT NOT NULL,
    "packKey" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "VerticalOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "company" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "message" TEXT NOT NULL DEFAULT '',
    "sourceVertical" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "userAgent" TEXT NOT NULL DEFAULT '',
    "ip" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantModuleRecord" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantModuleRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvolutionEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvolutionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "conversationId" TEXT,
    "actorEmail" TEXT,
    "tool" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "inputJson" JSONB,
    "resultJson" JSONB,
    "touchedPaths" TEXT[],
    "backupRef" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StripeProcessedEvent" (
    "eventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "outcome" TEXT NOT NULL,
    "errorMsg" TEXT,

    CONSTRAINT "StripeProcessedEvent_pkey" PRIMARY KEY ("eventId")
);

-- CreateTable
CREATE TABLE "DomainEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 5,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "errorMsg" TEXT,

    CONSTRAINT "DomainEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FactoryNotification" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FactoryNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_clientId_key" ON "Tenant"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_legacyTenantId_key" ON "Tenant"("legacyTenantId");

-- CreateIndex
CREATE INDEX "Tenant_status_idx" ON "Tenant"("status");

-- CreateIndex
CREATE INDEX "Tenant_businessType_idx" ON "Tenant"("businessType");

-- CreateIndex
CREATE INDEX "TenantAccount_clientId_status_idx" ON "TenantAccount"("clientId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TenantAccount_clientId_email_key" ON "TenantAccount"("clientId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "BillingSubscription_clientId_key" ON "BillingSubscription"("clientId");

-- CreateIndex
CREATE INDEX "BillingSubscription_status_idx" ON "BillingSubscription"("status");

-- CreateIndex
CREATE INDEX "BillingSubscription_currentPlanKey_idx" ON "BillingSubscription"("currentPlanKey");

-- CreateIndex
CREATE INDEX "BillingInvoice_clientId_createdAt_idx" ON "BillingInvoice"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "BillingInvoice_status_idx" ON "BillingInvoice"("status");

-- CreateIndex
CREATE UNIQUE INDEX "TrialState_tenantId_key" ON "TrialState"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "TrialState_clientId_key" ON "TrialState"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingState_clientId_accountId_key" ON "OnboardingState"("clientId", "accountId");

-- CreateIndex
CREATE UNIQUE INDEX "LifecycleState_tenantId_key" ON "LifecycleState"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "LifecycleState_clientId_key" ON "LifecycleState"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "VerticalOverride_packKey_key" ON "VerticalOverride"("packKey");

-- CreateIndex
CREATE INDEX "VerticalOverride_updatedAt_idx" ON "VerticalOverride"("updatedAt");

-- CreateIndex
CREATE INDEX "Lead_status_createdAt_idx" ON "Lead"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Lead_email_idx" ON "Lead"("email");

-- CreateIndex
CREATE INDEX "TenantModuleRecord_clientId_moduleKey_updatedAt_idx" ON "TenantModuleRecord"("clientId", "moduleKey", "updatedAt");

-- CreateIndex
CREATE INDEX "TenantModuleRecord_clientId_moduleKey_id_idx" ON "TenantModuleRecord"("clientId", "moduleKey", "id");

-- CreateIndex
CREATE INDEX "EvolutionEvent_tenantId_createdAt_idx" ON "EvolutionEvent"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_tool_createdAt_idx" ON "AuditEvent"("tool", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_actorEmail_createdAt_idx" ON "AuditEvent"("actorEmail", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_conversationId_idx" ON "AuditEvent"("conversationId");

-- CreateIndex
CREATE INDEX "StripeProcessedEvent_type_processedAt_idx" ON "StripeProcessedEvent"("type", "processedAt");

-- CreateIndex
CREATE INDEX "DomainEvent_status_nextAttemptAt_idx" ON "DomainEvent"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "DomainEvent_aggregateType_aggregateId_idx" ON "DomainEvent"("aggregateType", "aggregateId");

-- CreateIndex
CREATE INDEX "DomainEvent_type_occurredAt_idx" ON "DomainEvent"("type", "occurredAt");

-- CreateIndex
CREATE INDEX "FactoryNotification_readAt_createdAt_idx" ON "FactoryNotification"("readAt", "createdAt");

-- CreateIndex
CREATE INDEX "FactoryNotification_type_createdAt_idx" ON "FactoryNotification"("type", "createdAt");

-- AddForeignKey
ALTER TABLE "TenantAccount" ADD CONSTRAINT "TenantAccount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingSubscription" ADD CONSTRAINT "BillingSubscription_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingInvoice" ADD CONSTRAINT "BillingInvoice_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "BillingSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrialState" ADD CONSTRAINT "TrialState_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingState" ADD CONSTRAINT "OnboardingState_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LifecycleState" ADD CONSTRAINT "LifecycleState_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantModuleRecord" ADD CONSTRAINT "TenantModuleRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvolutionEvent" ADD CONSTRAINT "EvolutionEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
