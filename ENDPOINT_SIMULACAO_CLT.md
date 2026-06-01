# 🔍 Endpoint de Simulação CLT - Nossa Fintech

## ⚠️ Problema Identificado

O endpoint `/clt/simular` está retornando **404 (Not Found)** na API da Nossa Fintech.

## 🔍 Análise

### Endpoints Conhecidos da API Nossa Fintech

Todos os endpoints CLT seguem o padrão `/clt-loan/v1/...`:

1. ✅ **Autorização CLT**: `/clt-loan/v1/request-authorization`
2. ✅ **Verificar Status**: `/clt-loan/v1/check-authorization`
3. ✅ **Consultar Margem**: `/clt-loan/v1/get-margin`
4. ❓ **Simulação CLT**: `???` (não confirmado)

### Endpoint Atual (Não Funciona)

```
POST /clt/simular
```

**Status:** Retorna 404 - Not Found

## 🔧 Solução Implementada

O código agora tenta automaticamente vários endpoints possíveis:

1. `/clt-loan/v1/simulate` (mais provável, seguindo o padrão)
2. `/clt-loan/v1/simular`
3. `/clt-loan/v1/simulation`
4. `/clt/simular` (fallback)

## 📋 Próximos Passos

### 1. Verificar Documentação Oficial

Acesse a documentação da API:
- **URL:** https://nossa-fintech-doc.spixiiservices.com.br/docs/intro
- Procure por: "CLT simulation" ou "simular CLT"

### 2. Verificar Logs

Após executar uma simulação, verifique os logs:
- Qual endpoint foi tentado
- Qual retornou erro 404
- Se algum funcionou

### 3. Contatar Suporte

Se nenhum endpoint funcionar, entre em contato com o suporte da Nossa Fintech e pergunte:
- Qual é o endpoint correto para simulação CLT?
- Qual é a estrutura do payload esperado?
- Há alguma documentação específica para simulação?

## 📝 Payload Atual

O payload sendo enviado é:

```json
{
  "cpf": "11839893427",
  "id_cotacao": "019bacb7-d860-76f6-b432-abbdfc07c75e",
  "matricula": "5",
  "codigo_inscricao_empregador": 1,
  "numero_inscricao_empregador": "38052900000000",
  "valor": 0,
  "numero_parcelas": 12
}
```

## 🔗 Referências

- Documentação: https://nossa-fintech-doc.spixiiservices.com.br/docs/intro
- Base URL: https://nossa-fintech-api.spixiiservices.com.br

## ✅ Status Atual

- ✅ Token de acesso: Funcionando
- ✅ Autenticação: Funcionando
- ✅ Consulta de margem: Funcionando
- ❌ Simulação CLT: Endpoint não encontrado (404)

**Ação necessária:** Confirmar endpoint correto com a documentação ou suporte da API.
