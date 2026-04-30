# -----------------------------------------------------------------------------
# DEPRECATED (F-09) — este script se conserva solo para compatibilidad.
# Reemplazo canónico:
#   node scripts/ts/prontara.mjs blueprint <businessType> [--name "<nombre>"]
# Implementación de referencia: scripts/ts/build-blueprint.mjs
# Ver docs/scripts-migration-plan.md para el plan de jubilación.
# -----------------------------------------------------------------------------
function New-ProntaraBlueprintData {
  param(
    [Parameter(Mandatory = $true)]
    [string]$BusinessType,
    [Parameter(Mandatory = $true)]
    [string]$LegacySector,
    [Parameter(Mandatory = $true)]
    [string]$DisplayName,
    [string[]]$CoreModules = @(),
    [string[]]$OptionalModules = @(),
    [string[]]$Entities = @(),
    [string[]]$Workflows = @()
  )

  return [pscustomobject]@{
    BusinessType     = $BusinessType
    DisplayName      = $DisplayName
    LegacySector     = $LegacySector
    BlueprintVersion = "0.1.0"
    Branding         = [pscustomobject]@{
      appName  = $DisplayName
      logoText = $DisplayName
    }
    CoreModules     = @($CoreModules)
    OptionalModules = @($OptionalModules)
    Entities        = @($Entities)
    Workflows       = @($Workflows)
  }
}

function New-ProntaraBlueprint([string]$businessType, [string]$requestedName = "") {
  $business = Get-ProntaraBusinessByKey $businessType

  if ($null -eq $business) {
    throw "No existe el businessType: $businessType"
  }

  $defaultName = $business.SuggestedName
  if ([string]::IsNullOrWhiteSpace($defaultName)) {
    $defaultName = "Prontara ERP"
  }

  $displayName = $defaultName
  if (-not [string]::IsNullOrWhiteSpace($requestedName)) {
    $displayName = $requestedName.Trim()
  }

  $data = $null

  switch ($business.Key) {
    "clinica-dental" {
      $data = New-ProntaraBlueprintData `
        -BusinessType "clinica-dental" `
        -LegacySector "clinica" `
        -DisplayName $displayName `
        -CoreModules @("clientes","citas","documentos","facturacion","ajustes") `
        -OptionalModules @("cobros","historiales","recordatorios") `
        -Entities @("pacientes","citas","facturas","documentos") `
        -Workflows @("agenda-clinica","facturacion-clinica")
      break
    }

    "panaderia" {
      $data = New-ProntaraBlueprintData `
        -BusinessType "panaderia" `
        -LegacySector "panaderia" `
        -DisplayName $displayName `
        -CoreModules @("productos","compras","ventas","pedidos","almacen","facturacion","ajustes") `
        -OptionalModules @("produccion","repartos","cobros") `
        -Entities @("productos","pedidos","ventas","facturas","stock") `
        -Workflows @("ventas-mostrador","reposicion","pedido-cliente")
      break
    }

    "taller-auto" {
      $data = New-ProntaraBlueprintData `
        -BusinessType "taller-auto" `
        -LegacySector "taller-auto" `
        -DisplayName $displayName `
        -CoreModules @("clientes","vehiculos","ordenes_trabajo","citas","facturacion","cobros","ajustes","taller") `
        -OptionalModules @("recambios","presupuestos","partes") `
        -Entities @("clientes","vehiculos","ordenes","citas","facturas","cobros") `
        -Workflows @("recepcion-vehiculo","orden-trabajo","cierre-reparacion")
      break
    }

    "software-factory" {
      $data = New-ProntaraBlueprintData `
        -BusinessType "software-factory" `
        -LegacySector "estandar" `
        -DisplayName $displayName `
        -CoreModules @("clientes","ventas","facturacion","ajustes","documentos","proyectos","tareas") `
        -OptionalModules @("imputacion","soporte","cobros") `
        -Entities @("clientes","proyectos","tareas","facturas","documentos") `
        -Workflows @("alta-proyecto","seguimiento-proyecto","facturacion-servicios")
      break
    }

    "gimnasio" {
      $data = New-ProntaraBlueprintData `
        -BusinessType "gimnasio" `
        -LegacySector "gimnasio" `
        -DisplayName $displayName `
        -CoreModules @("clientes","crm","proyectos","presupuestos","facturacion","documentos","ajustes") `
        -OptionalModules @("asistencias","cuotas-recurrentes","clases") `
        -Entities @("socios","planes","cuotas","clases") `
        -Workflows @("alta-socio","renovacion-cuota","baja-socio")
      break
    }

    "peluqueria" {
      $data = New-ProntaraBlueprintData `
        -BusinessType "peluqueria" `
        -LegacySector "peluqueria" `
        -DisplayName $displayName `
        -CoreModules @("clientes","crm","proyectos","presupuestos","facturacion","documentos","ajustes") `
        -OptionalModules @("citas","catalogo-servicios","productos") `
        -Entities @("clientes","servicios","tickets","citas") `
        -Workflows @("reserva-cita","cierre-servicio","fidelizacion-cliente")
      break
    }

    "colegio" {
      $data = New-ProntaraBlueprintData `
        -BusinessType "colegio" `
        -LegacySector "colegio" `
        -DisplayName $displayName `
        -CoreModules @("clientes","crm","proyectos","presupuestos","facturacion","documentos","ajustes") `
        -OptionalModules @("matriculas","asistencias","comunicaciones") `
        -Entities @("familias","cursos","recibos","expedientes") `
        -Workflows @("matricula-alumno","emision-recibos","gestion-expediente")
      break
    }

    default {
      $modules = @()
      if ($null -ne $business.Modules) {
        $modules = @($business.Modules)
      }

      if ($modules.Count -eq 0) {
        $modules = @("clientes","ventas","facturacion","ajustes")
      }

      $legacySector = $business.LegacySector
      if ([string]::IsNullOrWhiteSpace($legacySector)) {
        $legacySector = "estandar"
      }

      $data = New-ProntaraBlueprintData `
        -BusinessType $business.Key `
        -LegacySector $legacySector `
        -DisplayName $displayName `
        -CoreModules $modules `
        -OptionalModules @() `
        -Entities @() `
        -Workflows @()
      break
    }
  }

  return [pscustomobject]@{
    BusinessType     = $data.BusinessType
    BusinessName     = $data.DisplayName
    DisplayName      = $data.DisplayName
    LegacySector     = $data.LegacySector
    BlueprintVersion = $data.BlueprintVersion
    Modules          = @($data.CoreModules)
    Branding         = $data.Branding
    CoreModules      = @($data.CoreModules)
    OptionalModules  = @($data.OptionalModules)
    Entities         = @($data.Entities)
    Workflows        = @($data.Workflows)
  }
}
