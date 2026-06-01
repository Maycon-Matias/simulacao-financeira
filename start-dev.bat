@echo off
echo ========================================
echo   Sistema Produto API - Iniciando...
echo ========================================
echo.

cd /d "%~dp0"

echo Verificando processos na porta 3004...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3004 ^| findstr LISTENING 2^>nul') do (
    echo Parando processo %%a na porta 3004...
    taskkill /F /PID %%a >nul 2>&1
)

timeout /t 2 /nobreak >nul

echo.
echo Iniciando servidor Next.js na porta 3004...
echo Pressione Ctrl+C para parar o servidor
echo.

npm.cmd run dev

pause
