# Runtime y factory conectados al contexto tenant

## Objetivo

Este documento fija el criterio oficial para que los scripts troncales no reconstruyan rutas del tenant por libre.

## Regla oficial

Los scripts troncales deben reutilizar helpers comunes de contexto tenant y no declarar a mano rutas base como:

- `.prontara/clients`
- `.prontara/data`
- `.prontara/artifacts`
- `.prontara/exports`
- `.prontara/deployments`

## Helper PowerShell oficial

- `scripts/lib/tenant-context.ps1`

## Scripts troncales migrados en este bloque

- `apply-prontara-database.ps1`
- `build-prontara-client.ps1`
- `build-prontara-release.ps1`
- `deploy-prontara-release.ps1`
- `export-prontara-package.ps1`
- `generate-prontara.ps1`
- `generate-prontara-database.ps1`
- `init-prontara-database.ps1`
- `sync-prontara-history.ps1`
- `update-prontara-maintenance.ps1`
- `prontara.ps1`

## Resultado esperado

- menos rutas hardcoded repartidas
- misma convención entre factory y runtime
- preparación para migrar el resto de scripts secundarios