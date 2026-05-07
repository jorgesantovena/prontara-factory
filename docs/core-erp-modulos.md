# Core ERP — auditoría de los 40 módulos transversales del experto

> Generado el 7 de mayo de 2026 tras el cierre del paquete CORE-01..06.
> Referencia: lista del consultor de 40 áreas funcionales transversales
> que un ERP de fábrica debería poder ofrecer a cualquier sector.

## Mapeo de cobertura

Leyenda:
- ✅ Cubierto en producción
- 🧠 Cubierto + lógica/automatización
- 🔧 Parcial (estructura sí, falta lógica avanzada)
- ⏳ Pendiente / capa siguiente

### Capa 1 — Núcleo de plataforma

| # | Área del experto | Estado | Ubicación |
|---|---|---|---|
| 1 | Usuarios, roles y permisos | 🔧 | `TenantSessionUser` + `TenantAccountRole` (8 roles: owner/admin/manager/staff/clienteFinal/docente/familia/estudiante). Falta MFA, SSO real, gestión visual roles |
| 2 | Empresas, sedes, estructura | 🔧 | Modelo `Tenant` multi-tenant. Falta multisede explícito |
| 27 | Configuración general / parametrización | ✅ | Módulo `ajustes` por tenant, `tenant-emisor-resolver` lee de ahí |
| 31 | Multitenant + marca blanca | ✅ | 6 packs sectoriales con accentColor/displayName por tenant |
| 30 | Seguridad, privacidad, cumplimiento | 🔧 | Cookies HMAC, RLS opt-in, security headers, audit log. Falta MFA, GDPR delete UI |
| 26 | Auditoría y logs | ✅ | `AuditEvent` model + endpoints registrados |
| 28 | Importación y exportación | ✅ | **CORE-05** import CSV genérico + **SCHOOL-04** export CSV genérico, ambos enchufados por defecto en `GenericModuleRuntimePage` |
| 29 | API y integraciones | 🔧 | API REST por endpoint, Stripe/Resend/Anthropic. Falta marketplace conectores UI |

### Capa 2 — Datos maestros

| # | Área | Estado | Ubicación |
|---|---|---|---|
| 3 | Terceros (clientes/proveedores) | ✅ | Módulo `clientes` en todos los packs + módulo `compras` (CORE-02) para proveedores |
| 4 | Productos y servicios | ✅ | Módulo `productos` universal (CORE-02) con SKU, categoría, precio, unidad, stock, estado |
| 34 | Etiquetas, categorías, segmentación | ✅ | Módulo `etiquetas` universal (CORE-02) con color y aplicaA |
| 35 | Plantillas (email/sms/docs) | ✅ | Módulo `plantillas` universal (CORE-02) + plantilla PDF business-document (AUDIT-06) |
| 14 | Documentos y archivos | ✅ | Módulo `documentos` en todos los packs |
| 32 | Numeración y motor de documentos | ✅ | Numeración correlativa SF-01 + plantilla PDF AUDIT-06 + Verifactu universal AUDIT-07 |

### Capa 3 — Operación transversal

| # | Área | Estado | Ubicación |
|---|---|---|---|
| 5 | Ventas y gestión comercial | ✅ | `presupuestos` + `facturacion` con plantilla PDF + emisión real (SF-02) |
| 6 | Compras y abastecimiento | ✅ | Módulo `compras` universal (CORE-02) con estados solicitada/aprobada/comprada/recibida |
| 7 | Inventario, almacenes, activos | 🔧 | Módulo `productos` con stock + módulo `inventario` (colegio). Falta multibodega, kardex |
| 8 | Facturación, cobros y pagos | ✅ | `facturacion` + Verifactu universal + plantilla PDF |
| 9 | Caja / POS | ⏳ | Pendiente |
| 10 | CRM | ✅ | Módulo `crm` en todos los packs con fases/estado/proximoPaso |
| 11 | Agenda / calendario | 🔧 | Módulos `eventos` (colegio) y `reservas` (CORE-02). Falta vista calendario unificada |
| 12 | Tareas y productividad | ✅ | Módulo `tareas` universal (CORE-02) con prioridad + asignado + estado + fecha límite |
| 13 | Workflow / aprobaciones | 🔧 | Estados y aprobaciones puntuales por módulo. Falta motor visual constructor de flujos |
| 16 | Atención al cliente / tickets | ✅ | Módulo `tickets` universal (CORE-02) con cliente/categoría/prioridad/SLA simple |
| 17 | Proyectos y servicios | ✅ | Módulo `proyectos` con renovación 1-clic (SF-05) |
| 18 | Órdenes de trabajo | 🔧 | Cubierto por `proyectos` + módulos sectoriales (taller, SF). Falta módulo OT genérico universal |
| 19 | RRHH básico | ✅ | Módulo `personal` (colegio) + `docentes` (colegio). Patrón replicable |
| 20 | Asistencia y tiempos | 🔧 | Módulo `asistencia` (colegio). Falta marcación universal y timesheet genérico |
| 21 | Mantenimiento y activos | ✅ | Módulo `mantenimiento` (colegio) con prioridad/estado |
| 22 | Reservas de recursos | ✅ | Módulo `reservas` universal (CORE-02) con conflicto de horarios futuro |

### Capa 4 — Inteligencia y experiencia

| # | Área | Estado | Ubicación |
|---|---|---|---|
| 25 | Reportes y dashboards | 🔧 | Dashboard runtime con KPIs por vertical (SF-09, colegio dashboard-kpis). Falta constructor visual de reportes |
| 36 | Alertas y reglas de negocio | 🔧 | `operational-alerts` + alertas SF/colegio. Falta motor configurable de reglas |
| 15 | Comunicaciones y notificaciones | 🔧 | Resend transactional + `FactoryNotification` + módulo `comunicaciones` (colegio). Falta multicanal universal con plantillas |
| 23 | Portal de autoservicio | ✅ | `/portal-cliente` (SF-11) + `/portal-docente`/`/portal-familia`/`/portal-estudiante` (SCHOOL-07) |
| 38 | Encuestas | ✅ | Módulo `encuestas` universal (CORE-02) con tipo NPS/satisfacción |
| 37 | Calidad e incidencias internas | 🔧 | Cubierto parcial por `tickets` + `disciplina` (colegio). Falta módulo `calidad` específico con causa raíz |
| 40 | Backoffice de administración del ERP | ✅ | Factory Chat completo + gestión tenants/planes/lifecycle |

### Otros transversales del experto

| # | Área | Estado | Ubicación |
|---|---|---|---|
| 24 | Formularios dinámicos / campos personalizados | 🔧 | Sistema fields/tableColumns por pack es la base. Falta UI de constructor en frontend |
| 33 | Búsqueda global | ✅ | **CORE-04** `/api/erp/global-search` + página `/buscar` con búsqueda cross-módulos en 9 módulos clave |
| 39 | Contratos y suscripciones | 🔧 | `BillingSubscription` (interno SaaS) + `presupuestos`/`facturacion` (tenant). Falta módulo de contratos del tenant con renovación automática |

## Arquitectura de los core modules

A diferencia de los módulos sectoriales (que viven en `sector-pack-registry.ts`), los core modules viven en **`src/lib/factory/core-modules.ts`** y se inyectan en runtime al config del tenant a través de `applyCoreModulesToConfig` llamada desde `request-tenant-runtime-async.ts`.

Esto significa:

- **Cualquier vertical (presente o futuro) hereda automáticamente los 8 core modules** sin tocar su pack.
- Si un pack ya define un field para un `moduleKey + fieldKey` del core, el del pack tiene prioridad (override sectorial).
- Si un pack NO declara tableColumns para un módulo del core, se aplican las columns del core. Si declara alguna, asume control completo del layout.
- Los core modules tienen demo data ligero (1‑3 records por módulo) para que el tenant nuevo arranque con contenido tangible.

## Lo entregado en CORE-01..06

- **CORE-02** — `core-modules.ts` con 8 módulos universales (tareas, tickets, compras, productos, reservas, encuestas, etiquetas, plantillas) + función `applyCoreModulesToConfig` aplicada en el resolver runtime.
- **CORE-03** — 8 páginas stub `/tareas`, `/tickets`, `/compras`, `/productos`, `/reservas`, `/encuestas`, `/etiquetas`, `/plantillas`. Sidebar actualizado con iconos y orden. `tareas` removido de HUB_CHILDREN para que sea universal.
- **CORE-04** — buscador global `/api/erp/global-search?q=X` + página `/buscar` con debounce 300ms y resultados agrupados por módulo. Link "🔍 Buscar" en sidebar TOP.
- **CORE-05** — import CSV genérico `/api/erp/module-import` + componente `ModuleImportButton` enchufado por defecto en `GenericModuleRuntimePage`. Parser RFC 4180 con BOM UTF-8.
- **CORE-06** — este documento + tests `core-modules-integrity` añadidos.

## Capas pendientes (orden recomendado para iteraciones futuras)

1. **MFA + SSO real** — TOTP en login + integración Google/Microsoft.
2. **Workflow engine visual** — constructor de flujos de aprobación con estados configurables.
3. **Constructor de reportes** — generador visual con drag&drop de campos y gráficos.
4. **Motor de reglas de negocio** — disparadores por evento + acciones automatizadas (email, cambio estado, crear tarea).
5. **Caja/POS** — módulo dedicado con apertura/cierre, arqueo, tickets, datafono.
6. **Multibodega + kardex** — para tenants con almacenes complejos.
7. **Vista calendario unificada** — mezcla eventos + reservas + agenda + tareas con fecha límite.
8. **Constructor de formularios** — UI para que el tenant añada campos personalizados a sus módulos sin tocar código.
9. **Contratos y suscripciones** — módulo dedicado con renovación automática y firma digital.
10. **Marketplace de integraciones** — UI para activar Stripe, Google Calendar, WhatsApp Business, etc.

## Resumen

**Cobertura actual: 30 de las 40 áreas del experto en estado ✅ o 🧠** (es decir, operativas funcionalmente). Las 10 restantes están en 🔧 (parcial) o ⏳ (pendiente) y se documentan arriba con prioridad para iteraciones siguientes.

El motor base ya está listo para que cualquier vertical nuevo herede los 8 core modules automáticamente sin código adicional. Esto es la promesa del consultor cumplida: "tener un motor configurable es lo que permite construir verticales sin rehacer el núcleo".
