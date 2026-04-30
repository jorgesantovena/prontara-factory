param(
  [Parameter(Position=0)]
  [string]$ClientRef,

  [Parameter(Position=1)]
  [string]$TargetPath
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $Root "scripts\lib\tenant-context.ps1")
. (Join-Path $Root "scripts\lib\active-client-registry.ps1")

$RegistryDir = Get-ProntaraClientsRoot -Root $Root
$DeploymentsDir = Get-ProntaraDeploymentsRoot -Root $Root

function Write-FileUtf8NoBom([string]$Path, [string]$Text) {
  $dir = Split-Path -Parent $Path
  if (-not [string]::IsNullOrWhiteSpace($dir)) {
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
  }

  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Text, $utf8NoBom)
}

function Write-JsonUtf8NoBom([string]$Path, $Object) {
  $json = $Object | ConvertTo-Json -Depth 40
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

function Get-LatestReleaseFromHistory($Client) {
  if (-not ($Client.PSObject.Properties.Name -contains "releaseHistory")) {
    return $null
  }

  $items = @($Client.releaseHistory)
  if ($items.Count -eq 0) {
    return $null
  }

  $sorted = $items | Sort-Object {
    if ($_.PSObject.Properties.Name -contains "at") { [string]$_.at } else { "" }
  } -Descending

  return $sorted[0]
}

function Ensure-DeploymentFields($Client) {
  if (-not ($Client.PSObject.Properties.Name -contains "deployment")) {
    $Client | Add-Member -NotePropertyName deployment -NotePropertyValue ([pscustomobject]@{
      lastDeployedAt = $null
      lastDeployedRelease = $null
      lastDeploymentPath = $null
    })
  }

  if (-not ($Client.PSObject.Properties.Name -contains "deploymentHistory")) {
    $Client | Add-Member -NotePropertyName deploymentHistory -NotePropertyValue @()
  }

  if (-not ($Client.PSObject.Properties.Name -contains "history")) {
    $Client | Add-Member -NotePropertyName history -NotePropertyValue @()
  }

  return $Client
}

$resolved = Resolve-ProntaraClient $ClientRef
if ($null -eq $resolved) {
  Write-Host "No se ha encontrado el cliente indicado ni un cliente activo." -ForegroundColor Red
  exit 1
}

$client = Ensure-DeploymentFields $resolved.Client

$latestRelease = Get-LatestReleaseFromHistory $client
if ($null -eq $latestRelease) {
  Write-Host "El cliente no tiene releases registradas." -ForegroundColor Red
  exit 1
}

$releaseDir = ""
if ($latestRelease.PSObject.Properties.Name -contains "releaseDir") {
  $releaseDir = [string]$latestRelease.releaseDir
}

if ([string]::IsNullOrWhiteSpace($releaseDir) -or -not (Test-Path $releaseDir)) {
  Write-Host "No existe la release a desplegar: $releaseDir" -ForegroundColor Red
  exit 1
}

$targetBase = $TargetPath
if ([string]::IsNullOrWhiteSpace($targetBase)) {
  $targetBase = Join-Path $DeploymentsDir $client.clientId
}

$stamp = Get-Date -Format "yyyyMMddHHmmss"
$deploymentDir = Join-Path $targetBase "deployment-$stamp"

New-Item -ItemType Directory -Force -Path $targetBase, $deploymentDir | Out-Null

Copy-Item -Path (Join-Path $releaseDir "*") -Destination $deploymentDir -Recurse -Force

$deploymentInfo = [ordered]@{
  deployedAt = (Get-Date).ToString("s")
  clientId = $client.clientId
  displayName = $client.displayName
  sector = $client.sector
  businessType = if ($client.PSObject.Properties.Name -contains "businessType") { $client.businessType } else { "" }
  packageVersion = if ($client.PSObject.Properties.Name -contains "packageVersion") { $client.packageVersion } else { "" }
  releaseDir = $releaseDir
  deploymentDir = $deploymentDir
  modules = @($client.modules)
}

Write-JsonUtf8NoBom (Join-Path $deploymentDir "deployment-info.json") $deploymentInfo

$deployEntry = [pscustomobject]@{
  at = (Get-Date).ToString("s")
  releaseDir = $releaseDir
  deploymentDir = $deploymentDir
  packageVersion = if ($client.PSObject.Properties.Name -contains "packageVersion") { $client.packageVersion } else { "" }
  modules = @($client.modules)
}

$deployHistory = @()
if ($client.deploymentHistory) {
  $deployHistory += @($client.deploymentHistory)
}
$deployHistory += $deployEntry
$client.deploymentHistory = @($deployHistory)

$client.deployment.lastDeployedAt = $deployEntry.at
$client.deployment.lastDeployedRelease = $releaseDir
$client.deployment.lastDeploymentPath = $deploymentDir

$historyItems = @()
if ($client.history) {
  $historyItems += @($client.history)
}
$historyItems += [pscustomobject]@{
  at = $deployEntry.at
  type = "deployment"
  text = "Deployment ejecutado"
  detectedModules = @()
  removedModule = $null
  resultingModules = @($client.modules)
  packageVersionBefore = if ($client.PSObject.Properties.Name -contains "packageVersion") { $client.packageVersion } else { "" }
  packageVersion = if ($client.PSObject.Properties.Name -contains "packageVersion") { $client.packageVersion } else { "" }
  releaseDir = $releaseDir
  deploymentDir = $deploymentDir
}
$client.history = @($historyItems | Sort-Object {
  if ($_.PSObject.Properties.Name -contains "at") { [string]$_.at } else { "" }
})

Write-JsonUtf8NoBom $resolved.FilePath $client

Write-Host ""
Write-Host "Deployment generado correctamente." -ForegroundColor Green
Write-Host "Cliente: $($client.displayName)"
Write-Host "ID: $($client.clientId)"
Write-Host "Release usada: $releaseDir"
Write-Host "Deployment: $deploymentDir"
Write-Host "PackageVersion: $($client.packageVersion)"
Write-Host ""