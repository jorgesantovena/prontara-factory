# Modelo de tenant de Prontara

## Propósito

Este documento fija oficialmente el modelo de tenant de Prontara para separar con claridad:

- identidad y configuración estructural del tenant
- datos operativos vivos del ERP
- rutas derivadas de exportación, deployment y artifacts

El objetivo es evitar que `.prontara/clients/<clientId>.json` se use como una base de datos mezclada.

---

## Decisión oficial

A partir de este momento, el modelo oficial queda dividido en dos capas:

1. `.prontara/clients/<clientId>.json`
   - contiene la definición canónica y estructural del tenant
   - no debe almacenar datos operativos vivos del ERP

2. `.prontara/data/<clientId>/*.json`
   - contiene los datos de negocio y operación diaria del tenant
   - es la capa de persistencia operativa del ERP

---

## Contrato formal de `.prontara/clients/<clientId>.json`

### Naturaleza

Este archivo representa la definición canónica del tenant.

Debe entenderse como configuración estructural, no como base de datos operativa.

### Campos esperados

El contrato de este archivo debe contener únicamente información de este tipo:

- `clientId`
- `businessType`
- `displayName`
- `branding`
- `modules`
- `blueprintVersion`
- `createdAt`
- `updatedAt`
- metadatos de provisioning
- metadatos de generación
- metadatos técnicos de packaging o release si forman parte de la definición estructural del tenant

### Permitido

Se permite guardar aquí información como:

- identidad del tenant
- tipo de negocio
- branding
- módulos habilitados
- versión del blueprint
- timestamps estructurales
- estado de provisioning
- estado de generación
- referencias técnicas de release si son descriptivas y no datos vivos de negocio

### Prohibido

No debe guardar aquí datos operativos vivos del ERP, por ejemplo:

- registros de clientes del negocio
- pipeline comercial vivo
- documentos operativos diarios
- facturas operativas
- presupuestos operativos
- proyectos operativos
- tareas operativas
- movimientos de tesorería
- historiales que realmente pertenezcan a la operación diaria del ERP

### Regla práctica

Si el dato cambia por el uso diario del ERP, no pertenece a `.prontara/clients/<clientId>.json`.

Si el dato define al tenant como estructura, sí pertenece aquí.

---

## Contrato formal de `.prontara/data/<clientId>/*.json`

### Naturaleza

Esta carpeta contiene la persistencia operativa del tenant.

Aquí viven los datos de negocio y funcionamiento diario del ERP.

### Archivos esperables

Ejemplos típicos:

- `clientes.json`
- `crm.json`
- `documentos.json`
- `facturacion.json`
- `presupuestos.json`
- `proyectos.json`
- `tareas.json`
- `tesoreria.json`
- otros ficheros equivalentes según módulos habilitados

### Contenido esperado

Aquí viven, entre otros:

- clientes
- oportunidades
- documentos
- facturas
- presupuestos
- proyectos
- tareas
- cobros
- pagos
- datos operativos de ajustes funcionales del ERP
- cualquier otra información viva de negocio

### Regla práctica

Si el dato cambia porque el usuario opera el ERP, debe vivir en `.prontara/data/<clientId>/`.

---

## Separación oficial de responsabilidades

### `.prontara/clients/<clientId>.json`

Responsable de:

- identidad del tenant
- configuración estructural
- branding
- módulos
- metadatos de provisioning
- metadatos de generación
- metadatos técnicos estructurales

### `.prontara/data/<clientId>/*.json`

Responsable de:

- persistencia operativa del ERP
- datos de negocio vivos
- estado funcional diario
- información generada por el uso del tenant

### `.prontara/exports/`, `.prontara/deployments/`, `.prontara/artifacts/`

Responsables de:

- salidas derivadas
- paquetes
- releases
- binarios
- despliegues
- exportables regenerables

No son fuente de verdad operativa.

---

## Helper único de contexto tenant

A nivel de código, el acceso al tenant debe unificarse mediante un helper único en:

`src/lib/factory/tenant-context.ts`

Ese helper debe centralizar al menos estas funciones:

- `resolveTenantContext()`
- `getTenantDefinition(clientId)`
- `getTenantDataRoot(clientId)`

### Resultado esperado del contexto

El contexto resuelto debe ofrecer una estructura coherente como esta:

- `clientId`
- definición del tenant
- ruta de datos
- ruta de artifacts
- ruta de exports
- ruta de deployments

El objetivo es que runtime y factory trabajen con una misma noción de tenant.

---

## Reglas de uso

### Runtime

Puede leer:

- definición estructural del tenant
- datos operativos del tenant

No debe usar como fuente de verdad:

- exports
- deployments
- artifacts

### Factory

Puede leer y escribir:

- `data/factory/active-client.json`
- `.prontara/clients/<clientId>.json`
- rutas estructurales de tenant
- metadatos de generación, packaging o provisioning

### Scripts operativos del ERP

Deben leer y escribir:

- `.prontara/data/<clientId>/*.json`

### Scripts de export y deployment

Deben producir salidas en:

- `.prontara/exports/`
- `.prontara/deployments/`
- `.prontara/artifacts/`

pero sin convertir esas salidas en fuente de verdad.

---

## Checklist de cumplimiento

- La definición estructural del tenant vive en `.prontara/clients/<clientId>.json`.
- Los datos operativos viven en `.prontara/data/<clientId>/*.json`.
- El JSON del tenant no se usa como base de datos mezclada.
- Runtime y factory pueden resolver un contexto común de tenant.
- Exports, deployments y artifacts siguen siendo derivados.
- La arquitectura separa identidad/configuración de operación diaria.

---

## Resumen ejecutivo

El tenant de Prontara queda formalmente dividido en dos capas:

1. `.prontara/clients/<clientId>.json` para definición estructural.
2. `.prontara/data/<clientId>/*.json` para operación diaria.

Con esto, el proyecto deja de mezclar configuración del tenant con datos vivos del ERP y gana una base limpia para runtime, factory, generación y despliegue.