param(
  [Parameter(Mandatory = $true)]
  [string]$ClientId
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-SectorModuleActions([string]$moduleKey, [string]$businessType = "general") {
  switch ($businessType) {
    "clinica-dental" {
      switch ($moduleKey) {
        "clientes" { return @("Nuevo paciente","Buscar historial","Ver revisiones","Abrir ficha") }
        "citas" { return @("Nueva cita","Reprogramar","Confirmar asistencia","Ver agenda") }
        "ventas" { return @("Registrar tratamiento","Crear presupuesto","Cerrar tratamiento","Ver detalle") }
        "facturacion" { return @("Emitir factura","Registrar cobro","Revisar impagos","Exportar") }
        "documentos" { return @("Subir consentimiento","Adjuntar radiografia","Descargar informe","Ver detalle") }
        "ajustes" { return @("Configurar agenda","Editar IVA","Cambiar plantilla","Guardar ajustes") }
      }
    }

    "gimnasio" {
      switch ($moduleKey) {
        "clientes" { return @("Alta de socio","Ver renovaciones","Actualizar ficha","Buscar socio") }
        "ventas" { return @("Cobrar cuota","Vender bono","Registrar servicio","Ver detalle") }
        "facturacion" { return @("Emitir recibo","Registrar cobro","Revisar impagos","Exportar") }
        "documentos" { return @("Subir alta","Firmar consentimiento","Descargar documento","Ver detalle") }
        "ajustes" { return @("Editar aforo","Cambiar cuotas","Configurar clases","Guardar ajustes") }
      }
    }

    "peluqueria" {
      switch ($moduleKey) {
        "clientes" { return @("Nueva clienta","Buscar ficha","Ver historial","Abrir detalle") }
        "ventas" { return @("Registrar servicio","Crear reserva","Cerrar ticket","Ver detalle") }
        "facturacion" { return @("Cobrar ticket","Cerrar caja","Emitir factura","Exportar") }
        "documentos" { return @("Subir ficha","Lanzar promo","Descargar documento","Ver detalle") }
        "ajustes" { return @("Editar agenda","Cambiar duraciones","Actualizar precios","Guardar ajustes") }
      }
    }

    "software-factory" {
      switch ($moduleKey) {
        "clientes" { return @("Nueva cuenta","Actualizar estado","Ver detalle","Buscar cuenta") }
        "crm" { return @("Nueva oportunidad","Registrar follow-up","Mover etapa","Ver pipeline") }
        "presupuestos" { return @("Crear propuesta","Duplicar propuesta","Enviar al cliente","Ver detalle") }
        "proyectos" { return @("Abrir proyecto","Actualizar estado","Revisar margen","Ver detalle") }
        "timesheets" { return @("Imputar horas","Revisar semana","Exportar horas","Ver detalle") }
        "planificacion_recursos" { return @("Asignar recurso","Mover carga","Revisar disponibilidad","Ver detalle") }
        "facturacion" { return @("Emitir factura","Registrar cobro","Revisar vencimientos","Exportar") }
        "finanzas" { return @("Nuevo movimiento","Conciliar","Ver tesoreria","Exportar") }
        "rrhh" { return @("Alta empleado","Registrar incidencia","Ver disponibilidad","Abrir ficha") }
        "documentos" { return @("Subir contrato","Adjuntar propuesta","Compartir documento","Ver detalle") }
        "ajustes" { return @("Cambiar modelo","Editar reporting","Configurar plantillas","Guardar ajustes") }
      }
    }
  }

  switch ($moduleKey) {
    "clientes" { return @("Nuevo registro","Filtrar y buscar","Exportar","Ver detalle") }
    "ventas" { return @("Nuevo registro","Filtrar y buscar","Exportar","Ver detalle") }
    "facturacion" { return @("Nuevo registro","Filtrar y buscar","Exportar","Ver detalle") }
    "documentos" { return @("Nuevo registro","Filtrar y buscar","Exportar","Ver detalle") }
    default { return @("Nuevo registro","Filtrar y buscar","Exportar","Ver detalle") }
  }
}

function Get-SectorDashboardHeroSubtitle([string]$businessType = "general") {
  switch ($businessType) {
    "clinica-dental" { return "ERP orientado a operativa de clinica, agenda, pacientes, documentacion y cobros." }
    "gimnasio" { return "ERP orientado a socios, cuotas, servicios, cobros y seguimiento diario del centro." }
    "peluqueria" { return "ERP orientado a clientes, agenda, servicios, caja diaria y fidelizacion." }
    "software-factory" { return "ERP orientado a cuentas, oportunidades, proyectos, horas, equipo y facturacion." }
    default { return "ERP generado por Prontara Factory y adaptado a la operativa principal del negocio." }
  }
}

function Get-SectorAssistantWelcome([string]$businessType = "general") {
  switch ($businessType) {
    "clinica-dental" { return "Hola. Soy el asistente interno de esta clinica. Puedes preguntarme por pacientes, agenda, tratamientos, cobros o documentacion." }
    "gimnasio" { return "Hola. Soy el asistente interno de este gimnasio. Puedes preguntarme por socios, cuotas, clases, cobros o capacidad operativa." }
    "peluqueria" { return "Hola. Soy el asistente interno de esta peluqueria. Puedes preguntarme por clientes, agenda, servicios, caja o promociones." }
    "software-factory" { return "Hola. Soy el asistente interno de esta software factory. Puedes preguntarme por cuentas, pipeline, proyectos, horas, equipo o facturacion." }
    default { return "Hola. Soy el asistente interno de este ERP. Puedes preguntarme por modulos, flujo principal, sector o KPIs." }
  }
}

function Get-SectorAssistantKpiHint([string]$businessType = "general") {
  switch ($businessType) {
    "clinica-dental" { return "citas del dia, pendientes de cobro, revisiones proximas y facturacion diaria" }
    "gimnasio" { return "socios activos, renovaciones, clases del dia y cobros pendientes" }
    "peluqueria" { return "citas del dia, caja diaria, ticket medio y huecos libres" }
    "software-factory" { return "pipeline comercial, horas imputadas, margen por proyecto y cobros pendientes" }
    default { return "pipeline, horas, utilizacion, margen, facturacion y cobros pendientes" }
  }
}

function Get-SectorAssistantScopeHint([string]$businessType = "general") {
  switch ($businessType) {
    "clinica-dental" { return "pacientes, agenda, documentacion, cobros y estructura general de la clinica" }
    "gimnasio" { return "socios, cuotas, clases, cobros y estructura general del gimnasio" }
    "peluqueria" { return "clientes, agenda, servicios, caja y estructura general del salon" }
    "software-factory" { return "cuentas, pipeline, proyectos, horas, equipo y estructura general del negocio" }
    default { return "modulos, flujo principal, sector, reporting y estructura general de este ERP" }
  }
}

function Get-SectorAssistantSuggestions([string]$businessType = "general") {
  switch ($businessType) {
    "clinica-dental" { return @("Que citas tengo hoy","Que modulos tiene esta clinica","Que indicadores debo vigilar","Como esta el seguimiento de pacientes") }
    "gimnasio" { return @("Cuantos socios activos hay","Que cobros estan pendientes","Que indicadores debo vigilar","Como va la actividad del centro") }
    "peluqueria" { return @("Cuantas citas hay hoy","Como va la caja del dia","Que indicadores debo vigilar","Que servicios se venden mas") }
    "software-factory" { return @("Que pipeline comercial tengo","Como van los proyectos","Que indicadores debo vigilar","Como esta la carga del equipo") }
    default { return @("Que modulos tiene este ERP","Cual es el flujo principal","Que KPIs debo mirar","De que sector es este ERP") }
  }
}

function Resolve-SectorizedModuleLabel([string]$moduleKey, [string]$sector, $renameMap, [string]$businessType = "general") {
  if ($null -ne $renameMap) {
    if ($renameMap.PSObject.Properties.Name -contains $moduleKey) {
      return [string]$renameMap.$moduleKey
    }
    if ($renameMap.ContainsKey($moduleKey)) {
      return [string]$renameMap[$moduleKey]
    }
  }

  switch ($businessType) {
    "clinica-dental" {
      switch ($moduleKey) {
        "clientes" { return "Pacientes" }
        "ventas" { return "Tratamientos" }
        "facturacion" { return "Facturacion" }
        "documentos" { return "Documentacion clinica" }
        "citas" { return "Agenda de citas" }
        default { }
      }
    }

    "gimnasio" {
      switch ($moduleKey) {
        "clientes" { return "Socios" }
        "ventas" { return "Cuotas y servicios" }
        "facturacion" { return "Cobros" }
        "documentos" { return "Documentacion" }
        default { }
      }
    }

    "peluqueria" {
      switch ($moduleKey) {
        "clientes" { return "Clientes" }
        "ventas" { return "Servicios" }
        "facturacion" { return "Caja y tickets" }
        "documentos" { return "Fichas y promos" }
        default { }
      }
    }

    "software-factory" {
      switch ($moduleKey) {
        "clientes" { return "Cuentas" }
        "crm" { return "Oportunidades" }
        "presupuestos" { return "Propuestas" }
        "proyectos" { return "Proyectos" }
        "timesheets" { return "Horas imputadas" }
        "planificacion_recursos" { return "Planificacion" }
        "facturacion" { return "Facturacion" }
        "finanzas" { return "Finanzas" }
        "rrhh" { return "Equipo" }
        "documentos" { return "Documentos" }
        default { }
      }
    }
  }

  return (Label-ForModule $moduleKey $sector $renameMap)
}

function Resolve-SectorizedModuleDescription([string]$moduleKey, [string]$sector, [string]$businessType = "general") {
  switch ($businessType) {
    "clinica-dental" {
      switch ($moduleKey) {
        "clientes" { return "Gestion de pacientes, historial administrativo y seguimiento." }
        "citas" { return "Agenda de revisiones, tratamientos y coordinacion de gabinete." }
        "ventas" { return "Seguimiento de tratamientos, presupuestos aceptados y cierres." }
        "facturacion" { return "Cobros, facturas y control de pagos pendientes." }
        "documentos" { return "Consentimientos, radiografias y documentacion del paciente." }
        "ajustes" { return "Configuracion operativa de la clinica y parametros base." }
      }
    }

    "gimnasio" {
      switch ($moduleKey) {
        "clientes" { return "Gestion de socios, leads y renovaciones." }
        "ventas" { return "Cuotas, bonos, entrenamiento personal y extras." }
        "facturacion" { return "Cobros recurrentes y seguimiento de impagos." }
        "documentos" { return "Altas, consentimientos y documentacion general." }
        "ajustes" { return "Parametros del centro, aforo y reglas de operacion." }
      }
    }

    "peluqueria" {
      switch ($moduleKey) {
        "clientes" { return "Base de clientes, historial y fidelizacion." }
        "ventas" { return "Servicios realizados, reservas y ticket medio." }
        "facturacion" { return "Caja diaria, tickets y control de cobros." }
        "documentos" { return "Fichas, promociones y materiales de apoyo." }
        "ajustes" { return "Configuracion de agenda, recursos y duraciones." }
      }
    }

    "software-factory" {
      switch ($moduleKey) {
        "clientes" { return "Cuentas activas, leads y seguimiento comercial." }
        "crm" { return "Pipeline comercial y proximos pasos de venta." }
        "presupuestos" { return "Propuestas economicas y alcance de proyectos." }
        "proyectos" { return "Entrega, margen, estado y seguimiento por cliente." }
        "timesheets" { return "Horas imputadas, facturables e internas." }
        "planificacion_recursos" { return "Carga del equipo y disponibilidad." }
        "facturacion" { return "Facturacion emitida y cobros pendientes." }
        "finanzas" { return "Ingresos, gastos y visibilidad economica." }
        "rrhh" { return "Equipo, situacion y observaciones operativas." }
        "documentos" { return "Contratos, propuestas y material del cliente." }
        "ajustes" { return "Parametros del negocio, reporting y facturacion." }
      }
    }
  }

  return (Description-ForModule $moduleKey $sector)
}

function Get-KpiCardsSectorized([array]$modules, [array]$reportingNeeds, [string]$businessType = "general") {
  switch ($businessType) {
    "clinica-dental" {
      return @(
        [pscustomobject]@{ Title = "Citas hoy"; Value = "14"; Note = "2 huecos libres" },
        [pscustomobject]@{ Title = "Pendientes cobro"; Value = "1.025 EUR"; Note = "6 tratamientos" },
        [pscustomobject]@{ Title = "Revisiones proximas"; Value = "9"; Note = "Siguientes 7 dias" },
        [pscustomobject]@{ Title = "Facturacion dia"; Value = "1.480 EUR"; Note = "Ritmo correcto" }
      )
    }

    "gimnasio" {
      return @(
        [pscustomobject]@{ Title = "Socios activos"; Value = "184"; Note = "12 altas este mes" },
        [pscustomobject]@{ Title = "Cobros pendientes"; Value = "890 EUR"; Note = "18 cuotas" },
        [pscustomobject]@{ Title = "Clases hoy"; Value = "11"; Note = "Aforo estable" },
        [pscustomobject]@{ Title = "Renovaciones"; Value = "24"; Note = "Semana actual" }
      )
    }

    "peluqueria" {
      return @(
        [pscustomobject]@{ Title = "Citas hoy"; Value = "19"; Note = "3 coloraciones" },
        [pscustomobject]@{ Title = "Caja dia"; Value = "742 EUR"; Note = "Buen ritmo" },
        [pscustomobject]@{ Title = "Ticket medio"; Value = "39 EUR"; Note = "Sube vs ayer" },
        [pscustomobject]@{ Title = "Huecos libres"; Value = "4"; Note = "Tarde" }
      )
    }

    "software-factory" {
      return @(
        [pscustomobject]@{ Title = "Pipeline"; Value = "48k EUR"; Note = "4 oportunidades activas" },
        [pscustomobject]@{ Title = "Horas imputadas"; Value = "312 h"; Note = "86pct facturables" },
        [pscustomobject]@{ Title = "Margen proyecto"; Value = "22pct"; Note = "Alpha lidera" },
        [pscustomobject]@{ Title = "Cobros pendientes"; Value = "7.800 EUR"; Note = "3 facturas abiertas" }
      )
    }
  }

  return @(Get-KpiCards $modules $reportingNeeds)
}

function Get-TableColumnsSectorized([string]$moduleKey, [string]$businessType = "general") {
  switch ($businessType) {
    "clinica-dental" {
      switch ($moduleKey) {
        "clientes" { return @("Paciente","Estado","Ultima visita","Proxima revision") }
        "citas" { return @("Paciente","Profesional","Fecha","Estado") }
        "ventas" { return @("Tratamiento","Paciente","Importe","Estado") }
        "facturacion" { return @("Factura","Paciente","Importe","Estado") }
        "documentos" { return @("Documento","Paciente","Tipo","Estado") }
      }
    }

    "gimnasio" {
      switch ($moduleKey) {
        "clientes" { return @("Socio","Plan","Estado","Renovacion") }
        "ventas" { return @("Concepto","Socio","Importe","Estado") }
        "facturacion" { return @("Recibo","Socio","Importe","Estado") }
        "documentos" { return @("Documento","Socio","Tipo","Estado") }
      }
    }

    "peluqueria" {
      switch ($moduleKey) {
        "clientes" { return @("Cliente","Perfil","Estado","Ultima visita") }
        "ventas" { return @("Servicio","Cliente","Importe","Estado") }
        "facturacion" { return @("Ticket","Cliente","Importe","Estado") }
        "documentos" { return @("Documento","Cliente","Tipo","Estado") }
      }
    }

    "software-factory" {
      switch ($moduleKey) {
        "clientes" { return @("Cuenta","Segmento","Estado","Ultimo contacto") }
        "crm" { return @("Oportunidad","Estado","Responsable","Proximo paso") }
        "presupuestos" { return @("Propuesta","Cuenta","Importe","Estado") }
        "proyectos" { return @("Proyecto","Cuenta","Estado","Margen") }
        "timesheets" { return @("Persona","Proyecto","Horas","Tipo") }
        "planificacion_recursos" { return @("Recurso","Rol","Carga","Disponibilidad") }
        "facturacion" { return @("Factura","Cuenta","Importe","Estado") }
        "finanzas" { return @("Movimiento","Tipo","Importe","Fecha") }
        "rrhh" { return @("Empleado","Area","Estado","Observacion") }
        "documentos" { return @("Documento","Cuenta","Tipo","Estado") }
      }
    }
  }

  return @(Get-TableColumns $moduleKey)
}

function Get-TableRowsSectorized([string]$moduleKey, [string]$businessType = "general") {
  switch ($businessType) {
    "clinica-dental" {
      switch ($moduleKey) {
        "clientes" { return @(@("Marta Ruiz","Activa","2026-04-20","2026-05-18"),@("Pedro Leon","Tratamiento","2026-04-19","2026-04-29"),@("Laura Sanz","Revision","2026-04-16","2026-05-02")) }
        "citas" { return @(@("Marta Ruiz","Dr. Gomez","2026-04-22 10:00","Confirmada"),@("Pedro Leon","Dra. Lara","2026-04-22 11:00","Pendiente"),@("Laura Sanz","Dr. Gomez","2026-04-23 09:30","Confirmada")) }
        "ventas" { return @(@("Limpieza","Marta Ruiz","75 EUR","Cerrado"),@("Endodoncia","Pedro Leon","450 EUR","Pendiente"),@("Revision","Laura Sanz","40 EUR","Cerrado")) }
        "facturacion" { return @(@("FD-1001","Marta Ruiz","180 EUR","Pagada"),@("FD-1002","Pedro Leon","950 EUR","Pendiente"),@("FD-1003","Laura Sanz","75 EUR","Pagada")) }
        "documentos" { return @(@("Consentimiento","Marta Ruiz","PDF","Firmado"),@("Presupuesto implante","Pedro Leon","PDF","Pendiente"),@("Radiografia inicial","Laura Sanz","Imagen","Archivado")) }
      }
    }

    "gimnasio" {
      switch ($moduleKey) {
        "clientes" { return @(@("Carlos Mora","Mensual","Activo","2026-05-01"),@("Irene Pardo","Premium","Activa","2026-05-03"),@("Sergio Vidal","Prueba","Lead","2026-04-27")) }
        "ventas" { return @(@("Cuota mensual","Carlos Mora","49 EUR","Pagada"),@("Entrenamiento personal","Irene Pardo","120 EUR","Pendiente"),@("Bono 5 clases","Sergio Vidal","35 EUR","Cerrada")) }
        "facturacion" { return @(@("FG-2001","Carlos Mora","49 EUR","Pagada"),@("FG-2002","Irene Pardo","120 EUR","Pendiente"),@("FG-2003","Sergio Vidal","35 EUR","Emitida")) }
        "documentos" { return @(@("Alta socio","Carlos Mora","PDF","Firmado"),@("Consentimiento salud","Irene Pardo","PDF","Firmado"),@("Promo verano","General","PDF","Activa")) }
      }
    }

    "peluqueria" {
      switch ($moduleKey) {
        "clientes" { return @(@("Elena Rey","Fidelizada","Activa","2026-04-19"),@("Noa Vega","Color","Activa","2026-04-20"),@("Julia Campos","Nueva","Pendiente","2026-04-17")) }
        "ventas" { return @(@("Corte y peinado","Elena Rey","32 EUR","Cerrada"),@("Coloracion","Noa Vega","68 EUR","Pendiente"),@("Tratamiento","Julia Campos","24 EUR","Reservada")) }
        "facturacion" { return @(@("FP-3001","Elena Rey","32 EUR","Pagada"),@("FP-3002","Noa Vega","68 EUR","Pendiente"),@("FP-3003","Julia Campos","24 EUR","Reservada")) }
        "documentos" { return @(@("Ficha cliente","Elena Rey","DOCX","Actualizada"),@("Promo primavera","General","PDF","Activa"),@("Carta color","Noa Vega","DOCX","Archivada")) }
      }
    }

    "software-factory" {
      switch ($moduleKey) {
        "clientes" { return @(@("Acme Legal","SMB","Activo","2026-04-19"),@("Nova Health","Mid Market","Activo","2026-04-18"),@("Blue Retail","Lead","Propuesta","2026-04-20")) }
        "crm" { return @(@("ERP retail","Demo","Claudia","Enviar propuesta"),@("Portal pacientes","Negociacion","Diego","Reunion CTO"),@("BI interno","Calificacion","Marta","Llamada")) }
        "presupuestos" { return @(@("SF-001","Acme Legal","12.500 EUR","Enviado"),@("SF-002","Blue Retail","22.800 EUR","Revision"),@("SF-003","Nova Health","9.600 EUR","Aceptado")) }
        "proyectos" { return @(@("Portal clientes","Acme Legal","En curso","28pct"),@("Backoffice clinico","Nova Health","Planificado","24pct"),@("Migracion ERP","Blue Retail","Analisis","21pct")) }
        "timesheets" { return @(@("Claudia","Portal clientes","6.5","Facturable"),@("Diego","Backoffice clinico","7.0","Facturable"),@("Marta","Portal clientes","2.0","Interno")) }
        "planificacion_recursos" { return @(@("Claudia","PM","85pct","Media"),@("Diego","Fullstack","90pct","Baja"),@("Marta","QA","70pct","Alta")) }
        "facturacion" { return @(@("FS-4001","Acme Legal","5.400 EUR","Pendiente"),@("FS-4002","Nova Health","3.200 EUR","Pagada"),@("FS-4003","Blue Retail","2.800 EUR","Emitida")) }
        "finanzas" { return @(@("Cobro FS-4002","Ingreso","3.200 EUR","2026-04-18"),@("Licencias cloud","Gasto","640 EUR","2026-04-17"),@("Proveedor QA","Gasto","420 EUR","2026-04-19")) }
        "rrhh" { return @(@("Claudia","Delivery","Activa","Sin incidencias"),@("Diego","Tecnologia","Activo","Guardia semanal"),@("Marta","Calidad","Activa","Vacaciones en mayo")) }
        "documentos" { return @(@("Propuesta Blue Retail","Blue Retail","PDF","Enviado"),@("Contrato Nova Health","Nova Health","DOCX","Firmado"),@("SOW Acme","Acme Legal","PDF","Revision")) }
      }
    }
  }

  return @(Get-TableRows $moduleKey)
}

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $Root "scripts\lib\tenant-context.ps1")
. (Join-Path $Root "scripts\lib\active-client-registry.ps1")
$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)

function Read-Utf8JsonFile([string]$Path) {
  $raw = [System.IO.File]::ReadAllText($Path, $Utf8NoBom)
  if ([string]::IsNullOrWhiteSpace($raw)) { return $null }
  return ($raw | ConvertFrom-Json)
}

function Write-Utf8File([string]$Path, [string]$Content) {
  [System.IO.File]::WriteAllText($Path, $Content, $Utf8NoBom)
}

function Has-Prop($obj, [string]$name) {
  if ($null -eq $obj) { return $false }
  return (@($obj.PSObject.Properties | Where-Object { $_.Name -eq $name }).Count -gt 0)
}

function Get-PropValue($obj, [string]$name, $defaultValue) {
  if (Has-Prop $obj $name) { return $obj.$name }
  return $defaultValue
}

function Get-ModuleArea([string]$moduleKey) {
  switch ($moduleKey) {
    "crm" { "Comercial" }
    "presupuestos" { "Comercial" }
    "clientes" { "Comercial" }
    "proyectos" { "Operacion" }
    "tareas" { "Operacion" }
    "timesheets" { "Operacion" }
    "planificacion_recursos" { "Operacion" }
    "soporte" { "Operacion" }
    "facturacion" { "Finanzas" }
    "finanzas" { "Finanzas" }
    "cobros" { "Finanzas" }
    "pagos" { "Finanzas" }
    "tesoreria" { "Finanzas" }
    "rrhh" { "Personas" }
    "documentos" { "Gestion" }
    "contratos" { "Gestion" }
    "asistente" { "Gestion" }
    default { "Otros" }
  }
}

function Default-LabelForModule([string]$m, [string]$sector) {
  switch ($m) {
    "clientes" { "Clientes" }
    "crm" { "CRM" }
    "presupuestos" { "Presupuestos" }
    "proyectos" { "Proyectos" }
    "tareas" { "Tareas" }
    "timesheets" { "Timesheets" }
    "planificacion_recursos" { "Planificacion de recursos" }
    "facturacion" { "Facturacion" }
    "finanzas" { "Finanzas" }
    "rrhh" { "RRHH" }
    "documentos" { "Documentos" }
    "contratos" { "Contratos" }
    "soporte" { "Soporte" }
    "reporting" { "Reporting" }
    "ajustes" { "Ajustes" }
    "asistente" { "Asistente" }
    "ventas" { "Ventas" }
    "compras" { "Compras" }
    "proveedores" { "Proveedores" }
    default { ($m -replace "_", " ") }
  }
}

function Description-ForModule([string]$m, [string]$sector) {
  switch ($m) {
    "clientes" { "Gestion de clientes y cuentas." }
    "crm" { "Leads, oportunidades y pipeline comercial." }
    "presupuestos" { "Presupuestos, propuestas y cotizaciones." }
    "proyectos" { "Gestion de proyectos, fases y entregables." }
    "tareas" { "Gestion de tareas y pendientes." }
    "timesheets" { "Imputacion de horas por proyecto, tarea y cliente." }
    "planificacion_recursos" { "Capacidad, carga y disponibilidad del equipo." }
    "facturacion" { "Facturas, cobros y seguimiento administrativo." }
    "finanzas" { "Tesoreria, ingresos, gastos y control basico." }
    "rrhh" { "Empleados, ausencias y documentacion laboral." }
    "documentos" { "Documentacion y archivos asociados." }
    "contratos" { "Contratos, bolsas de horas y condiciones de servicio." }
    "soporte" { "Tickets, incidencias y SLA." }
    "reporting" { "KPIs, cuadros de mando e indicadores." }
    "ajustes" { "Configuracion general del ERP." }
    "asistente" { "Asistente conversacional para consultar este ERP." }
    "ventas" { "Seguimiento de ventas y actividad comercial." }
    "compras" { "Control de compras y aprovisionamiento." }
    "proveedores" { "Gestion de proveedores." }
    default { "Modulo generado automaticamente." }
  }
}

function Label-ForModule([string]$m, [string]$sector, $renameMap) {
  if ($null -ne $renameMap -and (Has-Prop $renameMap $m)) {
    $value = [string]$renameMap.$m
    if (-not [string]::IsNullOrWhiteSpace($value)) { return $value }
  }
  return Default-LabelForModule $m $sector
}

function ExampleRows([string]$m, [string]$sector, $sampleData) {
  if ($null -ne $sampleData -and (Has-Prop $sampleData $m)) {
    $custom = $sampleData.$m
    if ($custom) { return @($custom) }
  }

  switch ($m) {
    "clientes" { return @("Cliente 1","Cliente 2","Cliente 3") }
    "crm" { return @("Lead A","Oportunidad B","Seguimiento C") }
    "presupuestos" { return @("P-001","P-002","P-003") }
    "proyectos" { return @("Proyecto Alpha","Proyecto Beta","Proyecto Gamma") }
    "tareas" { return @("Definir alcance","Preparar propuesta","Entregar sprint") }
    "timesheets" { return @("Ana - 6h","Luis - 5h","Marta - 7h") }
    "planificacion_recursos" { return @("Ana 80pct","Luis 65pct","Marta 90pct") }
    "facturacion" { return @("Factura F-001","Factura F-002","Factura F-003") }
    "finanzas" { return @("Cobro cliente A","Pago proveedor B","Prevision semanal") }
    "rrhh" { return @("Ana Lopez","Luis Perez","Marta Gil") }
    "contratos" { return @("Contrato anual","Bolsa de horas","Mantenimiento") }
    "soporte" { return @("Ticket 1001","Ticket 1002","Ticket 1003") }
    "documentos" { return @("Documento 1","Documento 2","Documento 3") }
    "ajustes" { return @("Empresa","Usuarios","Preferencias") }
    "asistente" { return @("Que modulos tiene este ERP","Cual es el flujo principal","Que KPIs debo mirar") }
    "ventas" { return @("Venta 1","Venta 2","Venta 3") }
    "compras" { return @("Compra 1","Compra 2","Compra 3") }
    "proveedores" { return @("Proveedor 1","Proveedor 2","Proveedor 3") }
    default { return @("Elemento 1","Elemento 2","Elemento 3") }
  }
}

function Get-KpiCards($modules, $reportingNeeds) {
  $cards = New-Object System.Collections.ArrayList
  $moduleList = @($modules)
  $reportingList = @($reportingNeeds)

  if (($moduleList -contains "crm") -or ($reportingList -contains "pipeline-comercial")) {
    [void]$cards.Add([pscustomobject]@{ Title = "Pipeline comercial"; Value = "18.500 EUR"; Note = "6 oportunidades activas" })
  }
  if (($moduleList -contains "timesheets") -or ($reportingList -contains "horas-imputadas")) {
    [void]$cards.Add([pscustomobject]@{ Title = "Horas imputadas"; Value = "312 h"; Note = "86pct facturables" })
  }
  if (($moduleList -contains "planificacion_recursos") -or ($reportingList -contains "utilizacion-del-equipo")) {
    [void]$cards.Add([pscustomobject]@{ Title = "Utilizacion equipo"; Value = "78pct"; Note = "Carga estable" })
  }
  if (($moduleList -contains "proyectos") -or ($reportingList -contains "margen-por-proyecto")) {
    [void]$cards.Add([pscustomobject]@{ Title = "Margen proyecto"; Value = "22pct"; Note = "Proyecto Alpha lidera" })
  }
  if ((($moduleList -contains "finanzas") -or ($moduleList -contains "facturacion")) -or ($reportingList -contains "cobros-pendientes")) {
    [void]$cards.Add([pscustomobject]@{ Title = "Cobros pendientes"; Value = "7.800 EUR"; Note = "3 facturas abiertas" })
  }
  if (($moduleList -contains "soporte") -or ($reportingList -contains "tickets-y-sla")) {
    [void]$cards.Add([pscustomobject]@{ Title = "Tickets SLA"; Value = "94pct"; Note = "Dentro de objetivo" })
  }

  if ($cards.Count -eq 0) {
    [void]$cards.Add([pscustomobject]@{ Title = "Estado general"; Value = "Operativo"; Note = "Sin KPI especifico" })
    [void]$cards.Add([pscustomobject]@{ Title = "Modulos activos"; Value = [string]$moduleList.Count; Note = "ERP generado" })
  }

  return @($cards)
}

function Get-TableColumns([string]$moduleKey) {
  switch ($moduleKey) {
    "crm" { return @("Nombre","Estado","Responsable","Proxima accion") }
    "presupuestos" { return @("Codigo","Cliente","Importe","Estado") }
    "proyectos" { return @("Proyecto","Cliente","Estado","Margen") }
    "timesheets" { return @("Persona","Proyecto","Horas","Tipo") }
    "planificacion_recursos" { return @("Recurso","Rol","Carga","Disponibilidad") }
    "facturacion" { return @("Factura","Cliente","Importe","Estado") }
    "finanzas" { return @("Movimiento","Tipo","Importe","Fecha") }
    "rrhh" { return @("Empleado","Area","Estado","Observacion") }
    "contratos" { return @("Contrato","Cliente","Modalidad","Estado") }
    "soporte" { return @("Ticket","Cliente","Prioridad","Estado") }
    "clientes" { return @("Cliente","Segmento","Estado","Ultimo contacto") }
    "documentos" { return @("Documento","Categoria","Responsable","Fecha") }
    default { return @("Nombre","Estado","Detalle","Fecha") }
  }
}

function Get-TableRows([string]$moduleKey) {
  switch ($moduleKey) {
    "crm" { return @(@("Lead A","Propuesta","Ana","Llamada jueves"),@("Lead B","Contacto","Luis","Enviar dossier"),@("Lead C","Negociacion","Marta","Revisar precio")) }
    "presupuestos" { return @(@("P-001","Cliente A","4500 EUR","Enviado"),@("P-002","Cliente B","7900 EUR","Aceptado"),@("P-003","Cliente C","2800 EUR","Revision")) }
    "proyectos" { return @(@("Proyecto Alpha","Cliente A","En curso","24 pct"),@("Proyecto Beta","Cliente B","Planificado","18 pct"),@("Proyecto Gamma","Cliente C","Seguimiento","21 pct")) }
    "timesheets" { return @(@("Ana","Proyecto Alpha","6","Facturable"),@("Luis","Proyecto Beta","5","Facturable"),@("Marta","Proyecto Gamma","3","Interno")) }
    "planificacion_recursos" { return @(@("Ana","PM","80 pct","Media"),@("Luis","Dev","65 pct","Alta"),@("Marta","QA","90 pct","Baja")) }
    "facturacion" { return @(@("F-001","Cliente A","1200 EUR","Pendiente"),@("F-002","Cliente B","3400 EUR","Emitida"),@("F-003","Cliente C","980 EUR","Cobrada")) }
    "finanzas" { return @(@("Cobro F-001","Ingreso","1200 EUR","2026-04-18"),@("AWS Marzo","Gasto","420 EUR","2026-04-15"),@("Nominas","Gasto","6200 EUR","2026-04-01")) }
    "rrhh" { return @(@("Ana Lopez","Operacion","Activo","Sin incidencias"),@("Luis Perez","Tecnologia","Activo","Vacaciones en mayo"),@("Marta Gil","QA","Activo","Revision trimestral")) }
    "contratos" { return @(@("CT-001","Cliente A","Mantenimiento","Activo"),@("CT-002","Cliente B","Bolsa horas","Activo"),@("CT-003","Cliente C","Proyecto","Revision")) }
    "soporte" { return @(@("T-1001","Cliente A","Alta","Abierto"),@("T-1002","Cliente B","Media","En progreso"),@("T-1003","Cliente C","Baja","Cerrado")) }
    "clientes" { return @(@("Cliente A","Pyme","Activo","2026-04-18"),@("Cliente B","Startup","Activo","2026-04-17"),@("Cliente C","Retail","Seguimiento","2026-04-15")) }
    "documentos" { return @(@("Contrato marco","Legal","Ana","2026-04-10"),@("Propuesta comercial","Comercial","Luis","2026-04-12"),@("Acta kickoff","Proyecto","Marta","2026-04-14")) }
    default { return @(@("Elemento 1","Activo","Detalle 1","2026-04-10"),@("Elemento 2","Revision","Detalle 2","2026-04-12"),@("Elemento 3","Pendiente","Detalle 3","2026-04-15")) }
  }
}

$tenantContext = Get-ProntaraTenantContext -ClientId $ClientId -Root $Root
$clientFile = $tenantContext.definitionPath
if (-not (Test-Path $clientFile)) {
  Write-Host "No existe el cliente: $ClientId" -ForegroundColor Red
  exit 1
}

$client = Read-Utf8JsonFile $clientFile

$displayName = [string](Get-PropValue $client "displayName" "Prontara ERP")
$sector = [string](Get-PropValue $client "sector" "estandar")
$version = [string](Get-PropValue $client "version" "0.1.0")
$renameMap = Get-PropValue $client "renameMap" ([pscustomobject]@{})
$sampleData = Get-PropValue $client "sampleData" ([pscustomobject]@{})
$blueprintMeta = Get-PropValue $client "blueprintMeta" ([pscustomobject]@{})
$modules = @()
if (Has-Prop $client "modules") { $modules = @($client.modules) }
if (-not ($modules -contains "asistente")) { $modules += "asistente" }

$companySize = ""
$coreFlow = @()
$reportingNeeds = @()

if ($null -ne $blueprintMeta) {
  if (Has-Prop $blueprintMeta "companyProfile" -and $null -ne $blueprintMeta.companyProfile) {
    if (Has-Prop $blueprintMeta.companyProfile "size") {
      $companySize = [string]$blueprintMeta.companyProfile.size
    }
  }
  if (Has-Prop $blueprintMeta "coreFlow") { $coreFlow = @($blueprintMeta.coreFlow) }
  if (Has-Prop $blueprintMeta "reportingNeeds") { $reportingNeeds = @($blueprintMeta.reportingNeeds) }
}

$srcDir = Join-Path $Root "src"
$appDir = Join-Path $srcDir "app"
$libDir = Join-Path $srcDir "lib"

New-Item -ItemType Directory -Force $appDir, $libDir | Out-Null

Get-ChildItem -Path $appDir -Directory -ErrorAction SilentlyContinue | Where-Object {
  $_.Name -notin @("api","factory")
} | ForEach-Object {
  Remove-Item $_.FullName -Recurse -Force -ErrorAction SilentlyContinue
}

$moduleObjects = @()
foreach ($m in $modules) {
  $moduleObjects += [pscustomobject]@{
    key = $m
    label = (Label-ForModule $m $sector $renameMap)
    description = (Description-ForModule $m $sector)
    route = if ($m -eq "dashboard") { "/" } else { "/$m" }
    area = (Get-ModuleArea $m)
  }
}

$kpiCards = @(Get-KpiCardsSectorized $modules $reportingNeeds $client.businessType)

$kpiCardsTs = ($kpiCards | ForEach-Object {
@"
        <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16, background: "#fff" }}>
          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>$($_.Title)</div>
          <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>$($_.Value)</div>
          <div style={{ fontSize: 12, opacity: 0.75 }}>$($_.Note)</div>
        </div>
"@
}) -join "`r`n"

$dashboardHeroSubtitle = Get-SectorDashboardHeroSubtitle $client.businessType
$assistantWelcome = Get-SectorAssistantWelcome $client.businessType
$assistantKpiHint = Get-SectorAssistantKpiHint $client.businessType
$assistantScopeHint = Get-SectorAssistantScopeHint $client.businessType
$assistantSuggestions = @(Get-SectorAssistantSuggestions $client.businessType)
$assistantSuggestionsTs = ($assistantSuggestions | ForEach-Object {
  "              <li>$_</li>"
}) -join "`r`n"
$moduleConfigTs = ($moduleObjects | ForEach-Object {
  $labelEsc = $_.label -replace '"','\"'
  $descEsc = $_.description -replace '"','\"'
  $areaEsc = $_.area -replace '"','\"'
  $routeEsc = $_.route -replace '"','\"'
  "    { key: `"$($_.key)`", label: `"$labelEsc`", description: `"$descEsc`", route: `"$routeEsc`", area: `"$areaEsc`" }"
}) -join ",`r`n"

$blueprintMetaTs = @"
  blueprintMeta: {
    companySize: "$companySize",
    coreFlow: [$(($coreFlow | ForEach-Object { "`"$_`"" }) -join ", ")],
    reportingNeeds: [$(($reportingNeeds | ForEach-Object { "`"$_`"" }) -join ", ")]
  },
"@

$generatedTs = @"
export const prontaraConfig = {
  clientId: "$ClientId",
  displayName: "$displayName",
  sector: "$sector",
  version: "$version",
$blueprintMetaTs
  modules: [
$moduleConfigTs
  ]
} as const
"@

Write-Utf8File (Join-Path $libDir "prontara.generated.ts") $generatedTs

$dashboardPage = @"
import Link from "next/link";
import { prontaraConfig } from "@/lib/prontara.generated";

export default function HomePage() {
  return (
    <main style={{ padding: 24, fontFamily: "Arial, sans-serif", maxWidth: 1280, margin: "0 auto" }}>
      <h1 style={{ fontSize: 32, marginBottom: 8 }}>{prontaraConfig.displayName}</h1>
      <p style={{ marginBottom: 12, maxWidth: 880 }}>$dashboardHeroSubtitle</p>
      <p style={{ marginBottom: 6 }}>Sector: {prontaraConfig.sector}</p>
      <p style={{ marginBottom: 6 }}>Version: {prontaraConfig.version}</p>
      <p style={{ marginBottom: 24 }}>Tamano: {prontaraConfig.blueprintMeta.companySize || "No definido"}</p>

      <section style={{ marginBottom: 24, border: "1px solid #ddd", borderRadius: 12, padding: 16, background: "#fafafa" }}>
        <h2 style={{ fontSize: 24, marginTop: 0, marginBottom: 12 }}>Cadena principal</h2>
        <p style={{ margin: 0 }}>{prontaraConfig.blueprintMeta.coreFlow.join(" -> ") || "No definida"}</p>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 24 }}>
$kpiCardsTs
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
        {prontaraConfig.modules.map((mod) => (
          <Link
            key={mod.key}
            href={mod.route}
            style={{
              display: "block",
              border: "1px solid #ddd",
              borderRadius: 12,
              padding: 16,
              textDecoration: "none",
              color: "inherit",
              background: "#fff"
            }}
          >
            <div style={{ fontSize: 12, opacity: 0.65, marginBottom: 6 }}>{mod.area}</div>
            <h3 style={{ marginTop: 0, marginBottom: 8 }}>{mod.label}</h3>
            <p style={{ margin: 0 }}>{mod.description}</p>
          </Link>
        ))}
      </section>
    </main>
  );
}
"@

Write-Utf8File (Join-Path $appDir "page.tsx") $dashboardPage

foreach ($mod in $moduleObjects) {
  if ($mod.key -eq "dashboard") { continue }

  $modDir = Join-Path $appDir $mod.key
  New-Item -ItemType Directory -Force $modDir | Out-Null

  if ($mod.key -eq "asistente") {
    $assistantPage = @"
"use client";

import Link from "next/link";
import { useState } from "react";
import { prontaraConfig } from "@/lib/prontara.generated";

type Message = {
  role: "assistant" | "user";
  text: string;
};

function answerQuestion(input: string): string {
  const lower = input.toLowerCase();

  if (lower.includes("modulos") || lower.includes("mÃƒÆ’Ã‚Â³dulos")) {
    return "Este ERP tiene estos modulos: " + prontaraConfig.modules.map((m) => m.label).join(", ");
  }

  if (lower.includes("flujo") || lower.includes("workflow") || lower.includes("cadena")) {
    return "El flujo principal es: " + (prontaraConfig.blueprintMeta.coreFlow.join(" -> ") || "No definido");
  }

  if (lower.includes("kpi") || lower.includes("indicador") || lower.includes("reporting")) {
    return "Los principales indicadores estan relacionados con pipeline, horas, utilizacion, margen, facturacion y cobros pendientes.";
  }

  if (lower.includes("sector")) {
    return "El sector actual es: " + prontaraConfig.sector;
  }

  return "Puedo ayudarte con modulos, flujo principal, sector, reporting y estructura general de este ERP.";
}

export default function AssistantPage() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      text: "$assistantWelcome",
    },
  ]);

  function send() {
    const text = input.trim();
    if (!text) return;

    setMessages((prev) => [
      ...prev,
      { role: "user", text },
      { role: "assistant", text: answerQuestion(text) },
    ]);
    setInput("");
  }

  return (
    <main style={{ padding: 24, fontFamily: "Arial, sans-serif", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ marginBottom: 16 }}>
        <Link href="/" style={{ textDecoration: "none" }}>&lt;- Volver al dashboard</Link>
      </div>

      <h1 style={{ fontSize: 32, marginBottom: 8 }}>Asistente</h1>
      <p style={{ marginBottom: 24 }}>
        Chat interno del ERP para consultar la configuracion y estructura generada de <strong>{prontaraConfig.displayName}</strong>.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1.7fr 1fr", gap: 16 }}>
        <section style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16, background: "#fff" }}>
          <div style={{ display: "grid", gap: 12, marginBottom: 16 }}>
            {messages.map((message, index) => (
              <div
                key={index}
                style={{
                  maxWidth: "88%",
                  padding: 12,
                  borderRadius: 12,
                  background: message.role === "assistant" ? "#f4f4f4" : "#e8f1ff",
                  justifySelf: message.role === "assistant" ? "start" : "end",
                }}
              >
                <div style={{ fontSize: 12, opacity: 0.65, marginBottom: 6 }}>
                  {message.role === "assistant" ? "Asistente" : "Tu"}
                </div>
                <div>{message.text}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") send();
              }}
              placeholder="Pregunta algo sobre este ERP"
              style={{ flex: 1, padding: "12px 14px", border: "1px solid #ccc", borderRadius: 10 }}
            />
            <button
              onClick={send}
              style={{ padding: "12px 16px", borderRadius: 10, border: "1px solid #222", background: "#111", color: "#fff" }}
            >
              Enviar
            </button>
          </div>
        </section>

        <aside style={{ display: "grid", gap: 16 }}>
          <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16, background: "#fff" }}>
            <h3 style={{ marginTop: 0 }}>Sugerencias</h3>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
$assistantSuggestionsTs
            </ul>
          </div>

          <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16, background: "#fff" }}>
            <h3 style={{ marginTop: 0 }}>Contexto</h3>
            <p><strong>Cliente:</strong> {prontaraConfig.displayName}</p>
            <p><strong>Sector:</strong> {prontaraConfig.sector}</p>
            <p><strong>Tamano:</strong> {prontaraConfig.blueprintMeta.companySize || "No definido"}</p>
            <p><strong>Modulos:</strong> {prontaraConfig.modules.length}</p>
          </div>
        </aside>
      </div>
    </main>
  );
}
"@
    Write-Utf8File (Join-Path $modDir "page.tsx") $assistantPage
    continue
  }

  $tableHeaders = @(Get-TableColumnsSectorized $mod.key $client.businessType)
  $tableRows = @(Get-TableRowsSectorized $mod.key $client.businessType)
  $moduleActions = @(Get-SectorModuleActions $mod.key $client.businessType)

  $theadTs = ($tableHeaders | ForEach-Object {
    "                  <th style={{ textAlign: `"left`", padding: `"10px 12px`", borderBottom: `"1px solid #ddd`", background: `"#fafafa`" }}>{`"$_`"}</th>"
  }) -join "`r`n"

  $tbodyTs = ($tableRows | ForEach-Object {
    $row = $_
    $cells = ($row | ForEach-Object {
      "                    <td style={{ padding: `"10px 12px`", borderBottom: `"1px solid #eee`" }}>{`"$_`"}</td>"
    }) -join "`r`n"
@"
                <tr>
$cells
                </tr>
"@
  }) -join "`r`n"

  $page = @"
import Link from "next/link";
import { prontaraConfig } from "@/lib/prontara.generated";

const moduleData = prontaraConfig.modules.find((m) => m.key === "$($mod.key)");

export default function ModulePage() {
  return (
    <main style={{ padding: 24, fontFamily: "Arial, sans-serif", maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ marginBottom: 16 }}>
        <Link href="/" style={{ textDecoration: "none" }}>&lt;- Volver al dashboard</Link>
      </div>

      <h1 style={{ fontSize: 32, marginBottom: 8 }}>{moduleData?.label}</h1>
      <p style={{ marginBottom: 24 }}>{moduleData?.description}</p>

      <div style={{ display: "grid", gridTemplateColumns: "1.8fr 1fr", gap: 16 }}>
        <div style={{ border: "1px solid #ddd", borderRadius: 12, overflow: "hidden", background: "#fff" }}>
          <div style={{ padding: 16, borderBottom: "1px solid #ddd" }}>
            <strong>Registros del modulo</strong>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr>
$theadTs
                </tr>
              </thead>
              <tbody>
$tbodyTs
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ display: "grid", gap: 16 }}>
          <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16, background: "#fff" }}>
            <h3 style={{ marginTop: 0 }}>Contexto del ERP</h3>
            <p><strong>Cliente:</strong> {prontaraConfig.displayName}</p>
            <p><strong>Area:</strong> {moduleData?.area}</p>
            <p><strong>Sector:</strong> {prontaraConfig.sector}</p>
            <p><strong>Tamano:</strong> {prontaraConfig.blueprintMeta.companySize || "No definido"}</p>
            <p><strong>Flujo principal:</strong> {prontaraConfig.blueprintMeta.coreFlow.join(" > ") || "No definido"}</p>
          </div>

          <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16, background: "#fff" }}>
            <h3 style={{ marginTop: 0 }}>Acciones simuladas</h3>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {moduleActions.map((actionLabel) => (
                <li key={actionLabel}>{actionLabel}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </main>
  );
}
"@

  Write-Utf8File (Join-Path $modDir "page.tsx") $page
}

Write-Host ""
Write-Host "App generada correctamente para $displayName." -ForegroundColor Green
Write-Host "Dashboard: src/app/page.tsx"
Write-Host "Config: src/lib/prontara.generated.ts"
Write-Host ("M{0}dulos generados: {1}" -f [char]0x00F3, ($modules -join ', '))
Write-Host ""
