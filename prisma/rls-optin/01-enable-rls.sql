-- ============================================================================
-- ARQ-10 · Row-Level Security (RLS) — opt-in defense in depth.
--
-- ⚠️  NO se aplica automáticamente. Lee `docs/rls-setup.md` antes de
--     ejecutar este script en cualquier entorno.
--
-- Qué hace:
--   1. Habilita RLS en las 9 tablas que llevan `clientId` (tenant scope).
--   2. Crea una policy por tabla que permite SELECT/INSERT/UPDATE/DELETE
--      SOLO si "clientId" = current_setting('app.tenant_id', true).
--   3. Permite bypass total al rol "prontara_admin" (para Factory operations
--      cross-tenant: dashboards, lifecycle, demos, refunds, etc.).
--
-- Qué NO hace:
--   - Tablas globales (Lead, EvolutionEvent, AuditEvent, StripeProcessedEvent,
--     DomainEvent, FactoryNotification): siguen sin RLS porque son consumidas
--     por código operador-Factory y/o no tienen tenant scope.
--   - Crear los roles. Verifica primero que existen (CREATE ROLE prontara_app
--     y CREATE ROLE prontara_admin).
--
-- Cómo funciona en runtime:
--   - El middleware Prisma (`src/lib/persistence/rls-middleware.ts`) ejecuta
--     `SET LOCAL app.tenant_id = '<clientId>'` al inicio de cada query/tx
--     iniciada con un clientId conocido.
--   - Las queries cross-tenant (analíticas Factory, lifecycle, etc.) usan
--     una conexión con el rol "prontara_admin" que está marcado BYPASSRLS.
-- ============================================================================

-- Tablas con tenant scope (clientId)
ALTER TABLE "Tenant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TenantAccount" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BillingSubscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BillingInvoice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TrialState" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OnboardingState" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LifecycleState" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VerticalOverride" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TenantModuleRecord" ENABLE ROW LEVEL SECURITY;

-- Policies — una por tabla, mismo patrón.
-- USING ↔ filtra qué filas son visibles a SELECT/UPDATE/DELETE.
-- WITH CHECK ↔ valida qué filas se permiten en INSERT/UPDATE.
-- Ambas comprueban que "clientId" coincide con el tenant_id de la sesión.

CREATE POLICY tenant_isolation ON "Tenant"
  FOR ALL
  USING ("clientId" = current_setting('app.tenant_id', true))
  WITH CHECK ("clientId" = current_setting('app.tenant_id', true));

CREATE POLICY tenant_isolation ON "TenantAccount"
  FOR ALL
  USING ("clientId" = current_setting('app.tenant_id', true))
  WITH CHECK ("clientId" = current_setting('app.tenant_id', true));

CREATE POLICY tenant_isolation ON "BillingSubscription"
  FOR ALL
  USING ("clientId" = current_setting('app.tenant_id', true))
  WITH CHECK ("clientId" = current_setting('app.tenant_id', true));

CREATE POLICY tenant_isolation ON "BillingInvoice"
  FOR ALL
  USING ("clientId" = current_setting('app.tenant_id', true))
  WITH CHECK ("clientId" = current_setting('app.tenant_id', true));

CREATE POLICY tenant_isolation ON "TrialState"
  FOR ALL
  USING ("clientId" = current_setting('app.tenant_id', true))
  WITH CHECK ("clientId" = current_setting('app.tenant_id', true));

CREATE POLICY tenant_isolation ON "OnboardingState"
  FOR ALL
  USING ("clientId" = current_setting('app.tenant_id', true))
  WITH CHECK ("clientId" = current_setting('app.tenant_id', true));

CREATE POLICY tenant_isolation ON "LifecycleState"
  FOR ALL
  USING ("clientId" = current_setting('app.tenant_id', true))
  WITH CHECK ("clientId" = current_setting('app.tenant_id', true));

CREATE POLICY tenant_isolation ON "VerticalOverride"
  FOR ALL
  USING ("clientId" = current_setting('app.tenant_id', true))
  WITH CHECK ("clientId" = current_setting('app.tenant_id', true));

CREATE POLICY tenant_isolation ON "TenantModuleRecord"
  FOR ALL
  USING ("clientId" = current_setting('app.tenant_id', true))
  WITH CHECK ("clientId" = current_setting('app.tenant_id', true));

-- ============================================================================
-- Roles (descomenta y ajusta passwords antes de ejecutar)
-- ============================================================================
-- CREATE ROLE prontara_app  LOGIN PASSWORD '...';   -- el rol normal de la app
-- CREATE ROLE prontara_admin LOGIN PASSWORD '...' BYPASSRLS;  -- Factory ops

-- Conceder permisos básicos sobre el schema:
-- GRANT USAGE ON SCHEMA public TO prontara_app, prontara_admin;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public
--   TO prontara_app, prontara_admin;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public
--   TO prontara_app, prontara_admin;

-- ============================================================================
-- Rollback (por si necesitas volver atrás)
-- ============================================================================
-- DROP POLICY tenant_isolation ON "Tenant";
-- DROP POLICY tenant_isolation ON "TenantAccount";
-- ... (idem para cada tabla)
-- ALTER TABLE "Tenant" DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE "TenantAccount" DISABLE ROW LEVEL SECURITY;
-- ... (idem)
