# RLS · Row-Level Security para Prontara (ARQ-10)

Esta guía explica cómo activar **Row-Level Security** de Postgres como capa de defense-in-depth contra bugs de query mal filtrada en multi-tenancy. Hoy Prontara depende de la disciplina del código (cada query incluye `WHERE clientId`); con RLS activa, además, la propia DB rechaza cualquier query que no haya identificado correctamente el tenant.

> **Estado**: opt-in. La pieza está preparada (SQL + middleware Prisma) pero NO se activa automáticamente. Lee esta guía completa antes de aplicar nada.

## Por qué activarlo

- Si un dev nuevo escribe `prisma.tenantAccount.findMany()` sin `where: { clientId }` y deshabilita la sesión por error, hoy Postgres devuelve TODAS las cuentas de TODOS los tenants. Con RLS activa: 0 filas (o error si está estricto).
- Cumplimiento: facilita defender ante auditor que el aislamiento está enforced en la propia DB, no solo en el código.
- Coste: una fila por tabla protegida en `pg_policies` y una llamada `set_config` por transacción tenant-scoped.

## Por qué NO está activado por defecto

- Cualquier query existente que NO declare el tenant explícitamente fallará al activarlo. Hay decenas de queries en stores async — auditarlas y migrarlas a `withTenantTransaction` requiere tiempo.
- El operador Factory ejecuta queries cross-tenant constantemente (analíticas MRR, lifecycle, dashboards globales). Necesitan un rol `prontara_admin` con `BYPASSRLS` o se rompe el panel.
- En desarrollo local con `PRONTARA_PERSISTENCE=filesystem` no aplica (filesystem no tiene RLS) — la asimetría de comportamiento puede confundir.

## Cuándo activar

Cuando se cumplan **dos** de estos:

1. Aparezca el primer cliente regulado (sanitario, jurídico, financiero) o llegue una auditoría externa que pregunte por aislamiento.
2. El equipo crezca a más de un dev y ya no podamos garantizar disciplina en cada PR.
3. Aparezca un near-miss (un PR que casi se mergea con un `WHERE clientId` faltante).

Mientras tanto, la pieza queda lista en `prisma/rls-optin/01-enable-rls.sql` + `src/lib/persistence/rls-middleware.ts`.

## Plan de activación (orden importa)

### Paso 1 · Crear los dos roles en Postgres

Conecta a Neon con un usuario superuser y ejecuta:

```sql
-- Rol normal: la app web lo usa para la mayoría de queries.
CREATE ROLE prontara_app LOGIN PASSWORD '<password-largo-aleatorio>';

-- Rol admin: Factory ops cross-tenant (analíticas, lifecycle).
CREATE ROLE prontara_admin LOGIN PASSWORD '<otro-password>' BYPASSRLS;

-- Permisos sobre el schema:
GRANT USAGE ON SCHEMA public TO prontara_app, prontara_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public
  TO prontara_app, prontara_admin;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public
  TO prontara_app, prontara_admin;

-- Privilegios por defecto para tablas FUTURAS (importante si Prisma
-- añade tablas con migrate):
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO prontara_app, prontara_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO prontara_app, prontara_admin;
```

### Paso 2 · Aplicar las policies

```bash
psql "$DATABASE_URL" -f prisma/rls-optin/01-enable-rls.sql
```

A partir de aquí, **cualquier query con el rol `prontara_app` que no haya seteado `app.tenant_id` devolverá 0 filas o fallará** según la operación. Las queries con el rol `prontara_admin` pasan tal cual (BYPASSRLS).

### Paso 3 · Configurar dos `DATABASE_URL`

Tu `.env` o env vars de Vercel deben tener dos URLs:

```
DATABASE_URL=postgres://prontara_app:.../prontara              # rol normal
DATABASE_URL_ADMIN=postgres://prontara_admin:.../prontara      # rol bypassrls
```

Hoy `src/lib/persistence/db.ts` solo conoce `DATABASE_URL`. Para soportar el modo admin tendrás que añadir un cliente Prisma adicional (`getPrismaAdminClient`) que use `DATABASE_URL_ADMIN`. Plantilla:

```ts
// db-admin.ts (nuevo)
import { PrismaClient } from "@prisma/client";

let cached: PrismaClient | null = null;
export function getPrismaAdminClient(): PrismaClient {
  if (!cached) {
    cached = new PrismaClient({
      datasources: { db: { url: process.env.DATABASE_URL_ADMIN } },
    });
  }
  return cached;
}
```

Las páginas y endpoints de `/factory/*` usarían este cliente; los de `/api/runtime/*` y otras rutas tenant-scoped usarían `withTenantTransaction(clientId, ...)`.

### Paso 4 · Migrar queries tenant-scoped progresivamente

En cada endpoint que sirve a un tenant concreto:

```ts
// ❌ Antes
const accounts = await prisma.tenantAccount.findMany({
  where: { clientId },
});

// ✅ Después (RLS activa)
import { withTenantTransaction } from "@/lib/persistence/rls-middleware";
const accounts = await withTenantTransaction(clientId, async (tx) => {
  return tx.tenantAccount.findMany();
  // sin "where: { clientId }" — RLS lo añade
});
```

Recomendación: migra **endpoint por endpoint**, no todo a la vez. Cada migración debe llevar test E2E mínimo que valide que un tenant NO puede leer datos de otro.

### Paso 5 · Verificación end-to-end

Test manual obligatorio antes de declararlo activo:

1. Login como `tenant-A`.
2. Edita la URL para hacer GET sobre un recurso de `tenant-B` (ej: `/api/runtime/clientes/<id-de-B>`).
3. **Debe** devolver 404 (no 200, no 500).
4. Repetir el test con `prontara_app` directamente desde `psql` — debe filtrar por `app.tenant_id`.

### Paso 6 · Monitorización

Activa logs de Postgres para queries que devuelven 0 filas en tablas tenant-scoped — un volumen anómalo puede indicar un bug en la activación de RLS.

## Cómo desactivar (rollback rápido)

Si algo sale mal en producción y tienes que volver atrás:

```sql
DROP POLICY tenant_isolation ON "Tenant";
DROP POLICY tenant_isolation ON "TenantAccount";
DROP POLICY tenant_isolation ON "BillingSubscription";
DROP POLICY tenant_isolation ON "BillingInvoice";
DROP POLICY tenant_isolation ON "TrialState";
DROP POLICY tenant_isolation ON "OnboardingState";
DROP POLICY tenant_isolation ON "LifecycleState";
DROP POLICY tenant_isolation ON "VerticalOverride";
DROP POLICY tenant_isolation ON "TenantModuleRecord";

ALTER TABLE "Tenant"             DISABLE ROW LEVEL SECURITY;
ALTER TABLE "TenantAccount"      DISABLE ROW LEVEL SECURITY;
ALTER TABLE "BillingSubscription" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "BillingInvoice"     DISABLE ROW LEVEL SECURITY;
ALTER TABLE "TrialState"         DISABLE ROW LEVEL SECURITY;
ALTER TABLE "OnboardingState"    DISABLE ROW LEVEL SECURITY;
ALTER TABLE "LifecycleState"     DISABLE ROW LEVEL SECURITY;
ALTER TABLE "VerticalOverride"   DISABLE ROW LEVEL SECURITY;
ALTER TABLE "TenantModuleRecord" DISABLE ROW LEVEL SECURITY;
```

(Los roles puedes dejarlos: no estorban si nadie los usa.)

## Tablas globales sin RLS (por diseño)

Estas NO llevan `clientId` y por tanto NO tienen policy:

- `Lead` — leads de la landing (pre-tenant).
- `EvolutionEvent` — eventos del Factory operativo.
- `AuditEvent` — log de auditoría Factory.
- `StripeProcessedEvent` — dedupe global de webhooks.
- `DomainEvent` — saga global de eventos de dominio.
- `FactoryNotification` — eventos visibles para operador.

Acceso a estas tablas se controla por el middleware de auth de `/api/factory/*` (que requiere sesión de operador), no por RLS.

## Referencias

- [ADR-0002](./adr/0002-shared-db-multi-tenant.md) — modelo shared DB + tenant_id.
- [Postgres docs · Row Security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- ARQ-10 en `docs/Auditoria-Arquitectonica-Prontara.docx`.
