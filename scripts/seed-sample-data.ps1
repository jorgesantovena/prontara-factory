[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$ClientId
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $Root "scripts\lib\tenant-context.ps1")
$Root = Split-Path -Parent $Root

$ClientsDir = Get-ProntaraClientsRoot -Root $Root
$ClientFile = Join-Path $ClientsDir "$ClientId.json"
$GeneratorScript = Join-Path $Root "generate-prontara.ps1"

function Read-Utf8Json([string]$Path) {
  $utf8NoBom = [System.Text.UTF8Encoding]::new($false)
  $raw = [System.IO.File]::ReadAllText($Path, $utf8NoBom)
  return $raw | ConvertFrom-Json
}

function Write-Utf8Json([string]$Path, $Object) {
  $utf8NoBom = [System.Text.UTF8Encoding]::new($false)
  $json = $Object | ConvertTo-Json -Depth 20
  [System.IO.File]::WriteAllText($Path, $json, $utf8NoBom)
}

function New-GeneralCatalog {
  return @{
    "clientes" = @(
      @{ Cliente = "Cliente Demo 1"; Segmento = "PYME"; Estado = "Activo"; "Ultimo contacto" = "2026-04-15" },
      @{ Cliente = "Cliente Demo 2"; Segmento = "Servicios"; Estado = "Activo"; "Ultimo contacto" = "2026-04-17" },
      @{ Cliente = "Cliente Demo 3"; Segmento = "Industria"; Estado = "Potencial"; "Ultimo contacto" = "2026-04-18" }
    )
    "crm" = @(
      @{ Nombre = "Oportunidad A"; Estado = "Propuesta"; Responsable = "Ana"; "Proxima accion" = "Llamada" },
      @{ Nombre = "Oportunidad B"; Estado = "Negociacion"; Responsable = "Luis"; "Proxima accion" = "Demo" }
    )
    "presupuestos" = @(
      @{ Codigo = "P-001"; Cliente = "Cliente Demo 1"; Importe = "2800"; Estado = "Enviado" },
      @{ Codigo = "P-002"; Cliente = "Cliente Demo 2"; Importe = "4600"; Estado = "Aceptado" }
    )
    "proyectos" = @(
      @{ Proyecto = "Implantacion Alpha"; Cliente = "Cliente Demo 1"; Estado = "En curso"; Margen = "22%" },
      @{ Proyecto = "Soporte Beta"; Cliente = "Cliente Demo 2"; Estado = "Planificado"; Margen = "18%" }
    )
    "timesheets" = @(
      @{ Persona = "Ana"; Proyecto = "Implantacion Alpha"; Horas = "7.5"; Tipo = "Facturable" },
      @{ Persona = "Luis"; Proyecto = "Soporte Beta"; Horas = "5.0"; Tipo = "No facturable" }
    )
    "planificacion_recursos" = @(
      @{ Recurso = "Ana"; Rol = "PM"; Carga = "80%"; Disponibilidad = "Media" },
      @{ Recurso = "Luis"; Rol = "Dev"; Carga = "65%"; Disponibilidad = "Alta" }
    )
    "facturacion" = @(
      @{ Factura = "F-1001"; Cliente = "Cliente Demo 1"; Importe = "1450"; Estado = "Pendiente" },
      @{ Factura = "F-1002"; Cliente = "Cliente Demo 2"; Importe = "980"; Estado = "Pagada" }
    )
    "finanzas" = @(
      @{ Movimiento = "Cobro F-1002"; Tipo = "Ingreso"; Importe = "980"; Fecha = "2026-04-18" },
      @{ Movimiento = "Licencia software"; Tipo = "Gasto"; Importe = "220"; Fecha = "2026-04-17" }
    )
    "rrhh" = @(
      @{ Empleado = "Ana"; Area = "Operaciones"; Estado = "Activo"; Observacion = "Sin incidencias" },
      @{ Empleado = "Luis"; Area = "Tecnologia"; Estado = "Activo"; Observacion = "Teletrabajo parcial" }
    )
    "documentos" = @(
      @{ Documento = "Propuesta comercial"; Tipo = "PDF"; Cliente = "Cliente Demo 1"; Estado = "Firmado" },
      @{ Documento = "Contrato de servicio"; Tipo = "DOCX"; Cliente = "Cliente Demo 2"; Estado = "Revision" }
    )
    "productos" = @(
      @{ Producto = "Servicio Base"; Categoria = "Servicios"; Precio = "490"; Estado = "Activo" },
      @{ Producto = "Pack Soporte"; Categoria = "Servicios"; Precio = "790"; Estado = "Activo" }
    )
    "ventas" = @(
      @{ Venta = "V-001"; Cliente = "Cliente Demo 1"; Importe = "1450"; Estado = "Pendiente" },
      @{ Venta = "V-002"; Cliente = "Cliente Demo 2"; Importe = "980"; Estado = "Cerrada" }
    )
    "pedidos" = @(
      @{ Pedido = "PD-001"; Cliente = "Cliente Demo 1"; Estado = "Preparacion"; Fecha = "2026-04-19" },
      @{ Pedido = "PD-002"; Cliente = "Cliente Demo 2"; Estado = "Entregado"; Fecha = "2026-04-18" }
    )
    "almacen" = @(
      @{ SKU = "A-001"; Producto = "Consumible A"; Stock = "24"; Estado = "Correcto" },
      @{ SKU = "A-002"; Producto = "Consumible B"; Stock = "8"; Estado = "Bajo" }
    )
    "citas" = @(
      @{ Paciente = "Marta Ruiz"; Profesional = "Dr. Gomez"; Fecha = "2026-04-22 10:00"; Estado = "Confirmada" },
      @{ Paciente = "Pedro Leon"; Profesional = "Dra. Lara"; Fecha = "2026-04-22 11:00"; Estado = "Pendiente" }
    )
  }
}

function New-ClinicaDentalCatalog {
  return @{
    "clientes" = @(
      @{ Cliente = "Marta Ruiz"; Segmento = "Paciente"; Estado = "Activa"; "Ultimo contacto" = "2026-04-20" },
      @{ Cliente = "Pedro Leon"; Segmento = "Paciente"; Estado = "Activo"; "Ultimo contacto" = "2026-04-19" },
      @{ Cliente = "Laura Sanz"; Segmento = "Paciente"; Estado = "Revision"; "Ultimo contacto" = "2026-04-16" }
    )
    "citas" = @(
      @{ Paciente = "Marta Ruiz"; Profesional = "Dr. Gomez"; Fecha = "2026-04-22 10:00"; Estado = "Confirmada" },
      @{ Paciente = "Pedro Leon"; Profesional = "Dra. Lara"; Fecha = "2026-04-22 11:00"; Estado = "Pendiente" },
      @{ Paciente = "Laura Sanz"; Profesional = "Dr. Gomez"; Fecha = "2026-04-23 09:30"; Estado = "Confirmada" }
    )
    "documentos" = @(
      @{ Documento = "Consentimiento informado"; Tipo = "PDF"; Cliente = "Marta Ruiz"; Estado = "Firmado" },
      @{ Documento = "Presupuesto implante"; Tipo = "PDF"; Cliente = "Pedro Leon"; Estado = "Pendiente" },
      @{ Documento = "Radiografia inicial"; Tipo = "Imagen"; Cliente = "Laura Sanz"; Estado = "Archivado" }
    )
    "facturacion" = @(
      @{ Factura = "FD-1001"; Cliente = "Marta Ruiz"; Importe = "180"; Estado = "Pagada" },
      @{ Factura = "FD-1002"; Cliente = "Pedro Leon"; Importe = "950"; Estado = "Pendiente" },
      @{ Factura = "FD-1003"; Cliente = "Laura Sanz"; Importe = "75"; Estado = "Pagada" }
    )
    "ventas" = @(
      @{ Venta = "T-001 Limpieza"; Cliente = "Marta Ruiz"; Importe = "75"; Estado = "Cerrada" },
      @{ Venta = "T-002 Endodoncia"; Cliente = "Pedro Leon"; Importe = "450"; Estado = "Pendiente" },
      @{ Venta = "T-003 Revision"; Cliente = "Laura Sanz"; Importe = "40"; Estado = "Cerrada" }
    )
    "ajustes" = @(
      @{ Clave = "duracion_cita"; Valor = "30 min"; Estado = "Activo"; Observacion = "Configuracion base" },
      @{ Clave = "iva_servicios"; Valor = "21%"; Estado = "Activo"; Observacion = "Facturacion" }
    )
  }
}

function New-GimnasioCatalog {
  return @{
    "clientes" = @(
      @{ Cliente = "Carlos Mora"; Segmento = "Socio"; Estado = "Activo"; "Ultimo contacto" = "2026-04-20" },
      @{ Cliente = "Irene Pardo"; Segmento = "Socia"; Estado = "Activa"; "Ultimo contacto" = "2026-04-18" },
      @{ Cliente = "Sergio Vidal"; Segmento = "Lead"; Estado = "Prueba"; "Ultimo contacto" = "2026-04-19" }
    )
    "ventas" = @(
      @{ Venta = "Cuota mensual"; Cliente = "Carlos Mora"; Importe = "49"; Estado = "Pagada" },
      @{ Venta = "Entrenamiento personal"; Cliente = "Irene Pardo"; Importe = "120"; Estado = "Pendiente" },
      @{ Venta = "Bono de 5 clases"; Cliente = "Sergio Vidal"; Importe = "35"; Estado = "Cerrada" }
    )
    "facturacion" = @(
      @{ Factura = "FG-2001"; Cliente = "Carlos Mora"; Importe = "49"; Estado = "Pagada" },
      @{ Factura = "FG-2002"; Cliente = "Irene Pardo"; Importe = "120"; Estado = "Pendiente" }
    )
    "documentos" = @(
      @{ Documento = "Alta socio"; Tipo = "PDF"; Cliente = "Carlos Mora"; Estado = "Firmado" },
      @{ Documento = "Consentimiento salud"; Tipo = "PDF"; Cliente = "Irene Pardo"; Estado = "Firmado" }
    )
    "productos" = @(
      @{ Producto = "Cuota mensual"; Categoria = "Membresia"; Precio = "49"; Estado = "Activo" },
      @{ Producto = "Pack personal"; Categoria = "Servicios"; Precio = "120"; Estado = "Activo" },
      @{ Producto = "Bono 5 clases"; Categoria = "Clases"; Precio = "35"; Estado = "Activo" }
    )
    "ajustes" = @(
      @{ Clave = "aforo_sala"; Valor = "40"; Estado = "Activo"; Observacion = "Sala principal" },
      @{ Clave = "renovacion_cuotas"; Valor = "Mensual"; Estado = "Activo"; Observacion = "Suscripciones" }
    )
  }
}

function New-PeluqueriaCatalog {
  return @{
    "clientes" = @(
      @{ Cliente = "Elena Rey"; Segmento = "Cliente"; Estado = "Activa"; "Ultimo contacto" = "2026-04-19" },
      @{ Cliente = "Noa Vega"; Segmento = "Cliente"; Estado = "Activa"; "Ultimo contacto" = "2026-04-20" },
      @{ Cliente = "Julia Campos"; Segmento = "Cliente"; Estado = "Pendiente"; "Ultimo contacto" = "2026-04-17" }
    )
    "ventas" = @(
      @{ Venta = "Corte y peinado"; Cliente = "Elena Rey"; Importe = "32"; Estado = "Cerrada" },
      @{ Venta = "Coloracion"; Cliente = "Noa Vega"; Importe = "68"; Estado = "Pendiente" },
      @{ Venta = "Tratamiento"; Cliente = "Julia Campos"; Importe = "24"; Estado = "Reservada" }
    )
    "facturacion" = @(
      @{ Factura = "FP-3001"; Cliente = "Elena Rey"; Importe = "32"; Estado = "Pagada" },
      @{ Factura = "FP-3002"; Cliente = "Noa Vega"; Importe = "68"; Estado = "Pendiente" }
    )
    "documentos" = @(
      @{ Documento = "Ficha cliente"; Tipo = "DOCX"; Cliente = "Elena Rey"; Estado = "Actualizada" },
      @{ Documento = "Promocion primavera"; Tipo = "PDF"; Cliente = "General"; Estado = "Activa" }
    )
    "productos" = @(
      @{ Producto = "Corte mujer"; Categoria = "Servicios"; Precio = "22"; Estado = "Activo" },
      @{ Producto = "Coloracion"; Categoria = "Servicios"; Precio = "68"; Estado = "Activo" },
      @{ Producto = "Tratamiento reparador"; Categoria = "Servicios"; Precio = "24"; Estado = "Activo" }
    )
    "ajustes" = @(
      @{ Clave = "duracion_slot"; Valor = "30 min"; Estado = "Activo"; Observacion = "Agenda" },
      @{ Clave = "cabinas_activas"; Valor = "4"; Estado = "Activo"; Observacion = "Recursos" }
    )
  }
}

function New-SoftwareFactoryCatalog {
  return @{
    "clientes" = @(
      @{ Cliente = "Acme Legal"; Segmento = "SMB"; Estado = "Activo"; "Ultimo contacto" = "2026-04-19" },
      @{ Cliente = "Nova Health"; Segmento = "Mid Market"; Estado = "Activo"; "Ultimo contacto" = "2026-04-18" },
      @{ Cliente = "Blue Retail"; Segmento = "Lead"; Estado = "Propuesta"; "Ultimo contacto" = "2026-04-20" }
    )
    "crm" = @(
      @{ Nombre = "ERP retail"; Estado = "Demo"; Responsable = "Claudia"; "Proxima accion" = "Enviar propuesta" },
      @{ Nombre = "Portal pacientes"; Estado = "Negociacion"; Responsable = "Diego"; "Proxima accion" = "Reunion CTO" }
    )
    "presupuestos" = @(
      @{ Codigo = "SF-001"; Cliente = "Acme Legal"; Importe = "12500"; Estado = "Enviado" },
      @{ Codigo = "SF-002"; Cliente = "Blue Retail"; Importe = "22800"; Estado = "Revision" }
    )
    "proyectos" = @(
      @{ Proyecto = "Portal clientes"; Cliente = "Acme Legal"; Estado = "En curso"; Margen = "28%" },
      @{ Proyecto = "Backoffice clinico"; Cliente = "Nova Health"; Estado = "Planificado"; Margen = "24%" }
    )
    "timesheets" = @(
      @{ Persona = "Claudia"; Proyecto = "Portal clientes"; Horas = "6.5"; Tipo = "Facturable" },
      @{ Persona = "Diego"; Proyecto = "Backoffice clinico"; Horas = "7.0"; Tipo = "Facturable" },
      @{ Persona = "Marta"; Proyecto = "Portal clientes"; Horas = "2.0"; Tipo = "Interno" }
    )
    "planificacion_recursos" = @(
      @{ Recurso = "Claudia"; Rol = "PM"; Carga = "85%"; Disponibilidad = "Media" },
      @{ Recurso = "Diego"; Rol = "Fullstack"; Carga = "90%"; Disponibilidad = "Baja" },
      @{ Recurso = "Marta"; Rol = "QA"; Carga = "70%"; Disponibilidad = "Alta" }
    )
    "facturacion" = @(
      @{ Factura = "FS-4001"; Cliente = "Acme Legal"; Importe = "5400"; Estado = "Pendiente" },
      @{ Factura = "FS-4002"; Cliente = "Nova Health"; Importe = "3200"; Estado = "Pagada" }
    )
    "finanzas" = @(
      @{ Movimiento = "Cobro FS-4002"; Tipo = "Ingreso"; Importe = "3200"; Fecha = "2026-04-18" },
      @{ Movimiento = "Licencias cloud"; Tipo = "Gasto"; Importe = "640"; Fecha = "2026-04-17" }
    )
    "rrhh" = @(
      @{ Empleado = "Claudia"; Area = "Delivery"; Estado = "Activa"; Observacion = "Sin incidencias" },
      @{ Empleado = "Diego"; Area = "Tecnologia"; Estado = "Activo"; Observacion = "Guardia semanal" },
      @{ Empleado = "Marta"; Area = "Calidad"; Estado = "Activa"; Observacion = "Vacaciones en mayo" }
    )
    "documentos" = @(
      @{ Documento = "Propuesta Blue Retail"; Tipo = "PDF"; Cliente = "Blue Retail"; Estado = "Enviado" },
      @{ Documento = "Contrato Nova Health"; Tipo = "DOCX"; Cliente = "Nova Health"; Estado = "Firmado" }
    )
    "ajustes" = @(
      @{ Clave = "modelo_facturacion"; Valor = "Bolsa de horas"; Estado = "Activo"; Observacion = "Operacion" },
      @{ Clave = "periodo_reporting"; Valor = "Semanal"; Estado = "Activo"; Observacion = "Seguimiento" }
    )
  }
}

function Get-BusinessCatalog([string]$BusinessType) {
  switch ($BusinessType) {
    "clinica-dental" { return New-ClinicaDentalCatalog }
    "gimnasio" { return New-GimnasioCatalog }
    "peluqueria" { return New-PeluqueriaCatalog }
    "software-factory" { return New-SoftwareFactoryCatalog }
    default { return New-GeneralCatalog }
  }
}

if (-not (Test-Path $ClientFile)) {
  throw "No existe el cliente: $ClientId"
}

$client = Read-Utf8Json $ClientFile

$businessType = "general"
if ($client.PSObject.Properties.Name -contains "businessType" -and $null -ne $client.businessType) {
  $businessType = [string]$client.businessType
}

$catalog = Get-BusinessCatalog $businessType
$selected = [ordered]@{}

if ($null -ne $client.modules) {
  foreach ($module in @($client.modules)) {
    $moduleKey = [string]$module
    if ($catalog.ContainsKey($moduleKey)) {
      $selected[$moduleKey] = $catalog[$moduleKey]
    }
  }
}

if ($selected.Count -eq 0) {
  if ($catalog.ContainsKey("clientes")) {
    $selected["clientes"] = $catalog["clientes"]
  }
}

if ($client.PSObject.Properties.Name -contains "sampleData") {
  $client.sampleData = $selected
}
else {
  $client | Add-Member -NotePropertyName sampleData -NotePropertyValue $selected
}

if ($client.PSObject.Properties.Name -contains "status") {
  $client.status = "updated"
}

Write-Utf8Json $ClientFile $client

$generatorOutput = ""
if (Test-Path $GeneratorScript) {
  $generatorOutput = & $GeneratorScript -ClientId $ClientId 2>&1 | Out-String
}

Write-Output "Datos de muestra cargados correctamente."
Write-Output "Cliente: $ClientId"
Write-Output "BusinessType: $businessType"
Write-Output "Conjuntos: $($selected.Keys -join ', ')"

if (-not [string]::IsNullOrWhiteSpace($generatorOutput)) {
  Write-Output ""
  Write-Output $generatorOutput.Trim()
}
