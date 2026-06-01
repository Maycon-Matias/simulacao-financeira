@echo off
cd /d "%~dp0"

echo Configurando npm...
call npm config set offline false 2>nul
call npm config delete proxy 2>nul
call npm config delete https-proxy 2>nul

echo.
echo Instalando dependencias...
call npm install
if errorlevel 1 exit /b 1

echo.
echo Instalando Chromium do Playwright...
call npm run playwright:install
if errorlevel 1 exit /b 1

echo.
echo Concluido.
pause
