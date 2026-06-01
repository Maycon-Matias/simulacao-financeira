# Instala dependencias e Chromium do Playwright.
# Execute no PowerShell: .\install-playwright.ps1

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "Configurando npm (offline=false, sem proxy)..." -ForegroundColor Cyan
npm config set offline false 2>$null
npm config delete proxy 2>$null
npm config delete https-proxy 2>$null

Write-Host "`nInstalando dependencias (npm install)..." -ForegroundColor Cyan
npm install
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`nInstalando Chromium do Playwright..." -ForegroundColor Cyan
npm run playwright:install
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`nConcluido." -ForegroundColor Green
