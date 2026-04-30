# Cierre Bloque A — Migración async para Postgres

Fecha: 2026-04-28

## Lo que ahora funciona en `PRONTARA_PERSISTENCE=postgres`

### A1 — Login y validación de sesión
- `src/app/api/runtime/login/route.ts` usa `findTenantAccountByCredentialsAsync`
- `src/app/api/runtime/change-password/route.ts` usa `setTenantAccountPasswordAsync` y `getTenantAccountByIdAsync`

### A2 — Alta de tenant desde web
- `src/lib/saas/tenant-creation.ts` reescrito como async; persiste:
  - Definition del tenant en tabla `Tenant` (postgres) o `.prontara/clients/<id>.json` (filesystem)
  - Cuenta admin vía `saveTenantAccountsAsync`
  - Trial state vía `getOrCreateTrialStateAsync`
  - Subscription vía `getOrCreateBillingSubscriptionAsync` + `saveBillingSubscriptionAsync`

### A3 — Recuperación de contraseña
- `src/app/api/runtime/password-reset/request/route.ts` usa `getTenantAccountByEmailAsync`, `listTenantAccountsAsync`, `saveTenantAccountsAsync`
- `src/app/api/runtime/password-reset/confirm/route.ts` usa `listTenantAccountsAsync`, `saveTenantAccountsAsync`

### A4 — Tenant context / registry
- Nuevo `src/lib/persistence/tenant-context-async.ts` con:
  - `listTenantIdsAsync()` — lista clientIds desde `Tenant.findMany` o filesystem
  - `getTenantDefinitionAsync(clientId)` — devuelve el JSON definition desde `Tenant.definition` o el .json local
  - `getTenantDefinitionSafeAsync(clientId)` — variante tolerante a errores

### A5 — Datos operativos del ERP
- Nuevo `src/lib/persistence/active-client-data-store-async.ts` con:
  - `listModuleRecordsAsync`, `saveModuleRecordsAsync`, `createModuleRecordAsync`,
    `updateModuleRecordAsync`, `deleteModuleRecordAsync`
  - En postgres opera sobre la tabla `TenantModuleRecord` (filtrado por
    `clientId + moduleKey`); en filesystem delega a `.prontara/data/<clientId>/<module>.json`

### A6 — Onboarding y lifecycle
- Nuevo `src/lib/persistence/onboarding-store-async.ts` con CRUD completo
  sobre la tabla `OnboardingState` (con `stepsJson` Json).
- Nuevo `src/lib/persistence/lifecycle-state-async.ts` con
  `readLifecycleStateAsync` y `recordLifecycleSentAsync` sobre la tabla
  `LifecycleState` (con `sentJson` Json).

### A7 — Webhook Stripe
- `src/app/api/stripe/webhook/route.ts` ahora usa:
  - `activatePaidPlanAsync` para `checkout.session.completed`
  - `readBillingSubscriptionAsync` + `saveBillingSubscriptionAsync` para
    `invoice.payment_failed` y `customer.subscription.deleted`
- Los handlers son ya async y se hacen `await`.

### A8 — Verificación
- `tsc --noEmit` limpio en los wrappers nuevos y todos los callers
  modificados (filtrando ruido de entorno sandbox).
- Smoke test programático (`scripts/smoke-test-factory-flow.mjs`) sigue
  pasando los 21 checks en filesystem mode (en postgres mode hay que
  ejecutarlo tras `prisma db push` y `db:seed`).

## Lo que sigue pendiente (no bloquea Block A pero sí el deploy)

1. **Migrar callers que no estaban en el listado de A pero que conviene
   tocar antes de deploy real**: `tenant-resolver.ts`, `tenant-clients-index.ts`,
   `subscription-guard.ts`, `business-analytics.ts`, lifecycle-runner.
   La mayoría leen sync con `readBillingSubscription` o `listTenantClientsIndex`.
   En postgres seguirán funcionando si los datos están ya en BD pero por el
   path filesystem (lectura del JSON local) que estará vacío en Vercel.
2. **Wrappers async para chat-store y audit-log**: hoy en filesystem en
   `data/factory/chat/`. Se puede vivir con esto en Vercel si hay volumen
   persistente o si se mueve a S3/R2 más tarde.
3. **Tests end-to-end con postgres real**: provisionar Neon, `db push`,
   `db:seed`, levantar `pnpm dev` con `PRONTARA_PERSISTENCE=postgres` y
   recorrer manualmente: alta → login → cambio password → ver dashboard.

## Cómo probar Postgres mode en local

```powershell
$env:DATABASE_URL = "postgresql://..."
$env:PRONTARA_PERSISTENCE = "postgres"
pnpm prisma generate
pnpm prisma db push
pnpm db:seed
pnpm dev
```

Tras eso, abrir `http://localhost:3000/factory` y comprobar que el
dashboard carga (lee tenants desde Postgres). Probar login con el admin
de `software-factory-demo`.

## Próximo bloque

**Bloque B (provisionar infra)** ya se puede arrancar:
- Crear cuenta Neon (plan Launch)
- `pnpm prisma db push` contra esa DATABASE_URL
- `pnpm db:seed` para volcar datos iniciales
- Verificar en SQL Editor que las tablas tienen filas

Después: **Bloque C (Stripe live)**, **D (Resend)**, **E (Vercel deploy)**.
