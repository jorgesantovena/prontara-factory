# ADR-0003 · Persistencia dual filesystem | postgres con flag de runtime

- **Fecha**: 2025-Q4 (formalizado 2026-04-29)
- **Estado**: Aceptado
- **Decisores**: Equipo Prontara

## Contexto

El proyecto nació con persistencia 100% en filesystem (JSON files bajo `data/`), porque:

- El producto inicial era una app de escritorio para una sola empresa.
- Permitía iterar sin levantar infra de DB.
- Hacía fácil onboarding local (clona y arranca, sin docker-compose ni Postgres).

Cuando el producto se transformó en SaaS multi-tenant, surgió la necesidad de Postgres (concurrencia, transacciones, queries analíticas). Pero arrancar el desarrollo local con Postgres obligatorio:

- Rompía el flujo de los devs nuevos (instala Postgres, configura URL, migra schema).
- Hacía que los tests E2E necesitaran una DB efímera levantada y migrada.
- Hacía imposible el modo "demo offline" para ferias o presentaciones.

A la vez, queríamos que producción usara Postgres SÍ o SÍ.

## Opciones consideradas

### A. Solo Postgres (eliminar filesystem)

**A favor**: una sola ruta de código, sin if/else en cada store.

**En contra**: rompe el flujo de desarrollo local y de demos offline. Obliga a docker-compose + migrate antes de poder ver la app.

### B. Solo filesystem (no migrar a Postgres)

**A favor**: simplicidad máxima.

**En contra**: imposible escalar más allá de un cliente. Sin transacciones, sin queries analíticas, sin row locks. No vendible como SaaS.

### C. Dual con flag de runtime (`PRONTARA_PERSISTENCE=filesystem|postgres`)

Cada store tiene una función `*-async.ts` que internamente decide:

```ts
if (getPersistenceBackend() === "postgres") {
  return await prismaQuery(...);
}
return fsQuery(...);
```

**A favor**: dev local funciona sin DB, producción usa Postgres, tests E2E pueden elegir uno u otro.

**En contra**:
- Cada store tiene dos rutas de código que mantener sincronizadas.
- Cada bug puede aparecer en una sola y pasar tests del otro modo.
- Los tipos TS no impiden divergencia de comportamiento.

## Decisión

**Opción C: dual con flag**, pero con **disciplina de paridad**:

1. Solo Postgres es source of truth en producción. Filesystem es modo dev/demo, no soportado para clientes finales.
2. Cada store async expone **una sola interfaz pública** (la versión `Async`). Las internas (`fsX`, `prismaX`) son detalle de implementación.
3. Los nombres de funciones públicas terminan en `Async` para hacer evidente que devuelven Promise (incluso cuando el backing es FS y podría ser síncrono).
4. Cuando la divergencia se detecta, **el bug se cierra en la rama Postgres primero**, después en filesystem.
5. Si en algún punto el coste de mantener filesystem supera el beneficio (suele pasar al tener tests reales con Postgres en CI), se cierra el modo filesystem en un ADR de superación.

Implementación: `src/lib/persistence/db.ts` expone `getPersistenceBackend()` y `withPrisma(fn)`. Cada store en `src/lib/persistence/*-async.ts` sigue el patrón.

## Consecuencias

**Positivas**:
- Onboarding local trivial: `pnpm dev` arranca con `PRONTARA_PERSISTENCE=filesystem` y todo funciona.
- Demos en cliente sin internet/DB son posibles.
- Tests rápidos pueden correr en filesystem; tests de integración usan Postgres.
- Permite el flujo "haz cambios en la app de escritorio offline → exporta → re-importa en SaaS" si algún día se quiere.

**Negativas / aceptadas**:
- Doble mantenimiento por store (real, doloroso).
- Falta de transacciones reales en filesystem → algunos flujos (createTenantFromAlta) tienen rollback parcial limitado.
- Nuevo dev tiene que entender que en producción solo se usa Postgres y que el FS es desarrollo.

**Mitigaciones aplicadas**:
- Helpers compartidos como `writeJsonAtomic` en `src/lib/saas/fs-atomic.ts` (escritura atómica) intentan dar mejor garantía en FS.
- ARQ-3 (saga + dedupe) cierra parte del gap de transaccionalidad para el flujo crítico (alta + Stripe).

## Cuándo cerrar el modo filesystem

Cuando se cumplan **dos** de estos:

1. CI tiene Postgres efímero y los tests E2E corren en él.
2. Las demos offline ya no son un caso de uso real.
3. El esfuerzo de mantener paridad supera al beneficio percibido.

En ese momento → ADR de superación, eliminar las ramas FS de cada store, eliminar `data/` como persistencia (mantener solo como uploads).

## Referencias

- `src/lib/persistence/db.ts` — `getPersistenceBackend()` y `withPrisma()`.
- `src/lib/persistence/*-async.ts` — patrón aplicado en cada store.
- `docs/persistence-architecture.md` — docs operativas más detalladas del runtime.
- F-06 (ronda 2 de auditoría) — origen del refactor.
