param(
  [Parameter(Position=0)]
  [string]$ClientRef
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $Root "scripts\lib\tenant-context.ps1")
. (Join-Path $Root "scripts\lib\active-client-registry.ps1")

$RegistryDir = Get-ProntaraClientsRoot -Root $Root

function Write-FileUtf8NoBom([string]$Path, [string]$Text) {
  $dir = Split-Path -Parent $Path
  if (-not [string]::IsNullOrWhiteSpace($dir)) {
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
  }
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Text, $utf8NoBom)
}

function Write-JsonUtf8NoBom([string]$Path, $Object) {
  $json = $Object | ConvertTo-Json -Depth 60
  Write-FileUtf8NoBom $Path $json
}

function Resolve-ProntaraClient([string]$Ref) {
  $resolved = $Ref
  if ([string]::IsNullOrWhiteSpace($resolved)) {
    $resolved = Get-ActiveClientId -Root $Root
  }
  if ([string]::IsNullOrWhiteSpace($resolved)) {
    return $null
  }

  $directFile = Join-Path $RegistryDir "$resolved.json"
  if (Test-Path $directFile) {
    return @{
      Client = (Get-Content $directFile -Raw | ConvertFrom-Json)
      FilePath = $directFile
    }
  }

  $files = Get-ChildItem $RegistryDir -Filter *.json -ErrorAction SilentlyContinue
  foreach ($f in $files) {
    $candidate = Get-Content $f.FullName -Raw | ConvertFrom-Json
    if ($candidate.displayName -eq $resolved -or $candidate.clientId -eq $resolved) {
      return @{
        Client = $candidate
        FilePath = $f.FullName
      }
    }
  }

  return $null
}

Set-Location $Root

$resolved = Resolve-ProntaraClient $ClientRef
if ($null -eq $resolved) {
  Write-Host "No se ha encontrado el cliente indicado ni un cliente activo." -ForegroundColor Red
  exit 1
}

$client = $resolved.Client
$tenantContext = Get-ProntaraTenantContext -ClientId $client.clientId -Root $Root

if (-not ($client.PSObject.Properties.Name -contains "database")) {
  Write-Host "El cliente no tiene bloque database." -ForegroundColor Red
  exit 1
}

if (-not ($client.database.PSObject.Properties.Name -contains "lastAppliedAt")) {
  $client.database | Add-Member -NotePropertyName lastAppliedAt -NotePropertyValue $null
}

if (-not (Test-Path ".\prisma\schema.prisma")) {
  Write-Host "No existe prisma\schema.prisma" -ForegroundColor Red
  exit 1
}

if (-not (Test-Path ".\.env.prontara")) {
  Write-Host "No existe .env.prontara" -ForegroundColor Red
  exit 1
}

Copy-Item ".\.env.prontara" ".\.env" -Force

Write-Host ""
Write-Host "1. Ejecutando prisma generate..." -ForegroundColor Cyan
pnpm exec prisma generate
if ($LASTEXITCODE -ne 0) {
  Write-Host "Fallo en prisma generate." -ForegroundColor Red
  $client.database.status = "error"
  $client.database.lastAppliedAt = (Get-Date).ToString("s")
  Write-JsonUtf8NoBom $tenantContext.definitionPath $client
  exit 1
}

Write-Host ""
Write-Host "2. Ejecutando prisma db push..." -ForegroundColor Cyan
pnpm exec prisma db push --schema prisma/schema.prisma
if ($LASTEXITCODE -ne 0) {
  Write-Host "Fallo en prisma db push." -ForegroundColor Red
  $client.database.status = "error"
  $client.database.lastAppliedAt = (Get-Date).ToString("s")
  Write-JsonUtf8NoBom $tenantContext.definitionPath $client
  exit 1
}

$client.database.status = "applied"
$client.database.lastAppliedAt = (Get-Date).ToString("s")

if (-not ($client.PSObject.Properties.Name -contains "history")) {
  $client | Add-Member -NotePropertyName history -NotePropertyValue @()
}

$historyItems = @()
if ($client.history) {
  $historyItems += @($client.history)
}

$historyItems += [pscustomobject]@{
  at = (Get-Date).ToString("s")
  type = "database_apply"
  text = "Schema Prisma aplicado"
  detectedModules = @()
  removedModule = $null
  resultingModules = @($client.modules)
  packageVersionBefore = if ($client.PSObject.Properties.Name -contains "packageVersion") { $client.packageVersion } else { "" }
  databaseName = $client.database.databaseName
  schemaVersion = $client.database.schemaVersion
}

$client.history = @($historyItems)
Write-JsonUtf8NoBom $tenantContext.definitionPath $client

Write-Host ""
Write-Host "Base de datos aplicada correctamente." -ForegroundColor Green
Write-Host "Cliente: $($client.displayName)"
Write-Host "DatabaseName: $($client.database.databaseName)"
Write-Host "SchemaVersion: $($client.database.schemaVersion)"
Write-Host "Estado DB: $($client.database.status)"
Write-Host ""
