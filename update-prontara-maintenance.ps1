param(
  [Parameter(Position=0)]
  [string]$ClientRef,

  [Parameter(Position=1)]
  [string]$ChangeText
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $Root "scripts\lib\tenant-context.ps1")
$RegistryDir = Get-ProntaraClientsRoot -Root $Root
$CurrentFile = Get-ProntaraLegacyCurrentClientPath -Root $Root

function Write-FileUtf8NoBom([string]$Path, [string]$Text) {
  $dir = Split-Path -Parent $Path
  if (-not [string]::IsNullOrWhiteSpace($dir)) {
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
  }

  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Text, $utf8NoBom)
}

function Write-JsonUtf8NoBom([string]$Path, $Object) {
  $json = $Object | ConvertTo-Json -Depth 30
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
    $resolved = Get-CurrentClientId
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

function Normalize-UpdateEntry($Entry, $CurrentModules, $CurrentPackageVersion) {
  $textValue = ""
  if ($Entry.PSObject.Properties.Name -contains "text") {
    $textValue = [string]$Entry.text
  }

  $detectedModules = @()
  if ($Entry.PSObject.Properties.Name -contains "detectedModules" -and $Entry.detectedModules) {
    $detectedModules = @($Entry.detectedModules)
  }

  $removedModule = $null
  if ($Entry.PSObject.Properties.Name -contains "removedModule") {
    $removedModule = $Entry.removedModule
  }

  $atValue = (Get-Date).ToString("s")
  if ($Entry.PSObject.Properties.Name -contains "at" -and $Entry.at) {
    $atValue = [string]$Entry.at
  }

  return [pscustomobject]@{
    at = $atValue
    type = "maintenance_update"
    text = $textValue
    detectedModules = @($detectedModules)
    removedModule = $removedModule
    resultingModules = @($CurrentModules)
    packageVersionBefore = $CurrentPackageVersion
  }
}

if ([string]::IsNullOrWhiteSpace($ChangeText) -and -not [string]::IsNullOrWhiteSpace($ClientRef)) {
  $maybeDirectClient = Resolve-ProntaraClient $ClientRef
  if ($null -eq $maybeDirectClient) {
    $ChangeText = $ClientRef
    $ClientRef = ""
  }
}

$resolved = Resolve-ProntaraClient $ClientRef
if ($null -eq $resolved) {
  Write-Host "No se ha encontrado el cliente indicado ni un cliente activo." -ForegroundColor Red
  exit 1
}

if ([string]::IsNullOrWhiteSpace($ChangeText)) {
  Write-Host "Debes indicar el texto del cambio." -ForegroundColor Yellow
  exit 1
}

$client = $resolved.Client

if (-not ($client.PSObject.Properties.Name -contains "history")) {
  $client | Add-Member -NotePropertyName history -NotePropertyValue @()
}

if (-not ($client.PSObject.Properties.Name -contains "updates")) {
  $client | Add-Member -NotePropertyName updates -NotePropertyValue @()
}

$currentPackageVersion = ""
if ($client.PSObject.Properties.Name -contains "packageVersion") {
  $currentPackageVersion = [string]$client.packageVersion
}

$currentModules = @()
if ($client.modules) {
  $currentModules = @($client.modules)
}

# Normalizar updates antiguos al historial si history está vacío
$historyItems = @()
if ($client.history) {
  $historyItems += @($client.history)
}

if ($historyItems.Count -eq 0 -and $client.updates) {
  foreach ($u in @($client.updates)) {
    $historyItems += (Normalize-UpdateEntry $u $currentModules $currentPackageVersion)
  }
}

$newHistoryEntry = [pscustomobject]@{
  at = (Get-Date).ToString("s")
  type = "maintenance_note"
  text = $ChangeText
  detectedModules = @()
  removedModule = $null
  resultingModules = @($currentModules)
  packageVersionBefore = $currentPackageVersion
}

$historyItems += $newHistoryEntry
$client.history = @($historyItems)

Write-JsonUtf8NoBom $resolved.FilePath $client

Write-Host ""
Write-Host "Historial de mantenimiento actualizado correctamente." -ForegroundColor Green
Write-Host "Cliente: $($client.displayName)"
Write-Host "ID: $($client.clientId)"
Write-Host "Entrada añadida: $ChangeText"
Write-Host "Total history: $(@($client.history).Count)"
Write-Host ""
