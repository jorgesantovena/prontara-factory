param(
  [Parameter(Position=0)]
  [string]$ClientRef
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
  $json = $Object | ConvertTo-Json -Depth 40
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

function Get-HistoryKey($entry) {
  $type = ""
  $at = ""
  $packageVersion = ""
  $releaseDir = ""
  $text = ""

  if ($entry.PSObject.Properties.Name -contains "type") { $type = [string]$entry.type }
  if ($entry.PSObject.Properties.Name -contains "at") { $at = [string]$entry.at }
  if ($entry.PSObject.Properties.Name -contains "packageVersion") { $packageVersion = [string]$entry.packageVersion }
  if ($entry.PSObject.Properties.Name -contains "releaseDir") { $releaseDir = [string]$entry.releaseDir }
  if ($entry.PSObject.Properties.Name -contains "text") { $text = [string]$entry.text }

  return "$type|$at|$packageVersion|$releaseDir|$text"
}

$resolved = Resolve-ProntaraClient $ClientRef
if ($null -eq $resolved) {
  Write-Host "No se ha encontrado el cliente indicado ni un cliente activo." -ForegroundColor Red
  exit 1
}

$client = $resolved.Client

if (-not ($client.PSObject.Properties.Name -contains "history")) {
  $client | Add-Member -NotePropertyName history -NotePropertyValue @()
}

$historyItems = @()
if ($client.history) {
  $historyItems += @($client.history)
}

$existingKeys = @{}
foreach ($item in $historyItems) {
  $existingKeys[(Get-HistoryKey $item)] = $true
}

$added = 0

if ($client.PSObject.Properties.Name -contains "releaseHistory" -and $client.releaseHistory) {
  foreach ($release in @($client.releaseHistory)) {
    $entry = [pscustomobject]@{
      at = if ($release.PSObject.Properties.Name -contains "at") { [string]$release.at } else { (Get-Date).ToString("s") }
      type = "release"
      text = "Release generada"
      detectedModules = @()
      removedModule = $null
      resultingModules = if ($release.PSObject.Properties.Name -contains "modules") { @($release.modules) } else { @() }
      packageVersionBefore = if ($release.PSObject.Properties.Name -contains "packageVersion") { [string]$release.packageVersion } else { "" }
      packageVersion = if ($release.PSObject.Properties.Name -contains "packageVersion") { [string]$release.packageVersion } else { "" }
      releaseDir = if ($release.PSObject.Properties.Name -contains "releaseDir") { [string]$release.releaseDir } else { "" }
      zipPath = if ($release.PSObject.Properties.Name -contains "zipPath") { [string]$release.zipPath } else { "" }
    }

    $key = Get-HistoryKey $entry
    if (-not $existingKeys.ContainsKey($key)) {
      $historyItems += $entry
      $existingKeys[$key] = $true
      $added++
    }
  }
}

$sorted = $historyItems | Sort-Object {
  if ($_.PSObject.Properties.Name -contains "at") { [string]$_.at } else { "" }
}

$client.history = @($sorted)
Write-JsonUtf8NoBom $resolved.FilePath $client

Write-Host ""
Write-Host "Historial sincronizado correctamente." -ForegroundColor Green
Write-Host "Cliente: $($client.displayName)"
Write-Host "ID: $($client.clientId)"
Write-Host "Entradas añadidas desde releaseHistory: $added"
Write-Host "Total history: $(@($client.history).Count)"
Write-Host ""
