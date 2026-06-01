# 🔧 Troubleshooting - Erro 500 (Internal Server Error)

Este documento ajuda a identificar e resolver erros 500 na API.

## 🔍 Como Identificar o Problema

### 1. Verificar os Logs do Console

Abra o console do navegador (F12) e verifique:
- Qual endpoint está retornando erro 500
- Mensagem de erro específica
- Stack trace completo

### 2. Verificar os Logs do Servidor

No terminal onde o servidor está rodando (`npm run dev`), procure por:
- Mensagens de erro em vermelho
- Stack traces
- Logs que começam com `[NossaFintechClient]`, `[autorizar-clt]`, `[consultar-clt]`, etc.

## 🐛 Problemas Comuns e Soluções

### Problema 1: Promot ID Não Configurado

**Sintomas:**
- Erro 500 ao tentar autenticar
- Mensagem: "Promot ID não configurado"

**Solução:**
1. Verifique se a variável de ambiente está configurada:
   ```env
   NOSSA_FINTECH_API_PROMOT_ID=1
   ```
   ou
   ```env
   NEXT_PUBLIC_NOSSA_FINTECH_API_PROMOT_ID=1
   ```

2. Se estiver usando "001" como string, o sistema agora converte automaticamente para `1`

3. Reinicie o servidor após alterar variáveis de ambiente:
   ```bash
   # Pare o servidor (Ctrl+C)
   # Inicie novamente
   npm run dev
   ```

### Problema 2: Credenciais Inválidas

**Sintomas:**
- Erro 500 ao fazer login
- Mensagem de erro da API de autenticação

**Solução:**
1. Verifique as credenciais no arquivo `.env.local`:
   ```env
   NOSSA_FINTECH_API_CPF=10143545108
   NOSSA_FINTECH_API_PASSWORD=sua-******
   NOSSA_FINTECH_API_PROMOT_ID=1
   ```

2. Verifique se o CPF está correto (11 dígitos, sem formatação)

3. Verifique se a ****** está correta

4. Verifique se o Promot ID está correto (deve ser `1` ou `001`)

### Problema 3: Erro na Conversão do Promot ID

**Sintomas:**
- Erro ao fazer login
- Promot ID não está sendo reconhecido

**Solução:**
O código agora trata automaticamente:
- `"001"` → `1`
- `"1"` → `1`
- `1` → `1`

Se ainda houver problemas, verifique os logs:
```
[NossaFintechClient] Verificando Promot ID para login. Valor atual: ...
[NossaFintechClient] Promot ID atualizado: ... -> ... (tipo: ...)
```

### Problema 4: Timeout na Requisição

**Sintomas:**
- Erro 500 após alguns segundos
- Mensagem: "Timeout: A requisição demorou muito para responder"

**Solução:**
1. Verifique sua conexão com a internet
2. Verifique se a API da Nossa Fintech está acessível
3. Algumas operações podem demorar mais (simulações CLT têm timeout de 2 minutos)

### Problema 5: Erro ao Processar Resposta da API

**Sintomas:**
- Erro 500 após receber resposta da API
- Mensagem: "Erro ao processar requisição"

**Solução:**
1. Verifique os logs do servidor para ver a resposta completa da API
2. A resposta pode ter uma estrutura diferente do esperado
3. Verifique se todos os campos obrigatórios foram enviados

## 📋 Checklist de Verificação

Antes de reportar um erro 500, verifique:

- [ ] **Variáveis de Ambiente**: Todas as variáveis necessárias estão configuradas?
  ```env
  NOSSA_FINTECH_API_CPF=10143545108
  NOSSA_FINTECH_API_PASSWORD=sua-******
  NOSSA_FINTECH_API_PROMOT_ID=1
  NOSSA_FINTECH_API_BASE_URL=https://nossa-fintech-api.spixiiservices.com.br
  ```

- [ ] **Servidor Reiniciado**: Após alterar variáveis de ambiente, o servidor foi reiniciado?

- [ ] **Credenciais Corretas**: CPF, ****** e Promot ID estão corretos?

- [ ] **Formato dos Dados**: 
  - CPF: 11 dígitos sem formatação
  - Promot ID: `1` ou `001` (ambos funcionam)

- [ ] **Logs Verificados**: Os logs do console e do servidor foram verificados?

## 🔍 Como Coletar Informações para Debug

### 1. Logs do Console do Navegador

Abra o DevTools (F12) → Console e copie:
- Mensagens de erro
- Requisições que falharam (aba Network)

### 2. Logs do Servidor

No terminal, copie:
- Mensagens que começam com `[NossaFintechClient]`
- Mensagens que começam com `[autorizar-clt]`, `[consultar-clt]`, etc.
- Stack traces completos

### 3. Informações da Requisição

Anote:
- Qual endpoint foi chamado (ex: `/api/produto/autorizar-clt`)
- Quais dados foram enviados (CPF, nome, telefone, etc.)
- Qual API ID foi usado (se aplicável)

## 🛠️ Correções Implementadas

### Conversão Melhorada do Promot ID

O código agora trata corretamente:
- `"001"` → converte para `1` (número)
- `"1"` → converte para `1` (número)
- `1` → mantém como `1` (número)

### Logs Melhorados

Os logs agora mostram:
- Valor atual do Promot ID
- Tipo do Promot ID (string ou number)
- Conversões realizadas

## 📞 Próximos Passos

Se o problema persistir após seguir este guia:

1. **Colete todas as informações acima**
2. **Verifique se o problema é específico de um endpoint**
3. **Teste com dados diferentes** para isolar o problema
4. **Verifique a documentação da API**: https://nossa-fintech-doc.spixiiservices.com.br/docs/intro

## 🔗 Endpoints que Podem Retornar 500

- `POST /api/produto/autorizar-clt` - Criar autorização CLT
- `POST /api/produto/verificar-status-clt` - Verificar status da autorização
- `POST /api/produto/consultar-clt` - Consultar margem/vínculos CLT
- `POST /api/produto/clt/simular` - Simular proposta CLT

Todos esses endpoints têm tratamento de erro detalhado e logs para facilitar o debug.
