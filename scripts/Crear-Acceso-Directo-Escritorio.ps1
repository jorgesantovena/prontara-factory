# =======================================================================
#  Prontara Factory — crear acceso directo en el escritorio
#
#  Uso: doble-click sobre este fichero, O abrir PowerShell aqui y correr:
#       powershell -ExecutionPolicy Bypass -File .\Crear-Acceso-Directo-Escritorio.ps1
# =======================================================================

$ErrorActionPreference = 'Stop'

# Resolver rutas
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectDir = Split-Path -Parent $ScriptDir
$BatPath = Join-Path $ScriptDir 'Prontara-Factory.bat'
$IconPath = Join-Path $ProjectDir 'src-tauri\icons\icon.ico'

if (-not (Test-Path $BatPath)) {
    Write-Host "[X] No se encuentra Prontara-Factory.bat en $ScriptDir" -ForegroundColor Red
    pause
    exit 1
}
if (-not (Test-Path $IconPath)) {
    Write-Host "[!] No se encuentra el icono en $IconPath" -ForegroundColor Yellow
    Write-Host "    El acceso directo se creara con el icono por defecto."
    $IconPath = $BatPath
}

# Crear acceso directo en el escritorio del usuario
$DesktopPath = [Environment]::GetFolderPath('Desktop')
$ShortcutPath = Join-Path $DesktopPath 'Prontara Factory.lnk'

$WScriptShell = New-Object -ComObject WScript.Shell
$Shortcut = $WScriptShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = $BatPath
$Shortcut.WorkingDirectory = $ProjectDir
$Shortcut.IconLocation = "$IconPath,0"
$Shortcut.Description = 'Abrir Prontara Factory en el navegador'
$Shortcut.WindowStyle = 7   # Minimizado
$Shortcut.Save()

# Tambien en el menu Inicio del usuario para que aparezca al buscar "Prontara"
$StartMenu = [Environment]::GetFolderPath('StartMenu')
$StartProgramsDir = Join-Path $StartMenu 'Programs'
if (Test-Path $StartProgramsDir) {
    $StartShortcut = Join-Path $StartProgramsDir 'Prontara Factory.lnk'
    $S2 = $WScriptShell.CreateShortcut($StartShortcut)
    $S2.TargetPath = $BatPath
    $S2.WorkingDirectory = $ProjectDir
    $S2.IconLocation = "$IconPath,0"
    $S2.Description = 'Abrir Prontara Factory en el navegador'
    $S2.Save()
    Write-Host "[OK] Acceso directo creado en el menu Inicio:" -ForegroundColor Green
    Write-Host "     $StartShortcut"
}

Write-Host ""
Write-Host "[OK] Acceso directo creado en el escritorio:" -ForegroundColor Green
Write-Host "     $ShortcutPath"
Write-Host ""
Write-Host "Ya puedes:"
Write-Host "  1. Doble-click en 'Prontara Factory' en tu escritorio para arrancar."
Write-Host "  2. Buscar 'Prontara' en el menu Inicio."
Write-Host "  3. Boton derecho > 'Anclar a la barra de tareas' si lo quieres siempre a mano."
Write-Host ""
pause
