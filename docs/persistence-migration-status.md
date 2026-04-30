# Estado de la migración a Postgres

## Lo que está hecho (sesión 1)

### Schema Prisma completo
`prisma/schema.prisma` con todos los modelos críticos:
- `Tenant` — definición + branding + status
- `TenantAccount` — cuentas con scrypt
- `BillingSubscription` + `BillingInvoice` — modelo real (setup fee + soporte)
- `TrialState`, `OnboardingState`, `LifecycleState`
- `VerticalOverride` — overrides editor visual
- `Lead` — formulario público
- `TenantModuleRecord` — datos operativos del ERP
- `EvolutionEvent`, `AuditEvent` — trazas

### Adapter pattern
`src/lib/persistence/db.ts` con flag `PRONTARA_PERSISTENCE=postgres|filesystem`
(default filesystem). En modo postgres carga `PrismaClient` lazy. El modo
filesystem no requiere DATABASE_URL ni Prisma para funcionar.

### Stores migrados (POC, dual-mode)
- `src/lib/persistence/leads-store-async.ts` — leads
- `src/lib/persistence/vertical-overrides-async.ts` — overrides de verticales

Ambos son wrappers async que enrutan a Postgres o filesystem según el flag.
Las APIs que los consumen (`/api/factory/leads`, `/api/factory/verticales/*`,
`/api/public/leads`) ya usan estos wrappers.

### Script de seed
`scripts/seed-from-json.mjs` — lee todos los JSON locales y los inserta en
Postgres. Idempotente (upserts). Soporta `--dry-run`. Migra:
- Tenants (`.prontara/clients/`)
- Accounts (`data/saas/accounts/`)
- Billing subscriptions + invoices (`data/saas/billing/`)
- Trial state (`data/saas/trial/`)
- Vertical overrides (`data/saas/vertical-overrides/`)
- Leads (`data/saas/leads/`)

## Lo que QUEDA (sesión 2)

### Stores pendientes de migrar a wrappers async

1. **`src/lib/saas/account-store.ts`** — el más crítico. Lo usan:
   - `auth-session.ts` (login, validación de session)
   - `account-provisioning.ts`
   - `tenant-hard-provisioning.ts`
   - `password-reset/*` endpoints
   - Múltiples páginas y APIs
   
   Refactor: crear `src/lib/persistence/account-store-async.ts` con versión
   async de cada función, actualizar todos los callers a `await` la versión
   async.

2. **`src/lib/saas/billing-store.ts`** — similar al anterior. Lo usan:
   - `/api/factory/client/[clientId]/support` y `/invoices`
   - `business-analytics.ts`
   - `subscription-guard.ts`
   - `billing-engine.ts`

3. **`src/lib/saas/trial-store.ts`** — usado en lifecycle y guards. Pequeño.

4. **`src/lib/saas/onboarding-store.ts`** — pequeño, fácil.

5. **`src/lib/saas/lifecycle-evaluator.ts`** — los reads/writes de
   `LifecycleState` están dentro del módulo. Refactor más localizado.

6. **`src/lib/factory/tenant-context.ts` + `tenant-registry.ts`** — leen
   los `.prontara/clients/<id>.json`. Estos son los que más requieren un
   refactor cuidadoso porque se usan en docenas de sitios. La estrategia
   es exponer una versión async (`getTenantDefinitionAsync`,
   `listTenantIdsAsync`) y migrar callers gradualmente.

7. **`src/lib/erp/active-client-data-store.ts`** — datos operativos del
   ERP por tenant (`.prontara/data/<clientId>/<module>.json`). Es el más
   sensible porque cada tenant escribe datos productivos aquí. Se mapea a
   `TenantModuleRecord` en el schema. Refactor importante.

### No migrar a Postgres todavía (mantener filesystem)

Estos NO bloquean producción y pueden quedarse en filesystem si Vercel
tiene volumen persistente, o moverse a object storage (S3/R2) más tarde:

- **Chat conversations + uploads** (`data/factory/chat/`) — uploads son
  binarios; las conversaciones JSON pueden ir a Postgres pero no es
  crítico.
- **Audit log JSONL** (`data/factory/chat/audit/`) — append-only diario.
  Encaja mejor en S3/R2 que en Postgres.
- **Backups de chat-writes** (`.prontara/backups/`) — herramienta interna
  de operador, baja prioridad.
- **Demo data** del seeder — se regenera desde código.

## Cómo proceder en sesión 2

### Estimación de esfuerzo

| Tarea | Tiempo |
|---|---|
| Migrar account-store + actualizar callers | 2-3 h |
| Migrar billing-store + actualizar callers | 2 h |
| Migrar trial + onboarding + lifecycle | 1 h |
| Migrar tenant-registry / tenant-context | 2-3 h (cuidadoso) |
| Migrar active-client-data-store (módulos ERP) | 2-3 h |
| Testing end-to-end con Postgres + dry-run del seed | 1 h |
| **Total** | **10-13 h** |

Esto es 1.5-2 días de trabajo concentrado.

### Cómo arrancar mañana

1. **Provisiona Neon en serio** (no solo el free tier). Empieza por
   `eu-central-1`. Copia la connection string.
2. En local, define `DATABASE_URL` y corre:
   ```powershell
   $env:DATABASE_URL = "postgresql://..."
   pnpm prisma generate
   pnpm prisma db push    # crea las tablas según el schema
   node scripts/seed-from-json.mjs --dry-run
   node scripts/seed-from-json.mjs    # crea las filas reales
   ```
3. Verifica en Neon SQL Editor que los datos están: `SELECT count(*) FROM "Tenant";` etc.
4. Ya con datos en Postgres, dile a Claude que migre los stores pendientes
   uno por uno empezando por `account-store` (es el más crítico).
5. Tras cada migración: tsc + smoke test del flujo (login, ver
   tenant, etc.) en `PRONTARA_PERSISTENCE=postgres`.
6. Cuando todo funcione local con Postgres, deploy en Vercel con esa
   misma `DATABASE_URL`.

### Checklist post-migración para deploy

- [ ] `pnpm prisma db push` en Neon con el schema actual.
- [ ] `node scripts/seed-from-json.mjs` ejecutado y verificado.
- [ ] Stores migrados: account, billing, trial, onboarding, lifecycle, tenant-context, module-data.
- [ ] tsc filtrado limpio en modo postgres.
- [ ] Smoke test manual: alta de tenant, login, suscripción, factura, lifecycle, chat.
- [ ] Variables de entorno en Vercel:
  - `DATABASE_URL`
  - `PRONTARA_PERSISTENCE=postgres`
  - todo lo demás del `docs/deploy-vercel.md`
- [ ] Backup automatizado de Neon programado.

### Plan de rollback

Si algo falla en producción tras el cambio:
1. Cambia `PRONTARA_PERSISTENCE=filesystem` en Vercel y redeploy.
2. Vercel volverá a leer JSON. **Solo es viable si los JSON están en el
   filesystem desplegado** — en serverless puro no funciona porque no hay
   volumen persistente.
3. El plan B real es mantener un branch `last-working-postgres` separado
   y hacer revert si hace falta.

## Notas de diseño tomadas en sesión 1

- El cliente Prisma se carga lazy con `require()` dinámico para que el
  bundle de Vercel no incluya Prisma cuando se usa filesystem. Si siempre
  usas Postgres en prod, esto no importa, pero da flexibilidad.
- El patrón de wrapper async (`leads-store-async.ts`) deja el módulo
  filesystem original intacto. Esto permite refactor incremental sin
  romper nada — los callers que aún no se migran siguen funcionando.
- El cache de overrides de vertical (`vertical-overrides-async.ts`) tiene
  TTL de 30s para serverless. Sin caché, cada request a la página de un
  vertical haría una query a Postgres → mata performance.
