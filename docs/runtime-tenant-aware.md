# Runtime tenant-aware de Prontara

## Objetivo

Este documento fija la regla operativa para que runtime y APIs de Prontara resuelvan siempre el tenant desde el contexto oficial y no desde rutas sueltas, estado legacy o derivadas.

---

## Regla oficial

Toda ruta runtime o API que necesite contexto tenant debe apoyarse en:

- `src/lib/factory/runtime-tenant-resolver.ts`
- `src/lib/factory/tenant-context.ts`
- `src/lib/factory/active-client-registry.ts`

La secuencia correcta es:

1. resolver el `clientId`
2. construir el `TenantContext`
3. leer definición y datos desde el contexto resultante

---

## Helper oficial

El helper oficial de entrada para runtime y APIs es:

- `resolveRuntimeTenantContext(...)`

Y se apoya internamente en:

- `resolveRequestedClientId(...)`
- `getActiveClientId()`
- `resolveTenantContext(clientId)`

---

## Fuente de verdad permitida para runtime

Runtime y APIs pueden usar:

- `data/factory/active-client.json` solo para obtener el tenant activo cuando no se pasa `clientId`
- `.prontara/clients/<clientId>.json` para definición canónica del tenant
- `.prontara/data/<clientId>/` para datos operativos del tenant

---

## Queda prohibido

A partir de ahora no deben aparecer nuevas resoluciones manuales de este tipo dentro de runtime o APIs:

- lectura directa de `.prontara/current-client.txt`
- lectura directa de `data/factory/active-client.json` fuera del helper oficial
- `path.join(process.cwd(), ".prontara", "clients", ...)` repartido por rutas runtime
- `path.join(process.cwd(), ".prontara", "data", ...)` repartido por rutas runtime
- lectura de `.prontara/exports/` como origen operativo
- lectura de `.prontara/deployments/` como origen operativo
- lectura de `.prontara/artifacts/` como origen operativo

---

## Patrón esperado en APIs

El patrón esperado es este, conceptualmente:

1. obtener `clientId` explícito si la ruta lo recibe
2. si no existe, usar el cliente activo oficial
3. resolver `TenantContext`
4. operar con `context.definitionPath`, `context.dataRoot`, `context.definition`

---

## Resultado esperado

- runtime tenant-aware coherente
- APIs alineadas con la arquitectura oficial
- menos lógica duplicada
- menos riesgo de mezclar tenant activo, tenant definido y derivadas