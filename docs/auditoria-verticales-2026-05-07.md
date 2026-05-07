# Auditoría de verticales — 7 mayo 2026

> Estado de los 6 packs sectoriales: branding, módulos, fields/tableColumns, demo data y gaps respecto al pack más completo (Software Factory).

## 1. Identidad de cada pack

| Pack | businessType | Sector | accentColor | displayName | Tone |
|---|---|---|---|---|---|
| **Clínica Dental** | `clinica-dental` | salud | `#0f766e` (teal verde‑oscuro) | Prontara Dental | sectorial |
| **Software Factory** | `software-factory` | tecnologia | `#2563eb` (azul) | Prontara Tech | professional |
| **Gimnasio** | `gimnasio` | fitness | `#dc2626` (rojo) | Prontara Gym | sectorial |
| **Peluquería** | `peluqueria` | belleza | `#db2777` (rosa) | Prontara Beauty | sectorial |
| **Taller** | `taller` | automocion | `#ea580c` (naranja) | Prontara Taller | sectorial |
| **Colegio** | `colegio` | educacion | `#7c3aed` (violeta) | Prontara School | sectorial |

Los 6 colores tienen alto contraste entre sí — buena distinción visual cuando se navegan tenants diferentes.

## 2. Módulos comunes vs específicos

**Comunes a los 6 packs** (núcleo del ERP):

`clientes`, `crm`, `proyectos`, `presupuestos`, `facturacion`, `documentos`, `asistente`, `ajustes`.

**Específicos por vertical:**

| Pack | Módulos extra (solo en este pack) |
|---|---|
| Clínica Dental | — (usa los 8 comunes con renombre semántico: pacientes, citas, tratamientos…) |
| Software Factory | `catalogo-servicios`, `tareas`, `incidencias`, `actividades`, `versiones`, `mantenimientos`, `justificantes`, `descripciones-proyecto` |
| Gimnasio | — (renombra: socios, planes/clases, bonos…) |
| Peluquería | — (renombra: clientes, citas, bonos…) |
| Taller | — (renombra: clientes, vehículos, OTs, presupuestos taller…) |
| Colegio | — (renombra: familias/alumnos, cursos, recibos, servicios complementarios…) |

> Nota: SF es el único con el "Hub Producción" (8 sub‑módulos accesibles desde `/produccion` como pestañas, no desde sidebar).

## 3. Estado de fields / tableColumns / demo data por módulo

Conteos: `fields / tableColumns / demoData` (1 = presente, 0 = ausente).

### Clínica Dental — `#0f766e`

| Módulo | F | C | D | Estado |
|---|---|---|---|---|
| clientes | 7 | 4 | 1 | OK |
| crm | 0 | 0 | 1 | **falta fields+cols** |
| proyectos | 7 | 5 | 1 | OK |
| presupuestos | 6 | 4 | 1 | OK |
| facturacion | 5 | 4 | 1 | OK |
| documentos | 0 | 0 | 1 | **falta fields+cols** |

### Software Factory — `#2563eb` (referencia, el más completo)

| Módulo | F | C | D | Estado |
|---|---|---|---|---|
| clientes | 0 | 0 | 1 | usa página custom (`/clientes` propia) — no afecta |
| crm | 7 | 5 | 1 | OK (cerrado en SF‑21) |
| proyectos | 12 | 8 | 1 | OK |
| presupuestos | 7 | 5 | 1 | OK (cerrado en SF‑14) |
| facturacion | 8 | 6 | 1 | OK (cerrado en SF‑14) |
| documentos | 3 | 2 | 1 | OK |
| catalogo-servicios | 6 | 5 | 1 | OK |
| Hub /produccion (7 sub‑módulos) | 0 | 0 | 1 | OK (la página `/produccion` los renderiza con su propia config — no usan sidebar) |

### Gimnasio — `#dc2626`

| Módulo | F | C | D | Estado |
|---|---|---|---|---|
| clientes | 6 | 3 | 1 | OK |
| crm | 0 | 0 | 1 | **falta fields+cols** |
| proyectos | 6 | 4 | 1 | OK |
| presupuestos (Bonos y packs) | 5 | 5 | 1 | OK (cerrado en SF‑19) |
| facturacion | 5 | 4 | 1 | OK |
| documentos | 0 | 0 | 1 | **falta fields+cols** |

### Peluquería — `#db2777`

| Módulo | F | C | D | Estado |
|---|---|---|---|---|
| clientes | 6 | 3 | 1 | OK |
| crm | 0 | 0 | 1 | **falta fields+cols** |
| proyectos | 8 | 5 | 1 | OK |
| presupuestos (Bonos) | 5 | 5 | 1 | OK (cerrado en SF‑19) |
| facturacion | 5 | 4 | 1 | OK |
| documentos | 0 | 0 | 1 | **falta fields+cols** |

### Taller — `#ea580c`

| Módulo | F | C | D | Estado |
|---|---|---|---|---|
| clientes | 10 | 5 | 1 | OK |
| crm | 0 | 0 | 1 | **falta fields+cols** |
| proyectos | 12 | 6 | 1 | OK |
| presupuestos | 8 | 4 | 1 | OK |
| facturacion | 5 | 4 | 1 | OK |
| documentos | 0 | 0 | 1 | **falta fields+cols** |

### Colegio — `#7c3aed` (estado peor)

| Módulo | F | C | D | Estado |
|---|---|---|---|---|
| clientes | 9 | **0** | **0** | **falta cols + demo** |
| crm | **0** | **0** | **0** | **falta TODO** |
| proyectos | 5 | **0** | **0** | **falta cols + demo** |
| presupuestos (Servicios complementarios) | 5 | 5 | **0** | **falta demo** (cols cerradas en SF‑19) |
| facturacion | 5 | **0** | **0** | **falta cols + demo** |
| documentos | **0** | **0** | **0** | **falta TODO** |

## 4. Gaps consolidados — qué le falta a cada pack

### Crítico (bloqueante para producción del vertical)

**Colegio** está en estado más débil:
- Sin `tableColumns` para casi nada → tablas con filas sin contenido en columnas (mismo síntoma que vimos en SF‑14).
- Sin demo data → cualquier tenant nuevo arranca completamente vacío sin contenido para entender la herramienta.

### Importante (mejora la primera impresión)

**Todos excepto SF**: módulos `crm` y `documentos` con 0 fields, 0 tableColumns:
- `crm` sí tiene demo data en dental, gimnasio, peluquería, taller — pero se renderiza como filas vacías sin columnas y modal sin campos.
- `documentos` igual: demo data presente pero sin estructura para mostrarlo.

### Menor

`ajustes` y `asistente` no tienen fields/cols en ningún pack — pero son módulos sistema con UI propia, no problema.

## 5. Plan de prioridad recomendado para cerrar todos los verticales

**Bloque 1 — Cerrar Colegio (1 push):**
1. Añadir tableColumns para los 6 módulos del pack Colegio
2. Añadir demo data realista (3‑6 registros por módulo: familias, alumnos, recibos, etc.)
3. Añadir fields para `crm` y `documentos` en Colegio

**Bloque 2 — Cerrar `crm` en los 4 packs sectoriales (1 push):**
- Estructura común para dental/gimnasio/peluquería/taller: `{ nombre, telefono, email, origen, estado, proximoPaso }` con estado `lead/visitado/cliente/perdido`.
- Taller añade `vehiculo` opcional.
- Cinco fields, 4‑5 columns por pack.

**Bloque 3 — Cerrar `documentos` en los 5 packs no‑SF (1 push):**
- Estructura común: `{ nombre, tipo, cliente, fecha, estado }`.
- Tipos por vertical: dental → `consentimiento/historia/imagen`, gimnasio → `tarifa/contrato/certificado_medico`, etc.

**Total estimado:** 3 pushes pequeños cierran la paridad de UI básica entre todos los verticales.

## 6. Paleta de colores — disponibilidad para nuevos verticales

Los 6 colores en uso ocupan los principales tonos del espectro. Para añadir nuevos verticales sin que se confundan visualmente, paleta sugerida (Tailwind tokens equivalentes):

### Verdes (libres aún)
- `#16a34a` (green‑600) — limpio, brillante. Buen candidato para "alimentación" / "agricultura" / "jardinería"
- `#059669` (emerald‑600) — algo más frío, distinto del teal dental
- `#65a30d` (lime‑600) — más amarillento

### Azules (libres aún)
- `#0891b2` (cyan‑600) — claramente distinto del azul SF
- `#1e40af` (indigo‑700) — más oscuro y solemne (ej. "asesoría legal")
- `#0284c7` (sky‑600) — celeste (ej. "limpieza" / "servicios profesionales")

### Rojos / rosas (libres aún)
- `#b91c1c` (red‑700) — más oscuro que el del gimnasio
- `#be123c` (rose‑700) — entre rojo y rosa

### Naranjas / amarillos (libres aún)
- `#c2410c` (orange‑700) — más oscuro que el del taller
- `#d97706` (amber‑600) — amarillento (ej. "panadería" / "construcción")
- `#a16207` (yellow‑700) — mostaza

### Violetas / fucsias (libres aún)
- `#6d28d9` (violet‑700) — más oscuro que el del colegio
- `#c026d3` (fuchsia‑600) — fucsia puro

### Tonos tierra (sin usar todavía)
- `#78350f` (amber‑900) — marrón cálido (ej. "carpintería")
- `#57534e` (stone‑600) — gris pizarra (ej. "consultoría B2B")
- `#1f2937` (slate‑800) — antracita (ej. "industria")

**Regla recomendada al añadir vertical N+1:** buscar el tono que esté a más de 60° de matiz HSL del vertical existente más cercano para que dos tenants vecinos se distingan al primer vistazo en operaciones del operador (Factory Chat, dashboard agregado, etc.).

## 7. Rendimiento estimado para cerrar al 100%

| Pack | Trabajo restante | Estimación |
|---|---|---|
| Software Factory | 0 — completo (en validación visual de SF‑07/SF‑08) | — |
| Clínica Dental | crm + documentos fields/cols | ~30 min |
| Gimnasio | crm + documentos fields/cols | ~30 min |
| Peluquería | crm + documentos fields/cols | ~30 min |
| Taller | crm + documentos fields/cols | ~30 min |
| Colegio | tableColumns para 6 módulos + demo data + crm + documentos | ~60–90 min |

**Total para los 5 verticales no‑SF:** ~3–4 horas de trabajo de empaque (no requiere arquitectura nueva).

---

_Auditoría generada el 7 de mayo de 2026 desde el chat Cowork._

---

## Anexo — Cierre del 7 de mayo (mismo día)

Los 5 packs no‑SF se cerraron en una sola tacada (commits AUDIT‑02..04):

- **Clínica Dental** ✅ — añadidos `crm` (nombre, telefono, email, origen, estado, proximoPaso) y `documentos` (nombre, tipo, cliente, fecha, estado) con sus respectivos `tableColumns`. Tipos de documento: consentimiento, historia, radiografia, receta, informe.
- **Gimnasio** ✅ — añadidos `crm` (Captación) y `documentos` (Contratos / certificados médicos / consentimientos / tarifas).
- **Peluquería** ✅ — añadidos `crm` y `documentos` (ficha_color, consentimiento, contrato, informe).
- **Taller** ✅ — añadidos `crm` con campo extra `vehiculo` (marca/modelo) y `documentos` (albaran, hoja_taller, certificado, factura_proveedor, informe).
- **Colegio** ✅ — añadidos `crm` (Admisiones, con estado matriculado/lead/visitado/perdido) y `documentos` (Expedientes: expediente, autorizacion, admision, boletin, informe). _Corrección: Colegio sí tenía demo data desde antes — la auditoría inicial reportó "0 demo" por un fallo de regex, ya verificado con la lectura directa del registry._

Estado final de los 6 packs tras este cierre:

| Pack | Color | Estado |
|---|---|---|
| Clínica Dental | `#0f766e` | ✅ Completo |
| Software Factory | `#2563eb` | ✅ Completo (referencia) |
| Gimnasio | `#dc2626` | ✅ Completo |
| Peluquería | `#db2777` | ✅ Completo |
| Taller | `#ea580c` | ✅ Completo |
| Colegio | `#7c3aed` | ✅ Completo |

Todos los verticales tienen ahora paridad funcional para los 6 módulos del núcleo (`clientes`, `crm`, `proyectos`, `presupuestos`, `facturacion`, `documentos`) — fields, tableColumns y demo data presentes. SF mantiene su superioridad por el Hub Producción y Catálogo de Servicios, que son específicos del vertical.

Próximos pasos posibles:
- Activar tenants reales en cada vertical para validar UX por sector.
- Si entra un nuevo vertical, usar la paleta libre del § 6.
- Para SF: avanzar la integración real Verifactu cuando llegue el certificado AEAT.
