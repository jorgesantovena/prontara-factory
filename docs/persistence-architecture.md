# Arquitectura de persistencia de Prontara

## Propósito

Este documento fija oficialmente la arquitectura de persistencia de Prontara para evitar mezclar estado del factory, definición de tenants, datos operativos y salidas derivadas.

Su objetivo es dejar una única referencia válida para desarrollo, mantenimiento, generación, exportación y evolución del proyecto.

---

## Decisión oficial

A partir de este momento, la arquitectura oficial de persistencia de Prontara queda definida así:

- `data/factory/active-client.json` es el **cliente activo del factory**.
- `.prontara/clients/<clientId>.json` es la **definición canónica del tenant**.
- `.prontara/data/<clientId>/*.json` contiene los **datos operativos por tenant**.
- `.prontara/exports/`, `.prontara/deployments/` y `.prontara/artifacts/` son **salidas derivadas**.
- `.prontara/current-client.txt` es **legacy** y queda permitido solo de forma **temporal** para compatibilidad.

Estas reglas mandan sobre cualquier interpretación previa o implícita.

---

## Mapa de carpetas

### Estado oficial

```text
data/
  factory/
    active-client.json

.prontara/
  clients/
    <clientId>.json
  data/
    <clientId>/
      *.json
```

### Salidas derivadas

```text
.prontara/
  exports/
  deployments/
  artifacts/
```

### Compatibilidad legacy temporal

```text
.prontara/
  current-client.txt
```

---

## Fuente de verdad por tipo de dato

### 1. Estado global del factory

**Ruta oficial:**

```text
data/factory/active-client.json
```

**Responsabilidad:**
- guardar el cliente activo del factory
- resolver sobre qué tenant se está operando en contexto factory

**Regla:**
- es el único estado global permitido del factory

---

### 2. Definición canónica del tenant

**Ruta oficial:**

```text
.prontara/clients/<clientId>.json
```

**Responsabilidad:**
- identidad del tenant
- configuración estructural
- metadatos de negocio
- branding
- módulos
- parámetros persistentes de definición

**Regla:**
- esta ruta manda sobre cualquier copia equivalente en exports, deployments, backups o artefactos

---

### 3. Datos operativos del tenant

**Ruta oficial:**

```text
.prontara/data/<clientId>/*.json
```

**Responsabilidad:**
- datos funcionales y operativos por tenant
- datos de runtime persistidos por módulo
- información usada por la aplicación para trabajar día a día

**Ejemplos observados en auditoría:**
- `ajustes.json`
- `clientes.json`
- `crm.json`
- `documentos.json`
- `facturacion.json`
- `presupuestos.json`
- `proyectos.json`

**Regla:**
- el runtime debe leer los datos operativos desde aquí, no desde exportaciones ni despliegues ya generados

---

### 4. Salidas derivadas

**Rutas derivadas:**

```text
.prontara/exports/
.prontara/deployments/
.prontara/artifacts/
```

**Responsabilidad:**
- paquetes exportados
- releases
- despliegues generados
- instalables
- zips
- builds
- trazas de salida del proceso de generación o entrega

**Regla:**
- no son fuente de verdad
- son regenerables
- pueden borrarse o reconstruirse sin redefinir la arquitectura canónica del tenant

---

### 5. Legacy temporal

**Ruta legacy:**

```text
.prontara/current-client.txt
```

**Estado:**
- permitido temporalmente solo por compatibilidad con piezas antiguas

**Regla:**
- no debe considerarse fuente de verdad
- no debe usarse como base de nuevas decisiones de arquitectura
- deberá retirarse cuando toda lectura/escritura haya migrado a `data/factory/active-client.json`

---

## Qué puede leer cada capa

### Factory

Puede leer:
- `data/factory/active-client.json`
- `.prontara/clients/<clientId>.json`

Puede leer además `.prontara/current-client.txt` solo mientras exista compatibilidad legacy todavía no retirada.

No debe tomar como fuente de verdad:
- `.prontara/exports/`
- `.prontara/deployments/`
- `.prontara/artifacts/`

---

### Runtime de tenant

Puede leer:
- `.prontara/clients/<clientId>.json` para definición estructural del tenant
- `.prontara/data/<clientId>/*.json` para datos operativos

No debe leer como fuente operativa:
- exports
- deployments
- artifacts
- backups manuales
- snapshots de corrección
- copias intermedias de release

---

### Scripts de exportación y release

Pueden leer:
- `.prontara/clients/<clientId>.json`
- `.prontara/data/<clientId>/*.json`
- `data/factory/active-client.json` si necesitan contexto del cliente activo en factory

Su salida debe terminar en:
- `.prontara/exports/`
- `.prontara/deployments/`
- `.prontara/artifacts/`

---

## Qué puede escribir cada script o capa

### Factory

Puede escribir:
- `data/factory/active-client.json`

No debe escribir definición canónica en rutas derivadas.

---

### Gestión de tenants

Puede escribir:
- `.prontara/clients/<clientId>.json`

No debe escribir la definición canónica en:
- exports
- deployments
- artifacts
como sustitución del fichero oficial de cliente.

---

### Runtime o persistencia funcional

Puede escribir:
- `.prontara/data/<clientId>/*.json`

No debe persistir datos operativos en:
- `.prontara/exports/`
- `.prontara/deployments/`
- `.prontara/artifacts/`

---

### Scripts de exportación, empaquetado y despliegue

Pueden escribir:
- `.prontara/exports/`
- `.prontara/deployments/`
- `.prontara/artifacts/`

No deben reescribir la arquitectura oficial ni redefinir la fuente de verdad.

---

## Rutas prohibidas como fuente de verdad

Las siguientes rutas quedan explícitamente prohibidas como fuente oficial de verdad arquitectónica u operativa:

```text
.prontara/exports/
.prontara/deployments/
.prontara/artifacts/
```

También quedan prohibidas como fuente oficial:
- backups de arreglos manuales
- snapshots de encoding
- json de backup
- copias intermedias de release
- metadatos empaquetados dentro de packages o deploys como sustitución del cliente canónico

Esto incluye, entre otros:
- `.prontara/backup-*`
- `.prontara/clients/backup-*`
- `.prontara/exports/*/meta/*`
- `.prontara/deployments/*/meta/*`
- `.prontara/*release*`
- `.prontara/*package*`

---

## Reglas operativas que deben quedar claras

### Regla 1

El runtime no debe usar `exports`, `deployments` ni `artifacts` como fuente de lectura operativa.

### Regla 2

`exports`, `deployments` y `artifacts` son productos derivados y regenerables.

### Regla 3

El único estado global permitido del factory es:

```text
data/factory/active-client.json
```

### Regla 4

La definición del tenant vive en:

```text
.prontara/clients/<clientId>.json
```

### Regla 5

Los datos operativos del tenant viven en:

```text
.prontara/data/<clientId>/
```

### Regla 6

`.prontara/current-client.txt` no debe considerarse fuente de verdad; solo compatibilidad legacy temporal.

---

## Plan de retirada del legacy

La retirada del legacy debe hacerse en este orden:

1. Identificar todos los scripts y rutas que todavía leen `.prontara/current-client.txt`.
2. Migrar esas lecturas a `data/factory/active-client.json`.
3. Verificar que ninguna decisión operativa dependa ya de `current-client.txt`.
4. Mantener `current-client.txt` solo como compatibilidad temporal durante transición controlada.
5. Retirarlo cuando la migración esté completa y validada.

---

## Checklist de cumplimiento

Antes de dar por válida cualquier evolución de persistencia, debe cumplirse todo esto:

- El cliente activo del factory se resuelve desde `data/factory/active-client.json`.
- La definición canónica del tenant se resuelve desde `.prontara/clients/<clientId>.json`.
- Los datos operativos se resuelven desde `.prontara/data/<clientId>/*.json`.
- Ninguna ruta derivada se usa como fuente de verdad.
- `current-client.txt` no se usa como base de nuevas piezas.
- Cualquier compatibilidad legacy está documentada como temporal.
- Factory, runtime y exportación tienen responsabilidades separadas.

---

## Notas de compatibilidad temporal

La auditoría muestra coexistencia de rutas históricas, backups, exports, deployments y snapshots de corrección. Esa coexistencia no cambia la decisión oficial anterior.

Mientras exista código legacy, puede mantenerse compatibilidad temporal con:
- `.prontara/current-client.txt`
- ciertos backups
- estructuras antiguas aún no migradas

Pero esa compatibilidad no altera la fuente de verdad oficial.

---

## Resumen ejecutivo

La persistencia oficial de Prontara queda cerrada así:

- **Factory activo:** `data/factory/active-client.json`
- **Tenant canónico:** `.prontara/clients/<clientId>.json`
- **Datos operativos:** `.prontara/data/<clientId>/*.json`
- **Salidas derivadas:** `.prontara/exports/`, `.prontara/deployments/`, `.prontara/artifacts/`
- **Legacy temporal:** `.prontara/current-client.txt`

Cualquier cambio futuro debe respetar esta arquitectura.