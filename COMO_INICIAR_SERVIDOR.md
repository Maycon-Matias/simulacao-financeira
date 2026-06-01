# 🚀 Como Iniciar o Servidor

## ⚠️ Problema Comum: Porta 3004 já em uso

Se você receber o erro:
```
Error: listen EADDRINUSE: address already in use :::3004
```

Significa que já há um processo usando a porta 3004.

## ✅ Soluções Rápidas

### Opção 1: Usar o Script Automático (Mais Fácil)

**Clique duas vezes no arquivo:**
- `start-dev.bat` - Para iniciar o servidor
- `restart-dev.bat` - Para reiniciar o servidor

O script automaticamente:
1. ✅ Para processos na porta 3004
2. ✅ Inicia o servidor

### Opção 2: Comandos Manuais

#### No PowerShell:
```powershell
# Parar processos na porta 3004
netstat -ano | findstr :3004
# Anote o PID (último número) e execute:
taskkill /F /PID <PID>

# Iniciar servidor
npm.cmd run dev
```

#### No CMD (Prompt de Comando):
```cmd
# Parar processos na porta 3004
netstat -ano | findstr :3004
# Anote o PID e execute:
taskkill /F /PID <PID>

# Iniciar servidor
npm run dev
```

### Opção 3: Usar Porta Diferente

Se quiser usar outra porta (ex: 3005):

```cmd
npm.cmd run dev -- -p 3005
```

## 🔍 Verificar se o Servidor Está Rodando

Abra o navegador e acesse:
- http://localhost:3004

Se aparecer a página, o servidor está funcionando! ✅

## 📋 Checklist de Verificação

Antes de iniciar, verifique:

- [ ] **Node.js instalado**: `node --version` (deve mostrar v18+)
- [ ] **npm instalado**: `npm --version`
- [ ] **Dependências instaladas**: `npm install` (se necessário)
- [ ] **Porta 3004 livre**: Nenhum processo usando a porta

## 🐛 Problemas Comuns

### 1. Erro: "npm.ps1 não pode ser carregado"

**Solução:** Use `npm.cmd` ao invés de `npm`:
```cmd
npm.cmd run dev
```

Ou use o CMD ao invés do PowerShell.

### 2. Erro: "Porta já em uso"

**Solução:** Pare o processo usando a porta:
```cmd
# Ver qual processo está usando
netstat -ano | findstr :3004

# Parar o processo (substitua PID pelo número encontrado)
taskkill /F /PID <PID>
```

### 3. Erro: "Cannot find module"

**Solução:** Instale as dependências:
```cmd
npm install
```

### 4. Servidor não inicia

**Solução:** Verifique os logs no terminal para ver o erro específico.

## 📝 Comandos Úteis

```cmd
# Ver processos na porta 3004
netstat -ano | findstr :3004

# Parar todos os processos Node.js (CUIDADO!)
taskkill /F /IM node.exe

# Verificar se Node.js está instalado
node --version

# Verificar se npm está instalado
npm --version

# Instalar dependências
npm install

# Iniciar servidor
npm.cmd run dev

# Iniciar em porta diferente
npm.cmd run dev -- -p 3005
```

## 🎯 Resumo Rápido

**Para iniciar rapidamente:**
1. Clique duas vezes em `start-dev.bat`
2. Ou execute: `npm.cmd run dev`

**Se der erro de porta:**
1. Execute: `taskkill /F /PID <PID>` (substitua PID)
2. Ou use: `start-dev.bat` que faz isso automaticamente

**Acessar o servidor:**
- http://localhost:3004
