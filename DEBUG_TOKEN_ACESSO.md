# 🔍 Debug - Token de Acesso Não Gerado

Este documento ajuda a identificar por que o token de acesso não está sendo gerado mesmo com credenciais corretas.

## 🔎 Como Verificar se o Token Está Sendo Gerado

### 1. Verificar os Logs do Console

Abra o console do navegador (F12) e procure por mensagens que começam com `[NossaFintechClient]`:

**Logs esperados durante o login:**
```
[NossaFintechClient] Verificando Promot ID para login. Valor atual: 1 Tipo: number
[NossaFintechClient] Fazendo login na API: https://nossa-fintech-api.spixiiservices.com.br/auth/login
[NossaFintechClient] Payload do login: { "cpf": "10143545108", "promot_id": 1, "******": "***" }
[NossaFintechClient] Promot ID sendo enviado: 1 (tipo: number)
[NossaFintechClient] Resposta do login - Status: 200 OK
[NossaFintechClient] Resposta do login (texto): {"access_token":"...","expires_in":3600}
[NossaFintechClient] Resposta do login (JSON): { ... }
[NossaFintechClient] Token obtido com sucesso! (tamanho: XXX caracteres)
[NossaFintechClient] Token expira em: 3600 segundos
[NossaFintechClient] Login Nossa Fintech realizado com sucesso!
[NossaFintechClient] Token armazenado: SIM
[NossaFintechClient] Expiração: 2025-01-XX...
```

### 2. Verificar os Logs do Servidor

No terminal onde o servidor está rodando, procure pelas mesmas mensagens acima.

## 🐛 Problemas Comuns

### Problema 1: Resposta da API Não Contém `access_token`

**Sintomas:**
- Log mostra: `[NossaFintechClient] Erro no login - resposta sem token`
- Log mostra: `[NossaFintechClient] Estrutura completa da resposta: {...}`
- Log mostra: `[NossaFintechClient] Campos disponíveis na resposta: [...]`

**Possíveis Causas:**
1. A API pode estar retornando o token em um campo diferente
2. A estrutura da resposta pode estar aninhada
3. A API pode estar retornando um erro que não está sendo detectado

**Solução:**
1. Verifique o log `[NossaFintechClient] Resposta do login (JSON)` para ver a estrutura completa
2. Verifique o log `[NossaFintechClient] Campos disponíveis na resposta` para ver quais campos existem
3. O código agora verifica múltiplos formatos:
   - `data.access_token`
   - `data.accessToken`
   - `data.token`
   - `data.data.access_token`
   - `data.data.accessToken`
   - `data.data.token`

### Problema 2: Erro na Resposta da API

**Sintomas:**
- Log mostra: `[NossaFintechClient] Erro no login Nossa Fintech: 401 {...}`
- Log mostra: `[NossaFintechClient] Erro no login Nossa Fintech: 400 {...}`

**Possíveis Causas:**
1. Credenciais incorretas (CPF, ****** ou promot_id)
2. Promot ID incorreto
3. Formato do payload incorreto

**Solução:**
1. Verifique o log `[NossaFintechClient] Payload do login` para confirmar os dados enviados
2. Verifique se o CPF está correto (11 dígitos, sem formatação)
3. Verifique se a ****** está correta
4. Verifique se o Promot ID está correto (deve ser `1` ou `001`)
5. Verifique o log `[NossaFintechClient] Erro no login - Resposta completa` para ver a mensagem de erro da API

### Problema 3: Erro ao Fazer Parse da Resposta

**Sintomas:**
- Log mostra: `[NossaFintechClient] Erro ao fazer parse da resposta: ...`

**Possíveis Causas:**
1. A API está retornando HTML em vez de JSON (erro 500, 404, etc.)
2. A resposta está vazia
3. A resposta não é um JSON válido

**Solução:**
1. Verifique o log `[NossaFintechClient] Resposta do login (texto)` para ver o que a API retornou
2. Verifique o status HTTP no log `[NossaFintechClient] Resposta do login - Status:`

### Problema 4: Token Gerado mas Não Armazenado

**Sintomas:**
- Log mostra: `[NossaFintechClient] Token obtido com sucesso!`
- Mas log mostra: `[NossaFintechClient] Token armazenado: NÃO`

**Solução:**
Isso não deveria acontecer, mas se acontecer, verifique:
1. Se há algum erro após a linha "Token obtido com sucesso"
2. Se o token está sendo limpo em algum lugar (ex: `updateCredentials` sendo chamado)

## 📋 Checklist de Verificação

Antes de reportar um problema, verifique:

- [ ] **Credenciais Configuradas**: CPF, ****** e Promot ID estão no `.env.local`?
  ```env
  NOSSA_FINTECH_API_CPF=10143545108
  NOSSA_FINTECH_API_PASSWORD=sua-******
  NOSSA_FINTECH_API_PROMOT_ID=1
  ```

- [ ] **Servidor Reiniciado**: Após alterar variáveis de ambiente, o servidor foi reiniciado?

- [ ] **Logs Verificados**: Os logs do console e do servidor foram verificados?

- [ ] **Status HTTP**: Qual é o status HTTP da resposta? (200 = sucesso, 401 = não autorizado, 400 = erro na requisição)

- [ ] **Estrutura da Resposta**: A resposta da API contém algum campo relacionado a token?

## 🔧 Melhorias Implementadas

### 1. Logs Detalhados
O código agora registra:
- Payload completo do login (com ****** mascarada)
- Promot ID sendo enviado e seu tipo
- Status HTTP da resposta
- Resposta completa em texto e JSON
- Estrutura completa da resposta se não houver token
- Campos disponíveis na resposta
- Confirmação de token armazenado

### 2. Verificação de Múltiplos Formatos
O código agora verifica o token em diferentes formatos:
- `access_token` (snake_case)
- `accessToken` (camelCase)
- `token` (formato simples)
- Formatos aninhados em `data`

### 3. Tratamento de Erros Melhorado
- Captura e exibe erros de parse
- Exibe resposta completa mesmo em caso de erro
- Mensagens de erro mais descritivas

## 📊 Exemplo de Resposta Esperada da API

A API deve retornar algo como:

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_in": 3600
}
```

Ou possivelmente:

```json
{
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expires_in": 3600
  }
}
```

## 🚀 Próximos Passos

1. **Execute uma requisição** que tente fazer login
2. **Verifique os logs** seguindo este guia
3. **Identifique o problema** usando os sintomas acima
4. **Se o problema persistir**, copie todos os logs e verifique:
   - Status HTTP da resposta
   - Estrutura completa da resposta
   - Mensagens de erro específicas

## 📞 Informações para Suporte

Se precisar de ajuda, forneça:
1. Logs completos do console e do servidor
2. Status HTTP da resposta
3. Estrutura completa da resposta da API (JSON)
4. Credenciais usadas (sem a ******, apenas confirme se estão corretas)
