# Prontara — Continuidad de chat (13 mayo 2026, post TEST-2.x)

> **Para:** la siguiente conversación con Claude que continúe este trabajo.
> **De:** la conversación previa (la que va a cerrarse ahora).
> **Estado:** TEST-1.x desplegado en producción (commit `66e1f5d`). TEST-2.x escrito en disco pero **NO commiteado** porque `pnpm exec tsc --noEmit` falla y el usuario aún no ha pegado el error.

---

## 0. Cómo está empaquetada esta nota

- **§1–§3** te ponen al día del proyecto en 5 minutos.
- **§4** es la lista exacta de fixes hechos hoy y los ficheros tocados.
- **§5** es el bloqueo actual y lo siguiente que hay que hacer al abrir el chat nuevo.
- **§6** es la cola de tareas futuras (no urgentes).
- **§7** es referencia técnica que vas a necesitar (rutas, claves, dónde tocar qué).

Para profundizar en arquitectura: `docs/HANDOFF-2026-05.md` (692 líneas, escrito el 12-may-2026 tras H15-C). No lo dupliques — extiende.

---

## 1. Qué es Prontara

ERP multi-tenant SaaS para PYMES españolas (4-20 empleados). Dos capas bajo el mismo código:

| Capa | URL | Quién la usa |
|------|-----|--------------|
| **Factory** | `app.prontara.com/` (redirige a `/factory`) | Jorge (CEO SISPYME) — provisiona tenants, ve métricas SaaS |
| **Runtime** | `app.prontara.com/{vertical}` | Clientes finales — cada uno ve su ERP sectorial |

11 verticales (slugs URL): `softwarefactory`, `dental`, `veterinaria`, `colegio`, `peluqueria`, `taller`, `hosteleria`, `abogados`, `inmobiliaria`, `asesoria`, `gimnasio`.

El vertical bandera es **Software Factory** (al 95-100%). El resto al 60-80%.

## 2. Stack

- Next.js 16 (App Router + Turbopack + React 19), TypeScript estricto
- Postgres en Neon Frankfurt + Prisma 6.19.3
- Vercel para deploy (auto-deploy en push a `main`)
- Resend (email transaccional e inbound), Stripe (cobros), Anthropic Claude (asistente, OCR)
- Tauri 2 (wrapper desktop, opcional, sin uso en producción)

## 3. Arquitectura mínima imprescindible

### 3.1 Sector packs
Cada vertical tiene un **SectorPackDefinition** en `src/lib/factory/sector-pack-registry.ts` con:
- `key`, `businessType`, `branding` (color de acento, displayName)
- `disabledCoreModules` (qué módulos CORE no aplican — ej. SF deshabilita `caja`, `productos`, `kardex`...)
- `modules` (lista de módulos del vertical: `clientes`, `crm`, `proyectos`, ...)
- `fields` (definiciones por módulo: `{ moduleKey, fieldKey, label, kind, required, options? }`)
- `tableColumns` (qué columnas se ven en el listado del módulo)
- `entities` (descripción de cada entidad para el asistente IA)

Cuando añadas/quites algo de un pack, ten en cuenta que `applyCoreModulesToConfig()` inyecta los módulos universales en todos los packs. Para opt-out, añade el moduleKey a `disabledCoreModules`.

### 3.2 Endpoints clave del runtime
- `GET /api/runtime/tenant-config` — devuelve labels, fields, tableColumns, branding del tenant. Lee slug desde cookie de sesión o query string.
- `GET /api/erp/module?module=clientes` — lista registros del módulo.
- `POST /api/erp/module` — crea/edita/borra (`mode: "create" | "edit" | "delete"`).
- `GET /api/erp/options?module=X` — opciones para campos `relation`.
- `GET/POST /api/erp/reports` — listar/crear/ejecutar reportes.
- `GET /api/runtime/saved-views?moduleKey=X` — vistas guardadas por usuario+módulo.

### 3.3 Componentes generic core
- `src/components/erp/generic-module-runtime-page.tsx` (~1000 líneas) — la página de un módulo cualquiera del runtime. Toolbar (Vistas/Filtros/Columnas), tabla, KPIs, drawer detalle, integra `ErpRecordEditor`.
- `src/components/erp/erp-record-editor.tsx` (~600 líneas) — editor full-page con tabs (general/contacto/comercial/financiero/notas/documentos), classifyField agrupa los fields automáticamente.
- `src/components/erp/danger-confirm.tsx` — modal de confirmación obligando a teclear "ELIMINAR" o similar.
- `src/lib/saas/use-current-vertical.ts` — hook con `link(modulePath)` que prefija el slug del vertical en URLs.

### 3.4 Multi-vertical en URLs
Toda ruta del runtime vive bajo `src/app/[vertical]/...`. Si pones `<Link href="/clientes">` en lugar de `<Link href={link("clientes")}>`, el middleware redirige a `/acceso` (login) porque la ruta `/clientes` no existe (solo `/{vertical}/clientes`). Este es el bug que arreglé en TEST-1.4.

---

## 4. Lo que se ha hecho HOY (13-may-2026)

### 4.1 Commit deployado: `66e1f5d` — TEST-1.1..1.7

Tester (cliente final, no técnico) reportó 7 bugs en `Pontara Test 1.docx`. Todos arreglados y desplegados en producción:

| ID | Bug | Fix |
|----|-----|-----|
| **TEST-1.1** | SF pack tenía botón "Nuevo cliente" pero no `fields` ni `tableColumns` para `clientes` (única pack de las 11 con este hueco) | Añadidos 11 fields (nombre, cif, contacto, email, telefono, direccion, estado con options, segmento, responsable, fechaAlta, notas) + 7 tableColumns en `sector-pack-registry.ts` |
| **TEST-1.2** | Botón decía "Nuevo Client" sin la "e" final | Mapa `SINGULAR_OVERRIDES` con 30+ entradas (clientes→cliente, oportunidades→oportunidad, etc.) en `singular()` de ambos `generic-module-runtime-page.tsx` y `erp-record-editor.tsx`. Antes hacía `slice(-2)` y dejaba "client". |
| **TEST-1.3** | Bulk actions eran `alert("TODO: ...")` | Modal real para "Asignar responsable" (text input) y "Cambiar estado" (select dinámico desde rows). "Enviar" eliminado. "Archivar" pasa por `DangerConfirm` (escribir ARCHIVAR). Helper `bulkUpdate(field, value)` itera selectedIds + POST mode=edit con merge del payload. |
| **TEST-1.4** | "Más acciones" → /vista-kanban iba a `/acceso` (sin prefix vertical) | `useCurrentVertical().link()` en breadcrumb "Inicio", dropdown "Más acciones" (Kanban/Calendario/Reportes), "Ver ficha completa" del drawer, tab Documentos del editor, "Ver documentos" del record-detail, botón Ficha del clientes-module-client. |
| **TEST-1.5** | Editor mostraba solo tab "Documentos" cuando fields=[] y permitía Guardar registros vacíos | `tabsConFields` excluye documentos; documentos solo aparece si hay otros tabs. Tab inicial = `tabsConFields[0]` nunca documentos. `doSubmit` lanza error si fields=[]. Botón Guardar `disabled` con tooltip. Componente `NoFieldsConfigured` con link a /ajustes-campos. |
| **TEST-1.6** | "Filtros" era un select de estado con label "▽ Filtros" confuso | Popover real con Estado + Segmento + Responsable (dinámicos según fields del módulo) + contador. Columnas ya era funcional. |
| **TEST-1.7** | Tour paso 2 prometía "cambiar de empresa" y "abrir ayuda" que no existen para tenants single-empresa | Reescrito el copy: "Si tu cuenta gestiona varias empresas, también podrás cambiar entre ellas." |

### 4.2 Pendiente de commit: TEST-2.1..2.12

Tester mandó `Prontara Test 2.docx` con 12 bugs/mejoras nuevas (fechado 13-may-2026). Todos los fixes están en disco pero `pnpm exec tsc --noEmit` falla y el usuario aún no pegó el error.

| ID | Bug | Fix aplicado |
|----|-----|--------------|
| **TEST-2.1** | "Ver ficha completa" del drawer iba a `/factory/clientes/{id}` que no existe → 404 | El Link es ahora un `<button onClick={onEdit}>` que abre el editor full-page (mismo onEdit que botón "Editar" inferior). |
| **TEST-2.2** | Sin estándar de click vs doble-click | `onDoubleClick={() => { setSelected(item); setModalMode("edit"); }}` + `title="Click: detalle rápido — Doble click: editar"` en `<tr>`. |
| **TEST-2.3** | Tab "Contactos" no permite CRUD de contactos | Componente `ContactosSublist` añadido a `erp-record-editor.tsx`. Cuando `tab === "contacto" && moduleKey === "clientes"`, render alongside del FieldGrid. Persiste como JSON en field `contactosJson`. |
| **TEST-2.4** | Columna "Contacto" del listado no muestra el preferido | En el render de la tabla del runtime page: si `col.fieldKey === "contacto" && item.contactosJson`, parsea y usa `arr.find(c => c.preferido)?.nombre` o `arr[0].nombre`. |
| **TEST-2.5** | direccion/poblacion/CP/provincia/pais aparecían en tab "Contactos" | `classifyField()` ya no clasifica esos como "contacto" — caen a "general". Solo telefono/tel/email/contacto/web/sitio van a "contacto". |
| **TEST-2.6** | "Ver como Kanban" en ficha de Cliente no tiene sentido | Const `KANBAN_MODULES = new Set(["crm","oportunidades","proyectos","tareas","tickets","cau","incidencias","presupuestos","compras"])`. La opción solo sale si `KANBAN_MODULES.has(moduleKey)`. |
| **TEST-2.7** | Calendario abierto y vacío sin saber qué hacer | Empty state con explicación: "El calendario muestra automáticamente las tareas con fecha límite, las reservas, citas..." con instrucciones de "Para que aparezcan entradas: crea una Tarea, apunta una actividad, etc." |
| **TEST-2.8** | Crear reporte solo guarda metadato; no hay documento descargable | Añadidos botones "↓ Excel (CSV)" (descarga CSV in-browser via Blob) y "🖨 Imprimir / PDF" (`window.print()`). Helper `downloadCsv(name, rows)` en el mismo fichero. |
| **TEST-2.9** | Drawer "Enviar email" no hace nada | Mailto mejorado con subject pre-rellenado y `title=` explicativo. (El motivo real puede ser que el navegador no tiene cliente de email registrado — el tooltip lo aclara.) |
| **TEST-2.10** | Vistas Guardadas: no se distingue "Todos" de "Clientes 4" | Sub-líneas explicativas en cada entrada: "Sin filtros — toda la lista" para Todos; "estado=activo · 'búsqueda'" para vistas custom. Tooltip en hover. |
| **TEST-2.11** | Jerga (CSV, Kanban, Prospecto, Archivar, módulo) confunde al tester | "Prospecto" → "Cliente potencial" (en options del estado de SF clientes). "↓ CSV" → "↓ Exportar a Excel". "Ver como Kanban" → "Tablero por fases (Kanban)". "Archivar" → "Eliminar seleccionados". Tooltips añadidos. |
| **TEST-2.12** | Botón "..." de fila duplica el click sobre cliente; no había Editar/Email/Llamar/Eliminar/Copiar | Popover real al pulsar "..." con: Editar, Enviar email (mailto), Llamar (tel:), Duplicar (clona payload sin id, abre create con valores precargados), Eliminar (con confirm). State `rowMenuOpenId`. Backdrop fixed con z-index 40 para cerrar al click fuera. |

### 4.3 Ficheros modificados (TEST-2.x, no commiteados)

```
src/app/[vertical]/calendario/page.tsx        — empty state TEST-2.7
src/app/[vertical]/reportes/page.tsx          — botones CSV/PDF + downloadCsv() TEST-2.8
src/components/erp/erp-record-editor.tsx      — classifyField TEST-2.5, ContactosSublist TEST-2.3+2.4
src/components/erp/generic-module-runtime-page.tsx — TEST-2.1, 2.2, 2.4, 2.6, 2.10, 2.11, 2.12
src/components/erp/module-export-button.tsx   — copy "Exportar a Excel" TEST-2.11
src/lib/factory/sector-pack-registry.ts       — "Cliente potencial" TEST-2.11
```

---

## 5. **AQUÍ ESTAMOS BLOQUEADOS** — siguiente paso al abrir el chat nuevo

El usuario corrió:

```powershell
cd C:\ProntaraFactory\prontara-factory
pnpm exec tsc --noEmit
```

…y dijo "no funcionó el deploy, fue el typecheck". **No ha pegado el output del error.** El sandbox Linux donde corre Claude no puede ejecutar `tsc` (los symlinks de `.pnpm` de Windows no son legibles desde Linux), así que **necesitas pedirle el texto del error**.

### Acción inmediata al abrir el chat nuevo:

1. Saluda y pídele que pegue **directamente como texto** (no como adjunto docx — ha estado adjuntando el mismo fichero viejo en bucle por culpa de algún auto-attach del UI) las primeras 30 líneas del output de `pnpm exec tsc --noEmit`. Algo como:
   ```
   src/components/erp/erp-record-editor.tsx:475:21 - error TS2304: Cannot find name 'foo'.
   ```
2. Identifica el patrón del error (suele ser uno repetido N veces) y arregla los ficheros.
3. Cuando el typecheck pase, ejecuta el bloque de commit + push:
   ```powershell
   cd C:\ProntaraFactory\prontara-factory
   git add src/app/[vertical]/calendario/page.tsx src/app/[vertical]/reportes/page.tsx src/components/erp/erp-record-editor.tsx src/components/erp/generic-module-runtime-page.tsx src/components/erp/module-export-button.tsx src/lib/factory/sector-pack-registry.ts
   git commit -m "TEST-2.1..2.12: fixes del 2o reporte del tester"
   git push
   ```
4. Vercel auto-deploya. Pídele que el tester valide en https://app.prontara.com/factory/clientes con Ctrl+F5.

### Áreas calientes del código a revisar primero si el error es críptico

- **`erp-record-editor.tsx`** líneas ~459-602 — añadí tipo `Contacto`, función `ContactosSublist`, const `subIpt`. Revisa que `useState` y demás hooks estén importados (lo están: línea 3).
- **`generic-module-runtime-page.tsx`** — añadidos:
  - State `rowMenuOpenId` (línea ~195)
  - Const `KANBAN_MODULES` (línea ~87)
  - Posible problema: cambio en `initialValue={selected}` (línea ~436) — antes era ternario `modalMode === "edit" ? selected : null`. Si TS infiere mal el tipo, podría quejarse.
- **`reportes/page.tsx`** — añadida función `downloadCsv()` que usa `Blob`, `URL.createObjectURL`, `document.createElement`. Todos browser APIs disponibles en cliente; pero como el archivo es `"use client"` debería ir bien.

### Posibles causas más probables del error TS

1. **Variable no usada (`noUnusedLocals`)** — quizás el `accent` parameter de ContactosSublist (lo paso pero no lo uso para nada visible). Solución: añadir `void accent;` o eliminar el parámetro.
2. **Tipo `any` implícito en clone** — `clone[k] = String(v ?? "")` con `v: unknown` debería estar OK pero TS strict podría quejarse.
3. **Falta `key` en algún `.map()`** — improbable, pero revisable.
4. **Tipo de `popoverItem` aplicado a `<a>`** — `popoverItem` es `CSSProperties`, aplicable a cualquier tag.

---

## 6. Cola de mejoras pendientes (no críticas)

Cosas que el tester insinuó pero no dejé como tarea explícita y que tarde o temprano querrá:

- **Refrescar lista tras editar contacto preferido**. Si el tester cambia el preferido en el editor y guarda, la columna del listado debería reflejar el nuevo nombre. Hoy solo se actualiza si recargas. La función `load()` ya se llama tras saveRecord pero el navegador puede cachear — verificar.
- **Sublista de contactos también para módulos no-clientes**. Hoy solo se renderiza si `moduleKey === "clientes"`. Si pides aplicar a `crm` (oportunidades) habría que generalizar. Sería un campo "tener contactos asociados" por módulo.
- **Doble-click conflicto con drawer**. Ahora click abre drawer, doble-click abre editor. En navegadores rápidos el primer click ya disparó `openDetail` antes de que llegue el segundo. UX patches: `setTimeout` o usar shift+click. Por ahora vamos a probar como está.
- **Glosario "módulo"**. El tester se quejó de la palabra. No hay un sitio único para renombrar. Habría que pasar a "sección" o "apartado" en sidebar/títulos. Es trabajo extenso de copy.
- **Reporte real en MS-Word (`.docx`)**. Hoy genera CSV + print PDF. Para Word real haría falta `docx` skill o servidor (puppeteer/python-docx). Esperar a que el tester lo pida explícitamente.
- **Pantalla "Entra en tu entorno" cuando se navega sin sesión**. El tester reportó que aparecía desde links del Día 1 — eso es correcto comportamiento del middleware (TEST-1.4 lo arregló). Si vuelve a aparecer en TEST-3, mirar `middleware.ts`.

---

## 7. Referencia técnica imprescindible

### 7.1 Entorno del usuario
- Usuario humano: **Jorge Santoveña Martín** (CEO SISPYME). Email: jorge.santovena@gmail.com.
- Sistema: Windows con PowerShell. Repo en `C:\ProntaraFactory\prontara-factory`.
- Workspace folder de Claude: `C:\ProntaraFactory` (puede crear ficheros aquí, los ve el usuario).
- Outputs temporales: `C:\Users\Jorge\AppData\Roaming\Claude\local-agent-mode-sessions\.../outputs\` (no los ve el usuario — solo es scratchpad).

### 7.2 Producción
- App: https://app.prontara.com
- Tenant del tester: **software-factory-demo-3** (slug `softwarefactory`).
- Vercel auto-deploya en push a `main`. Tarda 2-3 min normalmente. Si tras push no se ve cambio en 5 min, mirar el dashboard.
- Postgres en Neon Frankfurt. Variables de entorno en Vercel.
- Resend para email transaccional. `PRONTARA_PUBLIC_BASE_URL` debe ser `https://app.prontara.com` (no `localhost:3000` — bug histórico).

### 7.3 Sandbox del Claude vs Windows
- Bash sandbox = Linux Ubuntu, sin pnpm/tsc disponibles para este repo (los symlinks de pnpm-store de Windows no se leen).
- File tools (Read/Write/Edit) escriben directamente al filesystem Windows del usuario.
- Bash sí puede correr `git` contra el repo (con limitaciones — el `.git/index.lock` lo crea Windows y el sandbox no lo puede borrar).
- Cuando el usuario tiene `.git/index.lock` colgado: cerrar VSCode, GitHub Desktop, GitKraken — son los que lo dejan colgado. Si no funciona: `Remove-Item .git\index.lock -Force` en PowerShell.

### 7.4 Tareas tracker
- Tareas 1-177: H1..H15 (núcleo, verticales, factura electrónica, AI, etc.)
- Tareas 178-184: TEST-1.1..1.7 (deployadas en `66e1f5d`)
- Tareas 185-196: TEST-2.1..2.12 (en disco, pendientes de typecheck + commit)

### 7.5 Documentos relacionados
- `docs/HANDOFF-2026-05.md` — handoff completo de 692 líneas tras H15-C (12-may-2026). Para contexto profundo de arquitectura.
- `docs/PRUEBA-SF-USUARIO.md` — guía de prueba para el tester (lenguaje no técnico).
- `docs/QA-PLAN-SOFTWAREFACTORY.md` — plan QA del vertical SF.
- `docs/colegio-modulos.md`, `docs/core-erp-modulos.md`, `docs/persistence-architecture.md` — arquitectura por dominio.

### 7.6 Estilo de respuesta esperado
El usuario es CEO no programador. Pide:
- Respuestas cortas y directas, sin muchos rodeos.
- Cuando le pidas que ejecute algo, **dale el bloque entero copy-paste-able** para PowerShell.
- Si algo falla, no pidas nuevas adjunciones — pídele que pegue el output como texto plano.
- Trata los reportes del tester como input válido. Distingue "regresión que ya arreglé" vs "bug genuino nuevo".

---

## 8. Prompt sugerido para abrir el chat nuevo

> Estoy continuando trabajo en el ERP Prontara. Lee `C:\ProntaraFactory\prontara-factory\docs\HANDOFF-2026-05-13-TEST-2.md` para enterarte de dónde estamos. Resumen rápido: TEST-2.1..2.12 está en disco pero el typecheck falla y aún no he pegado el error. Pídeme que ejecute `cd C:\ProntaraFactory\prontara-factory ; pnpm exec tsc --noEmit` y te pegue el resultado como texto.
