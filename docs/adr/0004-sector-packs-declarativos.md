# ADR-0004 · Sector packs como registry declarativo en TypeScript

- **Fecha**: 2025-Q4 (formalizado 2026-04-29)
- **Estado**: Aceptado
- **Decisores**: Equipo Prontara

## Contexto

Prontara es un ERP-template configurable por sector. Cada vertical (clínica dental, peluquería, gimnasio, taller mecánico, software factory, colegio…) tiene:

- Etiquetas distintas (en una clínica son "pacientes", en un gimnasio son "socios").
- Módulos visibles diferentes (una peluquería no necesita "presupuestos" igual que un taller; un colegio no necesita "facturación" pero sí "calificaciones").
- Demo data específica.
- KPIs y prioridades del dashboard distintos.
- Reglas de landing y asistente con tono propio.

La pregunta clave: **¿dónde vive esta configuración por sector?**

## Opciones consideradas

### A. Tabla en base de datos editable desde Factory UI

Cada sector pack es un row con JSON. Operador Factory edita desde una UI.

**A favor**:
- Cambios sin redeploy.
- Posible que clientes no técnicos editen sus propios packs.

**En contra**:
- Schema versioning del JSON es responsabilidad del código → bugs sutiles.
- TypeScript no puede tipar lo que viene de la DB → runtime errors en lugar de errores en compile time.
- Un sector pack mal escrito puede romper a TODOS los clientes de ese sector hasta que se arregle desde la UI.
- No diff visible en git → revisión y rollback complicados.
- Acoplamiento fuerte con la DB → desarrollo local sin DB se rompe.

### B. Sector packs como ficheros markdown / yaml en disco

Cada vertical es un fichero leído al arrancar.

**A favor**:
- Diff visible en git.
- Editable sin redeploy si se hot-reload.

**En contra**:
- Sigue sin tipos (parser → cualquier estructura).
- Yaml/markdown acepta cualquier cosa → bugs sutiles.
- Hot-reload en serverless es ficción.

### C. Sector packs como módulos TypeScript en `src/lib/saas/sector-packs/`

Cada vertical es un fichero `.ts` que exporta un objeto de tipo `SectorPack` (TenantRuntimeConfig + extras). Un registry central los agrupa.

**A favor**:
- TypeScript strict valida la forma en compile time → cualquier campo mal escrito es error de build, no runtime.
- Diff visible en git, revisión por PR.
- Refactor masivo (cambio de tipo SectorPack) se ve y arregla en un commit.
- Cero infra: no DB, no parser, no hot-reload exótico.
- Permite sobrescribir vertical por cliente (overrides) en otra capa (DB) sin acoplar el catálogo base a DB.

**En contra**:
- Cualquier cambio requiere redeploy.
- Operador Factory NO puede crear/editar packs sin un dev (mitigable con UI de overrides en DB encima).

## Decisión

**Opción C: sector packs como módulos TypeScript en un registry**, con dos capas:

1. **Capa base (commit-bound)**: `src/lib/saas/sector-packs/{key}.ts` — el catálogo oficial del producto. Cambios requieren PR + redeploy. TypeScript strict valida.
2. **Capa de overrides (DB-bound)**: `vertical_overrides` en Postgres — un operador Factory puede ajustar etiquetas, módulos visibles, etc. **por cliente**, sin redeploy. Estas overrides se aplican encima del pack base en el resolver de runtime config (`src/lib/saas/runtime-config.ts`).

Resultado: lo importante (estructura, tipos, lista de campos válidos) es código revisado en git. Lo trivial (renombrar "Cita" a "Reserva" para un cliente concreto) es UI sin redeploy.

## Consecuencias

**Positivas**:
- Bugs en sector packs son errores de compilación, no runtime → cero crashes en producción por un campo mal escrito.
- Diff entre versiones de un pack es legible en GitHub → ideal para review.
- Refactors profundos (renombrar `industry` → `sectorKey`) se ven y propagan en un PR.
- Onboarding de un dev: puede leer `src/lib/saas/sector-packs/clinica-dental.ts` y entender 100% qué hace ese vertical sin entrar a DB.
- ARQ-1 puede testear sector packs sin tocar DB (los importas y los validas).

**Negativas / aceptadas**:
- Operador Factory necesita PR para crear un nuevo vertical desde cero.
- Mitigado parcialmente con la UI de overrides (puede personalizar uno existente para un cliente sin tocar código).
- La capa de overrides añade complejidad al resolver (hay que mergear bien base + override).

## Implementación clave

- Tipos: `src/lib/saas/account-definition.ts` define `TenantRuntimeConfig`.
- Catálogo base: `src/lib/saas/sector-packs/*.ts`.
- Registry: `src/lib/saas/sector-packs/registry.ts`.
- Overrides en DB: tabla `VerticalOverride` en `prisma/schema.prisma`.
- Resolver: `src/lib/saas/runtime-config.ts` aplica base + override y devuelve config final.

## Referencias

- F-15 (ronda 1) — unificación de TenantRuntimeConfig.
- ADR-0002 — multi-tenancy (las overrides son por `clientId`).
- `docs/vertical-pattern.md` — patrón operativo paso a paso.
