param(
  [Parameter(Position=0)]
  [string]$ClientRef
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $Root "scripts\lib\tenant-context.ps1")
. (Join-Path $Root "scripts\lib\active-client-registry.ps1")
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

$resolved = Resolve-ProntaraClient $ClientRef
if ($null -eq $resolved) {
  Write-Host "No se ha encontrado el cliente indicado ni un cliente activo." -ForegroundColor Red
  exit 1
}

$client = $resolved.Client
$tenantContext = Get-ProntaraTenantContext -ClientId $client.clientId -Root $Root

$dbName = "prontara_" + ($client.clientId -replace '[^a-zA-Z0-9_]', '_')

if (-not ($client.PSObject.Properties.Name -contains "database")) {
  $client | Add-Member -NotePropertyName database -NotePropertyValue ([pscustomobject]@{
    provider = "postgresql"
    mode = "per_client_database"
    databaseName = $dbName
    schemaVersion = "0.1.0"
    status = "pending"
    connectionEnvVar = "DATABASE_URL"
    generatedAt = $null
  })
} else {
  if (-not ($client.database.PSObject.Properties.Name -contains "provider")) { $client.database | Add-Member -NotePropertyName provider -NotePropertyValue "postgresql" }
  if (-not ($client.database.PSObject.Properties.Name -contains "mode")) { $client.database | Add-Member -NotePropertyName mode -NotePropertyValue "per_client_database" }
  if (-not ($client.database.PSObject.Properties.Name -contains "databaseName")) { $client.database | Add-Member -NotePropertyName databaseName -NotePropertyValue $dbName }
  if (-not ($client.database.PSObject.Properties.Name -contains "schemaVersion")) { $client.database | Add-Member -NotePropertyName schemaVersion -NotePropertyValue "0.1.0" }
  if (-not ($client.database.PSObject.Properties.Name -contains "status")) { $client.database | Add-Member -NotePropertyName status -NotePropertyValue "pending" }
  if (-not ($client.database.PSObject.Properties.Name -contains "connectionEnvVar")) { $client.database | Add-Member -NotePropertyName connectionEnvVar -NotePropertyValue "DATABASE_URL" }
  if (-not ($client.database.PSObject.Properties.Name -contains "generatedAt")) { $client.database | Add-Member -NotePropertyName generatedAt -NotePropertyValue $null }
}

Write-JsonUtf8NoBom $tenantContext.definitionPath $client

Write-Host ""
Write-Host "Configuracion de base de datos inicializada correctamente." -ForegroundColor Green
Write-Host "Cliente: $($client.displayName)"
Write-Host "ID: $($client.clientId)"
Write-Host "Provider: $($client.database.provider)"
Write-Host "DatabaseName: $($client.database.databaseName)"
Write-Host "SchemaVersion: $($client.database.schemaVersion)"
Write-Host ""
