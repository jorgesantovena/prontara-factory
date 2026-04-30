param(
  [Parameter(Position=0)]
  [string]$ClientRef
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $Root "scripts\lib\active-client-registry.ps1")
. (Join-Path $Root "scripts\lib\tenant-context.ps1")
$RegistryDir = Get-ProntaraClientsRoot -Root $Root
$CurrentFile = Get-ProntaraLegacyCurrentClientPath -Root $Root
$ExportsDir = Get-ProntaraExportsRoot -Root $Root

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

function Get-CurrentClientId {
  if (Test-Path $CurrentFile) {
    $id = (Get-Content $CurrentFile -Raw).Trim()
    if (-not [string]::IsNullOrWhiteSpace($id)) {
      return $id
    }
  }
  return $null
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

function Ensure-ClientDeliveryFields($Client) {
  if (-not ($Client.PSObject.Properties.Name -contains "packageVersion")) {
    $Client | Add-Member -NotePropertyName packageVersion -NotePropertyValue "0.1.0"
  }

  if (-not ($Client.PSObject.Properties.Name -contains "buildStatus")) {
    $Client | Add-Member -NotePropertyName buildStatus -NotePropertyValue "ready"
  }

  if (-not ($Client.PSObject.Properties.Name -contains "branding")) {
    $Client | Add-Member -NotePropertyName branding -NotePropertyValue ([pscustomobject]@{
      appName = $Client.displayName
      logoText = $Client.displayName
      primaryColor = "#2563eb"
    })
  }

  if (-not ($Client.PSObject.Properties.Name -contains "delivery")) {
    $Client | Add-Member -NotePropertyName delivery -NotePropertyValue ([pscustomobject]@{
      exportFormat = "folder"
      lastExportAt = $null
      lastExportPath = $null
    })
  }

  if (-not ($Client.PSObject.Properties.Name -contains "maintenance")) {
    $Client | Add-Member -NotePropertyName maintenance -NotePropertyValue ([pscustomobject]@{
      channel = "remote"
      updatable = $true
    })
  }

  return $Client
}

function Save-ClientJson([string]$Path, $Client) {
  Write-JsonUtf8NoBom $Path $Client
}

function Export-ProntaraClientPackage($Client) {
  New-Item -ItemType Directory -Force -Path $ExportsDir | Out-Null

  $stamp = Get-Date -Format "yyyyMMddHHmmss"
  $packageDir = Join-Path $ExportsDir "$($Client.clientId)-package-$stamp"
  $appDir = Join-Path $packageDir "app"
  $metaDir = Join-Path $packageDir "meta"

  New-Item -ItemType Directory -Force -Path $packageDir, $appDir, $metaDir | Out-Null

  if ($Client.instancePath -and (Test-Path $Client.instancePath)) {
    Copy-Item -Path (Join-Path $Client.instancePath "*") -Destination $appDir -Recurse -Force -ErrorAction SilentlyContinue
  }

  $businessTypeValue = ""
  if ($Client.PSObject.Properties.Name -contains "businessType") {
    $businessTypeValue = [string]$Client.businessType
  }

  $blueprintVersionValue = ""
  if ($Client.PSObject.Properties.Name -contains "blueprintVersion") {
    $blueprintVersionValue = [string]$Client.blueprintVersion
  }

  $manifest = [ordered]@{
    clientId = $Client.clientId
    displayName = $Client.displayName
    sector = $Client.sector
    businessType = $businessTypeValue
    blueprintVersion = $blueprintVersionValue
    packageVersion = $Client.packageVersion
    buildStatus = $Client.buildStatus
    exportedAt = (Get-Date).ToString("s")
    runtime = $Client.runtime
    version = $Client.version
    modules = @($Client.modules)
    instanceSource = $Client.instancePath
    branding = $Client.branding
    maintenance = $Client.maintenance
  }

  $summary = @()
  $summary += "Cliente: $($Client.displayName)"
  $summary += "ID: $($Client.clientId)"
  $summary += "Sector: $($Client.sector)"
  if ($businessTypeValue) { $summary += "BusinessType: $businessTypeValue" }
  if ($blueprintVersionValue) { $summary += "BlueprintVersion: $blueprintVersionValue" }
  $summary += "PackageVersion: $($Client.packageVersion)"
  $summary += "BuildStatus: $($Client.buildStatus)"
  $summary += "Version app: $($Client.version)"
  $summary += "Exportado: $((Get-Date).ToString("s"))"
  $summary += "Modulos: $($Client.modules -join ', ')"

  $install = @()
  $install += "INSTALACION / DESPLIEGUE"
  $install += ""
  $install += "1. Copiar el contenido de la carpeta app al servidor o equipo destino."
  $install += "2. Instalar dependencias con pnpm install si aplica."
  $install += "3. Usar pnpm dev para pruebas o pnpm build para despliegue."
  $install += "4. Conservar meta/client.json para futuras actualizaciones y mantenimiento."
  $install += ""
  $install += "Cliente: $($Client.displayName)"
  $install += "ID: $($Client.clientId)"
  if ($businessTypeValue) {
    $install += "BusinessType: $businessTypeValue"
  }

  Write-JsonUtf8NoBom (Join-Path $metaDir "client.json") $Client
  Write-JsonUtf8NoBom (Join-Path $metaDir "manifest.json") $manifest
  Write-FileUtf8NoBom (Join-Path $metaDir "summary.txt") ($summary -join [Environment]::NewLine)
  Write-FileUtf8NoBom (Join-Path $metaDir "install-info.txt") ($install -join [Environment]::NewLine)
  Write-FileUtf8NoBom (Join-Path $metaDir "version.txt") $Client.packageVersion

  $legacySummaryPath = Join-Path $ExportsDir "$($Client.clientId).txt"
  Write-FileUtf8NoBom $legacySummaryPath ($summary -join [Environment]::NewLine)

  return @{
    PackageDir = $packageDir
    AppDir = $appDir
    MetaDir = $metaDir
    LegacySummaryPath = $legacySummaryPath
  }
}

$resolved = Resolve-ProntaraClient $ClientRef

if ($null -eq $resolved) {
  Write-Host "No se ha encontrado el cliente indicado ni un cliente activo." -ForegroundColor Red
  exit 1
}

$client = Ensure-ClientDeliveryFields $resolved.Client
$result = Export-ProntaraClientPackage $client

$client.delivery.lastExportAt = (Get-Date).ToString("s")
$client.delivery.lastExportPath = $result.PackageDir
Save-ClientJson $resolved.FilePath $client

Write-Host ""
Write-Host "Export generado correctamente." -ForegroundColor Green
Write-Host "Cliente: $($client.displayName)"
Write-Host "ID: $($client.clientId)"
Write-Host "PackageVersion: $($client.packageVersion)"
Write-Host "BuildStatus: $($client.buildStatus)"
Write-Host "Paquete: $($result.PackageDir)"
Write-Host "App: $($result.AppDir)"
Write-Host "Meta: $($result.MetaDir)"
Write-Host "Resumen legacy: $($result.LegacySummaryPath)"
Write-Host ""
