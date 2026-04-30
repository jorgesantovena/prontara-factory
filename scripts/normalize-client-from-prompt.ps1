[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$ClientId,

  [Parameter(Mandatory = $true)]
  [string]$Prompt
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Root = Split-Path -Parent $Root

$ClientFile = Join-Path $Root ".prontara\clients\$ClientId.json"
$GeneratorScript = Join-Path $Root "generate-prontara.ps1"

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

function Resolve-Business([string]$Text) {
  $t = $Text.ToLowerInvariant()

  if ($t.Contains("clínica dental") -or $t.Contains("clinica dental") -or $t.Contains("dentista") -or $t.Contains("dental")) {
    return @{
      BusinessType = "clinica-dental"
      Sector = "salud"
      DisplayName = "Clínica Dental Demo"
      Modules = @("clientes", "citas", "documentos", "facturacion", "ajustes")
      Accent = "#0f766e"
      Surface = "#f0fdfa"
      Logo = "Dental Demo"
      InstallerName = "Clinica Dental Demo"
    }
  }

  if ($t.Contains("gimnasio") -or $t.Contains("gym") -or $t.Contains("centro deportivo")) {
    return @{
      BusinessType = "gimnasio"
      Sector = "fitness"
      DisplayName = "Gimnasio Demo"
      Modules = @("clientes", "ventas", "facturacion", "documentos", "ajustes")
      Accent = "#1d4ed8"
      Surface = "#eff6ff"
      Logo = "Gym Demo"
      InstallerName = "Gimnasio Demo"
    }
  }

  if ($t.Contains("peluquería") -or $t.Contains("peluqueria") -or $t.Contains("salón de belleza") -or $t.Contains("salon de belleza") -or $t.Contains("barbería") -or $t.Contains("barberia")) {
    return @{
      BusinessType = "peluqueria"
      Sector = "belleza"
      DisplayName = "Peluquería Demo"
      Modules = @("clientes", "ventas", "facturacion", "documentos", "ajustes")
      Accent = "#be185d"
      Surface = "#fdf2f8"
      Logo = "Salon Demo"
      InstallerName = "Peluqueria Demo"
    }
  }

  if ($t.Contains("software factory") -or $t.Contains("software-factory") -or $t.Contains("fábrica de software") -or $t.Contains("fabrica de software")) {
    return @{
      BusinessType = "software-factory"
      Sector = "tecnologia"
      DisplayName = "Software Factory Demo"
      Modules = @("clientes", "crm", "presupuestos", "proyectos", "timesheets", "planificacion_recursos", "facturacion", "finanzas", "rrhh", "documentos", "ajustes")
      Accent = "#7c3aed"
      Surface = "#f5f3ff"
      Logo = "SF Demo"
      InstallerName = "Software Factory Demo"
    }
  }

  return @{
    BusinessType = "general"
    Sector = "estandar"
    DisplayName = "ERP Demo"
    Modules = @("clientes", "ventas", "facturacion", "documentos", "ajustes")
    Accent = "#111827"
    Surface = "#f8fafc"
    Logo = "ERP Demo"
    InstallerName = "ERP Demo"
  }
}

if (-not (Test-Path $ClientFile)) {
  throw "No existe el cliente: $ClientId"
}

$client = Read-Utf8Json $ClientFile
$resolution = Resolve-Business $Prompt

$client.displayName = $resolution.DisplayName
$client.businessType = $resolution.BusinessType
$client.sector = $resolution.Sector

if ($client.PSObject.Properties.Name -contains "modules") {
  $client.modules = @($resolution.Modules)
}
else {
  $client | Add-Member -NotePropertyName modules -NotePropertyValue @($resolution.Modules)
}

if ($client.PSObject.Properties.Name -contains "branding" -and $null -ne $client.branding) {
  $client.branding.appName = $resolution.DisplayName
  $client.branding.logoText = $resolution.Logo
  $client.branding.accentColor = $resolution.Accent
  $client.branding.surfaceColor = $resolution.Surface
  $client.branding.installerName = $resolution.InstallerName
}
else {
  $client | Add-Member -NotePropertyName branding -NotePropertyValue ([pscustomobject]@{
    appName = $resolution.DisplayName
    logoText = $resolution.Logo
    accentColor = $resolution.Accent
    surfaceColor = $resolution.Surface
    installerName = $resolution.InstallerName
  })
}

if ($client.PSObject.Properties.Name -contains "status") {
  $client.status = "updated"
}

Write-Utf8Json $ClientFile $client

$generatorOutput = ""
if (Test-Path $GeneratorScript) {
  $generatorOutput = & $GeneratorScript -ClientId $ClientId 2>&1 | Out-String
}

Write-Output "Cliente normalizado correctamente."
Write-Output "ClientId: $ClientId"
Write-Output "DisplayName: $($resolution.DisplayName)"
Write-Output "Sector: $($resolution.Sector)"
Write-Output "BusinessType: $($resolution.BusinessType)"
Write-Output "AccentColor: $($resolution.Accent)"
Write-Output "SurfaceColor: $($resolution.Surface)"
Write-Output "InstallerName: $($resolution.InstallerName)"
Write-Output "Modules: $($resolution.Modules -join ', ')"

if (-not [string]::IsNullOrWhiteSpace($generatorOutput)) {
  Write-Output ""
  Write-Output $generatorOutput.Trim()
}
