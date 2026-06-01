# Script PowerShell para iniciar o servidor de desenvolvimento
# Este script contorna o problema de política de execução

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Iniciando Servidor de Desenvolvimento" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Navega para o diretório do projeto
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptPath

Write-Host "Diretório: $scriptPath" -ForegroundColor Gray
Write-Host ""

# Verifica se Node.js está instalado
Write-Host "Verificando Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "✓ Node.js encontrado: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Node.js não encontrado!" -ForegroundColor Red
    Write-Host "  Instale o Node.js de: https://nodejs.org/" -ForegroundColor Yellow
    pause
    exit 1
}

Write-Host ""

# Verifica se npm está disponível
Write-Host "Verificando npm..." -ForegroundColor Yellow
try {
    $npmVersion = & "C:\Program Files\nodejs\npm.cmd" --version
    Write-Host "✓ npm encontrado: v$npmVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ npm não encontrado!" -ForegroundColor Red
    pause
    exit 1
}

Write-Host ""

# Verifica se node_modules existe
if (-not (Test-Path "node_modules")) {
    Write-Host "Instalando dependências..." -ForegroundColor Yellow
    & "C:\Program Files\nodejs\npm.cmd" install
    Write-Host ""
}

# Inicia o servidor
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Iniciando servidor na porta 3004..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Acesse: http://localhost:3004" -ForegroundColor Green
Write-Host ""
Write-Host "Pressione Ctrl+C para parar o servidor" -ForegroundColor Yellow
Write-Host ""

# Executa npm run dev usando o caminho completo
& "C:\Program Files\nodejs\npm.cmd" run dev

