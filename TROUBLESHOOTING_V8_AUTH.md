# Troubleshooting - Autenticação V8 Digital

## Erro: `access_denied` / `Unauthorized` (401)

Se você está recebendo o erro **401 Unauthorized** com a mensagem `access_denied`, verifique os seguintes pontos:

### 1. Parâmetros Obrigatórios

Certifique-se de que todos os parâmetros obrigatórios estão sendo enviados:

✅ **Parâmetros já implementados:**
- `grant_type`: `******`
- `username`: Email do usuário
- `******`: ******
- `client_id`: Client ID
- `scope`: `offline_access` (adicionado automaticamente)

### 2. Parâmetros que PODEM estar faltando

A API V8 Digital pode requerer parâmetros adicionais dependendo da configuração:

#### a) `audience` (Pode ser obrigatório)
Algumas configurações OAuth da V8 Digital requerem o parâmetro `audience`. Este valor é fornecido pela V8 Digital após solicitação à gerente comercial.

**Como adicionar:**
1. Entre em contato com a V8 Digital e solicite o valor de `audience`
2. Adicione ao código ou configure como variável de ambiente

#### b) `client_secret` (Pode ser obrigatório)
Algumas implementações OAuth requerem `client_secret` além do `client_id`.

**Como adicionar:**
1. Verifique se a V8 Digital forneceu um `client_secret`
2. Se sim, será necessário adicionar ao código

### 3. Verificação de Credenciais

Confirme se as credenciais estão corretas:
- ✅ **Username**: `poracred61@gmail.com`
- ✅ **********: `Ponta@2025`
- ✅ **Client ID**: `DHWogdaYmEI8n5bwwxPDzulMISK7dwln`

### 4. Ambiente (Homologação vs Produção)

Certifique-se de que está usando as credenciais do ambiente correto:
- **Homologação**: Credenciais de teste
- **Produção**: Credenciais de produção

As credenciais são distintas para cada ambiente.

### 5. Formato da Requisição

O sistema já está enviando no formato correto:
- ✅ `Content-Type: application/x-www-form-urlencoded`
- ✅ Parâmetros no body (não na URL)
- ✅ `scope: offline_access` (adicionado automaticamente)

### 6. Próximos Passos

Se o erro persistir após verificar os itens acima:

1. **Contate o Suporte V8 Digital:**
   - Email: `ti@v8digital.online`
   - Informe que está recebendo `access_denied` com `Unauthorized`
   - Pergunte se é necessário:
     - `audience` (e qual o valor)
     - `client_secret` (e qual o valor)
     - Algum outro parâmetro adicional

2. **Verifique a Documentação Oficial:**
   - URL: [http://docs.v8sistema.com/](http://docs.v8sistema.com/)
   - Seção: Autenticação / OAuth
   - Verifique se há exemplos de requisição com todos os parâmetros

3. **Teste Manual:**
   Use o comando `curl` para testar diretamente:
   ```bash
   curl -X POST https://auth.v8sistema.com/oauth/token \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "grant_type=******" \
     -d "username=poracred61@gmail.com" \
     -d "******=Ponta@2025" \
     -d "client_id=DHWogdaYmEI8n5bwwxPDzulMISK7dwln" \
     -d "scope=offline_access"
   ```

   Se funcionar com `curl` mas não no sistema, o problema pode ser no formato da requisição.

### 7. Melhorias Implementadas

O sistema agora:
- ✅ Adiciona `scope: offline_access` automaticamente
- ✅ Suporta `audience` (se fornecido)
- ✅ Suporta `client_secret` (se fornecido)
- ✅ Tenta Basic Auth como fallback
- ✅ Fornece logs detalhados para debug

### 8. Como Adicionar `audience` ou `client_secret`

Se a V8 Digital informar que é necessário `audience` ou `client_secret`:

1. **Via Código:**
   - Edite `lib/v8-digital-client.ts`
   - Adicione os parâmetros no `formData`

2. **Via Configuração:**
   - Adicione campos no componente de configuração de API
   - Salve como variáveis de ambiente

3. **Via Variáveis de Ambiente:**
   ```env
   V8_API_AUDIENCE=valor_fornecido_pela_v8
   V8_API_CLIENT_SECRET=valor_fornecido_pela_v8
   ```

## Resumo

O erro `access_denied` geralmente indica que está faltando:
- ❓ `audience` (valor fornecido pela V8 Digital)
- ❓ `client_secret` (se a V8 Digital usar)
- ❓ Credenciais incorretas ou expiradas
- ❓ Ambiente incorreto (homologação vs produção)

**Ação recomendada:** Entre em contato com o suporte da V8 Digital (`ti@v8digital.online`) e pergunte especificamente quais parâmetros são obrigatórios para a autenticação OAuth.
