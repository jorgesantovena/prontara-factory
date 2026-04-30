[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$ClientId
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Root = Split-Path -Parent $Root

$ClientFile = Join-Path $Root ".prontara\clients\$ClientId.json"
$WrapperConfig = Join-Path $Root "desktop-wrapper\app-config.json"
$TauriConfig = Join-Path $Root "src-tauri\tauri.conf.json"

function Read-Utf8Json([string]$Path) {
  $utf8NoBom = [System.Text.UTF8Encoding]::new($false)
  $raw = [System.IO.File]::ReadAllText($Path, $utf8NoBom)
  return $raw | ConvertFrom-Json
}

function Write-Utf8Json([string]$Path, $Object) {
  $utf8NoBom = [System.Text.UTF8Encoding]::new($false)
  $json = $Object | ConvertTo-Json -Depth 20
  [System.IO.File]::WriteAllText($Path, $json, $utf8NoBom)
}

if (-not (Test-Path $ClientFile)) {
  throw "No existe el cliente: $ClientId"
}

$client = Read-Utf8Json $ClientFile

$displayName = [string]$client.displayName
$installerName = $displayName

if ($client.PSObject.Properties.Name -contains "branding" -and $null -ne $client.branding) {
  if ($client.branding.PSObject.Properties.Name -contains "installerName" -and $null -ne $client.branding.installerName -and "$($client.branding.installerName)".Trim() -ne "") {
    $installerName = [string]$client.branding.installerName
  }
}

if (Test-Path $WrapperConfig) {
  $wrapper = Read-Utf8Json $WrapperConfig
  $wrapper.productName = $installerName
  $wrapper.windowTitle = $displayName
  Write-Utf8Json $WrapperConfig $wrapper
}

if (Test-Path $TauriConfig) {
  $tauri = Read-Utf8Json $TauriConfig
  $tauri.productName = $installerName
  if ($tauri.PSObject.Properties.Name -contains "app" -and $null -ne $tauri.app) {
    if ($tauri.app.PSObject.Properties.Name -contains "windows" -and $null -ne $tauri.app.windows) {
      foreach ($win in @($tauri.app.windows)) {
        if ($win.PSObject.Properties.Name -contains "title") {
          $win.title = $displayName
        }
      }
    }
  }
  Write-Utf8Json $TauriConfig $tauri
}

Write-Output "Wrapper desktop actualizado."
Write-Output "ClientId: $ClientId"
Write-Output "DisplayName: $displayName"
Write-Output "InstallerName: $installerName"
