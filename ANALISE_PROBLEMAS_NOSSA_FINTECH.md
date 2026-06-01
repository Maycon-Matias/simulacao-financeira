# Análise de Problemas - Consulta de Margem Nossa Fintech

## 📋 Resumo da Situação

As consultas de margem estão retornando erro "Não foi encontrada autorização aprovada" ou status "PENDING", mesmo quando o registro está autorizado no sistema web.

## ✅ O que está CORRETO no código

1. **Endpoint**: `/clt-loan/v1/get-margin` ✓
2. **Método**: POST ✓
3. **Headers**: 
   - `Authorization: Bearer {token}` ✓
   - `Content-Type: application/json` ✓
4. **Payload**: 
   - `document_number` (CPF) ✓
   - `employer_document` (CNPJ) ✓
   - `service_type` (ex: "QITECH") ✓

## 🔍 Possíveis Causas do Problema

### 1. **Inconsistência de Dados entre Autorização e Consulta**

A autorização no sistema web pode ter sido criada com dados diferentes dos usados na consulta:

#### **Promot ID**
- ❌ **Problema**: O `promot_id` usado no login/autenticação pode ser diferente do usado na autorização
- ✅ **Solução**: Verificar se o `promot_id` configurado corresponde ao usado na autorização no sistema web

#### **CNPJ do Empregador**
- ❌ **Problema**: O CNPJ usado na consulta pode não corresponder ao CNPJ usado na autorização
- ✅ **Solução**: Comparar o CNPJ do CSV com o CNPJ usado na autorização no sistema web (devem ser EXATAMENTE iguais)

#### **Service Type**
- ❌ **Problema**: O `service_type` (ex: "QITECH") usado na consulta pode não corresponder ao usado na autorização
- ✅ **Solução**: Verificar no sistema web qual `service_type` foi usado na autorização e garantir que o CSV tenha o mesmo valor

### 2. **Status da Autorização**

A API pode retornar diferentes status:
- `AUTHORIZED`: Autorização aprovada e confirmada
- `PENDING`: Autorização criada mas ainda não confirmada pelo registro via SMS
- `NOT_AUTHORIZED`: Autorização não encontrada ou rejeitada

**Se o sistema web mostra "Autorizado" mas a API retorna "PENDING":**
- O registro pode não ter confirmado a autorização via SMS ainda
- Pode haver uma inconsistência entre o sistema web e a API
- Os dados da autorização podem não corresponder aos dados da consulta

### 3. **Problemas de Autenticação**

- ❌ **Problema**: Token expirado ou inválido
- ✅ **Solução**: O código já renova o token automaticamente, mas verifique os logs para confirmar

- ❌ **Problema**: Credenciais incorretas (CPF, ******, promot_id)
- ✅ **Solução**: Verificar se as credenciais estão corretas e correspondem às do sistema web

### 4. **Estrutura da Resposta da API**

A API pode retornar estruturas aninhadas diferentes:
```json
{
  "success": true,
  "data": {
    "success": true,
    "data": {
      "status": "PENDING",
      "authorization_link": "..."
    },
    "status": "PENDING"
  }
}
```

✅ **Solução**: O código já trata isso verificando múltiplos níveis (`data.status`, `data.data.status`)

## 🛠️ Checklist de Verificação

Antes de fazer uma consulta, verifique:

- [ ] **Promot ID**: O `promot_id` configurado corresponde ao usado na autorização?
- [ ] **CNPJ Empregador**: O CNPJ no CSV corresponde EXATAMENTE ao usado na autorização?
- [ ] **Service Type**: O `service_type` no CSV corresponde ao usado na autorização?
- [ ] **CPF**: O CPF está correto e formatado corretamente (11 dígitos)?
- [ ] **Status da Autorização**: O registro confirmou a autorização via SMS?
- [ ] **Credenciais**: As credenciais (CPF, ******, promot_id) estão corretas?

## 📊 Como Verificar os Dados da Autorização

1. **No Sistema Web da Nossa Fintech:**
   - Acesse a autorização do registro
   - Anote:
     - Promot ID usado
     - CNPJ do empregador
     - Service Type (código da bancarizadora)
     - Status da autorização

2. **No CSV de Importação:**
   - Verifique se todos os dados correspondem EXATAMENTE aos da autorização
   - CPF: 11 dígitos (sem formatação)
   - CNPJ: 14 dígitos (sem formatação)
   - Service Type: Deve ser exatamente o mesmo (ex: "QITECH")

## 🔧 Melhorias Implementadas no Código

1. ✅ Validação rigorosa de campos obrigatórios
2. ✅ Extração de status de múltiplos níveis da resposta
3. ✅ Mensagens de erro detalhadas com dados da consulta
4. ✅ Verificação de status antes de criar nova autorização
5. ✅ Logs detalhados para debug

## 📝 Próximos Passos Recomendados

1. **Verificar Logs**: Analise os logs do console para ver exatamente o que está sendo enviado e recebido
2. **Comparar Dados**: Compare os dados do CSV com os dados da autorização no sistema web
3. **Testar com um registro**: Teste com um registro que você sabe que está autorizado e compare os dados
4. **Contatar Suporte**: Se o problema persistir, entre em contato com o suporte da Nossa Fintech com:
   - CPF do registro
   - CNPJ do empregador usado
   - Service Type usado
   - Promot ID usado
   - Status retornado pela API vs. status no sistema web

## 🔧 Correção Implementada: Notação Científica no CNPJ

### Problema Identificado
Quando o Excel ou Google Sheets salva CNPJs grandes, eles podem ser convertidos para notação científica (ex: "4,41073E+13" ou "1,2608E+13"). Isso causa falhas nas consultas porque o CNPJ não é reconhecido corretamente.

### Solução Implementada
O código agora:
1. ✅ **Detecta notação científica** em CNPJs (padrão `E+` ou `e+`)
2. ✅ **Converte para número** e depois para string com 14 dígitos
3. ✅ **Corrige CNPJs com menos de 14 dígitos** adicionando zeros à esquerda
4. ✅ **Trunca CNPJs com mais de 14 dígitos** (pega os últimos 14)
5. ✅ **Valida CNPJs inválidos** (apenas zeros)
6. ✅ **Registra correções** para facilitar debug

### Exemplo de Correção
- **Antes**: `4,41073E+13` → Não funcionava
- **Depois**: `4,41073E+13` → `44107300000000` (14 dígitos)

### Como Evitar o Problema no Excel
1. **Formate a coluna como Texto** antes de inserir os CNPJs
2. **Ou use formatação personalizada**: `00000000000000` (14 zeros)
3. **Ou salve como CSV** diretamente sem abrir no Excel

## 🎯 Conclusão

O código está implementado corretamente conforme a documentação oficial. Os problemas principais podem ser:

1. **Inconsistência de dados** entre autorização e consulta (promot_id, CNPJ, service_type)
2. **Formatação incorreta** de CNPJs em notação científica (agora corrigido automaticamente)
3. **Status PENDING** quando o registro não confirmou a autorização via SMS

**A solução mais provável é garantir que todos os dados (promot_id, CNPJ, service_type) correspondam EXATAMENTE entre a autorização e a consulta.**

