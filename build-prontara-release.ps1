param(
  [Parameter(Position=0)]
  [string]$ClientRef
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $Root "scripts\lib\tenant-context.ps1")
. (Join-Path $Root "scripts\lib\active-client-registry.ps1")

$RegistryDir = Get-ProntaraClientsRoot -Root $Root
$ExportsDir = Get-ProntaraExportsRoot -Root $Root
$GenerateScript = Join-Path $Root "generate-prontara.ps1"
$ExportScript = Join-Path $Root "export-prontara-package.ps1"

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

function Increment-ProntaraVersion([string]$Version) {
  if ([string]::IsNullOrWhiteSpace($Version)) { return "0.1.0" }

  $parts = $Version.Split(".")
  if ($parts.Count -ne 3) { return "0.1.0" }

  $major = 0
  $minor = 1
  $patch = 0

  [void][int]::TryParse($parts[0], [ref]$major)
  [void][int]::TryParse($parts[1], [ref]$minor)
  [void][int]::TryParse($parts[2], [ref]$patch)

  $patch = $patch + 1
  return "$major.$minor.$patch"
}

$resolved = Resolve-ProntaraClient $ClientRef
if ($null -eq $resolved) {
  Write-Host "No se ha encontrado el cliente indicado ni un cliente activo." -ForegroundColor Red
  exit 1
}

$client = $resolved.Client

if (-not ($client.PSObject.Properties.Name -contains "packageVersion")) {
  $client | Add-Member -NotePropertyName packageVersion -NotePropertyValue "0.1.0"
}
if (-not ($client.PSObject.Properties.Name -contains "buildStatus")) {
  $client | Add-Member -NotePropertyName buildStatus -NotePropertyValue "ready"
}
if (-not ($client.PSObject.Properties.Name -contains "releaseHistory")) {
  $client | Add-Member -NotePropertyName releaseHistory -NotePropertyValue @()
}

$client.packageVersion = Increment-ProntaraVersion $client.packageVersion
$client.buildStatus = "building"
Write-JsonUtf8NoBom $resolved.FilePath $client

if (-not (Test-Path $GenerateScript)) {
  throw "No existe generate-prontara.ps1"
}
if (-not (Test-Path $ExportScript)) {
  throw "No existe export-prontara-package.ps1"
}

Write-Host ""
Write-Host "1. Regenerando ERP..." -ForegroundColor Cyan
& $GenerateScript -ClientId $client.clientId

Write-Host ""
Write-Host "2. Exportando paquete de cliente..." -ForegroundColor Cyan
& $ExportScript $client.clientId

$client = (Get-Content $resolved.FilePath -Raw | ConvertFrom-Json)

if (-not ($client.PSObject.Properties.Name -contains "releaseHistory")) {
  $client | Add-Member -NotePropertyName releaseHistory -NotePropertyValue @()
}
if (-not ($client.PSObject.Properties.Name -contains "delivery")) {
  throw "El cliente no tiene delivery tras el export."
}
if ([string]::IsNullOrWhiteSpace($client.delivery.lastExportPath)) {
  throw "No se ha guardado lastExportPath tras el export."
}

$packagePath = $client.delivery.lastExportPath
if (-not (Test-Path $packagePath)) {
  throw "No existe la ruta exportada: $packagePath"
}

Write-Host ""
Write-Host "3. Limpiando cache de build..." -ForegroundColor Cyan
if (Test-Path (Join-Path $Root ".next")) {
  Remove-Item (Join-Path $Root ".next") -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "4. Ejecutando build..." -ForegroundColor Cyan
Push-Location $Root
try {
  pnpm build
  if ($LASTEXITCODE -ne 0) {
    throw "pnpm build ha fallado."
  }
}
finally {
  Pop-Location
}

$stamp = Get-Date -Format "yyyyMMddHHmmss"
$releaseDir = Join-Path $ExportsDir "$($client.clientId)-release-$stamp"
$deployDir = Join-Path $releaseDir "deploy"
$packageCopyDir = Join-Path $releaseDir "package"
$metaDir = Join-Path $releaseDir "meta"

New-Item -ItemType Directory -Force -Path $releaseDir, $deployDir, $packageCopyDir, $metaDir | Out-Null

Write-Host ""
Write-Host "5. Preparando release..." -ForegroundColor Cyan

if (Test-Path (Join-Path $Root ".next")) {
  Copy-Item (Join-Path $Root ".next") $deployDir -Recurse -Force
}
if (Test-Path (Join-Path $Root "public")) {
  Copy-Item (Join-Path $Root "public") $deployDir -Recurse -Force
}
if (Test-Path (Join-Path $Root "package.json")) {
  Copy-Item (Join-Path $Root "package.json") $deployDir -Force
}
if (Test-Path (Join-Path $Root "pnpm-lock.yaml")) {
  Copy-Item (Join-Path $Root "pnpm-lock.yaml") $deployDir -Force
}
if (Test-Path (Join-Path $Root "tsconfig.json")) {
  Copy-Item (Join-Path $Root "tsconfig.json") $deployDir -Force
}
if (Test-Path (Join-Path $Root "next.config.js")) {
  Copy-Item (Join-Path $Root "next.config.js") $deployDir -Force
}
if (Test-Path (Join-Path $Root "next.config.mjs")) {
  Copy-Item (Join-Path $Root "next.config.mjs") $deployDir -Force
}
if (Test-Path (Join-Path $Root "next.config.ts")) {
  Copy-Item (Join-Path $Root "next.config.ts") $deployDir -Force
}

Copy-Item (Join-Path $packagePath "*") $packageCopyDir -Recurse -Force

$releaseManifest = [ordered]@{
  clientId = $client.clientId
  displayName = $client.displayName
  sector = $client.sector
  businessType = if ($client.PSObject.Properties.Name -contains "businessType") { $client.businessType } else { "" }
  blueprintVersion = if ($client.PSObject.Properties.Name -contains "blueprintVersion") { $client.blueprintVersion } else { "" }
  packageVersion = if ($client.PSObject.Properties.Name -contains "packageVersion") { $client.packageVersion } else { "0.1.0" }
  buildStatus = "built"
  builtAt = (Get-Date).ToString("s")
  releaseDir = $releaseDir
  packageSource = $packagePath
  modules = @($client.modules)
}

$client.buildStatus = "built"

$releaseInfo = @()
$releaseInfo += "RELEASE PRONTARA"
$releaseInfo += "ClientId: $($client.clientId)"
$releaseInfo += "DisplayName: $($client.displayName)"
$releaseInfo += "PackageVersion: $($client.packageVersion)"
$releaseInfo += "BuiltAt: $($releaseManifest.builtAt)"
$releaseInfo += "ReleaseDir: $releaseDir"
$releaseInfo += "PackageSource: $packagePath"

Write-JsonUtf8NoBom (Join-Path $metaDir "release-manifest.json") $releaseManifest
Write-FileUtf8NoBom (Join-Path $metaDir "release-info.txt") ($releaseInfo -join [Environment]::NewLine)

$historyItems = @()
if ($client.releaseHistory) {
  $historyItems += @($client.releaseHistory)
}
$historyItems += [pscustomobject]@{
  at = (Get-Date).ToString("s")
  releaseDir = $releaseDir
  packagePath = $packagePath
  packageVersion = $client.packageVersion
  modules = @($client.modules)
}
$client.releaseHistory = @($historyItems)

Write-JsonUtf8NoBom $resolved.FilePath $client

Write-Host ""
Write-Host "Release generada correctamente." -ForegroundColor Green
Write-Host "Cliente: $($client.displayName)"
Write-Host "ID: $($client.clientId)"
Write-Host "Release: $releaseDir"
Write-Host "PackageVersion: $($client.packageVersion)"
Write-Host ""