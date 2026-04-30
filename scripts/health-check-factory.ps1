[CmdletBinding()]
param(
    [string]$ProjectRoot = "C:\ProntaraFactory\prontara-factory",
    [string]$BaseUrl = "http://localhost:3000"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Section {
    param([string]$Title)
    Write-Host ""
    Write-Host ("=" * 90) -ForegroundColor DarkGray
    Write-Host $Title -ForegroundColor Cyan
    Write-Host ("=" * 90) -ForegroundColor DarkGray
}

function Write-Ok {
    param([string]$Text)
    Write-Host ("[OK] " + $Text) -ForegroundColor Green
}

function Write-Warn {
    param([string]$Text)
    Write-Host ("[WARN] " + $Text) -ForegroundColor Yellow
}

function Write-Err {
    param([string]$Text)
    Write-Host ("[ERR] " + $Text) -ForegroundColor Red
}

function Read-JsonSafe {
    param([string]$Path)

    try {
        return Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
    }
    catch {
        return $null
    }
}

if (-not (Test-Path -LiteralPath $ProjectRoot)) {
    throw "No existe la ruta del proyecto: $ProjectRoot"
}

Set-Location -LiteralPath $ProjectRoot

$errors = New-Object System.Collections.Generic.List[string]
$warnings = New-Object System.Collections.Generic.List[string]

$clientsDir = Join-Path $ProjectRoot ".prontara\clients"
$dataDir = Join-Path $ProjectRoot ".prontara\data"
$artifactsDir = Join-Path $ProjectRoot ".prontara\artifacts"
$activeClientFile = Join-Path $ProjectRoot "data\factory\active-client.json"

Write-Section "1. DISPONIBILIDAD DEL SERVIDOR"

try {
    $rootResponse = Invoke-WebRequest -UseBasicParsing -Uri ($BaseUrl + "/factory") -TimeoutSec 10
    Write-Ok ("Servidor accesible: " + $BaseUrl + "/factory -> " + $rootResponse.StatusCode)
}
catch {
    Write-Err "No se puede acceder al servidor Next en /factory"
    Write-Err "Antes de seguir, ejecuta npm run dev en otra consola"
    exit 1
}

Write-Section "2. API ACTIVE"

$activeApi = $null
try {
    $activeApi = Invoke-RestMethod -Uri ($BaseUrl + "/api/factory/active") -Method GET -TimeoutSec 15
    if ($activeApi.ok) {
        Write-Ok "GET /api/factory/active correcto"
        Write-Host ("activeClientId: " + [string]$activeApi.activeClientId) -ForegroundColor White
        Write-Host ("updatedAt: " + [string]$activeApi.updatedAt) -ForegroundColor White
    }
    else {
        Write-Err "GET /api/factory/active devolvió ok=false"
        $errors.Add("/api/factory/active ok=false")
    }
}
catch {
    Write-Err "Falló GET /api/factory/active"
    $errors.Add("Error llamando /api/factory/active")
}

Write-Section "3. API HISTORY"

$historyApi = $null
try {
    $historyApi = Invoke-RestMethod -Uri ($BaseUrl + "/api/factory/history") -Method GET -TimeoutSec 20
    if ($historyApi.ok) {
        Write-Ok "GET /api/factory/history correcto"
        $count = @($historyApi.items).Count
        Write-Host ("items: " + $count) -ForegroundColor White
        Write-Host ("activeClientId: " + [string]$historyApi.activeClientId) -ForegroundColor White
    }
    else {
        Write-Err "GET /api/factory/history devolvió ok=false"
        $errors.Add("/api/factory/history ok=false")
    }
}
catch {
    Write-Err "Falló GET /api/factory/history"
    $errors.Add("Error llamando /api/factory/history")
}

Write-Section "4. CONSISTENCIA ACTIVE VS HISTORY"

if ($null -ne $activeApi -and $null -ne $historyApi -and $activeApi.ok -and $historyApi.ok) {
    $activeClientId = [string]$activeApi.activeClientId
    $historyActiveClientId = [string]$historyApi.activeClientId

    if ($activeClientId -eq $historyActiveClientId) {
        Write-Ok "activeClientId coincide entre /active y /history"
    }
    else {
        Write-Err "activeClientId NO coincide entre /active y /history"
        $errors.Add("Desalineación activeClientId entre /active y /history")
    }

    if (-not [string]::IsNullOrWhiteSpace($activeClientId)) {
        $activeItems = @($historyApi.items | Where-Object { $_.isActive -eq $true })

        if ($activeItems.Count -eq 1) {
            if ([string]$activeItems[0].clientId -eq $activeClientId) {
                Write-Ok "El historial marca correctamente un único cliente activo"
            }
            else {
                Write-Err "El historial marca un cliente activo distinto al de /active"
                $errors.Add("isActive incorrecto en /history")
            }
        }
        elseif ($activeItems.Count -eq 0) {
            Write-Err "El historial no marca ningún cliente activo"
            $errors.Add("No hay isActive=true en /history")
        }
        else {
            Write-Err ("El historial marca varios clientes activos: " + $activeItems.Count)
            $errors.Add("Varios isActive=true en /history")
        }
    }
    else {
        Write-Warn "No hay cliente activo asignado"
        $warnings.Add("No hay cliente activo")
    }
}

Write-Section "5. CONSISTENCIA CON DISCO"

$activeClientJson = Read-JsonSafe -Path $activeClientFile
if ($null -eq $activeClientJson) {
    Write-Err "active-client.json está roto o no existe"
    $errors.Add("active-client.json inválido")
}
else {
    $diskClientId = [string]$activeClientJson.clientId
    Write-Host ("Cliente activo en disco: " + $diskClientId) -ForegroundColor White

    if (-not [string]::IsNullOrWhiteSpace($diskClientId)) {
        $clientJsonPath = Join-Path $clientsDir ($diskClientId + ".json")
        $clientDataDir = Join-Path $dataDir $diskClientId
        $clientArtifactsDir = Join-Path $artifactsDir $diskClientId

        if (Test-Path -LiteralPath $clientJsonPath) {
            Write-Ok "Existe JSON del cliente activo"
        }
        else {
            Write-Err "No existe JSON del cliente activo"
            $errors.Add("Falta JSON del cliente activo")
        }

        if (Test-Path -LiteralPath $clientDataDir) {
            Write-Ok "Existe carpeta data del cliente activo"
            $dataFiles = @(Get-ChildItem -LiteralPath $clientDataDir -File -ErrorAction SilentlyContinue)
            Write-Host ("archivos data: " + $dataFiles.Count) -ForegroundColor White
        }
        else {
            Write-Err "No existe carpeta data del cliente activo"
            $errors.Add("Falta data del cliente activo")
        }

        if (Test-Path -LiteralPath $clientArtifactsDir) {
            Write-Ok "Existe carpeta artifacts del cliente activo"
            $artifactFiles = @(Get-ChildItem -LiteralPath $clientArtifactsDir -File -ErrorAction SilentlyContinue)
            Write-Host ("archivos artifacts: " + $artifactFiles.Count) -ForegroundColor White
        }
        else {
            Write-Warn "No existe carpeta artifacts del cliente activo"
            $warnings.Add("Falta artifacts del cliente activo")
        }
    }
}

Write-Section "6. PRUEBA DE CLIENT-ACTION SOBRE EL CLIENTE ACTIVO"

if ($null -ne $activeApi -and $activeApi.ok -and -not [string]::IsNullOrWhiteSpace([string]$activeApi.activeClientId)) {
    $testClientId = [string]$activeApi.activeClientId

    try {
        $body = @{
            clientId = $testClientId
            action   = "use"
        } | ConvertTo-Json

        $actionResponse = Invoke-RestMethod `
            -Uri ($BaseUrl + "/api/factory/client-action") `
            -Method POST `
            -ContentType "application/json" `
            -Body $body `
            -TimeoutSec 120

        if ($actionResponse.ok -and [string]$actionResponse.activeClientId -eq $testClientId) {
            Write-Ok "POST /api/factory/client-action action=use correcto"
        }
        else {
            Write-Err "POST /api/factory/client-action no devolvió el resultado esperado"
            $errors.Add("client-action use inconsistente")
        }
    }
    catch {
        Write-Err "Falló POST /api/factory/client-action con action=use"
        $errors.Add("Error en client-action use")
    }
}
else {
    Write-Warn "Se omite test de client-action porque no hay cliente activo claro"
    $warnings.Add("Sin test de client-action")
}

Write-Section "7. RESUMEN"

Write-Host ("Errores: " + $errors.Count) -ForegroundColor Red
Write-Host ("Warnings: " + $warnings.Count) -ForegroundColor Yellow

if ($errors.Count -eq 0) {
    Write-Ok "Factory estable a nivel básico"
}
else {
    Write-Host ""
    Write-Host "Errores detectados:" -ForegroundColor Red
    foreach ($item in $errors) {
        Write-Host (" - " + $item) -ForegroundColor Red
    }
}

if ($warnings.Count -gt 0) {
    Write-Host ""
    Write-Host "Warnings detectados:" -ForegroundColor Yellow
    foreach ($item in $warnings) {
        Write-Host (" - " + $item) -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Health check de factory finalizado." -ForegroundColor Cyan