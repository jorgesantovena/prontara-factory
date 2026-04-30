# Patrón oficial de vertical

Guía para añadir un vertical nuevo a Prontara sin tocar el motor ni duplicar lógica. Si funciona al seguir este documento, el sistema está cumpliendo la tesis de "la fábrica ensambla soluciones en vez de programarlas a mano" (F-15, roadmap Fase 5).

## 1. Qué es un vertical

Un vertical es una configuración sectorial autocontenida que vive en una sola `SectorPackDefinition`. Al resolverse para un tenant, alimenta:

- La UI del ERP (labels, renameMap, módulos visibles, navegación).
- Los datos iniciales del tenant (demo data).
- La landing interna de entrega comercial (`/landing`).
- El copy del asistente conversacional.
- El dashboard del runtime vía `dashboardPriorities`.
- La identidad visual del tenant (branding, accent color).

Ningún código de UI tiene que conocer qué vertical es. El vertical se compone con el blueprint base y el resultado viaja dentro de `TenantRuntimeConfig`.

## 2. Dónde se define

Un vertical vive en `src/lib/factory/sector-pack-registry.ts` como un objeto de tipo `SectorPackDefinition`. El tipo está en `src/lib/factory/sector-pack-definition.ts`.

Paralelamente, el vertical debe estar registrado en dos sitios más:

- `scripts/ts/business-registry.mjs` — CLI Node que lista y bluprintea verticales.
- `scripts/ts/build-blueprint.mjs` — overrides de módulos core/optional, entidades y flujos.

Los archivos PowerShell equivalentes (`business-registry.ps1`, `build-blueprint.ps1`) son deprecados pero deben mantener paridad hasta que se jubilen (ver `docs/scripts-migration-plan.md` — F-09).

## 3. Anatomía de un `SectorPackDefinition`

```ts
const MI_VERTICAL_PACK: SectorPackDefinition = {
  key: "mi-vertical",                        // identificador único, kebab-case
  label: "Mi vertical",                      // nombre legible
  sector: "industria",                       // agrupación amplia (salud, tecnologia, retail, fitness...)
  businessType: "mi-vertical",               // suele coincidir con key
  description: "ERP sectorial para …",       // frase corta para la UI interna
  branding: { … },
  labels: { … },
  renameMap: { … },
  modules: [ … ],
  entities: [ … ],
  fields: [ … ],
  tableColumns: [ … ],
  dashboardPriorities: [ … ],
  demoData: [ … ],
  landing: { … },
  assistantCopy: { … },
};
```

Cada campo cumple un papel específico. Nunca los dejes vacíos "para rellenar luego"; pon un default sensato aunque no sea el definitivo.

### 3.1 `branding`

Identidad visual del tenant. Consumido por `tenant-branding.ts`, `commercial-composer.ts`, el dashboard runtime y el wrapper desktop.

```ts
branding: {
  displayName: "Prontara Tech",              // nombre comercial del vertical
  shortName: "PT",                           // 2-4 caracteres (iniciales del logo)
  accentColor: "#2563eb",                    // color de marca, hex
  logoHint: "digital, técnico, limpio",      // descripción del logo para el diseñador
  tone: "professional",                      // simple | professional | sectorial
}
```

El `accentColor` se usa en el dashboard Factory del cliente, en la landing `/landing` y en los chips de la UI sectorial. Debe contrastar sobre fondo blanco y sobre fondo negro (`#0f172a`).

### 3.2 `labels`

Sobrescriben los labels genéricos por módulo. Claves fijas (no se inventan): `clientes`, `crm`, `proyectos`, `presupuestos`, `facturacion`, `documentos`, `ajustes`, `asistente`.

```ts
labels: {
  clientes: "Socios",        // ej. gimnasio
  crm: "Seguimiento",
  proyectos: "Planes",
  presupuestos: "Presupuestos",
  facturacion: "Cuotas",
  documentos: "Documentos",
  ajustes: "Ajustes",
  asistente: "Asistente",
}
```

Estos labels se consumen en `module-ui-resolver.ts` y se propagan a todos los componentes runtime vía `TenantRuntimeConfig.labels`.

### 3.3 `renameMap`

Reemplazos terminológicos dentro de copy dinámico (plurales, singular). Se usa en placeholders, mensajes del asistente y textos variables.

```ts
renameMap: {
  cliente: "socio",
  clientes: "socios",
  proyecto: "plan",
  proyectos: "planes",
  factura: "cuota",
  facturas: "cuotas",
}
```

No es un diccionario libre: solo se sustituyen las claves definidas. El renombre va en minúsculas; la capitalización la aplica el componente consumidor si hace falta.

### 3.4 `modules`

Lista de módulos que el vertical habilita, con su label de navegación y empty state por sector. El `moduleKey` debe ser uno de los soportados por el core.

```ts
modules: [
  { moduleKey: "clientes", enabled: true, label: "Socios", navigationLabel: "Socios", emptyState: "Todavía no hay socios." },
  // …
]
```

Si un módulo está `enabled: false`, la navegación lo oculta pero el tenant sigue teniendo los datos (útil para activar en un upgrade).

### 3.5 `entities`

Descripción del "lenguaje de negocio" del vertical. No afecta al render pero alimenta al blueprint engine y a la demo comercial.

```ts
entities: [
  {
    key: "socio",                            // id interno
    label: "Socio",                          // etiqueta visible
    description: "Persona inscrita en el gimnasio.",
    moduleKey: "clientes",                   // módulo que la almacena
    primaryFields: ["nombre", "telefono"],   // campos que identifican la entidad
    relatedTo: ["plan", "cuota"],            // entidades relacionadas
  },
  // …
]
```

### 3.6 `fields`

Sobrescribe campos de los formularios de cada módulo. Si el campo no está aquí, el módulo usa el campo genérico de `module-schemas.ts`. Lo que añadas aquí **reemplaza** el genérico para ese par `moduleKey`+`fieldKey`.

```ts
fields: [
  { moduleKey: "clientes", fieldKey: "nombre", label: "Socio", kind: "text", required: true, placeholder: "Nombre del socio" },
  { moduleKey: "proyectos", fieldKey: "estado", label: "Estado del plan", kind: "status", required: true, placeholder: "activo / pausado / baja" },
  // …
]
```

Los `kind` disponibles: `text`, `email`, `tel`, `textarea`, `date`, `number`, `money`, `status`, `relation`. Si es `relation`, añade `relationModuleKey`.

### 3.7 `tableColumns`

Columnas visibles en la vista de lista de cada módulo. Cada item pertenece a un `moduleKey`. La primera columna con `isPrimary: true` es la clave visible en la navegación.

```ts
tableColumns: [
  { moduleKey: "clientes", fieldKey: "nombre", label: "Socio", isPrimary: true },
  { moduleKey: "clientes", fieldKey: "telefono", label: "Teléfono" },
  // …
]
```

### 3.8 `dashboardPriorities`

Orden de relevancia de los KPIs en el dashboard runtime `/`. Cada priority tiene:

```ts
dashboardPriorities: [
  { key: "pipeline", label: "Pipeline", description: "Valor potencial del negocio.", order: 1 },
  { key: "proyectos", label: "Proyectos activos", description: "Control operativo.", order: 2 },
  // …
]
```

El dashboard runtime reordena los KPIs según este orden (ver `applyDashboardPriorities` en `src/app/page.tsx`). El `label` sobrescribe al del KPI genérico; el `description` al helper.

Las `key` válidas son las de los KPIs generados en `dashboard-metrics.ts` (clientes, oportunidades, pipeline, proyectos, presupuestos, facturas) más el pseudo-bloque `actividad` que indica "mostrar la sección de actividad reciente aquí".

### 3.9 `demoData`

Datos iniciales que se siembran en el tenant al provisionarlo. **Entrelazados**, no aleatorios: cada cliente debe tener oportunidad, propuesta, proyecto, factura y entregable coherentes entre sí. Objetivo: que al abrir la demo del vertical parezca una empresa pyme real, no una base de datos sembrada con lorem.

```ts
demoData: [
  { moduleKey: "clientes", records: [ {…}, {…}, … ] },
  { moduleKey: "crm", records: [ {…}, … ] },
  { moduleKey: "proyectos", records: [ {…}, … ] },
  { moduleKey: "presupuestos", records: [ {…}, … ] },
  { moduleKey: "facturacion", records: [ {…}, … ] },
  { moduleKey: "documentos", records: [ {…}, … ] },
]
```

Regla mínima: 4-5 clientes distintos, con al menos uno en cada fase del pipeline (lead, negociación, cerrado), al menos un proyecto en riesgo para que aflore alerta, al menos una factura vencida y una cobrada. Todos los registros con `cliente` apuntando a nombres que existen en `clientes`.

El pack `SOFTWARE_FACTORY_PACK` en `sector-pack-registry.ts` es la referencia actual de cómo debe verse una demo data coherente.

### 3.10 `landing`

Mensaje comercial del vertical, consumido por `commercial-composer.ts` y renderizado en `/landing`.

```ts
landing: {
  headline: "Gestiona socios, planes y cuotas sin caos.",
  subheadline: "ERP online para gimnasios pequeños.",
  bullets: [
    "Socios, planes y cuotas conectados",
    "Cobros y facturación en el mismo flujo",
    "Pensado para equipos pequeños",
  ],
  cta: "Activa tu gimnasio online",
}
```

### 3.11 `assistantCopy`

Copy por defecto del asistente conversacional. Se lee como welcome inicial cuando el usuario abre `/asistente` y como sugerencia en los chips.

```ts
assistantCopy: {
  welcome: "Te ayudo a revisar socios, planes, cuotas y cobros del gimnasio.",
  suggestion: "Muéstrame los planes activos y las cuotas pendientes.",
}
```

## 4. Añadir un vertical nuevo — checklist

1. **Definir** el `SectorPackDefinition` en `src/lib/factory/sector-pack-registry.ts` y añadirlo al array `SECTOR_PACKS`.
2. **Business registry** — añadir entrada en `scripts/ts/business-registry.mjs` con `key`, `name`, `legacySector`, `suggestedName`, `aliases`, `modules`.
3. **Blueprint overrides** — añadir override en `scripts/ts/build-blueprint.mjs` con `coreModules`, `optionalModules`, `entities`, `workflows`.
4. **Paridad PowerShell** (temporal hasta F-09 completo) — replicar entradas en `business-registry.ps1` y `build-blueprint.ps1`.
5. **Smoke test** en local:
   ```bash
   node scripts/ts/prontara.mjs list-business
   node scripts/ts/prontara.mjs blueprint mi-vertical --name "Ejemplo"
   pnpm dev
   # Abrir /?sectorPack=mi-vertical&businessType=mi-vertical
   ```
6. **Verificación** — `tsc --noEmit` limpio (ver `reference_prontara_tsc.md` para el filtro de ruido de entorno).

## 5. Cuándo NO crear un vertical nuevo

- Solo cambian labels y renameMap → probablemente es un override de tenant individual, no un vertical.
- Solo cambia el copy comercial → se arregla con el `config.texts` del tenant, sin pack.
- El cliente pide funcionalidad que no existe en el core → discute la funcionalidad primero; no pongas la complejidad bajo la moqueta del vertical.

El patrón del vertical solo tiene sentido cuando el sector tiene un **lenguaje de negocio y una prioridad de datos** distintos, no cuando solo cambia la decoración.

## 6. Verticales actualmente implementados

| Key | Sector | Notas |
|---|---|---|
| `clinica-dental` | salud | Renombra cliente → paciente, proyecto → tratamiento. |
| `software-factory` | tecnologia | Vertical bandera de referencia. Demo data rica (5 clientes entrelazados). Tiene `src/lib/verticals/software-factory/` con overview y asistente específicos. |
| `gimnasio` | fitness | Renombra cliente → socio, factura → cuota. |
| `peluqueria` | servicios | Renombra documento → ticket. |
| `taller-auto` | automocion | Incluye módulo `vehiculos`. |
| `panaderia` | alimentacion | Módulos `productos`, `compras`, `pedidos`, `almacen`. |
| `colegio` | educacion | Renombra cliente → familia, proyecto → curso. |
| `general` | generico | Baseline sin overrides. |

## 7. Tamaño sano de un vertical

Las líneas aproximadas que ocupa cada vertical en `sector-pack-registry.ts` son una buena métrica para saber si algo está bien calibrado:

- Entre **80 y 120 líneas** por vertical (pack completo con demo data sobria).
- Si crece más de 180 líneas, probablemente estás metiendo lógica de producto en el pack. Mueve eso al core o a un vertical-specific lib (`src/lib/verticals/<nombre>/`).
- Si es más de 250, es muy probable que estés duplicando algo que debería ser del blueprint base.

## 8. Vertical bandera: Software Factory

El vertical `software-factory` es la referencia viva del patrón. Además de su entrada en `sector-pack-registry.ts`, tiene:

- `src/lib/verticals/software-factory/types.ts` — tipos del dashboard funcional del vertical.
- `src/lib/verticals/software-factory/overview.ts` — computación de KPIs específicos (proyectos en riesgo, propuestas estancadas, carga operativa).
- `src/lib/verticals/software-factory/assistant-intents.ts` — intents del asistente específicos (pipeline por fase, cobros, entregables).
- `src/app/software-factory/page.tsx` — página del dashboard funcional del vertical.
- `src/app/api/software-factory/overview/route.ts` — API que expone el overview.

Si un vertical necesita comportamiento propio más allá del pack (KPIs específicos, intents de asistente, lib dedicada), sigue esta estructura: una carpeta `src/lib/verticals/<nombre>/`, una página opcional `src/app/<nombre>/page.tsx` y APIs propias en `src/app/api/<nombre>/`.

No todos los verticales necesitan esto. La mayoría se resuelven solo con el `SectorPackDefinition`.
