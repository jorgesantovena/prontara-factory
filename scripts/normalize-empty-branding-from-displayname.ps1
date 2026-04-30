[CmdletBinding()]
param(
    [string]$ClientsPath = ".\.prontara\clients",
    [switch]$WhatIf
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Read-FileUtf8 {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )
    $utf8NoBom = [System.Text.UTF8Encoding]::new($false)
    [System.IO.File]::ReadAllText($Path, $utf8NoBom)
}

function Write-FileUtf8 {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,
        [Parameter(Mandatory = $true)]
        [string]$Content
    )
    $utf8NoBom = [System.Text.UTF8Encoding]::new($false)
    [System.IO.File]::WriteAllText($Path, $Content, $utf8NoBom)
}

if (-not (Test-Path -LiteralPath $ClientsPath)) {
    throw "No existe la carpeta de clientes: $ClientsPath"
}

$clientFiles = Get-ChildItem -LiteralPath $ClientsPath -Filter "*.json" -File | Sort-Object Name

if (-not $clientFiles -or $clientFiles.Count -eq 0) {
    Write-Host "No se encontraron archivos JSON en $ClientsPath"
    exit 0
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupRoot = Join-Path $ClientsPath ("backup-branding-normalize-" + $timestamp)

if (-not $WhatIf) {
    New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
}

$changed = @()
$unchanged = @()
$errors = @()

foreach ($file in $clientFiles) {
    try {
        $raw = Read-FileUtf8 -Path $file.FullName
        $json = $raw | ConvertFrom-Json

        $hasDisplayName = $json.PSObject.Properties.Name -contains 'displayName'
        if (-not $hasDisplayName -or [string]::IsNullOrWhiteSpace($json.displayName)) {
            $unchanged += $file.Name
            continue
        }

        $displayName = [string]$json.displayName

        $hasBranding = $json.PSObject.Properties.Name -contains 'branding'
        $branding = $null

        if ($hasBranding) {
            $branding = $json.branding
        }

        if ($null -eq $branding) {
            $unchanged += $file.Name
            continue
        }

        $hadAppName = $branding.PSObject.Properties.Name -contains 'appName'
        $hadLogoText = $branding.PSObject.Properties.Name -contains 'logoText'

        $originalAppName = $null
        $originalLogoText = $null

        if ($hadAppName) {
            $originalAppName = $branding.appName
        }

        if ($hadLogoText) {
            $originalLogoText = $branding.logoText
        }

        $newAppName = $originalAppName
        $newLogoText = $originalLogoText

        $changedThisFile = $false

        if (-not $hadAppName -or [string]::IsNullOrWhiteSpace($originalAppName)) {
            $newAppName = $displayName
            $changedThisFile = $true
        }

        if (-not $hadLogoText -or [string]::IsNullOrWhiteSpace($originalLogoText)) {
            $newLogoText = $displayName
            $changedThisFile = $true
        }

        if (-not $changedThisFile) {
            $unchanged += $file.Name
            continue
        }

        if ($hadAppName) {
            $branding.appName = $newAppName
        }
        else {
            $branding | Add-Member -NotePropertyName "appName" -NotePropertyValue $newAppName
        }

        if ($hadLogoText) {
            $branding.logoText = $newLogoText
        }
        else {
            $branding | Add-Member -NotePropertyName "logoText" -NotePropertyValue $newLogoText
        }

        $backupPath = Join-Path $backupRoot $file.Name

        if (-not $WhatIf) {
            Copy-Item -LiteralPath $file.FullName -Destination $backupPath -Force
            $updatedJson = $json | ConvertTo-Json -Depth 100
            Write-FileUtf8 -Path $file.FullName -Content $updatedJson
        }

        $changed += [pscustomobject]@{
            File           = $file.Name
            DisplayName    = $displayName
            AppNameOld     = $originalAppName
            AppNameNew     = $newAppName
            LogoTextOld    = $originalLogoText
            LogoTextNew    = $newLogoText
        }
    }
    catch {
        $errors += [pscustomobject]@{
            File  = $file.Name
            Error = $_.Exception.Message
        }
    }
}

Write-Host ""
Write-Host "Resumen"
Write-Host "-------"
Write-Host ("Archivos revisados: {0}" -f $clientFiles.Count)
Write-Host ("Archivos modificados: {0}" -f $changed.Count)
Write-Host ("Archivos sin cambios: {0}" -f $unchanged.Count)
Write-Host ("Errores: {0}" -f $errors.Count)

if ($WhatIf) {
    Write-Host "Modo simulación: no se han escrito cambios ni backups."
}
else {
    Write-Host ("Backup: {0}" -f $backupRoot)
}

if ($changed.Count -gt 0) {
    Write-Host ""
    Write-Host "Cambios aplicados"
    Write-Host "-----------------"
    foreach ($item in $changed) {
        Write-Host ("[{0}]" -f $item.File)
        Write-Host ("  displayName: {0}" -f $item.DisplayName)
        Write-Host ("  appName:     {0}  ->  {1}" -f $item.AppNameOld, $item.AppNameNew)
        Write-Host ("  logoText:    {0}  ->  {1}" -f $item.LogoTextOld, $item.LogoTextNew)
    }
}

if ($errors.Count -gt 0) {
    Write-Host ""
    Write-Host "Errores"
    Write-Host "-------"
    foreach ($item in $errors) {
        Write-Host ("[{0}] {1}" -f $item.File, $item.Error)
    }
}
