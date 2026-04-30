[CmdletBinding()]
param(
    [string]$ProjectRoot = "C:\ProntaraFactory\prontara-factory"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Ensure-Directory {
    param([Parameter(Mandatory = $true)][string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) {
        New-Item -ItemType Directory -Path $Path -Force | Out-Null
    }
}

function Read-JsonSafe {
    param([Parameter(Mandatory = $true)][string]$Path)
    try {
        return Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
    }
    catch {
        return $null
    }
}

function Write-TextUtf8NoBom {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Content
    )

    $parent = Split-Path -Path $Path -Parent
    if ($parent) {
        Ensure-Directory -Path $parent
    }

    $utf8NoBom = [System.Text.UTF8Encoding]::new($false)
    [System.IO.File]::WriteAllText($Path, $Content, $utf8NoBom)
}

function Backup-IfExists {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$BackupRoot,
        [Parameter(Mandatory = $true)][string]$ProjectRootForRelative
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        return
    }

    $relative = $Path.Substring($ProjectRootForRelative.Length).TrimStart("\")
    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $backupPath = Join-Path $BackupRoot ($relative + "." + $timestamp + ".bak")
    $backupDir = Split-Path -Path $backupPath -Parent

    Ensure-Directory -Path $backupDir
    Copy-Item -LiteralPath $Path -Destination $backupPath -Force
}

function Get-StringProp {
    param(
        [Parameter(Mandatory = $true)]$Object,
        [Parameter(Mandatory = $true)][string]$Name
    )

    $prop = $Object.PSObject.Properties[$Name]
    if ($null -eq $prop) { return "" }
    if ($null -eq $prop.Value) { return "" }
    return [string]$prop.Value
}

function Set-Prop {
    param(
        [Parameter(Mandatory = $true)]$Object,
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $false)]$Value
    )

    $Object | Add-Member -NotePropertyName $Name -NotePropertyValue $Value -Force
}

function Force-Array {
    param([Parameter(Mandatory = $true)]$Value)

    if ($null -eq $Value) {
        return @()
    }

    if ($Value -is [System.Array]) {
        return @($Value)
    }

    return @($Value)
}

function Convert-ToJsonArrayText {
    param([Parameter(Mandatory = $true)][object[]]$Items)

    if ($Items.Count -eq 0) {
        return "[]"
    }

    $parts = @()
    foreach ($item in $Items) {
        $parts += ($item | ConvertTo-Json -Depth 20)
    }

    return "[`r`n" + ($parts -join ",`r`n") + "`r`n]"
}

if (-not (Test-Path -LiteralPath $ProjectRoot)) {
    throw "No existe la ruta del proyecto: $ProjectRoot"
}

Set-Location -LiteralPath $ProjectRoot

$backupRoot = Join-Path $ProjectRoot "backups\fix-core-links-and-arrays"
$activeClientFile = Join-Path $ProjectRoot "data\factory\active-client.json"
$clientsRoot = Join-Path $ProjectRoot ".prontara\clients"
$dataRoot = Join-Path $ProjectRoot ".prontara\data"

$activeJson = Read-JsonSafe -Path $activeClientFile
if ($null -eq $activeJson) {
    throw "active-client.json esta roto o no existe"
}

$clientId = Get-StringProp -Object $activeJson -Name "clientId"
if ([string]::IsNullOrWhiteSpace($clientId)) {
    throw "No hay cliente activo"
}

$dataDir = Join-Path $dataRoot $clientId
if (-not (Test-Path -LiteralPath $dataDir)) {
    throw "No existe la carpeta data del cliente activo: $dataDir"
}

$clientesPath = Join-Path $dataDir "clientes.json"
$crmPath = Join-Path $dataDir "crm.json"
$presupuestosPath = Join-Path $dataDir "presupuestos.json"
$facturacionPath = Join-Path $dataDir "facturacion.json"
$documentosPath = Join-Path $dataDir "documentos.json"

$requiredPaths = @($clientesPath, $crmPath, $presupuestosPath, $facturacionPath, $documentosPath)
foreach ($path in $requiredPaths) {
    if (-not (Test-Path -LiteralPath $path)) {
        throw "Falta el archivo requerido: $path"
    }
}

$clientes = Force-Array (Read-JsonSafe -Path $clientesPath)
$crm = Force-Array (Read-JsonSafe -Path $crmPath)
$presupuestos = Force-Array (Read-JsonSafe -Path $presupuestosPath)
$facturas = Force-Array (Read-JsonSafe -Path $facturacionPath)
$documentos = Force-Array (Read-JsonSafe -Path $documentosPath)

if (@($clientes).Count -eq 0) {
    throw "clientes.json esta vacio"
}

Backup-IfExists -Path $crmPath -BackupRoot $backupRoot -ProjectRootForRelative $ProjectRoot
Backup-IfExists -Path $presupuestosPath -BackupRoot $backupRoot -ProjectRootForRelative $ProjectRoot
Backup-IfExists -Path $facturacionPath -BackupRoot $backupRoot -ProjectRootForRelative $ProjectRoot
Backup-IfExists -Path $documentosPath -BackupRoot $backupRoot -ProjectRootForRelative $ProjectRoot

$clienteBase = @($clientes)[0]
$clienteBaseId = Get-StringProp -Object $clienteBase -Name "id"
$clienteBaseNombre = Get-StringProp -Object $clienteBase -Name "nombre"

if ([string]::IsNullOrWhiteSpace($clienteBaseId)) {
    $clienteBaseId = [guid]::NewGuid().ToString()
    Set-Prop -Object $clienteBase -Name "id" -Value $clienteBaseId
}

if ([string]::IsNullOrWhiteSpace($clienteBaseNombre)) {
    $clienteBaseNombre = "Cliente principal"
    Set-Prop -Object $clienteBase -Name "nombre" -Value $clienteBaseNombre
}

$presupuestoBaseId = ""
$presupuestoBaseNumero = ""
if (@($presupuestos).Count -gt 0) {
    $presupuestoBase = @($presupuestos)[0]
    $presupuestoBaseId = Get-StringProp -Object $presupuestoBase -Name "id"
    $presupuestoBaseNumero = Get-StringProp -Object $presupuestoBase -Name "numero"
}

foreach ($item in $crm) {
    Set-Prop -Object $item -Name "clienteId" -Value $clienteBaseId
    Set-Prop -Object $item -Name "clienteNombre" -Value $clienteBaseNombre
}

foreach ($item in $presupuestos) {
    Set-Prop -Object $item -Name "clienteId" -Value $clienteBaseId
    Set-Prop -Object $item -Name "clienteNombre" -Value $clienteBaseNombre
}

foreach ($item in $facturas) {
    Set-Prop -Object $item -Name "clienteId" -Value $clienteBaseId
    Set-Prop -Object $item -Name "clienteNombre" -Value $clienteBaseNombre

    if (-not [string]::IsNullOrWhiteSpace($presupuestoBaseId)) {
        Set-Prop -Object $item -Name "presupuestoId" -Value $presupuestoBaseId
    }

    if (-not [string]::IsNullOrWhiteSpace($presupuestoBaseNumero)) {
        Set-Prop -Object $item -Name "presupuestoNumero" -Value $presupuestoBaseNumero
    }
}

foreach ($item in $documentos) {
    Set-Prop -Object $item -Name "clienteId" -Value $clienteBaseId
    Set-Prop -Object $item -Name "clienteNombre" -Value $clienteBaseNombre
    Set-Prop -Object $item -Name "origenModulo" -Value "clientes"
    Set-Prop -Object $item -Name "entidad" -Value "cliente"
    Set-Prop -Object $item -Name "entidadId" -Value $clienteBaseId
}

Write-TextUtf8NoBom -Path $clientesPath -Content (Convert-ToJsonArrayText -Items $clientes)
Write-TextUtf8NoBom -Path $crmPath -Content (Convert-ToJsonArrayText -Items $crm)
Write-TextUtf8NoBom -Path $presupuestosPath -Content (Convert-ToJsonArrayText -Items $presupuestos)
Write-TextUtf8NoBom -Path $facturacionPath -Content (Convert-ToJsonArrayText -Items $facturas)
Write-TextUtf8NoBom -Path $documentosPath -Content (Convert-ToJsonArrayText -Items $documentos)

Write-Host ""
Write-Host "=== FIX CORE LINKS + ARRAYS COMPLETADO ===" -ForegroundColor Green
Write-Host ("Cliente activo: " + $clientId) -ForegroundColor Green
Write-Host ("Cliente base: " + $clienteBaseNombre + " [" + $clienteBaseId + "]") -ForegroundColor Green
Write-Host ""
Write-Host "Comprobacion rapida:" -ForegroundColor Cyan
Write-Host (" - " + $crmPath)
Write-Host (" - " + $presupuestosPath)
Write-Host (" - " + $facturacionPath)
Write-Host (" - " + $documentosPath)
Write-Host ""
Write-Host "Backups en:" -ForegroundColor Yellow
Write-Host (" - " + $backupRoot)
Write-Host ""
Write-Host "Ahora ejecuta exactamente esto:" -ForegroundColor Cyan
Write-Host 'Get-Content ".\.prontara\data\estandar-20260419194129\crm.json" -Raw'
Write-Host 'Get-Content ".\.prontara\data\estandar-20260419194129\presupuestos.json" -Raw'
Write-Host 'Get-Content ".\.prontara\data\estandar-20260419194129\facturacion.json" -Raw'
Write-Host 'Get-Content ".\.prontara\data\estandar-20260419194129\documentos.json" -Raw'