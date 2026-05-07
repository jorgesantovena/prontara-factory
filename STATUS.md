# Prontara Factory — STATUS

> Snapshot del estado real al **7 de mayo de 2026** tras el bloque DEV-MFA / DEV-WF / DEV-CF / DEV-REP.

## Producción

- `https://app.prontara.com` — operativo, `overall: ok` en `/api/health`.
- 44+ tenants en Postgres (Neon Frankfurt).
- 6 verticales completos: clínica dental, software factory, gimnasio, peluquería, taller, colegio.
- 8 módulos transversales del CORE inyectados en todos los packs (tareas, tickets, compras, productos, reservas, encuestas, etiquetas, plantillas).

## Lo que tiene Prontara hoy

### Núcleo común (8 módulos)
clientes · crm · proyectos · presupuestos · facturacion · documentos · asistente · ajustes.

### Transversales del CORE (8 módulos)
tareas · tickets · compras · productos · reservas · encuestas · etiquetas · plantillas.

### Funcionalidades en cada módulo (gratis siempre)
CRUD, modal con campos del pack, tabla con columnas, **↑ Importar CSV**, **↓ Exportar CSV**, búsqueda local. En facturación además: **↓ PDF** (plantilla universal con datos del tenant), **Verifactu** (preparación XML AEAT).

### Específico Software Factory
Numeración correlativa, emisión real desde actividades, export mensual, renovación 1‑clic, bolsa de horas con saldo, KPIs, hub `/produccion` con 8 tabs, justificantes con PDF firmable, portal cliente.

### Específico Colegio
Calificaciones engine + boletín PDF, agregador asistencia, KPIs, 22 módulos sectoriales adicionales, 3 portales (docente/familia/estudiante).

### Plataforma
Buscador global cross-módulos (`/buscar`), sidebar dinámico, plantilla PDF universal, resolver de emisor del tenant, auth HMAC + scrypt, **MFA TOTP opcional** (`/ajustes-cuenta`), audit log, RLS opt‑in.

### Configurabilidad por el operador (DEV-MFA/WF/CF/REP)
- **MFA** activable por cuenta — código TOTP en login si está activo.
- **Workflow rules** — automatizaciones tipo "cuando X cambie a estado Y, hacer Z" (`/workflows`).
- **Custom fields** — añadir campos a cualquier módulo sin tocar código (`/ajustes-campos`).
- **Reportes** — constructor con filtros + agrupación, tabla + groups (`/reportes`).

### Roles disponibles
owner · admin · manager · staff · clienteFinal · docente · familia · estudiante.

## Estado de las 40 áreas del consultor del CORE

30/40 cubiertas operativamente (✅ o 🧠). Tras DEV-MFA/WF/CF/REP avanzamos:

- MFA → ✅ (era 🔧)
- Workflow engine → 🧠 MVP (acciones: notify / createTask / setEstado)
- Constructor de formularios → ✅ (custom fields per-tenant)
- Constructor de reportes → ✅ MVP (filtros + agrupación, sin gráficos todavía)

Quedan en pendiente / capa siguiente:
- SSO real (Google/Microsoft/SAML)
- Workflow engine VISUAL completo con paralelismo + aprobaciones multinivel
- Caja/POS dedicado
- Multibodega + kardex
- Vista calendario unificada (eventos+reservas+tareas)
- Mensajería interna en tiempo real
- Marketplace de integraciones (UI)
- App móvil PWA
- Constructor visual de formularios (drag&drop) — hoy CRUD manual
- Gráficos en reportes (Chart.js)

## Infra externa conectada

- Stripe live (suscripción Prontara) + webhook firmado
- Resend (DNS validados)
- Anthropic tier 1 (mantenido a propósito)
- GitHub Git Data API (chat → PR → Vercel auto-deploy)
- Verifactu/AEAT (preparación XML universal — falta firma + envío real con certificado del tenant)

## Pendientes legales / operativos

- **Verifactu real**: 5 pasos en `docs/verifactu-pendientes.md`. Bloqueante legal para emitir facturas en España.
- **Migración SISPYME real**: encargado a otra persona externa (Jorge en este chat, fecha 7 mayo).

## Cómo trabajar con Jorge (no negociable)

1. Bloques copia‑y‑pega completos para PowerShell. Sin placeholders. Una sola línea cuando se pueda.
2. No pedir secretos en chat (URLs / keys / passwords completos).
3. Lenguaje natural en producto, sin jerga técnica visible al usuario.
4. No usar el chat de producción para tareas grandes (tier 1, se rinde).
5. Verificar antes de proponer.
6. Tienes file tools (Read/Write/Edit) y bash sandbox. Pero `pnpm tsc/build/dev` los corre Jorge en local.

## Archivos clave

- `docs/vertical-pattern.md` — patrón para añadir verticales (15 secciones).
- `docs/colegio-modulos.md` — 35 áreas del experto vs Prontara Colegio.
- `docs/core-erp-modulos.md` — 40 áreas del experto vs CORE Prontara.
- `docs/auditoria-verticales-2026-05-07.md` — gaps por pack y colores.
- `docs/verifactu-pendientes.md` — checklist Verifactu real.
- `src/lib/factory/core-modules.ts` — 8 módulos universales del CORE.
- `src/lib/factory/sector-pack-registry.ts` — 6 packs sectoriales.
- `src/lib/factory/__tests__/sector-pack-integrity.test.ts` — 12 invariantes que blindan futuros packs.
- `prisma/schema.prisma` — modelos: Tenant, TenantAccount, BillingSubscription, TenantModuleRecord, TenantSequenceCounter, TenantAccountMfa (DEV-MFA), WorkflowRule (DEV-WF), TenantCustomField (DEV-CF), TenantReport (DEV-REP), VerifactuSubmission (SF-12), AuditEvent, FactoryNotification, etc.

## Próximo

Lo que recomienda este chat: validar con datos reales (SISPYME) y cerrar Verifactu real ANTES de seguir añadiendo features. Jorge tiene ambos en marcha con otra persona.
