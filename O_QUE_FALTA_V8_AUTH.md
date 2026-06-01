# O que está faltando para autenticação V8 Digital

## Análise do Erro 401 Unauthorized

Baseado no erro retornado:
```json
{
  "error": "access_denied",
  "error_description": "Unauthorized"
}
```

## ✅ O que JÁ está sendo enviado:

1. ✅ `grant_type`: `******`
2. ✅ `username`: `poracred61@gmail.com`
3. ✅ `******`: `Ponta@2025`
4. ✅ `client_id`: `DHWogdaYmEI8n5bwwxPDzulMISK7dwln`
5. ✅ `scope`: `offline_access` (adicionado automaticamente)

## ❓ O que PODE estar faltando:

### 1. **`audience`** (Muito Provável)

A documentação da V8 Digital indica que o parâmetro `audience` pode ser obrigatório. Este valor é fornecido pela V8 Digital após solicitação à gerente comercial.

**Como obter:**
- Entre em contato com a V8 Digital
- Solicite o valor de `audience` para sua integração
- Email: `ti@v8digital.online`

**Como adicionar:**
- O código já está preparado para aceitar `audience`
- Basta fornecer o valor quando configurar a API

### 2. **`client_secret`** (Possível)

Algumas implementações OAuth requerem `client_secret` além do `client_id`.

**Como verificar:**
- Verifique se a V8 Digital forneceu um `client_secret`
- Se sim, será necessário adicionar

**Como adicionar:**
- O código já está preparado para aceitar `client_secret`
- Basta fornecer o valor quando configurar a API

### 3. **Credenciais Incorretas ou Expiradas** (Possível)

Verifique se:
- O email `poracred61@gmail.com` está correto
- A ****** `Ponta@2025` está correta e não expirou
- O `client_id` está correto e ativo

### 4. **Ambiente Incorreto** (Possível)

Certifique-se de que está usando:
- Credenciais de **homologação** para testes
- Credenciais de **produção** para produção

As credenciais são distintas para cada ambiente.

## 🔧 Melhorias Implementadas

O sistema agora:
- ✅ Adiciona `scope: offline_access` automaticamente
- ✅ Suporta `audience` (se fornecido)
- ✅ Suporta `client_secret` (se fornecido)
- ✅ Tenta Basic Auth como fallback
- ✅ Fornece logs detalhados para debug

## 📋 Próximos Passos

### Passo 1: Contatar V8 Digital

Entre em contato com o suporte técnico:
- **Email**: `ti@v8digital.online`
- **Assunto**: Erro 401 Unauthorized - access_denied
- **Informe**:
  - Que está recebendo `access_denied` com `Unauthorized`
  - Que já está enviando: `grant_type`, `username`, `******`, `client_id`, `scope`
  - **Pergunte especificamente**:
    - É necessário o parâmetro `audience`? Qual o valor?
    - É necessário o parâmetro `client_secret`? Qual o valor?
    - Há algum outro parâmetro obrigatório que não está sendo enviado?

### Passo 2: Verificar Documentação

Consulte a documentação oficial:
- URL: [http://docs.v8sistema.com/](http://docs.v8sistema.com/)
- Seção: Autenticação / OAuth
- Procure por exemplos de requisição completos

### Passo 3: Teste Manual

Teste diretamente com `curl` para verificar se o problema é no formato:

```bash
curl -X POST https://auth.v8sistema.com/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=******" \
  -d "username=poracred61@gmail.com" \
  -d "******=Ponta@2025" \
  -d "client_id=DHWogdaYmEI8n5bwwxPDzulMISK7dwln" \
  -d "scope=offline_access"
```

Se funcionar com `curl`, o problema pode ser no formato da requisição do sistema.
Se não funcionar, o problema é nas credenciais ou parâmetros faltantes.

## 📝 Resumo

**O que está faltando provavelmente:**
1. ❓ **`audience`** - Valor fornecido pela V8 Digital (mais provável)
2. ❓ **`client_secret`** - Se a V8 Digital usar autenticação com secret
3. ❓ **Credenciais incorretas** - Verificar se estão corretas e ativas
4. ❓ **Ambiente incorreto** - Verificar se está usando credenciais do ambiente correto

**Ação imediata:** Contatar V8 Digital (`ti@v8digital.online`) e perguntar especificamente quais parâmetros são obrigatórios para a autenticação OAuth.
