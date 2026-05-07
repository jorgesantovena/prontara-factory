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

---

## 9. Comunes vs específicos — qué se hereda automáticamente y qué hay que rellenar

> Sección añadida 7 mayo 2026 tras el cierre de los 6 packs. Este es el contrato real que tienen que cumplir los verticales.

### A. Lo que es **común** a todos los verticales (ya está hecho, no hay que tocar)

Estas piezas viven en el motor y aplican a cualquier pack sin trabajo adicional:

**Núcleo de módulos del ERP** (los 8 que TODOS los verticales tienen `enabled: true`):

| Módulo | URL | Función |
|---|---|---|
| `clientes` | `/clientes` | CRUD de clientes / pacientes / socios / familias / etc. |
| `crm` | `/crm` | Pipeline comercial — leads y oportunidades |
| `proyectos` | `/proyectos` | Trabajos / OTs / cursos / planes activos |
| `presupuestos` | `/presupuestos` | Propuestas / bonos / servicios complementarios |
| `facturacion` | `/facturacion` | Emisión de facturas / cuotas / recibos / tickets |
| `documentos` | `/documentos` | Expedientes / fichas técnicas / albaranes / consentimientos |
| `asistente` | `/asistente` | Chat IA del runtime |
| `ajustes` | `/ajustes` | Configuración del tenant |

**Funcionalidades transversales** (heredadas):

- Numeración correlativa automática `FAC-YYYY-NNN`, `PRES-YYYY-NNN`, `JUS-YYYY-NNN` — SF‑01.
- Resolver de tenant por cookie de sesión — SF‑13.
- Guard de suscripción async (Postgres) — SF‑17.
- Plan limits por recurso (clientes, facturas/mes, documentos).
- Branding aplicado automáticamente desde el `accentColor` del pack.
- Sidebar dinámico que respeta `MODULE_ORDER` + fallback para módulos custom — SF‑04 / SF‑20.
- Dashboard runtime con métricas básicas, alertas operativas y trial state.
- Saga de alta (landing → Stripe → tenant creado → email activación → primer login).
- Páginas legales (/aviso‑legal, /privacidad, /cookies, /contrato).
- Audit log + backups + RLS Postgres opt‑in.

### B. Lo que es **específico** del vertical y hay que rellenar en el pack

Estas son las piezas que definen el carácter sectorial. Sin ellas, el módulo aparece pero está vacío o roto:

| Pieza | Obligatoriedad | Qué pasa si falta |
|---|---|---|
| `branding.accentColor` | obligatorio | Cae a azul Prontara genérico |
| `branding.displayName` | obligatorio | Sale "Prontara" en vez de tu marca |
| `labels` (renombre semántico) | recomendado | Ej. "Clientes" en vez de "Pacientes" |
| `renameMap` (singular/plural) | recomendado | Inconsistencias en el copy |
| `modules[].enabled` | obligatorio | Si está en `false`, el módulo no aparece en sidebar |
| `fields[]` por moduleKey | **obligatorio** para cada módulo enabled | **Modal "+ Nuevo" sale sin campos** (bug SF‑14, SF‑21, AUDIT‑02..04) |
| `tableColumns[]` por moduleKey | **obligatorio** para cada módulo enabled | **Tabla con filas sin columnas** |
| `demoData[]` por moduleKey | recomendado fuerte | Tenant nuevo arranca vacío sin contexto para entender |
| `dashboardPriorities` | recomendado | Dashboard sale con prioridades genéricas |
| `entities` | recomendado | El asistente IA pierde contexto sectorial |
| `landing` | recomendado | La página de landing comercial sale con copy genérico |
| `assistantCopy` | opcional | El asistente saluda con copy genérico |

### C. Módulos específicos de un solo vertical (extras del pack)

Algunos verticales añaden módulos que NO están en el núcleo común. Cuando el pack los declara `enabled: true`, automáticamente:

- Aparecen en el sidebar (al final del orden canónico, por el fallback genérico de SF‑04).
- Necesitan su propia página `src/app/<moduleKey>/page.tsx` (stub que usa `GenericModuleRuntimePage`) **o** vivir como tab dentro de un hub.

Caso real: **Software Factory** declara `catalogo-servicios`, `tareas`, `incidencias`, `actividades`, `versiones`, `mantenimientos`, `justificantes`, `descripciones-proyecto`. De estos:

- `catalogo-servicios` tiene página propia en `/catalogo-servicios`.
- Los otros 7 son **HUB_CHILDREN** — solo se acceden como tabs dentro de `/produccion`, no en sidebar.

Para añadir un hub‑child sin que aparezca como link 404 en sidebar, hay que añadirlo a `HUB_CHILDREN_MODULES` en `src/components/erp/tenant-sidebar.tsx`.

## 10. Checklist obligatorio para añadir un vertical nuevo

Cuando crees el pack N+1, copia esta lista y márcala. Si todo está en verde, está listo.

```
[ ] 1. Definir businessType en kebab-case (ej. "panaderia")
[ ] 2. Elegir accentColor — usar paleta libre del § 11. Verificar 60° HSL de distancia con vecinos
[ ] 3. Crear const NUEVO_PACK en src/lib/factory/sector-pack-registry.ts
[ ] 4. Registrarlo en sectorPacks[] (al final del archivo)
[ ] 5. branding completo (displayName, shortName, accentColor, logoHint, tone)
[ ] 6. labels para los 8 módulos del núcleo (renombre semántico sectorial)
[ ] 7. renameMap singular/plural si renombras
[ ] 8. modules[] con enabled:true para los 8 + extras propios
[ ] 9. fields[] con AL MENOS clientes, crm, proyectos, presupuestos, facturacion, documentos
[ ] 10. tableColumns[] paralelo a fields, con isPrimary en al menos uno por módulo
[ ] 11. demoData con 3-6 registros por módulo común (sin números reales — ficticios pero plausibles)
[ ] 12. dashboardPriorities con orden 1..5
[ ] 13. landing (headline, subheadline, bullets, cta)
[ ] 14. assistantCopy (welcome, suggestion)
[ ] 15. Si hay módulos extra: añadirlos también a fields/tableColumns/demoData
[ ] 16. Si hay módulos hub-children (solo accesibles desde otro hub): añadir al HUB_CHILDREN_MODULES en tenant-sidebar.tsx
[ ] 17. Correr `pnpm test` — el test de integridad sector-pack-integrity debe pasar
[ ] 18. Crear un tenant local con businessType=<nuevo> y validar visualmente las 6 URLs del núcleo
```

## 11. Paleta de colores — registro de uso

Colores **ocupados** (no reusar):

| Color | Pack | Sector |
|---|---|---|
| `#0f766e` (teal verde‑oscuro) | clinica-dental | salud |
| `#2563eb` (azul) | software-factory | tecnologia |
| `#dc2626` (rojo) | gimnasio | fitness |
| `#db2777` (rosa) | peluqueria | belleza |
| `#ea580c` (naranja) | taller | automocion |
| `#7c3aed` (violeta) | colegio | educacion |

Paleta **libre** sugerida (criterio: >60° HSL de distancia de vecinos):

| Color | Tono | Buen candidato para sector |
|---|---|---|
| `#16a34a` | green‑600 brillante | alimentación / agricultura |
| `#059669` | emerald‑600 | jardinería / sostenibilidad |
| `#65a30d` | lime‑600 amarillento | hostelería casual |
| `#0891b2` | cyan‑600 | limpieza / servicios profesionales |
| `#1e40af` | indigo‑700 oscuro | asesoría legal / notarías |
| `#0284c7` | sky‑600 celeste | turismo / agencias |
| `#b91c1c` | red‑700 oscuro | seguridad / emergencias |
| `#be123c` | rose‑700 | moda / boutique |
| `#c2410c` | orange‑700 oscuro | construcción / obras |
| `#d97706` | amber‑600 | panadería / pastelería |
| `#a16207` | yellow‑700 mostaza | gestoría rural |
| `#6d28d9` | violet‑700 oscuro | academia / formación |
| `#c026d3` | fuchsia‑600 | eventos / bodas |
| `#78350f` | amber‑900 marrón | carpintería / madera |
| `#57534e` | stone‑600 gris pizarra | consultoría B2B |
| `#1f2937` | slate‑800 antracita | industria / metal |

Cuando se use uno, mover de "libre" a "ocupado" en este documento.

## 12. Anti‑patrones detectados (bugs reales que se han visto)

Estos errores ya pasaron en producción. El test de integridad del § 13 los detecta automáticamente, pero conviene tenerlos en mente:

1. **Módulo enabled sin fields** → modal "+ Nuevo" sale sin campos. Vimos esto en SF (facturacion/presupuestos antes de SF‑14), en gimnasio/peluquería/colegio (presupuestos antes de SF‑19), en los 5 packs no‑SF (crm y documentos antes de AUDIT‑03/04).

2. **Módulo enabled sin tableColumns** → tabla muestra filas pero columnas vacías. Vimos esto en colegio antes de AUDIT‑02.

3. **`fieldKey` en pack pero `key` en frontend** → todos los inputs comparten state y al teclear en uno cambian todos. Lo arreglé en SF‑16 con un mapping en el resolver. Si añades fields nuevos, asegúrate de usar `fieldKey` (consistente con la definición de `SectorPackField`).

4. **Módulo hub‑child con página inexistente** → 404 en sidebar. Lo arreglé en SF‑20: añadir a `HUB_CHILDREN_MODULES`.

5. **Pack sin demo data** → tenant nuevo arranca con tablas vacías y el operador no entiende qué hacer. Aunque el motor funciona, la UX es mala.

6. **Color del pack idéntico (o muy cercano) a otro** → el operador confunde tenants en Factory Chat / dashboard agregado. Mantener regla 60° HSL.

7. **Módulo legacy en `MODULE_ORDER` del sidebar pero no enabled en el pack** → aparece en sidebar pero su página da 404 o está vacía.

8. **Llamar a `getOrCreateBillingSubscription` (sync) desde un endpoint serverless** → toca `/var/task/data/saas/billing` que es read‑only en Vercel, ENOENT. Usar siempre `getOrCreateBillingSubscriptionAsync` (SF‑15).

## 13. Test de integridad de packs

Existe `src/lib/factory/__tests__/sector-pack-integrity.test.ts` que verifica automáticamente:

- Cada pack tiene `accentColor` único (no se solapa con otro).
- Cada módulo enabled (excluyendo `asistente`, `ajustes` y los hub‑children del SF) tiene al menos 1 `field` y 1 `tableColumn`.
- Los 6 módulos del núcleo (`clientes`, `crm`, `proyectos`, `presupuestos`, `facturacion`, `documentos`) están enabled en todos los packs.
- Cada pack tiene demoData para al menos `clientes`, `proyectos` y `facturacion`.

Correr con `pnpm test sector-pack-integrity`. Si falla, el pack nuevo no está completo todavía.

## 14. Plantilla PDF compartida para documentos comerciales

> Sección añadida 7 mayo 2026 (AUDIT‑06). Heredada por **todos** los verticales sin trabajo adicional.

Todos los packs comparten **la misma plantilla** para imprimir presupuestos, facturas, pedidos y albaranes. El layout es idéntico — solo cambian:

- El **título** del documento (PRESUPUESTO / FACTURA / PEDIDO / ALBARÁN / RECIBO / TICKET / BONO), inferido del módulo o forzable con `?titulo=...`.
- Los datos del **emisor** (razón social, CIF, dirección, teléfono, email, color, iniciales del logo), resueltos desde el tenant.
- Los datos del **cliente** (razón social, CIF, dirección, contacto), resueltos desde el módulo `clientes` haciendo match por nombre.
- El **concepto + importe** del registro concreto.
- La **fecha secundaria** (Vencimiento en facturas, Validez en presupuestos, Entrega en pedidos).

### Arquitectura

- `src/lib/saas/business-document-generator.ts` — render PDF con pdfkit (layout A4 común).
- `src/lib/saas/tenant-emisor-resolver.ts` — resuelve identidad fiscal del tenant.
- `src/app/api/erp/business-document-pdf/route.ts` — endpoint GET unificado.
- `src/components/erp/download-document-button.tsx` — botón "↓ PDF" reusable que se enchufa en `extraRowActions` del `GenericModuleRuntimePage`.

### Cómo enchufarlo en un módulo nuevo

```tsx
// src/app/pedidos/page.tsx (ejemplo)
"use client";
import GenericModuleRuntimePage from "@/components/erp/generic-module-runtime-page";
import DownloadDocumentButton from "@/components/erp/download-document-button";

export default function PedidosPage() {
  return (
    <GenericModuleRuntimePage
      moduleKey="pedidos"
      href="/pedidos"
      extraRowActions={(row) => (
        <DownloadDocumentButton modulo="pedidos" row={row} />
      )}
    />
  );
}
```

Hoy ya está enchufado en `/presupuestos` (todos los verticales) y `/facturacion` (todos los verticales — y al lado del botón Verifactu si es SF).

### Configuración de los datos del emisor por tenant

El operador del tenant rellena los datos fiscales en el módulo `ajustes`. Las claves canónicas que el resolver entiende:

| Clave (en `nombre`/`clave`/`key` del registro) | Campo del PDF |
|---|---|
| `razon_social` / `razonSocial` / `nombre_fiscal` | Razón social en cabecera |
| `cif` / `nif` / `nif_cif` | CIF |
| `direccion` / `direccion_fiscal` / `domicilio` | Dirección |
| `telefono` / `tel` / `phone` | Teléfono |
| `email` / `email_contacto` / `correo` | Email |

Si una clave no existe, se usa fallback (`displayName` del branding para razón social, `—` para los demás). El operador verá el `—` y sabrá que tiene que rellenarlo en `/ajustes`.

El `accentColor` del logo viene del `branding.accentColor` del pack del vertical — automático, no se configura por tenant.

### Anti‑patrón a evitar

**No** hardcodear datos del emisor en el endpoint o en el generador. El emisor SIEMPRE es el tenant, no Prontara ni SISPYME. Solo el endpoint de Verifactu (SF‑12) usa datos de SISPYME explícitamente porque ahí SISPYME es el sujeto pasivo del IVA en la integración AEAT del SaaS, no del tenant.
