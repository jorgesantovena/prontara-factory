# Plan de migración de persistencia (F-06)

## 1. Punto de partida

Hoy el runtime escribe en ficheros JSON dentro de `.prontara/data/<clientId>/<moduleKey>.json`. El `schema.prisma` existía pero estaba desconectado: sin `tenantId`, sin relaciones, y nunca se ejecutaba contra PostgreSQL.

A cierre de esta ronda arquitectónica:

- `prisma/schema.prisma` describe el modelo multi-tenant completo: entidad `Tenant`, entidad `TenantUser`, y `tenantId` + índices compuestos en todos los modelos operativos.
- `src/lib/persistence/tenant-data-store.ts` define la interfaz `TenantDataStore` que encapsula list/get/create/update/remove/dropTenant.
- `src/lib/persistence/json-tenant-data-store.ts` implementa la interfaz sobre el layout JSON actual.
- `src/lib/persistence/prisma-tenant-data-store.ts` implementa la interfaz sobre Prisma.
- `getTenantDataStore()` elige entre JSON y Prisma según la env var `PERSISTENCE_BACKEND`.

Esto significa que los call sites del ERP ya pueden depender de una única API y que cambiar el backend es un cambio de flag, no un refactor de código de negocio.

## 2. Estrategia de corte

El corte se hace **dominio a dominio**, no en un big bang. La estrategia es:

1. Elegir un dominio (por ejemplo `clientes`).
2. Implementar un job de importación que lea los ficheros `.prontara/data/<clientId>/clientes.json` y haga `prisma.cliente.createMany` dentro de una transacción por tenant.
3. Ejecutar el job en entorno de staging contra una copia de los ficheros.
4. Switch del flag solo para ese dominio (ver sección 5: flag por módulo).
5. Validar 72 horas en staging. Si todo OK, replicar en producción.
6. Archivar el JSON del dominio migrado con marca `.migrated`.
7. Pasar al siguiente dominio.

Orden propuesto (de menor a mayor acoplamiento):

1. `ajustes` — clave/valor plano, sin relaciones.
2. `clientes` — base del CRM, muchas lecturas pero estructura simple.
3. `documentos` — similar a clientes, con ruta a disco.
4. `proyectos` + `tareas` — primer dominio con relación interna.
5. `facturas` + `cobros` + `pagos` — flujo de cobro, requiere migrar los tres a la vez.
6. `ventas` + `movimientos-tesoreria` — cierre financiero.

## 3. Migraciones Prisma

El primer `prisma migrate dev` genera el esquema completo de golpe en un entorno limpio. En entornos que ya tengan datos, el plan es:

1. Congelar escrituras en el dominio a migrar (modo read-only en ese módulo).
2. Ejecutar `prisma migrate deploy` solo si ya no lo estaba.
3. Ejecutar el job de importación del dominio.
4. Cambiar el flag del módulo a `prisma`.
5. Rehabilitar escrituras.

El tiempo de congelación por dominio debería estar por debajo de 15 minutos si el dataset no supera los cientos de miles de registros.

## 4. Contrato operativo

La interfaz `TenantDataStore` marca los invariantes que cualquier backend debe respetar:

- `clientId` llega validado por la capa HTTP (ver F-01) — la persistencia nunca lo deriva sola.
- `create` no acepta `id`/`createdAt`/`updatedAt` del caller; los genera el store.
- `update` respeta `id` y `createdAt`; solo puede tocar `updatedAt`.
- `dropTenant` es idempotente.
- Todas las operaciones son async y pueden fallar. El caller captura y convierte a respuesta HTTP.

El test suite (por añadir en ronda siguiente) valida ambos backends contra exactamente los mismos casos.

## 5. Flag por módulo (extensión futura)

`PERSISTENCE_BACKEND` hoy es global (`json` o `prisma`). Cuando el corte arranque, la env se amplía a un mapa JSON opcional:

```
PERSISTENCE_BACKEND=json
PERSISTENCE_BACKEND_OVERRIDES={"clientes":"prisma","ventas":"prisma"}
```

`getTenantDataStore(moduleKey)` consulta primero el override y cae al global si no aplica. Así se migra dominio a dominio sin reiniciar los otros.

## 6. Riesgos conocidos

- **Duplicación temporal de verdad.** Durante la ventana de cada dominio, el fichero JSON y la tabla Prisma conviven. El job de importación es idempotente y el corte en frío evita divergencias.
- **Cascade delete.** `onDelete: Cascade` en Tenant arrastra todos los datos del tenant al borrar. Antes del primer corte hay que confirmar que el equipo entiende que `dropTenant` en Prisma es destructivo; en el backend JSON también lo es, pero el operador suele recordarlo mejor.
- **Campos no mapeados.** Los módulos custom que no estén en `MODULE_TO_DELEGATE` del backend Prisma lanzan `UnsupportedModuleError`. Hasta que el modelo crezca, esos módulos se quedan en JSON aunque el flag global sea `prisma`.
- **Connection pooling.** En serverless hay que revisar pool de Prisma antes de activar el flag en producción.

## 7. Estado al cierre de la ronda

- Esquema multi-tenant: listo.
- Interfaz TenantDataStore: lista.
- Backend JSON: listo.
- Backend Prisma: listo detrás de flag (no activado).
- Flag por módulo: no implementado (extensión sección 5).
- Job de importación: no implementado.
- Suite de contrato: no implementada.

Siguiente ronda: job de importación para `ajustes` (menor riesgo) + suite compartida.
