# 📊 Análise - Dados Necessários para Simulação CLT

## ✅ Endpoint Correto Encontrado

**Endpoint:** `POST /clt-loan/v1/simulate-loan`

## 📋 Payload Correto (Conforme Documentação)

```json
{
  "margin_key": "string",
  "simulation_type": "Payment",
  "employer_document": "98179558000180",
  "requested_amount": 102,
  "service_type": "QITECH",
  "cod_tabela": "300003"
}
```

### Campos Obrigatórios:

1. **`margin_key`** (string, obrigatório)
   - ✅ **Obtido de:** Resposta da consulta de margem (`/clt-loan/v1/get-margin`)
   - ❌ **Temos no sistema?** NÃO - Precisamos obter da consulta de margem

2. **`simulation_type`** (string, obrigatório)
   - Valores possíveis: `"Payment"` ou `"Liquid"`
   - `"Payment"`: Simulação baseada no Valor da Parcela
   - `"Liquid"`: Simulação baseada no Valor Liberado
   - ❌ **Temos no sistema?** NÃO - Precisamos adicionar

3. **`employer_document`** (string, obrigatório)
   - CNPJ do empregador (somente números, 14 dígitos)
   - ✅ **Temos no sistema?** SIM - `numeroInscricaoEmpregador`

4. **`requested_amount`** (number, obrigatório)
   - Valor da parcela (se `simulation_type: "Payment"`) ou valor liberado (se `simulation_type: "Liquid"`)
   - ✅ **Temos no sistema?** SIM - `valor` ou `numeroParcelas`

5. **`service_type`** (string, obrigatório)
   - Código da bancarizadora (ex: "QITECH")
   - ✅ **Temos no sistema?** SIM - Já usado na consulta

6. **`cod_tabela`** (string, obrigatório)
   - Código da tabela obtido da listagem de tabelas (`/clt-loan/v1/list-rebates`)
   - ❌ **Temos no sistema?** NÃO - Precisamos listar tabelas primeiro

## 🔍 Dados que Estamos Enviando (INCORRETOS)

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

## ❌ Problemas Identificados

1. **Endpoint errado:** Estamos usando `/clt/simular` mas deveria ser `/clt-loan/v1/simulate-loan`
2. **Falta `margin_key`:** Não temos esse dado - precisa vir da consulta de margem
3. **Falta `simulation_type`:** Não estamos enviando esse campo
4. **Falta `cod_tabela`:** Não temos código da tabela - precisa listar tabelas primeiro
5. **Campos desnecessários:** `cpf`, `id_cotacao`, `matricula`, `codigo_inscricao_empregador` não são necessários
6. **Formato diferente:** A API espera `employer_document` e `requested_amount`, não `numero_inscricao_empregador` e `valor`

## ✅ Dados que TEMOS Disponíveis

### Da Consulta de Margem (`/clt-loan/v1/get-margin`):
- ✅ `margin_key` - **PRECISA SER ARMAZENADO**
- ✅ `employer_document` (CNPJ)
- ✅ `service_type`
- ✅ Dados do trabalhador

### Do Sistema Atual:
- ✅ CPF do registro
- ✅ CNPJ do empregador (`numeroInscricaoEmpregador`)
- ✅ Valor solicitado (`valor`)
- ✅ Número de parcelas (`numeroParcelas`)
- ✅ Service Type (`serviceType`)

## ❌ Dados que NÃO TEMOS

1. **`margin_key`** - Precisa ser obtido e armazenado após consulta de margem
2. **`cod_tabela`** - Precisa listar tabelas primeiro (`GET /clt-loan/v1/list-rebates`)
3. **`simulation_type`** - Precisa ser adicionado ao formulário (Payment ou Liquid)

## 🔧 Solução Necessária

### 1. Armazenar `margin_key` após consulta de margem
- Quando consultar margem, salvar o `margin_key` retornado
- Usar esse `margin_key` na simulação

### 2. Listar tabelas antes de simular
- Chamar `GET /clt-loan/v1/list-rebates` para obter tabelas disponíveis
- Permitir seleção da tabela ou usar uma padrão

### 3. Adicionar `simulation_type` ao formulário
- Permitir escolher entre "Payment" (valor da parcela) ou "Liquid" (valor liberado)

### 4. Atualizar payload da simulação
- Usar o formato correto conforme documentação
- Remover campos desnecessários

## 📝 Próximos Passos

1. ✅ Atualizar endpoint para `/clt-loan/v1/simulate-loan`
2. ⏳ Modificar consulta de margem para armazenar `margin_key`
3. ⏳ Adicionar endpoint para listar tabelas
4. ⏳ Adicionar campo `simulation_type` ao formulário
5. ⏳ Atualizar payload da simulação
