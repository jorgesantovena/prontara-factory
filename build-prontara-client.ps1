param(
  [Parameter(Position=0)]
  [string]$ClientId
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $Root "scripts\lib\tenant-context.ps1")
. (Join-Path $Root "scripts\lib\active-client-registry.ps1")

$ClientsDir = Get-ProntaraClientsRoot -Root $Root
$InstancesDir = Join-Path $Root ".prontara\instances"

function Write-FileUtf8NoBom([string]$Path, [string]$Text) {
  $dir = Split-Path -Parent $Path
  if (-not [string]::IsNullOrWhiteSpace($dir)) {
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
  }
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Text, $utf8NoBom)
}

function Write-JsonUtf8NoBom([string]$Path, $Object) {
  $json = $Object | ConvertTo-Json -Depth 20
  Write-FileUtf8NoBom $Path $json
}

if ([string]::IsNullOrWhiteSpace($ClientId)) {
  $ClientId = Get-ActiveClientId -Root $Root
}

if ([string]::IsNullOrWhiteSpace($ClientId)) {
  Write-Host "No se indicó ClientId y no hay cliente activo." -ForegroundColor Red
  Write-Host "Usa: data/factory/active-client.json o pasa el clientId por parámetro." -ForegroundColor Yellow
  exit 1
}

$clientFile = Join-Path $ClientsDir ($ClientId + ".json")
if (-not (Test-Path $clientFile)) {
  Write-Host "No existe el cliente: $ClientId" -ForegroundColor Red
  exit 1
}

$client = Get-Content $clientFile -Raw | ConvertFrom-Json
$instancePath = Join-Path $InstancesDir $ClientId

if (-not (Test-Path $instancePath)) {
  New-Item -ItemType Directory -Force $instancePath | Out-Null
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   BUILD CLIENT - PRONTARA" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Cliente:  $($client.displayName)"
Write-Host "ID:       $($client.clientId)"
Write-Host "Sector:   $($client.sector)"
Write-Host "Ruta:     $instancePath"
Write-Host ""

Push-Location $Root

try {
  if (Test-Path ".\package.json") {
    Write-Host "Instalando dependencias..." -ForegroundColor Yellow
    pnpm install

    Write-Host ""
    Write-Host "Lanzando build..." -ForegroundColor Yellow
    pnpm build
  } else {
    Write-Host "No se encontró package.json en la raíz del proyecto." -ForegroundColor Red
    exit 1
  }

  $client.status = "built"

  if (-not $client.PSObject.Properties.Name.Contains("updates")) {
    $client | Add-Member -MemberType NoteProperty -Name updates -Value @()
  }

  $stamp = (Get-Date).ToString("s")
  $msg = "build client ejecutado"
  $client.updates = @($client.updates) + @("[$stamp] $msg")

  Write-JsonUtf8NoBom $clientFile $client

  Write-Host ""
  Write-Host "Build completado correctamente." -ForegroundColor Green
}
catch {
  Write-Host ""
  Write-Host "Error durante el build:" -ForegroundColor Red
  Write-Host $_.Exception.Message -ForegroundColor Red
  exit 1
}
finally {
  Pop-Location
}