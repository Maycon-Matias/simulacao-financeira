# Script para iniciar o sistema
# Usa cmd para evitar problemas com política de execução do PowerShell
Write-Host "Instalando dependências..." -ForegroundColor Yellow
cmd /c "npm.cmd install"

Write-Host "`nIniciando servidor de desenvolvimento..." -ForegroundColor Green
cmd /c "npm.cmd run dev"

