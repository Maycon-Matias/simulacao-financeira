# 🚀 Instruções de Execução

## Executar o Sistema

### Opção 1: Via CMD (Recomendado)

```cmd
cd c:\codigos\Sistema-Produto-API
npm.cmd install
npm.cmd run dev
```

### Opção 2: Via Script Batch

Execute o arquivo `start.bat` no Windows Explorer ou via CMD:

```cmd
start.bat
```

### Opção 3: Via PowerShell (se a política permitir)

```powershell
cd c:\codigos\Sistema-Produto-API
npm install
npm run dev
```

## Acessar o Sistema

Após iniciar, o sistema estará disponível em:

**http://localhost:3004**

## Configuração

Antes de usar, configure o arquivo `.env.local`:

```env
NEXT_PUBLIC_API_BASE_URL=https://api.hubcredito.com.br/api
NEXT_PUBLIC_API_KEY=REDACTED
# ou
NEXT_PUBLIC_API_TOKEN=seu-token-aqui
```

## Comandos Disponíveis

- `npm run dev` - Inicia servidor de desenvolvimento (porta 3004)
- `npm run build` - Gera build de produção
- `npm run start` - Inicia servidor de produção (porta 3004)
- `npm run lint` - Executa linter

## Solução de Problemas

### Erro de Política de Execução

Se encontrar erro de política de execução no PowerShell, use o CMD ou execute:

```cmd
cmd /c "npm.cmd install"
cmd /c "npm.cmd run dev"
```

### Porta já em uso

Se a porta 3004 estiver ocupada, altere no `package.json`:

```json
"dev": "next dev -p 3005"
```

