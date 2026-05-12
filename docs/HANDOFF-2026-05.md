# Prontara — Documento de continuidad técnica

> **Fecha**: 12 mayo 2026
> **Versión**: tras H15-C (177 tareas registradas)
> **Audiencia**: arquitecto/analista/programador que recoge el testigo
> **Autor del repo**: Jorge Santoveña Martín (CEO SISPYME S.L.) en colaboración con el equipo de Claude.

Este documento es la memoria del proyecto en estado actual. Léelo entero antes de tocar código. Las decisiones importantes están justificadas — si vas a revertir alguna, mira primero el "por qué".

---

## 1. Qué es Prontara

ERP multi-tenant SaaS para PYMES españolas pequeñas (4-20 empleados). Dos productos vivos bajo el mismo código:

| Capa | URL | Para quién |
|------|-----|-----------|
| **Factory** | `app.prontara.com/` (redirige a `/factory`) | Jorge (CEO SISPYME): provisiona tenants, ve métricas SaaS, gestiona packs sectoriales |
| **Runtime** | `app.prontara.com/{vertical}` | Clientes finales: cada uno ve el ERP de su sector |

Verticales soportados con slug URL:

| Slug | businessType (pack) |
|------|---------------------|
| `softwarefactory` | software-factory |
| `dental` | clinica-dental |
| `veterinaria` | clinica-veterinaria |
| `colegio` | colegio |
| `peluqueria` | peluqueria |
| `taller` | taller |
| `hosteleria` | hosteleria |
| `abogados` | despacho-abogados |
| `inmobiliaria` | inmobiliaria |
| `asesoria` | asesoria |
| `gimnasio` | gimnasio |

El **vertical bandera** es Software Factory — está al 95-100% (ver §13). Los demás están al 60-80%.

---

## 2. Stack

- **Next.js 16** (App Router + Turbopack + React 19)
- **TypeScript strict mode**
- **Postgres en Neon Frankfurt** + Prisma 6.19.3
- **Vercel** para deploy (web + crons + edge)
- **Resend** para email transaccional + email inbound
- **Stripe** para cobros (link de pago en facturas, suscripciones SaaS)
- **Anthropic Claude** para asistente IA, OCR de facturas, factory-chat
- **Tauri 2** wrapper desktop (opcional, no se usa en producción ahora)

Versión Node mínima: 20.

---

## 3. Organización del código

```
src/
├── app/                          ← Next App Router
│   ├── page.tsx                  → redirect a /factory
│   ├── [vertical]/               → ★ runtime de TODOS los verticales (70+ páginas)
│   │   ├── layout.tsx            → valida slug, sesión, match vertical-tenant
│   │   ├── page.tsx              → home del tenant (HomeDashboard)
│   │   ├── clientes/             → módulos genéricos
│   │   ├── facturacion/
│   │   ├── proyectos/
│   │   ├── cau/                  → CAU específico SF con timeline+SLA+KB
│   │   ├── cau/[ticketId]/       → ficha de ticket con replies + imputación horas
│   │   ├── kb/                   → Base de conocimiento CAU
│   │   └── ...                   → ~70 módulos en total
│   ├── factory/                  → Panel CEO (no se mueve a [vertical])
│   │   ├── page.tsx              → dashboard operador
│   │   ├── clientes/             → lista tenants
│   │   ├── verticales/           → gestión packs
│   │   ├── suscripciones/        → billing SaaS
│   │   ├── salud/                → health-check tenants
│   │   ├── chat/                 → factory-chat (Claude tools)
│   │   └── ...
│   ├── software-factory/         → landing comercial PÚBLICA del vertical SF
│   │   └── page.tsx              → /software-factory (NO confundir con /softwarefactory)
│   ├── portal/[token]/           → portal cliente público (H15-C #5)
│   ├── acceso/                   → login
│   ├── alta/                     → signup
│   ├── verticales/               → catálogo público de verticales
│   ├── docs/                     → docs públicas
│   └── api/                      → endpoints
│       ├── factory/              → Factory (admin)
│       ├── runtime/              → Runtime tenant
│       │   ├── login/
│       │   ├── cau/              → replies, metrics, kb
│       │   ├── sf/               → SF-específicos: convert-proposal, recurring-invoices, project-profitability, team-utilization, milestones, portal-access, proposal-sign, daily-activity
│       │   ├── verifactu/sign-and-send/
│       │   └── ...
│       ├── erp/                  → módulos genéricos
│       ├── webhooks/             → inbound (cau-inbound, github, stripe)
│       └── cron/                 → crons (cau-sla-check, recurring-invoices-run, daily-activity-check, etc.)
├── components/                   → React components (cliente)
│   ├── erp/                      → shell del runtime (sidebar, topbar, home dashboard, record editor, grid genérico)
│   ├── factory/                  → shell del panel CEO
│   └── saas/                     → componentes auth/SAAS
├── lib/                          → lógica de negocio (servidor)
│   ├── saas/                     → auth, account store, billing, vertical-slug, runtime-env, runtime-tenant-runtime-async
│   ├── factory/                  → resolución tenants, sector-pack-registry, sector-pack-definition, core-modules, dashboard, health
│   ├── verticals/                → packs específicos
│   │   ├── software-factory/     → overview, dashboard-kpis, alerts, billing-emit, operational-lists, cau-sla, verifactu-aeat-client
│   │   ├── xmldsig.ts            → firma XML-DSig
│   │   └── verifactu-aeat-client.ts
│   ├── persistence/              → adaptador DB
│   │   ├── db.ts                 → withPrisma(), getPersistenceBackend()
│   │   ├── active-client-data-store-async.ts → CRUD módulos genéricos
│   │   ├── account-store-async.ts
│   │   └── sequence-counter-async.ts
│   ├── erp/                      → motor ERP transversal
│   ├── integrations/             → PSD2, etc.
│   ├── jobs/                     → handlers async (email, etc.)
│   ├── observability/            → Sentry, OTEL, logger, error-capture
│   ├── adapters/                 → llm-anthropic, etc.
│   └── factory-chat/             → tools del chat operador
├── proxy.ts                      → ★ Next 16 middleware (era middleware.ts en Next ≤15)
│                                   - Protege /api/factory/*
│                                   - Redirige rutas viejas /<modulo> → /<vertical>/<modulo>
├── middleware.ts                 → NO existe, está en proxy.ts (renombre Next 16)
prisma/
└── schema.prisma                 → 50+ modelos. Multi-tenant: cada modelo lleva tenantId+clientId
scripts/
├── seed-demos.ts                 → crea 3 tenants demo (dental, colegio, peluqueria)
├── ts/prontara.mjs               → CLI unificada (reemplaza scripts PowerShell)
└── ...
e2e/                              → Playwright specs
docs/                             → documentación (tenant-model, persistence, vertical-pattern, etc.)
public/                           → assets estáticos
```

**Convenciones**:
- Los archivos con `-async` son la versión que funciona en Postgres. Los sync (legacy) leen filesystem JSON.
- En producción siempre `PRONTARA_PERSISTENCE=postgres`.
- Los hooks/componentes cliente llevan `"use client"`. El resto es server.
- Rutas tenant-runtime SIEMPRE dentro de `app/[vertical]/`.
- Rutas globales (factory, acceso, alta, landing, docs, status, software-factory landing, portal) fuera.

---

## 4. Multi-tenancy

**Modelo de aislamiento**: cada modelo Prisma tenant-scoped lleva `tenantId` y `clientId`.
- `tenantId` = cuid generado por Prisma (id de la tabla `Tenant`)
- `clientId` = string semántico tipo `estandar-20260419194129` (compat legacy filesystem)
- `slug` = string URL-friendly del tenant (ej. `software-factory-demo`)

**Resolución del tenant en runtime**:
1. Usuario tiene cookie `prontara_session` (HMAC firmada, ver §6).
2. Cookie incluye: `accountId, tenantId, clientId, slug, businessType, email, fullName, role, mustChangePassword`.
3. `resolveRequestTenantRuntimeAsync(request)` lee el cookie, decodifica, resuelve TenantDefinition desde DB.
4. Devuelve un objeto unificado con `tenant`, `branding`, `config`, `artifacts`.

**Aislamiento de queries**:
- TODA query a un modelo tenant-scoped DEBE filtrar por `clientId` (o `tenantId`).
- `listModuleRecordsAsync(moduleKey, clientId)` ya lo hace internamente.
- Los endpoints leen `clientId` del `session` (no del body) para evitar inyección.

**Edge cases**:
- En `filesystem` mode (solo dev local), `tenantId === clientId`.
- En `postgres`, `tenantId` es el cuid de Prisma y `clientId` mantiene compat.

---

## 5. Sistema de packs sectoriales

`src/lib/factory/sector-pack-registry.ts` contiene 11 packs. Cada pack tiene la forma `SectorPackDefinition` (ver `sector-pack-definition.ts`):

```ts
{
  key: "software-factory",
  label: "Software factory",
  sector: "tecnologia",
  businessType: "software-factory",
  description: "...",
  disabledCoreModules?: ["productos", "reservas", "tickets", ...], // ★ H15-A
  branding: { displayName, shortName, accentColor, logoHint, tone },
  labels: { clientes: "Clientes", proyectos: "Proyectos", ... },
  renameMap: { proyecto: "proyecto", documento: "entregable", ... },
  modules: [{ moduleKey, enabled, label, navigationLabel, emptyState }, ...],
  entities: [{ key, label, moduleKey, primaryFields, relatedTo }, ...],
  fields: [{ moduleKey, fieldKey, label, kind, required, ... }, ...],
  tableColumns: [{ moduleKey, fieldKey, label, isPrimary }, ...],
  dashboardPriorities: [{ key, label, description, order }, ...],
  demoData: [{ moduleKey, records: [...] }, ...],
  landing: { headline, subheadline, bullets, cta },
  assistantCopy: { welcome, suggestion },
}
```

**CORE modules** (`src/lib/factory/core-modules.ts`):
- 8 módulos universales que se inyectan a TODOS los packs automáticamente: `tareas, tickets, compras, productos, reservas, encuestas, etiquetas, plantillas`.
- Inyección en `applyCoreModulesToConfig(config, { disabledCoreModules })` desde `request-tenant-runtime-async.ts`.
- Si un vertical no quiere alguno, declara `disabledCoreModules: [...]` en su pack (ej. SF quita productos/reservas/tickets/...).

**Cómo añadir un nuevo vertical**:
1. Define el pack en `sector-pack-registry.ts`.
2. Añade el slug en `vertical-slug.ts` (`VERTICAL_SLUG_TO_BUSINESS_TYPE`).
3. El test `sector-pack-integrity.test.ts` ejecuta guardrails — pásalo.
4. Si el vertical necesita módulos nuevos (no genéricos): añadir páginas en `app/[vertical]/<modulo>/page.tsx`.

---

## 6. Auth + sesiones

**Login**: `POST /api/runtime/login` valida credenciales contra `TenantAccount` (rate-limited por IP+tenant). Soporta MFA (TOTP). Tras éxito emite cookie HMAC.

**Cookie**: nombre `prontara_session`, HTTP-only, SameSite=Lax, secure en producción, 7 días.

Payload firmado (HMAC-SHA256 con `PRONTARA_SESSION_SECRET`):
```ts
{
  accountId, tenantId, clientId, slug,
  businessType,  // ★ H13-C — necesario para el middleware
  email, fullName, role, mustChangePassword,
  issuedAt, expiresAt
}
```

**Edge runtime**: el middleware (`proxy.ts`) NO usa `auth-session.ts` (que es Node), usa `auth-session-edge.ts` (Web Crypto API). Mismo formato HMAC.

**Decisión post-login** (`acceso/page.tsx`):
1. Si la URL trae `?redirectTo=` → ahí.
2. Si no, deduce vertical del `businessType` del session → `/{verticalSlug}`.
3. Si no, fallback `/?tenant=...` → terminará en `/factory`.

**SSO Google/Microsoft** (`oauth-providers.ts`):
- Endpoints: `/api/runtime/oauth/[provider]/start` y `/callback`.
- Botones en `/acceso` aparecen cuando hay slug + env vars `*_OAUTH_CLIENT_ID/_SECRET`.
- El callback identifica cuenta por email del provider + tenantSlug en state.

**MFA TOTP** (`totp.ts`):
- Secret cifrado AES-GCM en `TenantAccountMfa.secret`.
- Verificación opcional en login si `mfa.enabled=true`.

**Roles**: `owner | admin | viewer | cliente-final | docente | estudiante | familia` (ver `account-definition.ts`). Permisos granulares en `tool-permissions.ts`.

---

## 7. URL routing (H13 refactor)

**Decisión** (12 mayo 2026): mover todas las páginas tenant-runtime bajo segmento dinámico `[vertical]`.

**Antes**:
- `app.prontara.com/clientes` → módulo del tenant logueado
- `app.prontara.com/factory` → panel CEO

**Ahora**:
- `app.prontara.com/` → redirect a `/factory`
- `app.prontara.com/softwarefactory/clientes` → módulo SF
- `app.prontara.com/dental/clientes` → módulo Dental
- ... 11 verticales

**Mecanismo de compatibilidad**:
- `proxy.ts` intercepta rutas viejas `/clientes` sin prefijo de vertical → redirect 307 a `/{userVertical}/clientes` leyendo `businessType` del cookie.
- Si no hay cookie → redirect a `/acceso?redirectTo=/clientes`.
- Si cookie es antiguo (sin `businessType`) → `/acceso?reload=1` para regenerarlo.

**Componentes/hooks clave**:
- `lib/saas/vertical-slug.ts` — mapping `slug ↔ businessType`, normalizer, `verticalLink()`
- `lib/saas/use-current-vertical.ts` — hook `useCurrentVertical()` para componentes cliente
- `app/[vertical]/layout.tsx` — valida slug, sesión, match vertical-tenant. Redirige si el usuario está en un vertical que no es el suyo.

**Excepciones**:
- `/software-factory` (con guión) → landing comercial pública SF. NO confundir con `/softwarefactory` (sin guión, ERP del tenant SF).
- `/factory/*` → panel CEO global.
- `/portal/[token]` → portal cliente público (H15-C #5).
- `/landing`, `/acceso`, `/alta`, `/verticales`, `/docs`, `/status`, `/legal` → públicas.

---

## 8. Persistencia

**Dos backends** (`getPersistenceBackend()`):
- `filesystem` — dev local. JSON en `.prontara/data/<clientId>/<moduleKey>.json`.
- `postgres` — producción. Tabla `TenantModuleRecord` con campo `data: Json`.

**Helper universal**: `lib/persistence/active-client-data-store-async.ts` — funciona en ambos backends sin que el caller sepa cuál:
```ts
listModuleRecordsAsync(moduleKey, clientId)        → Record[]
createModuleRecordAsync(moduleKey, payload, clientId) → Record
updateModuleRecordAsync(moduleKey, recordId, payload, clientId)
deleteModuleRecordAsync(moduleKey, recordId, clientId)
```

**Prisma**: usar siempre `withPrisma(async (prisma) => ...)`:
```ts
const result = await withPrisma(async (prisma) => {
  const c = prisma as unknown as { tabla: { findMany: ... } };  // workaround tipos
  return await c.tabla.findMany({ where: { clientId } });
});
// result puede ser null si filesystem mode o si falla — siempre guard.
```

**Modelos clave** (50+ en schema.prisma):

| Modelo | Para qué |
|--------|----------|
| `Tenant` | tenant master (id, slug, businessType, displayName) |
| `TenantAccount` | usuarios de un tenant |
| `TenantAccountMfa` | TOTP secret cifrado |
| `TenantModuleRecord` | datos genéricos de módulos (clientes, proyectos, facturas...) |
| `TenantNotification` | notificaciones in-app |
| `TenantSavedView` | vistas guardadas por usuario+módulo |
| `TenantRecordComment` | comentarios+menciones en cualquier registro |
| `VerifactuSubmission` | envíos a AEAT con XML+CSV cifrados |
| `TenantCertificate` | cert+key A1/A3 cifrados |
| `CauTicketReply` | conversación tickets CAU (★ H15-B) |
| `CauSlaPolicy` | política SLA por severidad+urgencia (★ H15-B) |
| `CauKbEntry` | base de conocimiento CAU (★ H15-B) |
| `RecurringInvoice` | facturación recurrente (★ H15-C) |
| `ProjectMilestone` | hitos proyecto (★ H15-C) |
| `ProposalSignature` | firma electrónica propuestas (★ H15-C) |
| `ClientPortalAccess` | magic token portal cliente (★ H15-C) |
| `CauInboundMapping` | email entrante → ticket (★ H15-C) |
| `GithubInstallation` | OAuth GitHub App (★ H15-C) |
| `DailyActivityRequirement` | config parte horas diario (★ H15-C) |
| `EmployeeDailyLog` | log diario por empleado (★ H15-C) |

---

## 9. Estado por feature

### Software Factory (vertical bandera) — 95%

| Feature | Estado | Notas |
|---------|--------|-------|
| CRM oportunidades | ✅ | Fields completos |
| Propuestas con PDF | ✅ | Plantilla común AUDIT-06 |
| Conversión propuesta → proyecto | ✅ | Endpoint `POST /api/runtime/sf/convert-proposal` (H15-C #1) |
| Proyectos + código tipo servicio + bolsa horas | ✅ | H7-S1, S4 |
| Parte de horas (actividades) | ✅ | Con desde/hasta + lugar (H7-C3) |
| Producción hub (tareas, incidencias, versiones...) | ✅ | H7-S |
| Pre-facturación 8 columnas | ✅ | H7-S2 |
| Emisión facturas correlativas | ✅ | SF-01, SF-02 |
| PDF detalle SISPYME | ✅ | H7-S3 |
| Verifactu firma XML-DSig | ✅ | H6-VERIFACTU-SIGN |
| Verifactu envío AEAT real | ⚠️ | Cliente SOAP+mTLS implementado (H14-C). Necesita cert A1/A3 + env vars del tenant |
| CAU operativo | ✅ | Timeline + SLA + KB + imputación horas (H15-B) |
| Facturación recurrente | ✅ | Endpoint + cron (H15-C #2) — falta UI gestor visual |
| Rentabilidad por proyecto | ✅ | Endpoint `/sf/project-profitability` (H15-C #3) — falta UI |
| Utilización equipo | ✅ | Endpoint `/sf/team-utilization` (H15-C #4) — falta UI |
| Portal cliente | ✅ | `/portal/[token]` público funcional (H15-C #5) |
| Hitos proyecto | ✅ | CRUD endpoint (H15-C #6) — falta UI Gantt |
| Capacity planning | ⚠️ | No empezado |
| Firma electrónica propuestas | ✅ | Endpoint + storage (H15-C #8) — falta UI canvas |
| Email inbound CAU | ✅ | Webhook listo (H15-C #9). Requiere config MX + Resend |
| Integración GitHub | ✅ | Webhook listo (H15-C #10). Requiere GitHub App |
| Parte horas diario obligatorio | ✅ | Banner topbar + cron + config (H15-C #11) |
| Demo Delca | ✅ | H7-S6 |

### Otros verticales — 60-80%

- **Dental, Veterinaria**: pack completo con fields/cols/demo. Sin features específicas (citas calendario sería siguiente).
- **Colegio**: 22 módulos académicos (docentes, calificaciones, asistencia, etc.). Engine calificaciones + boletín PDF (SCHOOL-05). Portales docente/familia/estudiante (SCHOOL-07).
- **Veterinaria**: pack base (H3-VERT-01). Sin features específicas más allá.
- **Peluquería, Taller, Hostelería, Inmobiliaria, Asesoría, Despacho-abogados, Gimnasio**: packs base con fields+cols+demo data. Ninguna feature sectorial específica.

### Core transversal — 100% sólido

- 8 módulos universales inyectados a todos los packs (tareas, tickets, compras, productos, reservas, encuestas, etiquetas, plantillas) — desactivables por pack.
- Buscador global cross-módulos (CORE-04).
- Import/export CSV genérico (SCHOOL-04, CORE-05).
- Workflow engine con aprobaciones (DEV-WF, H2-WF2, H4-WF-PRO).
- Constructor de formularios con drag&drop (H2-FBD).
- Constructor de reportes con Chart.js (DEV-REP, H2-CHART).
- Vista Kanban + Gantt + Calendario universales (H4-VIEW-*).
- i18n ES/EN/CA (H4-I18N).
- Mensajería SSE en tiempo real (H3-FUNC-04).
- Marketplace integraciones UI (H3-FUNC-05) + Webhooks Slack/Zapier (H4-INTEG-*).
- Importador Excel inteligente (H6-IMPORT).
- OCR facturas Anthropic Vision (H6-OCR).
- AI agent con tools (H6-AI-AGENT).
- WhatsApp Business API (H6-WHATSAPP).
- Modelo 303 IVA (H6-CONTAB-303).
- PSD2 cliente agregador bancario (H6-PSD2).
- Stripe pay link (H6-PAY-LINK).
- SEPA pain.008 (H8.5-SEPA).
- Sistema multi-empresa interno (H7-C4).
- Tipos cliente, zonas, grupos, tarifas con vigencia (H8-C2..C5).
- Pipeline facturación granular con albaranes + vencimientos múltiples (H8-C6, C7).
- Plan de avisos automáticos (H8-C10).
- Tipos urgencia + recargo fuera horario + desplazamientos facturables (H8-S3..S6).

### Shell / UX — 100% rediseñado en H12-H13

- Sidebar con 5 categorías (Operación, Administración, Analítica, Configuración, Maestros colapsable).
- Topbar con buscador central + ⌘K + selector sede + notif + perfil.
- Home dashboard con saludo + 4 KPIs + accesos rápidos + pendientes + notificaciones + actividad + agenda.
- Grid genérico con KPIs, vistas guardadas, filtros, bulk actions, drawer detalle.
- Editor full-page con tabs + sidebar info.
- Breadcrumbs auto-generados, keyboard shortcuts, dark mode toggle, mobile-first crítico, PWA.

### Seguridad — sólido

- HMAC sesiones (H1-SEC-*).
- Cifrado AES-GCM de secrets (MFA, Verifactu XML, certificados).
- Rate limit en endpoints sensibles.
- CSP + headers seguridad en `next.config.ts`.
- GDPR endpoints: export, anonymize, delete (H3-GDPR-01).
- Retención logs configurable (H3-GDPR-02).
- Captura errores Sentry opt-in (H1-STAB-01).
- Health check profundo (H1-STAB-02).

---

## 10. Variables de entorno

Lista completa documentada en `.env.example` (H14-A). Críticas:

| Variable | Necesaria | Para qué |
|----------|-----------|----------|
| `PRONTARA_SESSION_SECRET` | sí (prod) | HMAC cookies. ≥32 chars. |
| `DATABASE_URL` | sí en `postgres` mode | Neon connection string |
| `PRONTARA_PERSISTENCE` | sí | `filesystem \| postgres` |
| `PRONTARA_PUBLIC_BASE_URL` | sí en prod | `https://app.prontara.com` |
| `RESEND_API_KEY` | recomendado | Emails transaccionales |
| `ANTHROPIC_API_KEY` | opcional | Asistente IA, OCR, factory chat |
| `STRIPE_SECRET_KEY` | opcional | Pay link + suscripciones |
| `GOOGLE_OAUTH_CLIENT_ID/SECRET` | opcional | SSO Google |
| `MICROSOFT_OAUTH_CLIENT_ID/SECRET` | opcional | SSO Microsoft |
| `VERIFACTU_PROD` | opcional | `true` activa envío prod AEAT |
| `VERIFACTU_CERT_PASSWORD` | opcional | passphrase del cert A1 del firmante |
| `CRON_SECRET` | sí en prod | autenticación de crons internos |
| `FACTORY_OPERATOR_SECRET` | sí en prod | endpoints admin globales |
| `CAU_INBOUND_SECRET` | opcional (H15-C #9) | webhook email entrante CAU |

---

## 11. Cron jobs

Configurar en `vercel.json`:

```json
{
  "crons": [
    { "path": "/api/cron/tick",                       "schedule": "*/5 * * * *" },
    { "path": "/api/cron/reminders",                  "schedule": "0 9 * * *" },
    { "path": "/api/cron/avisos",                     "schedule": "0 9 * * *" },
    { "path": "/api/cron/process-domain-events",      "schedule": "*/10 * * * *" },
    { "path": "/api/cron/health-snapshot",            "schedule": "*/15 * * * *" },
    { "path": "/api/cron/log-cleanup",                "schedule": "0 2 * * *" },
    { "path": "/api/cron/prewarm-cache",              "schedule": "0 7 * * *" },
    { "path": "/api/cron/cau-sla-check",              "schedule": "*/15 * * * *" },
    { "path": "/api/cron/recurring-invoices-run",     "schedule": "0 6 * * *" },
    { "path": "/api/cron/daily-activity-check",       "schedule": "0 18 * * 1-5" }
  ]
}
```

Cada cron lee `CRON_SECRET` del header `X-CRON-SECRET` o `?secret=`. Vercel lo inyecta automáticamente en sus crons.

---

## 12. Tests

- **Vitest** unitarios en `src/**/__tests__/*.test.ts` — 64 tests pasando hoy.
- **Playwright E2E** en `e2e/*.spec.ts` — 2 specs (smoke + H13 routing). Corre con `pnpm exec playwright test`.
- **Test crítico**: `sector-pack-integrity.test.ts` — guardrail que valida que cada pack tiene fields+cols para los módulos enabled. Lo verás fallar si añades un módulo nuevo sin completar el pack.

Para correr todo:
```bash
pnpm exec tsc --noEmit             # typecheck
pnpm exec vitest run               # unit tests
pnpm exec playwright test          # e2e
pnpm exec eslint .                 # lint (no bloquea build, opcional)
```

---

## 13. Deploy

**Vercel** (`app.prontara.com`):
- Build automático en push a `main`.
- Env vars en dashboard Vercel.
- `next.config.ts` excluye paquetes pesados del runtime (`prisma`, `pdfkit`, etc.) — ver comentarios del archivo.
- `outputFileTracingExcludes` evita inflar funciones serverless con `node_modules/.pnpm-store`.

**Neon Postgres** Frankfurt:
- Connection string en `DATABASE_URL`.
- `pnpm exec prisma db push` después de cambios en schema (sin migraciones formales todavía).
- Backups automáticos de Neon (7 días).

**Ciclo deploy local → prod**:
```powershell
cd C:\ProntaraFactory\prontara-factory
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
pnpm exec prisma generate
pnpm exec prisma db push                # si hay cambio de schema
pnpm exec tsc --noEmit
if ($?) { pnpm exec vitest run }
if ($?) { git add -A; git commit -m "..."; git push origin main }
```

Vercel detecta el push y deploya en 2-3 min.

---

## 14. Bloqueantes / TODOs conocidos

### Crítico (antes de vender Software Factory en producción)

1. **Cert A1/A3 para Verifactu**. El cliente SOAP+mTLS está hecho (`verifactu-aeat-client.ts`). Falta:
   - Comprar cert FNMT (~14€/año).
   - Subirlo al tenant via `/ajustes/certificado`.
   - Configurar `VERIFACTU_PROD=true` + `VERIFACTU_CERT_PASSWORD` en Vercel.

2. **`vercel.json` con los crons nuevos** (sección 11). Sin esto los crons no corren.

### UI pendiente de SF (los endpoints están listos)

Cada uno necesita una página dedicada que ya solo consuma el endpoint:

- `/softwarefactory/facturacion-recurrente` — gestor visual planes recurrentes (endpoint `/api/runtime/sf/recurring-invoices`).
- `/softwarefactory/rentabilidad` — tabla de rentabilidad por proyecto.
- `/softwarefactory/equipo/utilizacion` — gráfico semanal utilización.
- `/softwarefactory/proyectos/[id]/hitos` — Gantt de hitos.
- `/softwarefactory/capacity` — capacity planning.
- `/softwarefactory/ajustes/portal-cliente` — gestor de accesos magic-link.
- `/softwarefactory/ajustes/cau-inbound` — alias email entrante.
- `/softwarefactory/ajustes/github` — instalaciones GitHub.
- `/softwarefactory/ajustes/daily-activity` — config requisito parte horas.

### Acciones del CEO offline

1. **GitHub App** — crear en https://github.com/settings/apps con webhook a `/api/webhooks/github`.
2. **Email inbound** — dominio `cau.tudominio.com` con MX a Resend Inbound, endpoint webhook a `/api/webhooks/cau-inbound`.
3. **OAuth clients Google + Microsoft** — para SSO.

### Deudas menores

- `change-password/route.ts` solo preserva `businessType` del session existente. Si en algún momento se permite cambiar de tenant manteniendo cuenta, esto fallará.
- El test `sector-pack-integrity` tiene allow-list (`SYSTEM_MODULES`) que crece con cada módulo de UI propia. Mejor sería marcar el módulo en el pack con `ownUi: true`.
- El `kb` no usa el shell genérico — tiene su propia tabla Prisma. Si añades otros módulos así, el patrón está claro pero documenta.
- 13 TODOs en código en notification dispatcher y workflows. No críticos.
- 5 verticales con `demoData` parcial (peluqueria, taller, hosteleria, inmobiliaria, asesoria). Mejorable con 2-3 horas por pack.

### Mejoras nice-to-have

- Mover de `prisma db push` a migraciones formales (`prisma migrate dev`).
- Internacionalización: ES/EN/CA hecho pero falta extraer strings hardcoded en muchos componentes.
- Test E2E del flujo crítico login → crear cliente → emitir factura.

---

## 15. Patrones / convenciones

### Naming

- Slugs: `kebab-case` (`software-factory-demo`).
- Variables JS: `camelCase`.
- Tipos: `PascalCase`.
- Constantes top-level: `SCREAMING_SNAKE`.
- Endpoint paths: kebab-case (`/api/runtime/sf/convert-proposal`).
- Files: `kebab-case.ts` o `[param].tsx` para rutas dinámicas.

### Errores

- Server: `captureError(e, { scope, tags })` en cada catch. Loguea + manda a Sentry si está configurado.
- Cliente: setea `error` state en componente, muestra banner rojo.
- API: siempre devuelve `{ ok: false, error: "msg" }` con status correcto (400/401/403/404/500).

### Tipos Prisma temporales

`withPrisma` necesita workaround de tipos hasta migrar a `prisma generate` con `dmmf`:
```ts
const c = prisma as unknown as {
  miTabla: { findMany: (a: ...) => Promise<MiTipo[]> }
};
```
Es fricción, pero permite no esperar `@prisma/client` regenerado en cada PR.

### CSS inline

Todo el código UI usa **estilos inline** (no Tailwind). Decisión arquitectónica para no depender de un compilador adicional. Hay variables CSS (`var(--fg)`, `var(--bg-card)`) en algunos sitios — son del dark mode toggle (H5-UX-01).

### Componentes cliente

`"use client"` en la primera línea. Siempre hooks `useEffect`/`useState`, nunca lógica DB directa.

---

## 16. Mapa de archivos críticos

Si tienes que entender el sistema, lee en este orden:

1. `prisma/schema.prisma` — el dato es la verdad.
2. `src/lib/saas/auth-session.ts` + `auth-session-edge.ts` — cómo se autentica.
3. `src/lib/factory/sector-pack-registry.ts` — qué tenant ve qué.
4. `src/lib/factory/core-modules.ts` — módulos universales.
5. `src/lib/saas/request-tenant-runtime-async.ts` — cómo se resuelve un tenant en cada request.
6. `src/lib/persistence/active-client-data-store-async.ts` — cómo se lee/escribe data.
7. `src/proxy.ts` — middleware Next 16 (auth Factory + redirect rutas viejas).
8. `src/lib/saas/vertical-slug.ts` — el mapping slug↔businessType.
9. `src/app/[vertical]/layout.tsx` — el guard del runtime tenant.
10. `src/components/erp/tenant-shell.tsx` + `tenant-sidebar.tsx` + `dashboard-topbar.tsx` — el shell visible.
11. `src/components/erp/generic-module-runtime-page.tsx` — el listado universal de cualquier módulo.
12. `src/components/erp/erp-record-editor.tsx` — el formulario universal full-page.

Para SF específicamente:
- `src/lib/verticals/software-factory/cau-sla.ts` — motor SLA del CAU.
- `src/lib/verticals/software-factory/verifactu-aeat-client.ts` — cliente SOAP AEAT.
- `src/lib/verticals/software-factory/operational-lists.ts` — listas focales (proyectos riesgo, propuestas estancadas, facturas vencidas).
- `src/lib/verticals/software-factory/billing-emit.ts` — emisión facturas con sequence.

---

## 17. Histórico de horizontes (177 tareas)

Si te interesa la genealogía:

| Bloque | Tareas | Descripción |
|--------|--------|-------------|
| SF-01..21 | 21 | MVP Software Factory inicial |
| AUDIT-01..07 | 7 | Auditoría + cierre packs sectoriales |
| SCHOOL-01..08 | 8 | Pack Colegio + portales + 22 módulos |
| CORE-01..06 | 6 | 8 módulos universales inyectables |
| DEV-MFA/WF/CF/REP/DEUDA | 5 | Infraestructura developer |
| H1 (8) | Seguridad + estabilidad |
| H2 (8) | Auth avanzado + plantillas + gráficos + workflows |
| H3 (12) | Arquitectura (jobs, cache, índices, CI, GDPR, multi-bodega, calendario, SSE, marketplace, vertical vet) |
| H4 (9) | PWA, workflows pro, vistas Kanban/Gantt, i18n, integrations, docs, backup, audit-view |
| H5 (8) | 4 verticales nuevos, status, alertas, dark, widgets, scale |
| H6 (11) | Verifactu firma, importer, Stripe link, recordatorios, OCR, AI agent, WhatsApp, PDF editor, mobile, modelo 303, PSD2 |
| H7 (13) | Catálogo + empleados + actividades + multi-empresa + gastos + bulk + búsqueda. Y SF específico: apps, pre-fact, PDF SISPYME, contra-bolsa, CAU básico, demo Delca |
| H8 (17) | Sedes + tipos cliente + zonas + grupos + tarifas + pipeline + vencimientos + estadística + cerrar período + avisos + contratos + urgencias + recargo + desplazamientos + SEPA |
| H9 (10) | Shell profesional (sidebar categorías, topbar, dashboard sectorial, onboarding, login estilizado, ayuda, tour) |
| H10-H11 (14) | UX interna pulida (RecordDetail tabs, drawer, vistas guardadas, comentarios/menciones, atajos, EmptyState, DangerConfirm, breadcrumbs, campos condicionales, multi-vista, densidad, aprobaciones UI) |
| H12 (7) | Rediseño completo según mockups (sidebar, topbar, home, grid genérico, editor full-page) |
| H13 (4) | Refactor URLs a `/[vertical]/[modulo]` con middleware compat |
| H14 (5) | .env.example + seed demos + Verifactu envío AEAT + Playwright routing + SSO buttons |
| H15-A | 1 | Fix redirect post-login + sidebar SF customizada (disabledCoreModules) |
| H15-B | 1 | CAU operativo (timeline, SLA, KB, imputación horas) |
| H15-C | 1 | Cerrar SF (11 features): conversión propuesta, recurrentes, rentabilidad, utilización, portal cliente, hitos, firma, email inbound, GitHub, daily activity |

---

## 18. Contactos / responsabilidades

- **Propietario producto**: Jorge Santoveña Martín — `jorge.santovena@gmail.com`
- **Empresa**: SISPYME S.L.
- **Repo GitHub**: `jorgesantovena/prontara-factory`
- **Dominio producción**: `app.prontara.com`
- **DB producción**: Neon Frankfurt (`ep-lucky-sound-alh1hdji-pooler.c-3.eu-central-1.aws.neon.tech`)

---

## 19. Cómo entrar a contribuir (15 minutos)

```bash
git clone https://github.com/jorgesantovena/prontara-factory
cd prontara-factory
pnpm install
cp .env.example .env.local
# Edita .env.local:
#   PRONTARA_SESSION_SECRET=$(openssl rand -hex 32)
#   PRONTARA_PERSISTENCE=filesystem   (o postgres con DATABASE_URL)
#   PRONTARA_PUBLIC_BASE_URL=http://localhost:3000
pnpm exec prisma generate
pnpm exec prisma db push           # si postgres
pnpm exec tsx scripts/seed-demos.ts # crea 3 demos
pnpm dev
# Abre http://localhost:3000 → Factory
# Abre http://localhost:3000/softwarefactory → ERP SF (después de login)
```

Login en `/acceso` con cualquier email creado por seed-demos. La contraseña temporal aparece en la consola del seed.

---

## 20. Pensamiento final

El proyecto está en muy buen estado para ser un solo desarrollador a tiempo no exclusivo. 177 tareas cerradas. 50+ modelos Prisma. 150+ endpoints. 90+ páginas. Multi-tenant real. 11 verticales. Verifactu firmado. SSO. PWA. i18n. Tests automatizados.

Los puntos débiles son:
- **Tests E2E escasos** — 2 specs. Hay riesgo de regresión en releases grandes.
- **Sin migraciones Prisma formales** — `db push` puede generar deuda. Migrar a `migrate dev` cuando se contrate más gente.
- **Verticales no-bandera con demo data parcial** — para vender hay que pulir 2-3 más.
- **Algunos módulos SF tienen endpoint pero falta UI específica** — H15-C cerró backend, no UI completa.

Si vas a heredar esto, mi recomendación:
1. Primero: pasa una semana leyendo `[vertical]/` + `lib/saas/` + `lib/factory/`. Es el 80% del producto.
2. Después: corre los 3 demos (`pnpm exec tsx scripts/seed-demos.ts`), navega como cada uno, entiende el flujo.
3. Cuando tengas claro el modelo, ataca las UIs pendientes de SF en orden de impacto comercial.
4. Mantén el patrón establecido — el código es razonablemente consistente, no inventes uno nuevo.

Suerte. Cualquier duda concreta sobre por qué algo está como está, mira el comentario del archivo o `git blame`.

— Final del documento.
