@echo off
REM =======================================================================
REM  Prontara Factory — lanzador de escritorio
REM  Doble-click para arrancar el entorno y abrir el navegador.
REM =======================================================================
title Prontara Factory
color 0B

set "PROJECT_DIR=%~dp0.."
cd /d "%PROJECT_DIR%"

echo.
echo  ====================================================
echo            PRONTARA  FACTORY
echo  ====================================================
echo.
echo   Carpeta del proyecto:
echo   %PROJECT_DIR%
echo.

REM --- Comprobar si ya hay algo escuchando en el puerto 3000 ---
powershell -NoProfile -Command "if ((Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue)) { exit 0 } else { exit 1 }" >nul 2>&1
if %errorlevel% equ 0 (
  echo  [OK] Prontara ya esta corriendo en localhost:3000
  echo       Abriendo navegador...
  goto :open_browser
)

echo  [..] Arrancando Prontara en segundo plano (puede tardar 10-20 s)
echo.

REM --- Lanzar pnpm dev en una ventana minimizada ---
start "Prontara Factory - servidor" /MIN cmd /k "cd /d %PROJECT_DIR% && pnpm dev"

REM --- Esperar a que el puerto 3000 responda ---
echo  [..] Esperando a que el servidor responda...
set /a tries=0
:wait_loop
set /a tries+=1
if %tries% gtr 60 (
  echo.
  echo  [X] El servidor no respondio en 60 segundos.
  echo      Mira la ventana "Prontara Factory - servidor" para ver el error.
  echo.
  pause
  exit /b 1
)
powershell -NoProfile -Command "try { (Invoke-WebRequest -Uri http://localhost:3000 -UseBasicParsing -TimeoutSec 1).StatusCode } catch { exit 1 }" >nul 2>&1
if %errorlevel% neq 0 (
  timeout /t 1 /nobreak >nul
  goto :wait_loop
)

:open_browser
echo  [OK] Servidor listo. Abriendo http://localhost:3000/factory
start "" "http://localhost:3000/factory"

echo.
echo  ====================================================
echo   Tu entorno Prontara esta abierto en el navegador.
echo   Para cerrarlo, cierra la ventana minimizada
echo   "Prontara Factory - servidor".
echo  ====================================================
echo.
timeout /t 3 /nobreak >nul
exit /b 0
