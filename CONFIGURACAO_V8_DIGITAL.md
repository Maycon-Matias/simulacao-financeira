# Configuração V8 Digital

## ⚠️ IMPORTANTE: `audience` é OBRIGATÓRIO

A API V8 Digital **requer** o parâmetro `audience` para autenticação. Sem este parâmetro, você receberá erro `401 Unauthorized`.

## Variáveis de Ambiente

Crie um arquivo `.env.local` na raiz do projeto com as seguintes variáveis:

```env
# V8 Digital - OBRIGATÓRIAS
V8_API_USERNAME=poracred61@hotmail.com
V8_API_PASSWORD=F1Dfm!wmzDv*
V8_API_CLIENT_ID=DHWogdaYmEI8n5bwwxPDzulMlSK7dwIn
V8_API_AUDIENCE=https://bff.v8sistema.com  # ⚠️ OBRIGATÓRIO

# V8 Digital - Opcionais
V8_API_BASE_URL=https://bff.v8sistema.com
V8_API_AUTH_URL=https://auth.v8sistema.com/oauth/token
V8_API_CLIENT_SECRET=  # Não necessário para este client_id
```

## Credenciais Configuradas

✅ **Status**: Autenticação testada e funcionando!

As credenciais oficiais foram configuradas conforme instruções da V8 Digital:

- **Username**: `poracred61@hotmail.com`
- **Client ID**: `DHWogdaYmEI8n5bwwxPDzulMlSK7dwIn`
- **Audience**: `https://bff.v8sistema.com`
- **Scope**: `offline_access` (padrão)

**Documentação**: https://docs.v8sistema.com

## Endpoints

### Autenticação
- **URL**: `https://auth.v8sistema.com/oauth/token`
- **Método**: `POST` (APENAS POST, não aceita GET)
- **Content-Type**: `application/x-www-form-urlencoded`
- **Parâmetros obrigatórios**:
  - `grant_type`: `******`
  - `username`: Email de acesso
  - `******`: ******
  - `client_id`: ID do registro
  - `audience`: Valor fornecido pela V8 Digital ⚠️ **OBRIGATÓRIO**
  - `scope`: `offline_access`

### Exemplo de Requisição

```bash
curl -X POST https://auth.v8sistema.com/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=******" \
  -d "username=seu_email@exemplo.com" \
  -d "******=sua_senha" \
  -d "client_id=seu_client_id" \
  -d "audience=valor_fornecido_pela_v8" \
  -d "scope=offline_access"
```

### Resposta de Sucesso

```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "..."
}
```

## Base URL (BFF)

- **URL**: `https://bff.v8sistema.com`
- **Autenticação**: Bearer REDACTED (obtido na autenticação)

## Configuração no Sistema

1. Acesse a página de configuração de APIs
2. Selecione ou crie uma configuração para V8 Digital
3. Preencha todos os campos, **incluindo `audience`**
4. Teste a conexão

## Teste de Autenticação

Execute o script de teste:

```bash
# Instale as dependências (se necessário)
npm install axios qs dotenv

# Configure as variáveis de ambiente no .env.local
# Depois execute:
npx ts-node test-v8-exemplo.ts
```

Ou use o teste direto com Node.js:

```bash
node test-v8-digital-completo.js
```

## Troubleshooting

### Erro 401 Unauthorized

**Causa mais comum**: Falta o parâmetro `audience` ou valor incorreto.

**Solução**:
1. Verifique se `V8_API_AUDIENCE` está configurado no `.env.local`
2. Verifique se o valor está correto (fornecido pela V8 Digital)
3. Entre em contato com V8 Digital para confirmar o valor correto

### Erro "audience é obrigatório"

O sistema agora valida que `audience` está presente. Configure a variável de ambiente ou adicione na configuração da API.

### CORS Policy

O sistema usa uma rota Next.js (`/api/produto/v8/auth`) para fazer a autenticação no servidor, evitando problemas de CORS.

## Documentação Oficial

- **Documentação V8 Digital**: [http://docs.v8sistema.com/](http://docs.v8sistema.com/)
- **Suporte**: `ti@v8digital.online`
