# Troubleshooting - API V8 Digital

## Erro 401 Unauthorized

Se você está recebendo erro **401 Unauthorized** ao tentar autenticar na API V8 Digital, siga estes passos:

### 1. Verificar Credenciais

Confirme se as credenciais estão corretas:
- **Username/Email**: `poracred61@gmail.com`
- **********: `Ponta@2025`
- **Client ID**: `DHWogdaYmEI8n5bwwxPDzulMISK7dwln`

### 2. Verificar Logs do Servidor

Os logs do servidor mostrarão informações detalhadas:
- O que está sendo enviado na requisição
- A resposta completa do servidor
- Qualquer erro específico retornado pela API

Procure por logs que começam com `[v8/auth]` no console do servidor.

### 3. Possíveis Causas do 401

#### a) Credenciais Incorretas
- Verifique se o email e ****** estão corretos
- Confirme se o Client ID está correto
- Verifique se as credenciais não expiraram

#### b) Client Secret Necessário
Algumas implementações OAuth requerem `client_secret` além do `client_id`. Se a API V8 Digital requer isso, será necessário:
1. Obter o `client_secret` da V8 Digital
2. Adicionar ao endpoint de autenticação

#### c) Formato de Autenticação Diferente
A API V8 Digital pode usar:
- Basic Auth no header (já implementado como fallback)
- Client credentials no body de forma diferente
- Outro formato específico da V8 Digital

### 4. Verificar Documentação Oficial

Consulte a documentação oficial da V8 Digital:
- **URL**: [http://docs.v8sistema.com/](http://docs.v8sistema.com/)
- Seção: **Autenticação**

A documentação deve conter:
- O formato exato da requisição OAuth
- Se `client_secret` é necessário
- Se há algum header adicional necessário
- Exemplos de requisição e resposta

### 5. Contatar Suporte V8 Digital

Se o problema persistir, entre em contato com o suporte técnico:
- **Email**: `ti@v8digital.online`

Ao reportar, inclua:
- Payload enviado (sem ******)
- Resposta completa do servidor
- Logs do servidor
- Status code recebido

### 6. Verificar Ambiente

Certifique-se de que está usando:
- **URL de Autenticação correta**: `https://auth.v8sistema.com/oauth/token`
- **Credenciais do ambiente correto** (homologação vs produção)
- **URL Base correta**: `https://bff.v8sistema.com`

### 7. Testar Manualmente

Você pode testar a autenticação manualmente usando `curl`:

```bash
curl -X POST https://auth.v8sistema.com/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=******" \
  -d "username=poracred61@gmail.com" \
  -d "******=Ponta@2025" \
  -d "client_id=DHWogdaYmEI8n5bwwxPDzulMISK7dwln"
```

Se funcionar com `curl` mas não no sistema, o problema pode ser no formato da requisição.

### 8. Verificar se Precisa de Client Secret

Se a API retornar erro indicando que `client_secret` é necessário, será preciso:

1. Obter o `client_secret` da V8 Digital
2. Adicionar ao código de autenticação
3. Incluir no body da requisição ou como Basic Auth

## Melhorias Implementadas

O sistema agora:
- ✅ Tenta formato OAuth padrão primeiro
- ✅ Se receber 401, tenta com Basic Auth no header
- ✅ Fornece logs detalhados para debug
- ✅ Retorna mensagens de erro mais informativas
- ✅ Executa autenticação no servidor (evita CORS)

## Próximos Passos

1. Verifique os logs do servidor para ver a resposta exata da API
2. Consulte a documentação oficial da V8 Digital
3. Se necessário, entre em contato com o suporte técnico da V8 Digital
4. Se descobrir que precisa de `client_secret`, informe para que possamos adicionar ao código
