# Cierre de sesión — Webhook Stripe + Postgres async + Deploy prep

Fecha: 2026-04-27

## Lo que ha cambiado en esta sesión

### 1. Webhook Stripe que activa el plan al pagar

`src/app/api/stripe/webhook/route.ts` ya no es un stub TODO. Ahora despacha
los eventos relevantes:

- **`checkout.session.completed`** → llama a `activatePaidPlan()` con el
  `clientId`/`tenantId`/`slug`/`planKey` que el flujo de checkout puso en
  la metadata. Marca el setup fee como pagado, genera la factura `paid`
  y deja la suscripción en `active`.
- **`invoice.paid`** → llama a `markStripeInvoicePaid()` para localizar la
  factura local por su `stripeCheckoutSessionId` y ponerla en `paid`.
- **`invoice.payment_failed`** → marca la suscripción como `past_due`.
- **`customer.subscription.deleted`** → marca la suscripción como
  `cancelled` con `autoRenew: false`.

Se añadió el estado `past_due` a `BillingSubscriptionStatus` en
`billing-definition.ts`.

### 2. Endpoint público de alta de tenant

Ya existía desde la sesión anterior (`POST /api/factory/tenants/create`)
y consume `createTenantFromAlta()`. Lo importante es que **el flujo
"100% online" ya cierra el círculo**:

```
/alta (form)
  → POST /api/factory/tenants/create
    → createTenantFromAlta() crea client + admin + trial + billing
    → email con credenciales (Resend o outbox)
    → cliente accede a /acceso, hace login con su contraseña temporal
    → pulsa "Empezar con Estándar" en /suscripcion
    → Stripe Checkout cobra el setup fee
    → webhook → activatePaidPlan → tenant pasa a "active"
```

### 3. Migración a Postgres — wrappers async dual-mode

Tres nuevos módulos en `src/lib/persistence/`:

- **`account-store-async.ts`** — `listTenantAccountsAsync`,
  `saveTenantAccountsAsync`, `upsertTenantAdminAccountAsync`,
  `findTenantAccountByCredentialsAsync`, `getTenantAccountByIdAsync`,
  `getTenantAccountByEmailAsync`, `setTenantAccountPasswordAsync`,
  `getTenantAccountSnapshotAsync`. En `PRONTARA_PERSISTENCE=postgres`
  enrutan a Prisma; en filesystem delegan en las funciones síncronas
  originales.
- **`trial-store-async.ts`** — `getOrCreateTrialStateAsync`,
  `saveTrialStateAsync`, `refreshTrialStateAsync`. La normalización del
  `daysRemaining` ahora se hace en el wrapper.
- **`billing-store-async.ts`** — `readBillingSubscriptionAsync`,
  `getOrCreateBillingSubscriptionAsync`, `saveBillingSubscriptionAsync`,
  `activatePaidPlanAsync`. Persiste suscripción + invoices en una
  transacción Prisma cuando es Postgres.

**Migración de callers**: los wrappers son dual-mode pero los callers
existentes siguen usando las versiones sync. La migración full de
callers (`auth-session.ts`, todas las APIs de `/factory/*`, etc.) se
hace gradualmente. Mientras eso ocurre:

- **Filesystem mode (default)** sigue funcionando exactamente igual.
- **Postgres mode** funciona para los callers ya migrados (chat write
  tools, leads, vertical-overrides). Los callers no migrados
  fallarán con errores claros si se ejecutan en postgres mode.

Para deploy a Vercel realista, hay que migrar los callers críticos del
runtime (login, lectura de tenant, runtime data store). Es trabajo de
1.5-2 días concentrado y está pendiente — lo documentamos en
`docs/persistence-migration-status.md`.

### 4. Deploy preparation

- **`vercel.json`** creado con:
  - `buildCommand` que ejecuta `prisma generate` antes de `next build`
  - `maxDuration` extendido a 30s (webhook, alta) y 60s (lifecycle run)
  - Region `fra1` (Frankfurt) — alineada con Neon `eu-central-1`
- **`package.json`** actualizado:
  - `build` ahora incluye `prisma generate`
  - `postinstall` añade `prisma generate` (Vercel build cache friendly)
  - `db:push`, `db:seed`, `smoke` como scripts atajo

## Estado del despliegue real (qué falta para cobrar el primer cliente)

Con lo que hay hoy en `main` puedes hacer un deploy de vista pública
en Vercel (la landing /verticales, /precios, /faq, etc. funcionan).
Para el flujo de pago de extremo a extremo necesitas:

1. **Provisionar Neon en serio** (no free tier — usa el plan Launch ~19$/mes).
   Region `eu-central-1`. Copia la connection string.
2. **`pnpm prisma db push`** con esa `DATABASE_URL` para crear las tablas.
3. **`pnpm db:seed`** para volcar tus tenants locales (Software Factory Demo).
4. **Migrar callers críticos a wrappers async** (ver
   `docs/persistence-migration-status.md`). Mínimo:
   - `auth-session.ts` (login)
   - `tenant-context.ts` / `tenant-registry.ts`
   - `active-client-data-store.ts`
5. **Variables de entorno en Vercel**:
   - `DATABASE_URL` (Neon, con `?sslmode=require&pgbouncer=true`)
   - `PRONTARA_PERSISTENCE=postgres`
   - `PRONTARA_SESSION_SECRET` (≥32 chars)
   - `PRONTARA_APP_BASE_URL=https://app.prontara.com`
   - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
     `STRIPE_SETUP_PRICE_BASICO/_ESTANDAR/_PREMIUM`
   - `RESEND_API_KEY`, `PRONTARA_FROM_EMAIL`
   - `ANTHROPIC_API_KEY` (opcional, para chat factory)
6. **Apuntar el DNS de `app.prontara.com`** a Vercel.
7. **Configurar webhook de Stripe** en
   `https://app.prontara.com/api/stripe/webhook` con los eventos:
   `checkout.session.completed`, `invoice.paid`,
   `invoice.payment_failed`, `customer.subscription.deleted`.
8. **Verificar dominio en Resend** (`PRONTARA_FROM_EMAIL` debe estar
   en un dominio verificado).

## Verificación tsc

Sin errores reales en los nuevos ficheros (filtrando ruido de entorno
sandbox sin `@types/node`/types Next).

## Smoke test

`pnpm smoke` (alias de `node scripts/smoke-test-factory-flow.mjs`)
sigue verde con los 21 checks del flujo factory→vertical→tenant.

## Próximo paso recomendado

Ejecutar la migración de callers a wrappers async empezando por
`auth-session.ts`. Eso desbloquea login en postgres. A partir de ahí,
iterativamente: tenant-context → tenant-registry → active-client-data-store.

Cuando todo eso esté hecho y verificado en local con
`PRONTARA_PERSISTENCE=postgres`, ya puedes hacer deploy real y
empezar a cobrar.
