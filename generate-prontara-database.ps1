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
$PrismaDir = Join-Path $Root "prisma"

function Write-FileUtf8NoBom([string]$Path, [string]$Text) {
  $dir = Split-Path -Parent $Path
  if (-not [string]::IsNullOrWhiteSpace($dir)) {
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
  }
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Text, $utf8NoBom)
}

function Write-JsonUtf8NoBom([string]$Path, $Object) {
  $json = $Object | ConvertTo-Json -Depth 50
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

function Get-PrismaModelBlock([string]$moduleName) {
  switch ($moduleName) {
    "clientes" {
@"
model Cliente {
  id        String   @id @default(cuid())
  nombre    String
  email     String?
  telefono  String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
"@
    }
    "ventas" {
@"
model Venta {
  id          String   @id @default(cuid())
  referencia  String
  concepto    String?
  importe     Float    @default(0)
  estado      String   @default("pendiente")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
"@
    }
    "facturacion" {
@"
model Factura {
  id          String   @id @default(cuid())
  numero      String
  concepto    String?
  total       Float    @default(0)
  estado      String   @default("borrador")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
"@
    }
    "ajustes" {
@"
model Ajuste {
  id          String   @id @default(cuid())
  clave       String   @unique
  valor       String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
"@
    }
    "documentos" {
@"
model Documento {
  id          String   @id @default(cuid())
  nombre      String
  tipo        String?
  ruta        String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
"@
    }
    "proyectos" {
@"
model Proyecto {
  id          String   @id @default(cuid())
  nombre      String
  estado      String   @default("activo")
  descripcion String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
"@
    }
    "tareas" {
@"
model Tarea {
  id          String   @id @default(cuid())
  titulo      String
  estado      String   @default("pendiente")
  prioridad   String   @default("media")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
"@
    }
    "tesoreria" {
@"
model MovimientoTesoreria {
  id          String   @id @default(cuid())
  concepto    String
  importe     Float    @default(0)
  tipo        String   @default("movimiento")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
"@
    }
    "cobros" {
@"
model Cobro {
  id          String   @id @default(cuid())
  referencia  String
  importe     Float    @default(0)
  estado      String   @default("pendiente")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
"@
    }
    "pagos" {
@"
model Pago {
  id          String   @id @default(cuid())
  referencia  String
  importe     Float    @default(0)
  estado      String   @default("pendiente")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
"@
    }
    "citas" {
@"
model Cita {
  id          String   @id @default(cuid())
  titulo      String
  fecha       DateTime
  estado      String   @default("pendiente")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
"@
    }
    "proveedores" {
@"
model Proveedor {
  id          String   @id @default(cuid())
  nombre      String
  email       String?
  telefono    String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
"@
    }
    "productos" {
@"
model Producto {
  id          String   @id @default(cuid())
  nombre      String
  sku         String?
  precio      Float    @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
"@
    }
    "compras" {
@"
model Compra {
  id          String   @id @default(cuid())
  referencia  String
  importe     Float    @default(0)
  estado      String   @default("pendiente")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
"@
    }
    "web" {
@"
model ContenidoWeb {
  id          String   @id @default(cuid())
  clave       String   @unique
  titulo      String
  contenido   String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
"@
    }
    "presupuestos" {
@"
model Presupuesto {
  id          String   @id @default(cuid())
  numero      String
  concepto    String?
  total       Float    @default(0)
  estado      String   @default("borrador")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
"@
    }
    default {
@"
model $($moduleName.Substring(0,1).ToUpper() + $moduleName.Substring(1)) {
  id        String   @id @default(cuid())
  nombre    String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
"@
    }
  }
}

$resolved = Resolve-ProntaraClient $ClientRef
if ($null -eq $resolved) {
  Write-Host "No se ha encontrado el cliente indicado ni un cliente activo." -ForegroundColor Red
  exit 1
}

$client = $resolved.Client
$tenantContext = Get-ProntaraTenantContext -ClientId $client.clientId -Root $Root

if (-not ($client.PSObject.Properties.Name -contains "database")) {
  Write-Host "El cliente no tiene configuracion database. Ejecuta primero init-prontara-database.ps1" -ForegroundColor Red
  exit 1
}

New-Item -ItemType Directory -Force -Path $PrismaDir | Out-Null

$provider = [string]$client.database.provider
if ([string]::IsNullOrWhiteSpace($provider)) {
  $provider = "postgresql"
}

$schemaHeader = @"
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "$provider"
  url      = env("$($client.database.connectionEnvVar)")
}
"@

$modelBlocks = @()
foreach ($m in @($client.modules)) {
  $modelBlocks += (Get-PrismaModelBlock $m)
}

$schema = $schemaHeader + "`r`n" + (($modelBlocks -join "`r`n") + "`r`n")
Write-FileUtf8NoBom (Join-Path $PrismaDir "schema.prisma") $schema

$dbName = [string]$client.database.databaseName
if ([string]::IsNullOrWhiteSpace($dbName)) {
  $dbName = "prontara_" + ($client.clientId -replace '[^a-zA-Z0-9_]', '_')
}

$envText = @"
# Configuracion generada por Prontara Factory
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/$dbName?schema=public"
"@
Write-FileUtf8NoBom (Join-Path $Root ".env.prontara") $envText

$seedNotes = @()
$seedNotes += "Seed inicial sugerido para: $($client.displayName)"
$seedNotes += "ClientId: $($client.clientId)"
$seedNotes += "BusinessType: $(if ($client.PSObject.Properties.Name -contains 'businessType') { $client.businessType } else { '' })"
$seedNotes += "Modulos: $($client.modules -join ', ')"
$seedNotes += ""
$seedNotes += "Siguiente paso recomendado desde PowerShell:"
$seedNotes += "  pnpm prisma generate"
$seedNotes += "  pnpm prisma db push --schema prisma/schema.prisma"
Write-FileUtf8NoBom (Join-Path $PrismaDir "seed-notes.txt") ($seedNotes -join [Environment]::NewLine)

$client.database.status = "generated"
$client.database.generatedAt = (Get-Date).ToString("s")
Write-JsonUtf8NoBom $tenantContext.definitionPath $client

Write-Host ""
Write-Host "Capa de base de datos generada correctamente." -ForegroundColor Green
Write-Host "Cliente: $($client.displayName)"
Write-Host "ID: $($client.clientId)"
Write-Host "Provider: $provider"
Write-Host "Schema: $(Join-Path $PrismaDir 'schema.prisma')"
Write-Host "Env: $(Join-Path $Root '.env.prontara')"
Write-Host "Estado DB: $($client.database.status)"
Write-Host ""
