# Vertical Colegio — mapa de módulos vs requisitos del experto

> Generado el 7 de mayo de 2026 tras el cierre del paquete SCHOOL-01..08.
> Referencia: lista de 35 áreas funcionales de un ERP escolar completo,
> excluyendo contabilidad e integraciones externas (LMS, biometría,
> Google Workspace, pasarelas de pago, etc., que se conectarán a futuro).

## Cobertura por área del experto

Leyenda:
- ✅ Cubierto con CRUD operativo (formulario, tabla, demo data)
- 🧠 Cubierto + lógica especial específica colegio
- 🌐 Cubierto + portal específico
- ⏳ No implementado todavía / queda como capa siguiente

| # | Área | Módulo Prontara | Estado | Notas |
|---|---|---|---|---|
| 1 | Admisiones y matrícula | `crm` (Admisiones) | ✅ | CRUD + demo. Falta: firma digital, generación carta admisión |
| 2 | Gestión académica | `proyectos` (Cursos y grupos) | ✅ | CRUD + demo. Falta: promoción automática al curso siguiente |
| 3 | Calificaciones y boletines | `calificaciones` | 🧠 | CRUD + cálculo promedios ponderados + boletín PDF descargable |
| 4 | Asistencia y puntualidad | `asistencia` | 🧠 | CRUD + agregador % asistencia (últimos 7 / 30 días) |
| 5 | Gestión de estudiantes | `clientes` (Familias y alumnos) | ✅ | Custom 360 view |
| 6 | Familias y acudientes | `clientes` (familia) + `portal-familia` | 🌐 | Portal familia con sus alumnos / recibos / comunicaciones |
| 7 | Docentes y personal académico | `docentes` + `portal-docente` | 🌐 | CRUD docentes + portal con horario / planeaciones / calificaciones |
| 8 | Horarios | `horarios` | ✅ | CRUD por día/hora/aula/docente |
| 9 | Planeación curricular | `planeaciones` | ✅ | CRUD por asignatura/curso/docente/periodo |
| 10 | LMS / aula virtual | — | ⏳ | Excluido por petición (integración externa) |
| 11 | Disciplina y convivencia | `disciplina` | ✅ | CRUD con tipo (leve/grave/positivo) y medida adoptada |
| 12 | Orientación, psicología | `orientacion` | ✅ | CRUD con motivo / intervención / responsable / estado |
| 13 | Enfermería y salud | `enfermeria` | ✅ | CRUD con motivo / atención / medicación / aviso familia |
| 14 | Comunicación institucional | `comunicaciones` | ✅ | CRUD con asunto / destinatarios / canal / estado |
| 15 | Calendario y eventos | `eventos` | ✅ | CRUD con tipo / alcance / fechas |
| 16 | Transporte escolar | `transporte` | ✅ | CRUD con ruta / parada / horario / conductor |
| 17 | Comedor / cafetería | `comedor` | ✅ | CRUD con modalidad / alergias / inicio servicio |
| 18 | Biblioteca | `biblioteca` | ✅ | CRUD con título / autor / ISBN / préstamos / devolución |
| 19 | Inventario y activos | `inventario` | ✅ | CRUD con categoría / ubicación / responsable |
| 20 | Mantenimiento | `mantenimiento` | ✅ | CRUD con prioridad / responsable / estado |
| 21 | Compras internas | — | ⏳ | Pendiente como módulo separado |
| 22 | RRHH no académico | `personal` | ✅ | CRUD con puesto / contacto / fecha alta / estado |
| 23 | Seguridad y accesos | `visitantes` | ✅ | CRUD con DNI / motivo / hora entrada y salida |
| 24 | Gestión documental | `documentos` (Expedientes) | ✅ | CRUD con tipo (expediente / autorización / boletín / informe) |
| 25 | Trámites online | `tramites` | ✅ | CRUD con tipo (certificado / permiso / queja) y estado |
| 26 | Facturación, cartera y pagos | `facturacion` (Recibos) + `presupuestos` (Servicios complementarios) | 🧠 | Numeración correlativa, plantilla PDF compartida, Verifactu universal |
| 27 | Becas y descuentos | `becas` | ✅ | CRUD con tipo / porcentaje / vigencia / estado |
| 28 | Actividades extracurriculares | `actividades` | ✅ | CRUD con responsable / horario / cupo / precio |
| 29 | Salidas pedagógicas | `salidas` | ✅ | CRUD con destino / curso / fecha / coste familia / estado |
| 30 | Egresados | `egresados` | ✅ | CRUD con año egreso / etapa final / trayectoria |
| 31 | Reportes e indicadores | Dashboard runtime + `kpisVertical` colegio | 🧠 | KPIs: alumnos, cursos, % asistencia, recibos vencidos, becas activas, mantenimiento pendiente |
| 32 | Portales por perfil | `portal-docente` + `portal-familia` + `portal-estudiante` | 🌐 | 3 portales con filtrado por session.fullName |
| 33 | Seguridad, roles y auditoría | Auth + audit log + role tipo extendido | ✅ | Roles añadidos: docente, familia, estudiante (SCHOOL-07) |
| 34 | Configuración institucional | `ajustes` | ✅ | Datos del centro (razón social, CIF, dirección…) usados también por plantillas PDF y Verifactu |
| 35 | Integraciones externas | — | ⏳ | Excluidas por petición |

## Lo que es genérico al motor (sirve a TODOS los verticales)

Estos elementos viven fuera de `src/lib/verticals/colegio/` y se aprovechan en cualquier pack:

- **Numeración correlativa** (FAC/PRES/JUS) — `src/lib/persistence/sequence-counter-async.ts` (SF-01).
- **Plantilla PDF universal** para presupuesto / factura / pedido / albarán — `src/lib/saas/business-document-generator.ts` (AUDIT-06). Usada en colegio para los recibos.
- **Resolver del emisor** (datos fiscales del tenant) — `src/lib/saas/tenant-emisor-resolver.ts` (AUDIT-06).
- **Verifactu universal** — `/api/erp/verifactu-emit` con emisor del tenant (AUDIT-07). Cualquier colegio español que emita facturas lo usa.
- **Export CSV genérico** — `/api/erp/module-export?modulo=X` + componente `ModuleExportButton` enchufado por defecto en `GenericModuleRuntimePage` (SCHOOL-04). Disponible siempre en cualquier módulo.
- **Renovación 1-clic** — `/api/erp/proyecto-renovar` (SF-05). Se podría extender a renovación de matrículas en colegio.
- **Sidebar dinámico** con MODULE_ORDER + fallback genérico — `src/components/erp/tenant-sidebar.tsx` (SF-04 / SF-20).
- **Test de integridad de packs** — `src/lib/factory/__tests__/sector-pack-integrity.test.ts` (AUDIT-05). Detecta automáticamente módulos enabled sin fields.

## Lo que es específico del vertical colegio

Vive en `src/lib/verticals/colegio/`:

- `calificaciones-engine.ts` — cálculo de promedios ponderados por (alumno, asignatura, periodo).
- `boletin-generator.ts` — PDF del boletín de notas.
- `dashboard-kpis.ts` — KPIs específicos del centro educativo + agregador de asistencia.

Endpoints específicos en `/api/colegio/`:

- `GET /api/colegio/boletin-pdf?alumno=X&periodo=Y` — devuelve el PDF del boletín.

Componentes UI específicos:

- `src/components/erp/colegio-boletin-launcher.tsx` — selector alumno+periodo + botón "↓ Boletín PDF" en `/calificaciones`. Solo se renderiza si businessType=colegio.

Páginas específicas:

- `/portal-docente`, `/portal-familia`, `/portal-estudiante` — portales filtrados por sesión y rol.

## Capas pendientes (post-MVP)

Estas son funcionalidades del experto que NO están en este push y se podrían iterar después:

- **Promoción automática al curso siguiente** (área 2): bot en lote al final del curso.
- **Firma digital de documentos** (áreas 1, 11, 24): integración con FNMT u otra autoridad.
- **Compras internas** (área 21): módulo `compras` con flujo aprobación.
- **Aprobaciones multinivel** de trámites (área 25): workflow de estados con responsables.
- **App móvil familia/estudiante**: portales actuales son responsive pero no PWA todavía.
- **Mensajería interna en tiempo real** (área 14): hoy es CRUD asíncrono.
- **Validación legal de boletines** con firma del coordinador académico (área 3).

## Resumen

- **22 módulos nuevos** añadidos al pack colegio en SCHOOL-01.
- **22 páginas stub** creadas en SCHOOL-02.
- **Sidebar reorganizado** con 22 iconos y orden por área (académica → servicios → comunicación → operación → sistema) en SCHOOL-03.
- **Export CSV genérico** generalizado al motor común — beneficia a los 6 verticales en SCHOOL-04.
- **Lógica especial colegio**: cálculo de promedios + boletín PDF (SCHOOL-05) + KPIs y agregador asistencia (SCHOOL-06).
- **3 portales por perfil** (SCHOOL-07) con filtrado por sesión.
- **Roles extendidos**: docente, familia, estudiante.
- **Doc** (este archivo) + test de integridad sigue verde.

Cobertura final: **30 de las 35 áreas del experto cubiertas operativamente** en este push. Las 5 restantes están en la lista de "capas pendientes" — todas son trabajo posterior que no bloquea la operación diaria del colegio.
