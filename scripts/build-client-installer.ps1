[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$ClientId
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Root = Split-Path -Parent $Root

$PackageJsonPath = Join-Path $Root "package.json"
$ArtifactsRoot = Join-Path $Root ".prontara\artifacts\$ClientId"
$SyncWrapperScript = Join-Path $Root "scripts\sync-desktop-wrapper-from-client.ps1"

function Read-Utf8Text([string]$Path) {
  $utf8NoBom = [System.Text.UTF8Encoding]::new($false)
  return [System.IO.File]::ReadAllText($Path, $utf8NoBom)
}

if (Test-Path $SyncWrapperScript) {
  & $SyncWrapperScript -ClientId $ClientId | Out-String | Out-Null
}

if (-not (Test-Path $PackageJsonPath)) {
  [ordered]@{
    ok = $false
    clientId = $ClientId
    reason = "No existe package.json"
  } | ConvertTo-Json -Depth 10
  exit 0
}

$package = Read-Utf8Text $PackageJsonPath | ConvertFrom-Json

$scriptCandidates = @(
  "desktop:build",
  "build:desktop",
  "electron:build",
  "tauri:build",
  "dist",
  "package",
  "make"
)

$available = @()
if ($package.PSObject.Properties.Name -contains "scripts" -and $null -ne $package.scripts) {
  foreach ($prop in $package.scripts.PSObject.Properties) {
    $available += [string]$prop.Name
  }
}

$selectedScript = $null
foreach ($candidate in $scriptCandidates) {
  if ($available -contains $candidate) {
    $selectedScript = $candidate
    break
  }
}

if ($null -eq $selectedScript) {
  [ordered]@{
    ok = $false
    clientId = $ClientId
    reason = "No se encontró un script de build desktop conocido en package.json"
    tried = $scriptCandidates
    availableScripts = $available
  } | ConvertTo-Json -Depth 10
  exit 0
}

New-Item -ItemType Directory -Force $ArtifactsRoot | Out-Null

$searchDirs = @(
  (Join-Path $Root "src-tauri\target\release\bundle"),
  (Join-Path $Root "release"),
  (Join-Path $Root "dist"),
  (Join-Path $Root "out"),
  (Join-Path $Root "desktop\dist"),
  (Join-Path $Root "wails\build\bin")
)

$extensions = @("*.exe","*.msi","*.zip","*.appx")

function Find-Artifacts {
  $files = @()
  foreach ($dir in $searchDirs) {
    if (Test-Path $dir) {
      foreach ($ext in $extensions) {
        $files += Get-ChildItem -Path $dir -Recurse -File -Filter $ext -ErrorAction SilentlyContinue
      }
    }
  }
  return $files | Sort-Object LastWriteTime -Descending, Length -Descending
}

$filesBefore = @(Find-Artifacts)
$latestBefore = $filesBefore | Select-Object -First 1

$buildOutput = (& pnpm run $selectedScript 2>&1 | Out-String)

$filesAfter = @(Find-Artifacts)
$latestAfter = $filesAfter | Select-Object -First 1

$artifact = $latestAfter
if (-not $artifact) {
  $artifact = $latestBefore
}

if (-not $artifact) {
  [ordered]@{
    ok = $false
    clientId = $ClientId
    buildScript = $selectedScript
    reason = "No se encontró ningún artefacto de instalable"
    output = $buildOutput.Trim()
  } | ConvertTo-Json -Depth 10
  exit 0
}

$targetPath = Join-Path $ArtifactsRoot $artifact.Name
Copy-Item $artifact.FullName $targetPath -Force

[ordered]@{
  ok = $true
  clientId = $ClientId
  buildScript = $selectedScript
  artifactName = $artifact.Name
  artifactPath = $targetPath
  downloadUrl = "/api/factory/download?clientId=$ClientId&file=$([uri]::EscapeDataString($artifact.Name))"
  output = $buildOutput.Trim()
} | ConvertTo-Json -Depth 10
