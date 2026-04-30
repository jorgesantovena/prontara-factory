[CmdletBinding()]
param(
    [string]$ProjectRoot = "C:\ProntaraFactory\prontara-factory"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Show-Line {
    param([string]$Text)
    Write-Host $Text
}

function Read-JsonSafe {
    param([string]$Path)
    try {
        return Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
    }
    catch {
        return $null
    }
}

if (-not (Test-Path -LiteralPath $ProjectRoot)) {
    throw "No existe la ruta del proyecto: $ProjectRoot"
}

$activeClientFile = Join-Path $ProjectRoot "data\factory\active-client.json"
$clientsDir = Join-Path $ProjectRoot ".prontara\clients"
$dataDir = Join-Path $ProjectRoot ".prontara\data"
$artifactsDir = Join-Path $ProjectRoot ".prontara\artifacts"

Show-Line ""
Show-Line "=== HEALTH CHECK RUNTIME ==="

if (-not (Test-Path -LiteralPath $activeClientFile)) {
    Show-Line "ERROR: no existe active-client.json"
    exit 1
}

$active = Read-JsonSafe -Path $activeClientFile
if ($null -eq $active) {
    Show-Line "ERROR: active-client.json roto"
    exit 1
}

$clientId = [string]$active.clientId
if ([string]::IsNullOrWhiteSpace($clientId)) {
    Show-Line "ERROR: no hay cliente activo"
    exit 1
}

Show-Line ("Cliente activo: " + $clientId)

$clientJsonPath = Join-Path $clientsDir ($clientId + ".json")
if (-not (Test-Path -LiteralPath $clientJsonPath)) {
    Show-Line "ERROR: no existe el JSON del cliente activo"
    exit 1
}

Show-Line "OK: existe JSON del cliente activo"

$clientDataDir = Join-Path $dataDir $clientId
if (-not (Test-Path -LiteralPath $clientDataDir)) {
    Show-Line "WARN: no existe carpeta data del cliente activo"
}
else {
    Show-Line "OK: existe carpeta data del cliente activo"
    Get-ChildItem -LiteralPath $clientDataDir -File -ErrorAction SilentlyContinue |
        Select-Object Name, Length, LastWriteTime |
        Format-Table -AutoSize
}

$clientArtifactsDir = Join-Path $artifactsDir $clientId
if (-not (Test-Path -LiteralPath $clientArtifactsDir)) {
    Show-Line "WARN: no existe carpeta artifacts del cliente activo"
}
else {
    Show-Line "OK: existe carpeta artifacts del cliente activo"
    Get-ChildItem -LiteralPath $clientArtifactsDir -File -ErrorAction SilentlyContinue |
        Select-Object Name, Length, LastWriteTime |
        Format-Table -AutoSize
}