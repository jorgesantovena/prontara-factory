# Plan de jubilación de scripts PowerShell (F-09)

## 1. Punto de partida

La raíz del repositorio tiene **16 scripts `.ps1` vivos** (y decenas de `.bak` históricos, cubiertos por `retention-policy.md`). Entre ellos y los módulos TypeScript del runtime se duplica la resolución de blueprint, de verticales y de pack sectorial: hay dos «fuentes canónicas» para las mismas tablas, y cada vez que se añade un vertical hay que tocarlo a los dos lados.

El objetivo de esta ronda arquitectónica es:

1. Empezar a consolidar la generación en TypeScript (ESM puro, sin paso de build).
2. Exponer un único punto de entrada `node scripts/ts/prontara.mjs`.
3. Marcar los `.ps1` como DEPRECATED conforme van teniendo equivalente TS.
4. Documentar el camino para que los commits posteriores vayan cerrando uno a uno.

## 2. Estado actual

| Script PowerShell | Subcomando en CLI TS | Estado |
|---|---|---|
| `business-registry.ps1` | `prontara list-business` | **Portado** — paridad sincronizada con 8 verticales (incluye gimnasio, peluquería, colegio) |
| `build-blueprint.ps1` | `prontara blueprint <type>` | **Portado** — paridad sincronizada con blueprints por vertical |
| `generate-prontara.ps1` | `prontara generate-client` | Pendiente (~45KB — el más grande) |
| `build-prontara-client.ps1` | `prontara build-client` | Pendiente |
| `build-prontara-release.ps1` | `prontara build-release` | Pendiente |
| `deploy-prontara-release.ps1` | `prontara deploy-release` | Pendiente |
| `export-prontara-package.ps1` | `prontara export-package` | Pendiente |
| `apply-prontara-database.ps1` | `prontara apply-database` | Pendiente |
| `generate-prontara-database.ps1` | `prontara generate-database` | Pendiente |
| `init-prontara-database.ps1` | `prontara init-database` | Pendiente |
| `prontara.ps1` | dispatcher multi-subcomando | Pendiente — lo reemplaza la CLI una vez todo portado |
| `resolve-business-name.ps1` | interno del port de `generate-client` | Pendiente (se absorbe) |
| `resolve-business-type.ps1` | interno del port de `generate-client` | Pendiente (se absorbe) |
| `resolve-explicit-modules.ps1` | interno del port de `generate-client` | Pendiente (se absorbe) |
| `sync-prontara-history.ps1` | `prontara sync-history` | Pendiente |
| `update-prontara-maintenance.ps1` | `prontara update-maintenance` | Pendiente |

## 3. Arquitectura de los ports

Todos los scripts TS viven en `scripts/ts/`:

```
scripts/ts/
  prontara.mjs              # entrypoint CLI, dispatch por subcomando
  business-registry.mjs     # source of truth para tipos de negocio
  build-blueprint.mjs       # resolución de blueprint por businessType
  [siguiente port].mjs
  ...
```

Reglas del port:

1. **ESM puro**, sin paso de build. Se ejecutan con `node scripts/ts/...mjs`.
2. **Sin dependencias nuevas** si la original no las necesita. Los scripts actuales son PowerShell plano; los ports replican esa austeridad con APIs de Node (`node:fs`, `node:path`, `node:child_process`).
3. **Misma forma de datos.** Los objetos devueltos por cada port deben ser estructural y nominalmente equivalentes al equivalente PowerShell para que los consumidores downstream (scripts de CI, build-release) no noten el cambio.
4. **Cabecera DEPRECATED** en el `.ps1` antes del commit. No se borra el PS1 hasta haber verificado el port en al menos una pasada completa.
5. **Ningún fichero intermedio en disco** a menos que el original lo generase. El port no cambia el contrato de salida.

## 4. Orden de ataque recomendado

De menor a mayor acoplamiento con PowerShell idiosincrático:

1. `resolve-business-name.ps1`, `resolve-business-type.ps1`, `resolve-explicit-modules.ps1` — son helpers puros. Quedan absorbidos como módulos internos de `generate-client.mjs`.
2. `sync-prontara-history.ps1` — manejo de carpetas/ficheros.
3. `update-prontara-maintenance.ps1` — similar al anterior.
4. `init-prontara-database.ps1` — invoca `psql` / `prisma` por CLI; fácil de portar con `child_process.execSync`.
5. `apply-prontara-database.ps1`, `generate-prontara-database.ps1` — idem.
6. `export-prontara-package.ps1`, `build-prontara-client.ps1` — generan artefactos, necesitan tests.
7. `build-prontara-release.ps1`, `deploy-prontara-release.ps1` — pipelines de entrega; portar con paridad probada.
8. `generate-prontara.ps1` — el mayor. Se rompe en subcomandos TS cohesionados antes del port.
9. `prontara.ps1` — dispatcher legado; al final solo es un stub que llama a `node scripts/ts/prontara.mjs` con los mismos args.

## 5. Criterios de aceptación por port

- Ejecución de la CLI TS produce salida equivalente a la del `.ps1` (check manual documentado en el PR).
- La cabecera DEPRECATED del `.ps1` está añadida.
- Si el script formaba parte de un pipeline (CI, GitHub Actions, tarea programada) se actualizan los puntos de llamada para usar la CLI TS.
- Los tests de humo ejecutan la CLI al menos en `list-business` y en el nuevo subcomando.

## 6. Fecha de apagado de PowerShell

No se apaga el PS1 correspondiente hasta al menos **dos ciclos completos de release** sin incidencias tras el port. Ese grace period cubre tanto entregas comerciales a clientes como ejecuciones internas de mantenimiento.

## 7. Estado al cierre de la ronda

- CLI unificada `prontara.mjs` creada con subcomandos `list-business`, `blueprint`, `help`.
- Ports funcionando para `business-registry` y `build-blueprint`.
- PS1 correspondientes marcados DEPRECATED.
- Plan de ataque documentado para el resto.
- Smoke test manual OK.

Siguiente ronda: absorber los tres `resolve-*.ps1` en un módulo interno y empezar el port del `generate-prontara` por secciones.
