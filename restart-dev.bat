@echo off
echo ========================================
echo   Sistema Produto API - Reiniciando...
echo ========================================
echo.

cd /d "%~dp0"

echo Parando processos na porta 3004...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3004 ^| findstr LISTENING 2^>nul') do (
    echo Parando processo %%a...
    taskkill /F /PID %%a >nul 2>&1
)

timeout /t 2 /nobreak >nul

echo Iniciando servidor...
npm.cmd run dev
