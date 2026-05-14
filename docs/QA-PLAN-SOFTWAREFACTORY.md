# Plan de QA — Vertical Software Factory

> **Para**: arquitecto/analista/programador veterano que va a probar el vertical SF de Prontara end-to-end.
> **Tiempo estimado**: 3-4 horas para el paso 1-15 (recorrido completo). +1h cada bloque opcional.
> **Output esperado**: lista de issues con repro steps, severidad (P0/P1/P2/P3) y evidencia (screenshot/log).
>
> Antes de empezar lee también `docs/HANDOFF-2026-05.md` para entender la arquitectura. Aquí asumimos que ya conoces el modelo multi-tenant y los packs sectoriales.

---

## 0. Pre-requisitos

### 0.1. Acceso

- **URL**: `https://app.prontara.com`
- **Tenant demo SF**: `software-factory-demo`
- **Email**: el seed crea `demo@software-factory-demo.com` (o el que aparezca en `scripts/seed-demos.ts`)
- **Contraseña temporal**: el primer arranque la imprime en consola. Pide a Jorge la actual o regenera con seed.
- **Si no tienes acceso**: pide a Jorge un usuario `owner` o ejecuta seed en local (ver §0.3).

### 0.2. Browser recomendado

- Chrome o Firefox estables (no Beta).
- DevTools abierta durante toda la sesión: Console + Network + Application > Cookies.
- Tener Ctrl+Shift+R a mano para forzar reload.
- Modo incógnito para validar redirects y sesión.

### 0.3. Setup local opcional (si pruebas con DB limpia)

```bash
git clone https://github.com/jorgesantovena/prontara-factory
cd prontara-factory
pnpm install
cp .env.example .env.local
# Edita .env.local mínimo:
#   PRONTARA_SESSION_SECRET=$(openssl rand -hex 32)
#   PRONTARA_PERSISTENCE=filesystem
#   PRONTARA_PUBLIC_BASE_URL=http://localhost:3000
pnpm exec tsx scripts/seed-demos.ts     # crea 3 demos
pnpm dev
```

Anota la contraseña temporal que aparece en consola — la necesitas para el primer login.

### 0.4. Reglas de reporte de issues

Cada issue debe tener:

- **ID** (BUG-001, BUG-002…)
- **Severidad**:
  - **P0** — bloquea uso (login falla, error 500 en home, datos perdidos)
  - **P1** — workflow crítico roto (no se puede emitir factura, propuesta no se guarda)
  - **P2** — flujo secundario o UX rota pero hay workaround
  - **P3** — cosmético, mejora
- **Pasos para reproducir** (precisos, en imperativo)
- **Resultado actual** vs **esperado**
- **Browser/OS**, screenshot, logs de consola/red

---

## 1. Acceso y sesión

### 1.1. Landing pública + login flow

| # | Acción | Esperado |
|---|--------|----------|
| 1.1.1 | Navega a `app.prontara.com` en incógnito | Redirect a `/factory`. Verás el panel CEO o pedirá login si no hay cookie. |
| 1.1.2 | Navega a `app.prontara.com/software-factory` (con guión) | Landing comercial pública SF. NO pide login. |
| 1.1.3 | Click "Iniciar sesión" desde la landing | Redirect a `/acceso?redirectTo=/softwarefactory` |
| 1.1.4 | Teclea slug `software-factory-demo`, email y contraseña → Entrar | Tras login debe ir a `/softwarefactory`, NO a `/factory` |
| 1.1.5 | Cierra sesión (`/logout` o menú perfil) | Vuelves a `/acceso` o landing |
| 1.1.6 | Vuelve a `app.prontara.com/clientes` sin sesión | Debe redirigir a `/acceso?redirectTo=/clientes` |
| 1.1.7 | Inicia sesión desde ese acceso | Debe acabar en `/softwarefactory/clientes` (no en `/clientes` ni `/factory`) |

### 1.2. SSO Google/Microsoft

| # | Acción | Esperado |
|---|--------|----------|
| 1.2.1 | En `/acceso` teclea slug pero NO email/password. Mira si aparecen botones "Continuar con Google/Microsoft" | Solo aparecen si las env vars `GOOGLE_OAUTH_CLIENT_ID/SECRET` o `MICROSOFT_*` están configuradas |
| 1.2.2 | Click "Continuar con Google" | Redirect al consentimiento Google. Tras autorizar, debe acabar logueado en `/softwarefactory` |

> Si los botones no aparecen, no es bug — es que faltan env vars en Vercel. Anotarlo solo como nota.

### 1.3. MFA

| # | Acción | Esperado |
|---|--------|----------|
| 1.3.1 | En `/ajustes-cuenta` → activar MFA. Escanea QR con Authy/Google Auth | Genera código TOTP que valida |
| 1.3.2 | Cierra sesión y vuelve a entrar | Pide código TOTP además de password |
| 1.3.3 | Mete código erróneo 3 veces | Error 401 con mensaje claro, no se cuelga |

### 1.4. Edge cases sesión

| # | Acción | Esperado |
|---|--------|----------|
| 1.4.1 | Desde DevTools elimina cookie `prontara_session` y refresca cualquier página tenant | Redirige a `/acceso` con `redirectTo` correcto |
| 1.4.2 | Manipula manualmente la cookie (cambia 1 carácter) y recarga | Tratada como inválida → `/acceso` |
| 1.4.3 | Inicia sesión simultánea en 2 navegadores | Ambos siguen funcionando — la sesión es stateless HMAC |

---

## 2. Shell visual (sidebar, topbar, home)

### 2.1. Sidebar SF

Tras login en `/softwarefactory`, verifica que la sidebar muestra **exactamente**:

**Operación**: Clientes, Oportunidades, Proyectos, Producción, Parte de horas, Tareas, Avisos

**Administración**: Propuestas, Facturas, Entregables, Compras, CAU, Base de conocimiento, Gastos, Vencimientos, Desplazamientos

**Analítica**: Reportes, Encuestas (si aparece, BUG)

**Configuración**: Asistente, Ajustes, Empleados, Equipo, Workflows, Integraciones

**Maestros** (colapsado por defecto, click expande): Catálogo servicios, Aplicaciones, Tarifas, Tarifas especiales, Formas pago, Cuentas bancarias, Tipos cliente, Tipos servicio, Tipos urgencia, Catálogo actividades, Zonas, Grupos, Clases condición

**NO debe aparecer**: Caja, Puntos venta, Bodegas, Kardex, Albaranes, Productos, Reservas, Tickets, Plantillas, Etiquetas, Estadística ventas, ni ningún módulo de COLEGIO (docentes, calificaciones, asistencia, comedor, biblioteca, transporte, etc.).

| # | Acción | Esperado |
|---|--------|----------|
| 2.1.1 | Logueado como SF, mira la sidebar | Solo módulos del workflow SF (lista arriba) |
| 2.1.2 | Click "Colapsar" abajo | Sidebar se reduce a 64px con solo iconos. Click expande otra vez. La preferencia se persiste tras reload (localStorage). |
| 2.1.3 | Click en cada categoría | Toggle expand/collapse. La elección persiste tras reload. |
| 2.1.4 | Click en cada item | Navega a la página correspondiente. **Ningún item da 404**. Item activo se marca con color del vertical. |
| 2.1.5 | El logo arriba muestra "Software Factory Demo" o similar | Bien renderizado, no truncado feo |
| 2.1.6 | Item activo (Inicio en este momento) debe estar en azul vertical (`#2563eb`), NO negro | Si sale negro → BUG (fallback de accent color) |

### 2.2. Topbar

| # | Acción | Esperado |
|---|--------|----------|
| 2.2.1 | Buscador central tiene el hint `⌘K` (Mac) o `Ctrl K` (Windows) | Sí, según OS |
| 2.2.2 | Pulsa `⌘K`/`Ctrl K` desde cualquier página | Focus al buscador (sin recargar) |
| 2.2.3 | Teclea cualquier término y enter | Va a `/buscar?q=...` (debería redirigir a `/softwarefactory/buscar?q=...`) |
| 2.2.4 | Click campana notificaciones | Abre dropdown con últimas 20 |
| 2.2.5 | Click `?` ayuda | Abre HelpPanel |
| 2.2.6 | Click avatar + nombre | Dropdown con Mi cuenta / Ajustes / Cerrar sesión |
| 2.2.7 | Si hay multi-empresa configurada (H7-C4), aparece selector "Sede" | Cambiar afecta a la sesión |

### 2.3. Home dashboard

| # | Acción | Esperado |
|---|--------|----------|
| 2.3.1 | "Buenos días/tardes/noches, [Nombre] 👋" | Hora correcta según horario actual |
| 2.3.2 | Fecha actual a la derecha en español | OK |
| 2.3.3 | 4 KPIs en fila: Horas mes, Proyectos activos, Propuestas abiertas, Facturas pendientes | Números coherentes con datos del demo |
| 2.3.4 | Cada KPI tiene icono pastel, número grande, helper | Bien renderizado |
| 2.3.5 | "Accesos rápidos" muestra 4 tiles SF-específicos: Imputar horas, Nueva factura, Nueva propuesta, Pre-facturación | Sí |
| 2.3.6 | Click en cada tile → ir a la página correspondiente | OK |
| 2.3.7 | "Pendientes" muestra contadores con bullets de color | OK |
| 2.3.8 | "Notificaciones" / "Actividad reciente" / "Agenda de hoy" se cargan | Sin spinners infinitos |
| 2.3.9 | NO aparece la sección "Qué hacer primero" / onboarding | Está desactivada (FIX-SIDEBAR) |
| 2.3.10 | Si está activado el requisito de parte horas diario y al user le faltan horas | Banner ámbar "Te faltan X horas — Imputar ahora" debajo del topbar |

---

## 3. Workflow comercial: oportunidad → propuesta → conversión

### 3.1. Crear oportunidad (CRM)

| # | Acción | Esperado |
|---|--------|----------|
| 3.1.1 | Sidebar → Oportunidades | Listado con KPIs SLA arriba, vistas guardadas, filtros |
| 3.1.2 | Click "+ Nuevo Oportunidad" (o singular del label) | Editor full-page con tabs |
| 3.1.3 | Rellena: Empresa, Contacto, Email, Teléfono, Fase=Lead, Valor estimado, Próximo paso | Campos required marcados con * |
| 3.1.4 | Click "Guardar" | Crea registro, vuelve al listado, lo ves arriba |
| 3.1.5 | Click "Guardar y nuevo" en otra | Mantiene el editor abierto vacío |
| 3.1.6 | Edita una y prueba la estrella ☆/★ (favorito) | Toggle visual |
| 3.1.7 | Pill "No guardado" naranja aparece al cambiar algo | Y desaparece al guardar |

### 3.2. Convertir oportunidad en propuesta

| # | Acción | Esperado |
|---|--------|----------|
| 3.2.1 | En oportunidad → cambiar fase a "Ganado" | Manualmente |
| 3.2.2 | Sidebar → Propuestas → "+ Nueva" | Editor |
| 3.2.3 | Rellena: Cliente (selector relación), Concepto, Importe (con € prefix), Estado=Borrador → Enviado | Selector cliente lista los existentes |
| 3.2.4 | Guarda | Genera número correlativo automático si está vacío (SF-01) |
| 3.2.5 | Edita y cambia estado a "Aceptado" | Persiste |

### 3.3. Conversión propuesta → proyecto (H15-C #1)

| # | Acción | Esperado |
|---|--------|----------|
| 3.3.1 | Abre la propuesta aceptada | Ficha visible |
| 3.3.2 | Debe haber un botón "Convertir en proyecto" | (Si no hay UI todavía, prueba el endpoint vía DevTools console: `fetch("/api/runtime/sf/convert-proposal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ proposalId: "<id>" }) }).then(r => r.json()).then(console.log)`) |
| 3.3.3 | Tras conversión, ve a /proyectos | Existe un proyecto nuevo con nombre = concepto, cliente, fechaInicio=hoy, estado=activo |
| 3.3.4 | Vuelve a la propuesta original | Estado=convertida, campo projectRefId apunta al proyecto |
| 3.3.5 | Intenta convertir la misma propuesta otra vez | Error 400 "Ya se convirtió" |
| 3.3.6 | Convierte una propuesta en estado "Borrador" | Error: solo aceptado/firmado/ganado |

---

## 4. Workflow ejecución de proyecto

### 4.1. Crear proyecto manualmente

| # | Acción | Esperado |
|---|--------|----------|
| 4.1.1 | Sidebar → Proyectos → "+ Nuevo" | Editor |
| 4.1.2 | Rellena: Nombre, Cliente, Código de servicio (selector → INST/MANT/NUEDES/SOP/FORM/VERIFACTU), Estado=Activo, Facturable=Sí, Fecha inicio, Fecha caducidad | OK |
| 4.1.3 | Si codigoTipo=BOLSA, mete Horas totales=50 | Sí campo aparece. Disparador: la bolsa funcionará en pre-facturación |
| 4.1.4 | Guarda | Lo ves en listado |

### 4.2. Imputar horas (parte de horas)

| # | Acción | Esperado |
|---|--------|----------|
| 4.2.1 | Sidebar → Parte de horas → "+ Nuevo" | Editor |
| 4.2.2 | Rellena: Fecha (hoy), Persona (tu nombre o codigoCorto empleado), Proyecto (relación), Concepto, Horas=3.5, Tipo trabajo=desarrollo, Facturable=Sí | OK. Decimal con punto o coma debe funcionar |
| 4.2.3 | Si el proyecto es BOLSA: imputa otras 4h, verifica que el saldo de bolsa se ve | Debería bajar de 50 a 46 (H7-S4) |
| 4.2.4 | Imputa una con Tipo trabajo=soporte vinculada a un ticket CAU (campo tareaRelacionada=cau:<id>) | OK |

### 4.3. Producción hub

| # | Acción | Esperado |
|---|--------|----------|
| 4.3.1 | Sidebar → Producción | Hub con tabs: Tareas, Incidencias, Actividades, Versiones, Mantenimientos, Justificantes, Descripciones |
| 4.3.2 | Crea una tarea, una incidencia, una versión publicada | Sin errores |
| 4.3.3 | Genera un justificante (H7-S8 PDF firmable) | PDF se descarga sin error |
| 4.3.4 | NO debe haber tabs "Productos", "Stock", "Bodegas" | Si aparecen → BUG |

### 4.4. Vistas alternativas

| # | Acción | Esperado |
|---|--------|----------|
| 4.4.1 | Desde Proyectos → ver como Kanban | Tarjetas agrupadas por estado |
| 4.4.2 | Desde Proyectos → ver como Gantt | Barras temporales |
| 4.4.3 | Click en una tarjeta Kanban | Abre detalle |
| 4.4.4 | Calendario `/calendario` | Eventos del mes |

---

## 5. CAU — Centro de Atención al Usuario (H15-B)

### 5.1. Crear ticket manualmente

| # | Acción | Esperado |
|---|--------|----------|
| 5.1.1 | Sidebar → CAU | Listado dedicado con KPIs: Abiertos, Vencidos SLA, MTR, Compliance % |
| 5.1.2 | 6 vistas guardadas: Todos, Abiertos, Mis tickets, Sin asignar, Vencidos SLA, Esperando cliente | Cada una muestra contador |
| 5.1.3 | "+ Nuevo" → rellena Asunto, Cliente (relación), Aplicación (relación), Versión, Severidad=alta, Urgencia=urgente, Estado=nuevo, Descripción | OK |
| 5.1.4 | Guarda | Ticket aparece arriba |
| 5.1.5 | Bullet SLA junto al ticket | Verde (ok) inicialmente |

### 5.2. Ficha de ticket — conversación y SLA

| # | Acción | Esperado |
|---|--------|----------|
| 5.2.1 | Click en una fila | Ir a `/softwarefactory/cau/[id]` |
| 5.2.2 | Header: asunto, cliente, aplicación, versión | Visible |
| 5.2.3 | Sidebar derecha: Severidad, Urgencia, Estado, Asignado, Creado | OK |
| 5.2.4 | Timeline: ves la descripción original del cliente como burbuja gris izquierda | OK |
| 5.2.5 | Escribe respuesta en el textarea → click "Enviar respuesta" | Aparece tu mensaje en azul (derecha), `firstResponseAt` se marca |
| 5.2.6 | Marca el checkbox "Nota interna" y guarda | Aparece en amarillo con etiqueta "🔒 NOTA INTERNA" |
| 5.2.7 | Click "Imputar horas" → mete 1.5 → confirma | Crea registro en `actividades` enlazado al ticket. Aparece nota interna automática "⏱️ Imputadas 1.5 h" |
| 5.2.8 | Verifica en sidebar → Parte de horas que el registro existe con `tareaRelacionada=cau:<id>` | OK |
| 5.2.9 | Rellena el campo `solucion` del ticket (editando el record), cambia estado a "resuelto" via "Cerrar ticket" | Pregunta si convertir solución en KB entry |
| 5.2.10 | Acepta convertir en KB | Aparece en KB |

### 5.3. KB (base de conocimiento)

| # | Acción | Esperado |
|---|--------|----------|
| 5.3.1 | Sidebar → Base de conocimiento | Listado de entradas |
| 5.3.2 | Buscador full-text | Filtra por título, síntoma, solución, tags |
| 5.3.3 | Click una entrada | Panel detalle derecho con síntoma + solución |

### 5.4. SLA — escenarios

| # | Acción | Esperado |
|---|--------|----------|
| 5.4.1 | Crea ticket con severidad=critica, urgencia=urgente | SLA: 1h respuesta, 4h resolución (defaults) |
| 5.4.2 | Espera 2h sin responder (o cambia createdAt manualmente en DB) | Bullet SLA pasa a rojo "breached" |
| 5.4.3 | El cron `/api/cron/cau-sla-check` corre cada 15 min y debería: marcar `slaStatus=breached`, crear `TenantNotification` | Verifica notificaciones en la campana |
| 5.4.4 | Configura una política custom en `CauSlaPolicy` (severidad=alta, urgencia=normal, responseHours=2, resolutionHours=8) | Sobrescribe el default |

---

## 6. Workflow facturación (incluye Verifactu)

### 6.1. Pre-facturación

| # | Acción | Esperado |
|---|--------|----------|
| 6.1.1 | Sidebar → buscar "pre-facturación" o desde Accesos rápidos del home | Página con 8 columnas (H7-S2) |
| 6.1.2 | Tabla muestra: cliente, código tipo, horas en bolsa, contra-bolsa, fuera-bolsa, importe, etc. | Calculado del periodo (mes actual default) |
| 6.1.3 | Cambia mes en filtro | Recalcula |
| 6.1.4 | Click "Emitir mes" | Crea facturas correlativas para los clientes con horas pendientes (SF-02) |

### 6.2. Emisión factura manual

| # | Acción | Esperado |
|---|--------|----------|
| 6.2.1 | Sidebar → Facturas → "+ Nueva" | Editor |
| 6.2.2 | Cliente, concepto, importe, estado=emitida, fechaEmision=hoy | OK |
| 6.2.3 | Deja vacío el campo Número | Se autoasigna FAC-YYYY-NNN al guardar (SF-01) |
| 6.2.4 | En el listado, click en una factura | Ficha completa |
| 6.2.5 | Descargar PDF | Plantilla común AUDIT-06 o estilo SISPYME (H7-S3) según si es detalle |

### 6.3. Verifactu

> **Requiere**: tenant tiene certificado A1 subido en `/ajustes/certificado` Y env vars `VERIFACTU_PROD=true|false`, `VERIFACTU_CERT_PASSWORD=...`. En entorno test apunta a `prewww1.aeat.es`.

| # | Acción | Esperado |
|---|--------|----------|
| 6.3.1 | En una factura, click "Emitir Verifactu" | Genera XML, lo firma (XML-DSig) y envía a AEAT |
| 6.3.2 | Sin certificado configurado | Error claro "Sube primero el certificado" |
| 6.3.3 | Con certificado válido en entorno test | Respuesta AEAT con CSV o error |
| 6.3.4 | Mira `VerifactuSubmission` en DB | Status: prepared → sent / rejected / error |
| 6.3.5 | Re-emitir la misma factura | Error "Ya enviada" |

---

## 7. Facturación recurrente (H15-C #2)

> **UI dedicada está pendiente de construir**. Probar vía API con DevTools.

| # | Acción | Esperado |
|---|--------|----------|
| 7.1 | `POST /api/runtime/sf/recurring-invoices` body `{ clienteRefId, concepto: "Mantenimiento mensual", importe: "450.00", frecuenciaMeses: 1, diaCorte: 1 }` | Devuelve plan creado con nextRunAt |
| 7.2 | `GET /api/runtime/sf/recurring-invoices` | Lista todos los planes del tenant |
| 7.3 | `PATCH` con `{ id, activo: false }` | Pausa el plan |
| 7.4 | Cron `/api/cron/recurring-invoices-run` (con `X-CRON-SECRET`) | Si `nextRunAt <= now`, crea factura nueva, avanza `nextRunAt` un mes |
| 7.5 | Verifica que la factura tiene `recurringPlanId` en sus campos | Trazabilidad |

---

## 8. Rentabilidad por proyecto + Utilización equipo (H15-C #3-4)

> **UI dedicada pendiente**. Probar API.

| # | Acción | Esperado |
|---|--------|----------|
| 8.1 | `GET /api/runtime/sf/project-profitability` | Devuelve rows[] con ingresos, costes, margen, margenPct por proyecto |
| 8.2 | `?projectId=<id>` | Filtra a un solo proyecto |
| 8.3 | `?from=2026-04&to=2026-05` | Filtra ventana temporal |
| 8.4 | Los proyectos con más ingresos pero pocas horas → margen alto | Coherente |
| 8.5 | `GET /api/runtime/sf/team-utilization` (4 semanas default) | rows[] con persona, horasTotales, horasFacturables, horasDisponibles, utilizacionPct, facturablePct |
| 8.6 | Empleado dado de baja NO aparece en la tabla | Confirmado |
| 8.7 | `teamSummary` agrega todo el equipo | utilizacionPct = total/disponibles |

---

## 9. Portal cliente (H15-C #5)

| # | Acción | Esperado |
|---|--------|----------|
| 9.1 | `POST /api/runtime/sf/portal-access` con `{ clienteRefId, contactEmail, contactName, expiresInDays: 30 }` | Devuelve `portalUrl` con token |
| 9.2 | Abre la URL en navegador incógnito (sin sesión Prontara) | Carga `/portal/[token]` con datos del cliente |
| 9.3 | Verifica: Stats (tickets abiertos, facturas pendientes, proyectos activos), tabla tickets, tabla facturas | OK con datos reales |
| 9.4 | Manipula el token (cambia un carácter) | 404 |
| 9.5 | Espera hasta `expiresAt` (o `PATCH` lo a una fecha pasada) | 404 |
| 9.6 | Vuelve al ERP → `DELETE /api/runtime/sf/portal-access?id=<id>` | Token revocado, la URL devuelve 404 inmediatamente |
| 9.7 | `lastSeenAt` se actualiza cuando el cliente entra | OK |

---

## 10. Hitos de proyecto (H15-C #6)

> **UI Gantt pendiente**. Probar API.

| # | Acción | Esperado |
|---|--------|----------|
| 10.1 | `POST /api/runtime/sf/milestones { projectId, titulo, fechaObjetivo, pesoPct: 25 }` ×4 | Crea 4 hitos |
| 10.2 | `GET ?projectId=<id>` | Lista ordenada por `orden` |
| 10.3 | `PATCH` con `{ id, estado: "completado" }` | Marca completado + `fechaCompletado=now` |
| 10.4 | Si `disparaFactura=true`, al completar debería sugerir crear factura parcial | (Si UI existe; si no, anotar como TODO) |
| 10.5 | Suma de `pesoPct` de hitos = 100 | Validación visual / manual |

---

## 11. Firma electrónica de propuestas (H15-C #8)

> **UI canvas pendiente**. Probar endpoint.

| # | Acción | Esperado |
|---|--------|----------|
| 11.1 | `POST /api/runtime/sf/proposal-sign` con `{ proposalId, clientId, signerEmail, signerName, signatureSvg: "<svg>...</svg>" }` | Crea `ProposalSignature` + marca propuesta como `estado=firmado`, `fechaFirma`, `firmadoPor` |
| 11.2 | Endpoint sin auth (debe ser público para que el firmante externo entre) | OK, pero valida `signerEmail` contra `proposal.contactoEmail` |
| 11.3 | Email mismatch → 403 | OK |
| 11.4 | Propuesta inexistente → 404 | OK |
| 11.5 | Verifica que `signedIp` y `signedUserAgent` se guardan para auditoría | OK |

---

## 12. Parte de horas diario obligatorio (H15-C #11)

### 12.1. Configurar requerimiento (solo admin/owner)

| # | Acción | Esperado |
|---|--------|----------|
| 12.1.1 | Como owner: `PATCH /api/runtime/sf/daily-activity { requireDaily: true, minHoursPerDay: 7, cutoffTimeHHMM: "10:00", workdays: [1,2,3,4,5], reminderEmail: true }` | Crea/actualiza `DailyActivityRequirement` |
| 12.1.2 | `GET /api/runtime/sf/daily-activity` (sin team=1) | Devuelve `config + myStatus + isWorkday` para el user actual |
| 12.1.3 | Como rol viewer/cliente → `PATCH` | 403 |

### 12.2. Banner del topbar

| # | Acción | Esperado |
|---|--------|----------|
| 12.2.1 | Inicia sesión como empleado SF en día laborable | Si no has imputado nada, banner ámbar "Te faltan 7.0 h por imputar hoy → Imputar ahora" |
| 12.2.2 | Click "Imputar ahora →" | Va a `/softwarefactory/actividades` (parte de horas) |
| 12.2.3 | Imputa horas (3.5h) y recarga | Banner ahora dice "Te faltan 3.5 h" |
| 12.2.4 | Imputa hasta llegar a 7.0h | Banner desaparece |
| 12.2.5 | Click × del banner | Banner se oculta hasta refresh |
| 12.2.6 | Como user en fin de semana | Banner NO aparece (workdays=[1..5]) |

### 12.3. Vista equipo (managers)

| # | Acción | Esperado |
|---|--------|----------|
| 12.3.1 | `GET /api/runtime/sf/daily-activity?team=1` | Devuelve `team[]` con cada empleado y sus horas hoy |
| 12.3.2 | Empleados ordenados de menos horas a más | Los que aún no imputaron al principio |

### 12.4. Cron diario

| # | Acción | Esperado |
|---|--------|----------|
| 12.4.1 | `GET /api/cron/daily-activity-check` con secret | Para cada tenant con `requireDaily=true`, escanea empleados, crea `EmployeeDailyLog`, crea `TenantNotification` warn para los incompletos |
| 12.4.2 | Verifica que `EmployeeDailyLog` se rellena para hoy | OK |
| 12.4.3 | El log tiene `completed=true` si horas ≥ minHoursPerDay | OK |

---

## 13. Webhooks externos (requieren config)

### 13.1. Email inbound CAU (H15-C #9)

> Requiere: dominio configurado con MX → Resend Inbound, env `CAU_INBOUND_SECRET`, `CauInboundMapping` registrado.

| # | Acción | Esperado |
|---|--------|----------|
| 13.1.1 | Crea mapping en `CauInboundMapping`: aliasLocal=`delca`, clienteRefId=<id cliente Delca>, defaultSeveridad=`alta` | OK |
| 13.1.2 | Simula webhook: `POST /api/webhooks/cau-inbound?secret=<secret>` body `{ to: "delca@cau.tudominio.com", from: "user@delca.es", subject: "Error en pedidos", text: "..." }` | Devuelve `ticketId` |
| 13.1.3 | Ve a `/softwarefactory/cau` | Aparece el ticket nuevo con cliente=Delca, severidad=alta |
| 13.1.4 | Sin secret → 403 | OK |
| 13.1.5 | Alias no registrado → 404 | OK |

### 13.2. GitHub webhook (H15-C #10)

> Requiere: GitHub App creada, `GithubInstallation` registrado con `webhookSecret`.

| # | Acción | Esperado |
|---|--------|----------|
| 13.2.1 | En GitHub, crea un issue con título que incluya `#TICKET-abc123` | Webhook viaja a `/api/webhooks/github` con header `X-Hub-Signature-256` |
| 13.2.2 | Sin firma válida → 401 | OK |
| 13.2.3 | Issue `opened` → debería crear un ticket CAU automático con origen=github | Verifica |
| 13.2.4 | Push con commit message "fix: bug #TICKET-abc123" → vincula al ticket | (Implementación parcial — verificar comportamiento) |

---

## 14. Backoffice administrativo

### 14.1. Clientes

| # | Acción | Esperado |
|---|--------|----------|
| 14.1.1 | Sidebar → Clientes | Listado con drawer detalle al click |
| 14.1.2 | Drawer muestra: info contacto, info adicional, acciones rápidas (ver ficha, editar, email, llamar, eliminar) | OK |
| 14.1.3 | Edita cliente, añade IBAN, forma pago default | Persisten en próximas facturas |
| 14.1.4 | Crea cliente con `tipoCliente`, `zonaComercial`, `grupo` (H8-C2..C4) | OK |
| 14.1.5 | Crea un Punto de venta del cliente (H8-C1) | Si SF lo tiene desactivado → no aplica, ignorar |
| 14.1.6 | Eliminar requiere escribir "ELIMINAR" | DangerConfirm modal |

### 14.2. Empleados

| # | Acción | Esperado |
|---|--------|----------|
| 14.2.1 | Sidebar → Empleados → "+ Nuevo" | OK |
| 14.2.2 | Rellena código corto, nombre, email, tipoContrato, fechaAlta | OK |
| 14.2.3 | Marca "estado=baja" en uno | Deja de aparecer en utilización + parte horas filtros |

### 14.3. Ajustes del tenant

| # | Acción | Esperado |
|---|--------|----------|
| 14.3.1 | Sidebar → Ajustes | Branding (color, logo), IBAN emisor, etc. |
| 14.3.2 | Ajustes-campos (DEV-CF) | Constructor de campos personalizados con drag&drop (H2-FBD) |
| 14.3.3 | Workflows (DEV-WF, H2-WF2) | Reglas con condiciones múltiples |
| 14.3.4 | Integraciones | Marketplace UI (H3-FUNC-05) |

### 14.4. Multi-empresa interna (H7-C4)

| # | Acción | Esperado |
|---|--------|----------|
| 14.4.1 | Crea una segunda Company interna | Aparece en topbar selector |
| 14.4.2 | Cambia a la segunda y crea una factura | Se emite con esos datos de empresa |
| 14.4.3 | Vuelve a la primera | Las facturas anteriores son visibles desde ambas (si así está configurado) |

---

## 15. Buscador global + atajos teclado

| # | Acción | Esperado |
|---|--------|----------|
| 15.1 | `⌘K` desde cualquier página | Focus al buscador |
| 15.2 | Teclea nombre de cliente conocido → enter | Va a `/buscar` y muestra resultados cross-módulos (CORE-04) |
| 15.3 | Tecla `?` | Abre HelpPanel |
| 15.4 | Tecla `g` luego `c` (g+letra navegación, H10-G) | Va a Clientes |
| 15.5 | `g` luego `f` | Va a Facturas |

---

## 16. Mobile / PWA

| # | Acción | Esperado |
|---|--------|----------|
| 16.1 | Abre en Chrome móvil (o DevTools modo móvil) | Sidebar colapsada con botón hamburguesa |
| 16.2 | Las páginas críticas (clientes, facturas, parte horas) son usables a 380px ancho (H6-MOBILE) | OK |
| 16.3 | Aparece prompt "Instalar Prontara" (H4-PWA-01) | OK en navegadores compatibles |
| 16.4 | Instálala y abre desde el icono | Carga sin barra de navegación, offline shell funciona |
| 16.5 | Modo offline (DevTools Network → Offline), recarga la app | Muestra una shell, no crashea |

---

## 17. Edge cases / errores

| # | Acción | Esperado |
|---|--------|----------|
| 17.1 | Navega a `/softwarefactory/no-existe` | 404 nativo Next |
| 17.2 | Estando como user SF, navega a `/dental` | Redirect al vertical correcto (`/softwarefactory`) |
| 17.3 | Endpoint sin auth: `curl https://app.prontara.com/api/erp/module?module=clientes` | 401 |
| 17.4 | Endpoint sin permiso: como rol viewer intenta `PATCH /api/runtime/sf/daily-activity` | 403 |
| 17.5 | Stripe webhook con firma inválida | 401 |
| 17.6 | Verifactu envío sin certificado | Mensaje claro, no crash |
| 17.7 | Crea factura con importe="ABC" | Validación |
| 17.8 | Botón Eliminar pide confirmación explícita | DangerConfirm modal con "ELIMINAR" |

---

## 18. Performance / observabilidad

| # | Acción | Esperado |
|---|--------|----------|
| 18.1 | Carga home `/softwarefactory` 5 veces seguidas | TTFB < 1s tras la primera |
| 18.2 | Carga listado /clientes con 1000+ rows | Paginado funciona (25 por página default), sin freeze |
| 18.3 | DevTools Console — sin errores rojos durante navegación normal | Limpio |
| 18.4 | `GET /api/health` | Status 200 con detalle de componentes (DB, Stripe, Resend, Anthropic) |
| 18.5 | `GET /api/health-light` | Status 200, latencia <50ms |
| 18.6 | Manda 100 requests a `/api/runtime/login` con email/pass inválido | Rate limit en 5-10 intentos, status 429 |

---

## 19. Cosas conocidas (NO son bugs, no las reportes)

- **UIs específicas de SF pendientes** (los endpoints SÍ funcionan):
  - `/softwarefactory/facturacion-recurrente` (gestor visual)
  - `/softwarefactory/rentabilidad` (tabla rentabilidad)
  - `/softwarefactory/equipo/utilizacion` (gráfico)
  - `/softwarefactory/proyectos/[id]/hitos` (Gantt)
  - `/softwarefactory/capacity` (capacity planning)
  - `/softwarefactory/ajustes/portal-cliente` (gestor magic-link)
  - `/softwarefactory/ajustes/cau-inbound` (alias email)
  - `/softwarefactory/ajustes/github` (instalaciones)
  - `/softwarefactory/ajustes/daily-activity` (config requirement)
- **Verifactu envío AEAT** requiere certificado A1/A3 del tenant subido y env vars VERIFACTU_*. Sin eso, fallará por mTLS.
- **SSO Google/Microsoft** requiere env vars OAuth de Vercel. Sin eso, los botones no aparecen (es comportamiento esperado, no bug).
- **Email inbound CAU** + **GitHub webhook** requieren wiring externo (DNS MX, GitHub App). Sin eso, los endpoints existen pero no entrarán requests.
- **Algunos verticales NO-SF** tienen demo data parcial — esto es esperado, el foco actual es SF.
- **5 horas este mes = 0.0** en KPI del home si nadie ha imputado horas todavía en mayo 2026 — comprueba con datos reales.

---

## 20. Tabla de severidad sugerida (orientativa)

Si encuentras esto, así de grave:

| Hallazgo | Severidad |
|----------|-----------|
| Login no funciona | **P0** |
| Crear factura/propuesta/proyecto da error 500 | **P0** |
| Verifactu firma falla con cert válido en sandbox | **P0** |
| Datos de otro tenant aparecen | **P0 + security** |
| Endpoint sin auth devuelve datos | **P0 + security** |
| Sidebar muestra módulos de otro vertical (colegio en SF) | **P1** |
| Conversión propuesta→proyecto pierde datos | **P1** |
| CAU SLA no se calcula bien | **P1** |
| Banner parte horas obligatorio no aparece cuando debe | **P1** |
| Drawer detalle no se cierra | **P2** |
| Icono mal en algún módulo de Maestros | **P2** |
| Texto en inglés que debería estar en español | **P2** |
| Color del activo en sidebar es negro en vez de azul vertical | **P2** |
| Alguien escribió "Carlos Martin" en vez de "Carlos Martín" en seed | **P3** |

---

## 21. Entregable final esperado

Un documento (sheet o markdown) con:

1. **Resumen ejecutivo** — 1 párrafo: "el vertical SF está al X%. Hay Y issues críticos, Z issues medios. La parte W es lo más débil. La parte V está pulida."
2. **Tabla de issues** con ID, severidad, título, repro, esperado, evidencia.
3. **Top 5 cosas que arreglaría primero** según impacto comercial.
4. **Top 3 features que recomienda construir antes de salir a vender más**.
5. **Riesgos arquitectónicos** que vea (deuda técnica, dependencias frágiles, falta de tests críticos).

— Final del plan.
