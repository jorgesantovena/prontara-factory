@echo off
REM =======================================================================
REM  Prontara Factory — Instalador (un solo click)
REM
REM  Este fichero crea el acceso directo en el escritorio y en el menu
REM  Inicio para que puedas abrir Prontara Factory como cualquier otro
REM  programa.
REM =======================================================================
title Instalar Prontara Factory
color 0B

set "SCRIPT_DIR=%~dp0"
echo.
echo  ====================================================
echo            INSTALAR PRONTARA FACTORY
echo  ====================================================
echo.
echo  Voy a crear:
echo    - "Prontara Factory" en tu escritorio
echo    - "Prontara Factory" en el menu Inicio
echo.
echo  Pulsa cualquier tecla para continuar (o cierra para cancelar).
pause >nul

powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%Crear-Acceso-Directo-Escritorio.ps1"

if %errorlevel% neq 0 (
  echo.
  echo  [X] Algo fallo al crear el acceso directo.
  pause
  exit /b 1
)

echo.
echo  Listo. Cierra esta ventana.
pause
