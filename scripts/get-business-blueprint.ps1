[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$BusinessType
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function New-Blueprint {
    param(
        [Parameter(Mandatory = $true)]
        [string]$BusinessType,
        [Parameter(Mandatory = $true)]
        [string]$Sector,
        [Parameter(Mandatory = $true)]
        [string]$DisplayName,
        [Parameter(Mandatory = $true)]
        [string[]]$CoreModules,
        [string[]]$OptionalModules = @(),
        [string[]]$Entities = @(),
        [string[]]$Workflows = @()
    )

    return [pscustomobject]@{
        businessType     = $BusinessType
        sector           = $Sector
        blueprintVersion = "0.1.0"
        displayName      = $DisplayName
        branding         = [pscustomobject]@{
            appName  = $DisplayName
            logoText = $DisplayName
        }
        coreModules      = @($CoreModules)
        optionalModules  = @($OptionalModules)
        entities         = @($Entities)
        workflows        = @($Workflows)
    }
}

switch ($BusinessType) {
    "clinica-dental" {
        $blueprint = New-Blueprint `
            -BusinessType "clinica-dental" `
            -Sector "clinica" `
            -DisplayName "Prontara Clínica" `
            -CoreModules @("clientes","citas","documentos","facturacion","ajustes") `
            -OptionalModules @("cobros","historiales","recordatorios") `
            -Entities @("pacientes","citas","facturas","documentos") `
            -Workflows @("agenda-clinica","facturacion-clinica")
        break
    }

    "panaderia" {
        $blueprint = New-Blueprint `
            -BusinessType "panaderia" `
            -Sector "panaderia" `
            -DisplayName "Prontara Panadería" `
            -CoreModules @("productos","compras","ventas","pedidos","almacen","facturacion","ajustes") `
            -OptionalModules @("produccion","repartos","cobros") `
            -Entities @("productos","pedidos","ventas","facturas","stock") `
            -Workflows @("ventas-mostrador","reposicion","pedido-cliente")
        break
    }

    "taller-auto" {
        $blueprint = New-Blueprint `
            -BusinessType "taller-auto" `
            -Sector "taller-auto" `
            -DisplayName "Prontara Taller Auto" `
            -CoreModules @("clientes","vehiculos","ordenes_trabajo","citas","facturacion","cobros","ajustes","taller") `
            -OptionalModules @("recambios","presupuestos","partes") `
            -Entities @("clientes","vehiculos","ordenes","citas","facturas","cobros") `
            -Workflows @("recepcion-vehiculo","orden-trabajo","cierre-reparacion")
        break
    }

    "software-factory" {
        $blueprint = New-Blueprint `
            -BusinessType "software-factory" `
            -Sector "estandar" `
            -DisplayName "Prontara Software Factory" `
            -CoreModules @("clientes","ventas","facturacion","ajustes","documentos","proyectos","tareas") `
            -OptionalModules @("imputacion","soporte","cobros") `
            -Entities @("clientes","proyectos","tareas","facturas","documentos") `
            -Workflows @("alta-proyecto","seguimiento-proyecto","facturacion-servicios")
        break
    }

    default {
        $blueprint = New-Blueprint `
            -BusinessType "estandar" `
            -Sector "estandar" `
            -DisplayName "Prontara ERP" `
            -CoreModules @("clientes","ventas","facturacion","ajustes") `
            -OptionalModules @("compras","documentos","cobros") `
            -Entities @("clientes","ventas","facturas") `
            -Workflows @("venta","facturacion")
        break
    }
}

$blueprint | ConvertTo-Json -Depth 20
