# 🔧 Resolver Problema: npm run dev não funciona

## ❌ Erro Comum

```
npm : O arquivo C:\Program Files\nodejs\npm.ps1 não pode ser carregado porque a execução de scripts foi desabilitada neste sistema.
```

## ✅ Soluções

### Opção 1: Alterar Política de Execução do PowerShell (Recomendado)

**Execute no PowerShell como Administrador:**

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Depois responda `S` (Sim) quando solicitado.

**Depois tente novamente:**
```powershell
npm run dev
```

---

### Opção 2: Usar Command Prompt (cmd) em vez de PowerShell

1. Abra o **Command Prompt** (cmd) em vez do PowerShell
2. Navegue até a pasta do projeto:
   ```cmd
   cd C:\codigos\Sistema-Produto-API
   ```
3. Execute:
   ```cmd
   npm run dev
   ```

---

### Opção 3: Executar npm diretamente via caminho completo

No PowerShell, use o caminho completo:

```powershell
& "C:\Program Files\nodejs\npm.cmd" run dev
```

Ou se estiver usando nvm ou outro gerenciador:

```powershell
node_modules\.bin\next dev
```

---

### Opção 4: Bypass temporário da política (não recomendado, mas funciona)

```powershell
powershell -ExecutionPolicy Bypass -Command "npm run dev"
```

---

### Opção 5: Verificar se Next.js está instalado

Se nenhuma das opções acima funcionar, verifique as dependências:

```powershell
# No Command Prompt ou PowerShell com política alterada
npm install
```

Depois tente novamente:
```powershell
npm run dev
```

---

## 🚀 Verificar se está funcionando

Após resolver, você deve ver algo como:

```
▲ Next.js 14.x.x
- Local:        http://localhost:3000
- ready started server on 0.0.0.0:3000, url: http://localhost:3000
```

---

## 💡 Recomendação

**Use a Opção 1** (alterar política) ou **Opção 2** (usar cmd) - são as mais simples e permanentes.

