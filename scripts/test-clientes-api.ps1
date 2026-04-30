[CmdletBinding()]
param(
    [string]$ProjectRoot = "C:\ProntaraFactory\prontara-factory",
    [string]$BaseUrl = "http://localhost:3000"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $ProjectRoot)) {
    throw "No existe la ruta del proyecto: $ProjectRoot"
}

Set-Location -LiteralPath $ProjectRoot

$activeClientFile = Join-Path $ProjectRoot "data\factory\active-client.json"

if (-not (Test-Path -LiteralPath $activeClientFile)) {
    throw "No existe data\factory\active-client.json"
}

$activeState = Get-Content -LiteralPath $activeClientFile -Raw | ConvertFrom-Json
$clientId = [string]$activeState.clientId

if ([string]::IsNullOrWhiteSpace($clientId)) {
    throw "No hay cliente activo en data\factory\active-client.json"
}

$dataDir = Join-Path $ProjectRoot (".prontara\data\" + $clientId)
$dataFile = Join-Path $dataDir "clientes.json"

Write-Host ""
Write-Host "=== CLIENTE ACTIVO ===" -ForegroundColor Cyan
Write-Host ("ClientId: " + $clientId) -ForegroundColor Green
Write-Host ("Carpeta esperada: " + $dataDir) -ForegroundColor Yellow
Write-Host ("Archivo esperado: " + $dataFile) -ForegroundColor Yellow

Write-Host ""
Write-Host "=== ESTADO PREVIO ===" -ForegroundColor Cyan
if (Test-Path -LiteralPath $dataFile) {
    Write-Host "El archivo YA existía antes de llamar a la API." -ForegroundColor Green
}
else {
    Write-Host "El archivo NO existe todavía. Vamos a forzar su creación llamando a la API." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== LLAMADA A API ===" -ForegroundColor Cyan
$url = $BaseUrl + "/api/erp/module?module=clientes"
Write-Host ("URL: " + $url) -ForegroundColor White

try {
    $response = Invoke-RestMethod -Uri $url -Method GET
    Write-Host "La API respondió correctamente." -ForegroundColor Green
    Write-Host ""
    Write-Host "=== RESPUESTA API ===" -ForegroundColor Cyan
    $response | ConvertTo-Json -Depth 10 | Write-Host
}
catch {
    Write-Host ""
    Write-Host "=== ERROR EN LA API ===" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=== COMPROBACION FINAL ===" -ForegroundColor Cyan
if (Test-Path -LiteralPath $dataFile) {
    Write-Host "El archivo ya existe después de llamar a la API." -ForegroundColor Green
    Write-Host ""
    Write-Host "=== CONTENIDO DE clientes.json ===" -ForegroundColor Cyan
    Get-Content -LiteralPath $dataFile -Raw | Write-Host
}
else {
    Write-Host "El archivo sigue sin existir después de llamar a la API." -ForegroundColor Red
    Write-Host "Eso significa que la persistencia del módulo clientes no está funcionando." -ForegroundColor Yellow
    Write-Host ""

    if (Test-Path -LiteralPath $dataDir) {
        Write-Host ("Sí existe la carpeta: " + $dataDir) -ForegroundColor Yellow
        Get-ChildItem -LiteralPath $dataDir -Force |
            Select-Object Name, Length, LastWriteTime |
            Format-Table -AutoSize | Out-String | Write-Host
    }
    else {
        Write-Host ("No existe ni la carpeta: " + $dataDir) -ForegroundColor Red
    }
}