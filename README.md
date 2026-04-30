# Prontara Factory

ERP online multi-tenant para pymes pequeñas, con una arquitectura de dos capas:

- **Factory** — la aplicación interna desde la que se crean, provisionan y entregan los tenants cliente.
- **Runtime** — el ERP que ve cada cliente final, compartido en código pero aislado por tenant, configurado con su pack sectorial y su blueprint.

Ambas capas viven en la misma app Next.js (App Router, React 19, TypeScript). La persistencia operativa se apoya hoy en ficheros JSON por tenant y está preparada para migrar a base de datos relacional manteniendo la misma interfaz (ver `docs/persistence-migration-plan.md`).

## Arranque

Requisitos: Node 20+, pnpm.

```bash
pnpm install
cp .env.example .env       # luego ajusta SESSION_SECRET, DATABASE_URL, STRIPE_*
pnpm dev                   # servidor de desarrollo en http://localhost:3000
```

Variables obligatorias en `.env`:

- `SESSION_SECRET` — sin ella el arranque falla (ver F-02).
- `DATABASE_URL` — conexión PostgreSQL. Hoy solo la consumen migraciones de Prisma; el runtime sigue sobre JSON.
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` — necesarias para el alta de pago.

## Scripts

```bash
pnpm dev                         # servidor de desarrollo
pnpm build                       # build de producción
pnpm start                       # servir build
pnpm lint                        # eslint
pnpm desktop:dev                 # arranca el wrapper Tauri apuntando a localhost:3000
pnpm desktop:build               # empaqueta el wrapper para Windows
node scripts/cleanup-repo.mjs    # aplica docs/retention-policy.md
node scripts/ts/prontara.mjs     # CLI unificada (reemplaza los .ps1 progresivamente)
```

## Topología

| Ruta | Rol |
|---|---|
| `src/app/factory/*` | UI interna Factory (clientes, provisioning, salud, suscripciones) |
| `src/app/api/factory/*` | API Factory: altas, gestión de tenants, dashboard |
| `src/app/(clientes, facturacion, ...)` | UI Runtime compartida entre verticales |
| `src/app/api/runtime/*`, `src/app/api/erp/*` | API Runtime: sesión, módulos, cliente 360 |
| `src/app/software-factory/*` | Vertical bandera |
| `src/lib/factory/*` | Resolución de tenant, provisioning, health, dashboard |
| `src/lib/saas/*` | Auth, account store, billing, evolution, onboarding, activación |
| `src/lib/erp/*` | Definición de módulos, sector runtime, cliente 360, data stores |
| `src/lib/persistence/*` | Adaptador de persistencia (JSON hoy, Prisma mañana) |
| `src/lib/verticals/software-factory/` | Pack del vertical bandera |
| `scripts/` | Utilidades: limpieza, CLI unificada en TypeScript (ver F-09) |
| `prisma/schema.prisma` | Esquema multi-tenant con `tenantId` en cada modelo |
| `.prontara/`, `data/` | Estado runtime: `.prontara/clients/<clientId>.json` (definición) y `.prontara/data/<clientId>/*.json` (operativa) |
| `src-tauri/`, `desktop-wrapper/` | Wrapper de escritorio (Tauri 2) |

## Documentación

En `docs/`:

- `tenant-model.md` — modelo canónico de tenant, contratos de persistencia.
- `persistence-architecture.md` — layout en disco, separación estado global / por tenant.
- `persistence-migration-plan.md` — plan de migración de JSON a PostgreSQL (F-06).
- `scripts-migration-plan.md` — jubilación progresiva de los scripts PowerShell (F-09).
- `retention-policy.md` — política de retención de backups y auditorías.
- `runtime-api-next-step.md`, `runtime-tenant-aware.md`, `runtime-tenant-context-migration.md` — notas de evolución.

Los informes de auditoría y los memos de cierre de cada ronda de remediación viven fuera del repositorio.

## Estado de arquitectura

Cerrada la ronda 2 de remediación, los 18 hallazgos de la auditoría interna están en uno de estos tres estados:

- **Cerrados con implementación:** F-01 a F-05, F-07, F-08, F-10 a F-14, F-16, F-17, F-18.
- **Cerrados con arquitectura + política:** F-15 (retención), F-06 (adaptador + plan), F-09 (CLI + plan).
- **Pendientes de ejecución larga (plan trazado):** migración operativa F-06 (dominio a dominio) y port completo de los PowerShell en F-09.

## Licencia y uso

Proyecto interno. Todos los derechos reservados a Prontara.
