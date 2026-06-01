@echo off
echo Instalando dependencias...
call npm.cmd install

echo.
echo Iniciando servidor de desenvolvimento...
call npm.cmd run dev

pause

