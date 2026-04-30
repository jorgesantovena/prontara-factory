# Runtime / API siguiente paso real

## Estado

El bloque 5 base ya está encaminado:

- existe `runtime-tenant-resolver.ts`
- existe `tenant-context.ts`
- existe `active-client-registry.ts`
- la auditoría ya ha detectado los consumidores reales a migrar

## Conclusión práctica

No toca rehacer todo el runtime de golpe.

Toca introducir una capa puente estable para que las rutas runtime y SaaS dejen de resolver tenant por libre.

## Puente oficial añadido

Se añaden estos dos puntos de entrada:

- `src/lib/factory/runtime-tenant-context.ts`
- `src/lib/saas/tenant-runtime-paths.ts`

## Regla

A partir de ahora, el código nuevo de runtime y APIs debe consumir:

- `getRuntimeTenantContext(...)`
- `getRuntimeTenantPaths(...)`
- `resolveSaasTenantPaths(...)`

Y no debe reconstruir manualmente:

- `data/factory/active-client.json`
- `.prontara/clients/<clientId>.json`
- `.prontara/data/<clientId>/`
- `.prontara/artifacts/`
- `.prontara/exports/`
- `.prontara/deployments/`

## Candidatos reales de migración inmediata

Según la auditoría actual, los candidatos más claros son:

- `src/lib/factory/active-client-runtime.ts`
- `src/lib/saas/tenant-paths.ts`
- `src/lib/factory/active-client-mutation.ts`

## Objetivo del siguiente bloque

Sustituir en esos ficheros las resoluciones manuales por llamadas al puente oficial.