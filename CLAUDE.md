# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es Prontara Factory

ERP online multi-tenant para pymes, una sola app Next.js (App Router, React 19, TypeScript) con **dos capas que comparten código**:

- **Factory** — app interna desde la que se crean, provisionan y entregan los tenants cliente (`src/app/factory/*`, `src/lib/factory/*`).
- **Runtime** — el ERP que ve cada cliente final, aislado por tenant y configurado con su pack sectorial (`src/app/[vertical]/*`, `src/lib/erp/*`).

## Comandos

```bash
pnpm dev                       # servidor de desarrollo → http://localhost:3000
pnpm build                     # prisma generate && next build
pnpm lint                      # eslint
pnpm test                      # vitest run (one-shot)
pnpm test:watch                # vitest en modo watch
pnpm test:e2e                  # playwright (e2e/*.spec.ts)
pnpm db:push                   # prisma db push
pnpm db:seed                   # sembrar desde JSON
pnpm exec tsx scripts/seed-demos.ts   # 3 tenants demo pulidos
pnpm smoke                     # smoke test del flujo Factory
pnpm desktop:dev / desktop:build      # wrapper Tauri 2
```

Ejecutar **un solo test**: `pnpm exec vitest run src/lib/saas/__tests__/auth-session.test.ts`
o filtrar por nombre: `pnpm exec vitest run -t "nombre del test"`.

Vitest solo cubre libs server-side (`src/**/__tests__/**/*.test.ts`, environment `node`); no hay tests de componentes React. El alias `@/` apunta a `src/`.

## Arranque

Requiere **Node 20+** y **pnpm 9+**. Copia `.env.example` a `.env.local`. Solo `PRONTARA_SESSION_SECRET` es obligatoria siempre (y `DATABASE_URL` si se usa Postgres). El resto de variables son opcionales: si faltan, desactivan funcionalidad concreta (Stripe, IA, SSO, Verifactu, email) pero **no rompen el build**.

## Arquitectura

### Routing y multi-tenancy
- `src/app/[vertical]/*` es el runtime: segmento dinámico por vertical (`dental`, `colegio`, `software-factory`, etc.). El `layout.tsx` del segmento valida slug + sesión + que el tenant del usuario pertenece a ese vertical.
- `src/proxy.ts` es el middleware global (renombrado `proxy` en Next 16). Hace dos cosas: autentica `/api/factory/*` (sesión HMAC, rol admin/owner) y **redirige rutas de módulo sin prefijo** (`/clientes` → `/<vertical>/clientes`) leyendo el `businessType` del cookie de sesión — backward-compat con `<Link>` antiguos.
- La sesión viaja en el cookie `prontara_session` (HMAC + scrypt). El tenant se resuelve con `src/lib/saas/tenant-resolver-async.ts`; el contexto común runtime/factory está en `src/lib/factory/tenant-context.ts`.

### Persistencia — dos backends tras una interfaz
Toda lectura/escritura operativa de un tenant pasa por la interfaz `TenantDataStore` (`src/lib/persistence/tenant-data-store.ts`), obtenida con `getTenantDataStore()`. Dos implementaciones seleccionables por env, sin tocar call sites:
- `json` (default): escribe en `.prontara/data/<clientId>/<module>.json` con helpers atómicos.
- `prisma`: Postgres según `prisma/schema.prisma` (todos los modelos llevan `tenantId`).

**Gotcha:** conviven dos flags de persistencia con nombres distintos — `PRONTARA_PERSISTENCE` (`filesystem`/`postgres`, documentada en README/.env.example) y `PERSISTENCE_BACKEND` (`json`/`prisma`, leída por `tenant-data-store.ts`). Verifica cuál lee el código que toques antes de asumir.

### Modelo de tenant — dos capas que NO se mezclan
Regla canónica (`docs/tenant-model.md`):
- `.prontara/clients/<clientId>.json` → **definición estructural** del tenant (identidad, branding, módulos habilitados, blueprint, metadatos de provisioning). No es base de datos.
- `.prontara/data/<clientId>/*.json` → **datos operativos vivos** del ERP (clientes, facturas, proyectos, tareas...).
- Regla práctica: si el dato cambia por el uso diario del ERP, va en `data/`; si define al tenant como estructura, va en `clients/`.

### Sector packs + CORE
Un tenant = **módulos CORE universales** (`src/lib/factory/core-modules.ts`, transversales a todos los packs) + **un pack sectorial** (`src/lib/factory/sector-pack-registry.ts`, específico del vertical). Los módulos ERP se definen de forma declarativa (`src/lib/erp/module-definition.ts`, `module-schemas.ts`, `module-ui-*`). `src/lib/factory/__tests__/sector-pack-integrity.test.ts` blinda invariantes que todo pack futuro debe cumplir — si añades un vertical, ejecuta ese test.

### Ports & adapters
Integraciones externas tras interfaces en `src/lib/ports/*` (email, llm, payment) con implementaciones en `src/lib/adapters/*` (Resend, Anthropic, Stripe). Diseñadas para degradar limpio: sin la API key correspondiente, el endpoint devuelve 503/desactiva la feature en vez de romper.

### Configurabilidad por el operador
El tenant se puede ajustar sin tocar código: custom fields por tenant (`/ajustes-campos`), workflow rules (`/workflows`, motor en `src/lib/saas/workflow-engine.ts`), reportes (`/reportes`, `report-engine.ts`).

## Scripts y CLI
`scripts/` contiene utilidades. Los `.ps1` PowerShell son legacy y se están jubilando progresivamente (F-09) a favor de la CLI unificada `scripts/ts/prontara.mjs`. Los ficheros `*.ps1.bak-*` son backups históricos — ignóralos.

## Documentación clave
- `docs/tenant-model.md` — modelo canónico de tenant y contratos de persistencia.
- `docs/persistence-architecture.md` / `persistence-migration-plan.md` — layout en disco, plan JSON→Postgres.
- `docs/vertical-pattern.md` — patrón de 15 secciones para añadir un vertical nuevo.
- `docs/verifactu-pendientes.md` — pasos pendientes para emisión real AEAT (bloqueante legal en España).
- `STATUS.md` — snapshot funcional (verticales, módulos, infra conectada).

## Cómo trabajar en este repo (preferencias de Jorge, de STATUS.md)
1. Bloques copia-y-pega completos para PowerShell, sin placeholders; una sola línea cuando se pueda.
2. No pedir secretos en el chat (URLs, keys, passwords completos).
3. Lenguaje natural en el producto, sin jerga técnica visible al usuario final.
4. Verificar antes de proponer.
5. `pnpm tsc/build/dev` los ejecuta Jorge en local — no asumas que el build corre en este entorno; usa file tools y el sandbox para todo lo demás.
