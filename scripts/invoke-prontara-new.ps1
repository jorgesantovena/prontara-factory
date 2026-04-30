[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Text,

    [Parameter(Mandatory = $true)]
    [string]$Root
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$CurrentFile = Join-Path $Root ".prontara\current-client.txt"
$RegistryDir = Get-ProntaraClientsRoot -Root $Root
$InstancesDir = Join-Path $Root ".prontara\instances"
$GenerateScript = Join-Path $Root "generate-prontara.ps1"
$LegacyNewScript = Join-Path $Root "prontara.ps1"
$UniversalNewScript = Join-Path $Root "scripts\new-client-from-requirements.ps1"

$utf8NoBom = [System.Text.UTF8Encoding]::new($false)

function Write-Utf8File([string]$Path, [string]$Content) {
    [System.IO.File]::WriteAllText($Path, $Content, $utf8NoBom)
}

function Test-StructuredRequirements([string]$InputText) {
    if ([string]::IsNullOrWhiteSpace($InputText)) {
        return $false
    }

    $text = $InputText.Trim()

    if ($text.Length -ge 350) { return $true }
    if ($text -match "(`r`n|`n).+(`r`n|`n)") { return $true }
    if ($text -match '(?i)\bmvp\b|\bfase 2\b|\bsegunda fase\b') { return $true }
    if ($text -match '(?i)cadena principal|prioridad real|dashboard|reporting|timesheets|rrhh|crm') { return $true }
    if ($text -match '(?m)^\s*[-*]\s+') { return $true }
    if ($text -match '(?m)^\s*\d+\.\s+') { return $true }

    return $false
}

if (-not (Test-Path $UniversalNewScript)) {
    throw "No existe el script de alta universal: $UniversalNewScript"
}

if (-not (Test-Path $GenerateScript)) {
    throw "No existe el generador: $GenerateScript"
}

if (Test-StructuredRequirements $Text) {
    $clientJson = & $UniversalNewScript -RequirementsText $Text
    $client = $clientJson | ConvertFrom-Json

    Write-Utf8File -Path $CurrentFile -Content $client.clientId

    Write-Host ""
    Write-Host "Alta resuelta mediante analisis de requisitos." -ForegroundColor Green
    Write-Host "Cliente: $($client.displayName)"
    Write-Host "ID: $($client.clientId)"
    Write-Host "BusinessType: $($client.businessType)"
    Write-Host "Sector: $($client.sector)"
    Write-Host "BlueprintVersion: $($client.blueprintVersion)"
    Write-Host "Módulos: $($client.modules -join ', ')"
    Write-Host "Cliente activo: $($client.clientId)"
    Write-Host ""

    & $GenerateScript -ClientId $client.clientId
    exit $LASTEXITCODE
}

Write-Host ""
Write-Host "Entrada breve detectada. Usa el flujo corto existente." -ForegroundColor Cyan
Write-Host "Sigue usando:"
Write-Host '  .\prontara.ps1 new "<descripcion breve>"'
Write-Host ""
Write-Host "Todavia no se ha integrado automaticamente el flujo corto en este router para evitar romper el sistema." -ForegroundColor Yellow
Write-Host "Usa el comando corto normal para altas simples." -ForegroundColor Yellow
Write-Host ""
exit 2
