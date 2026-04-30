[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$RequirementsText,

    [string]$RequestedName = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path | Split-Path -Parent
. (Join-Path $Root "scripts\lib\tenant-context.ps1")
$ClientsDir = Get-ProntaraClientsRoot -Root $Root
$InstancesDir = Join-Path $Root ".prontara\instances"
$CurrentFile = Join-Path $Root ".prontara\current-client.txt"

New-Item -ItemType Directory -Force $ClientsDir, $InstancesDir | Out-Null

$utf8NoBom = [System.Text.UTF8Encoding]::new($false)

function Write-Utf8File([string]$Path, [string]$Content) {
    [System.IO.File]::WriteAllText($Path, $Content, $utf8NoBom)
}

$buildBlueprintScript = Join-Path $Root "scripts\build-blueprint-from-requirements.ps1"
$convertBlueprintScript = Join-Path $Root "scripts\convert-blueprint-to-client.ps1"

if (-not (Test-Path $buildBlueprintScript)) {
    throw "No existe el script: $buildBlueprintScript"
}

if (-not (Test-Path $convertBlueprintScript)) {
    throw "No existe el script: $convertBlueprintScript"
}

$blueprintJson = & $buildBlueprintScript -RequirementsText $RequirementsText -RequestedName $RequestedName
$clientJson = & $convertBlueprintScript -BlueprintJson $blueprintJson -InstancesDir $InstancesDir

$client = $clientJson | ConvertFrom-Json
$clientFile = Join-Path $ClientsDir "$($client.clientId).json"

Write-Utf8File -Path $clientFile -Content ($client | ConvertTo-Json -Depth 50)
Write-Utf8File -Path $CurrentFile -Content $client.clientId

Write-Host ""
Write-Host "Cliente generado desde requisitos." -ForegroundColor Green
Write-Host "Cliente: $($client.displayName)"
Write-Host "ID: $($client.clientId)"
Write-Host "BusinessType: $($client.businessType)"
Write-Host "Sector: $($client.sector)"
Write-Host "BlueprintVersion: $($client.blueprintVersion)"
Write-Host "Módulos: $($client.modules -join ', ')"
Write-Host "Archivo: $clientFile"
Write-Host ""

$client | ConvertTo-Json -Depth 50
