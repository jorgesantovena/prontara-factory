# ADR-0002 · Multi-tenancy con shared DB + tenant_id

- **Fecha**: 2025-Q4 (formalizado 2026-04-29)
- **Estado**: Aceptado
- **Decisores**: Equipo Prontara

## Contexto

Prontara es un SaaS multi-tenant. Cada cliente (PYME) tiene:

- Su propio subdominio / slug.
- Sus propias cuentas de usuario, datos de negocio (clientes, proyectos, facturas), configuración y contenido subido.
- Su propia suscripción de Stripe y plan facturado.
- Su propio sector pack que controla qué módulos ve.

El proyecto tiene que escalar a **decenas y eventualmente cientos de tenants**, donde la mayoría son PYMEs de 4-20 empleados con volúmenes de datos modestos (decenas de MB de DB, no GB).

Tres modelos clásicos posibles:

### A. DB-por-tenant
Cada cliente tiene su propia base de datos (o schema Postgres aislado).

### B. Shared DB + `tenant_id` en cada tabla
Una sola base de datos. Cada tabla incluye una columna `tenantId` (o `clientId`) y todas las queries la filtran.

### C. Shared DB + Row-Level Security (RLS) de Postgres
Misma idea que B, pero la separación se enforza en la propia DB con políticas RLS atadas a una variable de sesión.

## Opciones consideradas

### A. DB-por-tenant

**A favor**:
- Aislamiento físico → un cliente NUNCA puede ver datos de otro por bug de query.
- Backup, restore, eliminación por GDPR son operaciones triviales por DB.
- Cumplimiento médico/legal/financiero más fácil de defender ante un auditor.

**En contra**:
- En Neon/Vercel Postgres, gestionar 50+ DBs requiere automatización propia o coste lineal por DB.
- Migrations N veces (50 DBs = 50 ejecuciones).
- Pool de conexiones × N → fácil de sobrepasar el límite de Neon en plan starter.
- Para PYMEs de 5 personas con < 100 MB de datos, es matar moscas a cañonazos.

### B. Shared DB + `tenant_id`

**A favor**:
- Un solo Neon / Vercel Postgres → un solo coste base, un solo pool de conexiones.
- Una sola migration corre para todos los tenants.
- Operaciones cross-tenant (analíticas internas, reportes de Factory) son SQL trivial.
- Permite el modo dual filesystem|postgres (ver ADR-0003) sin gymnastics.

**En contra**:
- Aislamiento depende de la disciplina del código → un `WHERE tenantId` que falte = leak.
- Backup por tenant requiere `pg_dump --where` o lógica custom.
- Eliminación GDPR requiere borrar de N tablas (mitigable con `ON DELETE CASCADE`).
- No vendible como "DB aislada" a clientes regulados.

### C. Shared DB + RLS

**A favor**:
- Defense-in-depth: si un dev olvida `WHERE tenantId`, Postgres lo corta.
- Sigue siendo una sola DB.

**En contra**:
- Hay que setear la variable de sesión en cada conexión → coupling con el pool de Prisma/Neon.
- Bugs de RLS son sutiles (políticas mal escritas que filtran de más o de menos).
- Añade overhead de testing: cada query crítica hay que probarla con dos tenants.

## Decisión

**Opción B (shared DB + `tenant_id`) por defecto**, con la **puerta abierta a Opción A** para clientes regulados (sanitarios, jurídicos) cuando aparezcan.

Decisiones de implementación derivadas:

- Cada tabla tiene `clientId String @index` (ver `prisma/schema.prisma`).
- Las stores async (`*-store-async.ts`) reciben `clientId` como primer parámetro siempre.
- El middleware de sesión inyecta `clientId` desde la cookie firmada — el código de la API NO confía en el `clientId` del body.
- Cuando llegue el primer cliente sanitario/legal, se reservará la decisión a un nuevo ADR (provisión opt-in de DB-por-tenant en Neon, ver ARQ-11).

RLS (opción C) queda como **defense-in-depth opcional** para futuro (ARQ-10), no como mecanismo único de aislamiento.

## Consecuencias

**Positivas**:
- Coste y operación lineales con número de tenants → escala bien para el target de PYMEs.
- Una sola migration, un solo backup, una sola monitorización.
- Modo `PRONTARA_PERSISTENCE=filesystem` sigue siendo viable porque cada cliente vive bajo `data/clients/{slug}/`.

**Negativas / aceptadas**:
- Aislamiento es responsabilidad del código → mitigamos con:
  - `clientId` siempre desde sesión firmada (no del body).
  - Tests futuros (ARQ-1) que ejerciten queries con dos tenants distintos.
  - Posible RLS futura (ARQ-10) como red extra.
- Para el primer cliente regulado tendremos que ofrecer DB-por-tenant como opción premium o decir que no (decisión comercial, no técnica).

## Referencias

- `prisma/schema.prisma` — modelo con `clientId` por tabla.
- `src/lib/persistence/*` — stores async que reciben `clientId`.
- `src/middleware.ts` — origen único de verdad para `clientId`.
- ARQ-10 (RLS) y ARQ-11 (DB-por-tenant) — mejoras futuras opcionales.
