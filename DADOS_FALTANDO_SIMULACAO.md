# ⚠️ Dados Faltando para Simulação CLT - Nossa Fintech

## ✅ O que JÁ TEMOS no Sistema

1. ✅ **`employer_document`** (CNPJ do empregador)
   - Campo: `numeroInscricaoEmpregador`
   - Status: Disponível

2. ✅ **`requested_amount`** (Valor solicitado)
   - Campo: `valor` ou `numeroParcelas`
   - Status: Disponível

3. ✅ **`service_type`** (Código da bancarizadora)
   - Campo: `serviceType`
   - Status: Disponível

## ❌ O que FALTA no Sistema

### 1. `margin_key` (obrigatório)

**Status:** ❌ **NÃO TEMOS**

**Fonte:** 
- Resposta da consulta de margem (`POST /clt-loan/v1/get-margin`)
- Campo retornado: `data.margin_key`

**Exemplo de resposta da consulta de margem:**
```json
{
  "success": true,
  "data": {
    "margin_key": "5ce86e4d-2902-4a19-9859-73eb6c93cb33",
    "document": "44961167827",
    "employer": {
      "document": "98179558000180"
    },
    ...
  }
}
```

**Ação Necessária:**
- Modificar a consulta de margem para armazenar o `margin_key` retornado
- Usar esse `margin_key` na simulação

### 2. `simulation_type` (obrigatório)

**Status:** ❌ **NÃO TEMOS**

**Valores Possíveis:**
- `"Payment"`: Simulação baseada no Valor da Parcela
- `"Liquid"`: Simulação baseada no Valor Liberado

**Ação Necessária:**
- Adicionar campo no formulário de simulação
- Permitir escolha entre "Payment" e "Liquid"

### 3. `cod_tabela` (obrigatório)

**Status:** ❌ **NÃO TEMOS**

**Fonte:**
- Listagem de tabelas (`GET /clt-loan/v1/list-rebates`)
- Campo retornado: `data[].cod_tabela`

**Exemplo de resposta da listagem de tabelas:**
```json
{
  "success": true,
  "data": [
    {
      "cod_tabela": "300001",
      "number_of_installments": 12,
      "name": "Consignado CLT S/ Seguro",
      "complement": "0 a 200"
    },
    {
      "cod_tabela": "300002",
      "number_of_installments": 12,
      "name": "Consignado CLT S/ Seguro",
      "complement": "201 a 400"
    }
  ]
}
```

**Ação Necessária:**
- ✅ Endpoint criado: `/api/produto/clt/listar-tabelas`
- ⏳ Chamar esse endpoint antes de simular
- ⏳ Permitir seleção da tabela ou usar uma padrão

## 🔧 Correções Implementadas

### ✅ 1. Endpoint Correto
- Endpoint atualizado para: `/clt-loan/v1/simulate-loan`
- Código atualizado no `nossa-fintech-client.ts`

### ✅ 2. Payload Correto
- Payload atualizado conforme documentação oficial
- Validação de campos implementada

### ✅ 3. Método `listarTabelasCLT` Criado
- Método implementado no `nossa-fintech-client.ts`
- Endpoint `/api/produto/clt/listar-tabelas` criado

### ✅ 4. Validação de Campos
- Validação implementada na rota `/api/produto/clt/simular`
- Mensagens de erro informativas sobre campos faltando

## ⏳ O que Ainda Precisa Ser Feito

### 1. Armazenar `margin_key` após Consulta de Margem

**Local:** `components/produto-consultar-clt.tsx` ou `components/clt-consulta-lote.tsx`

**Ação:**
```typescript
// Após consultar margem, armazenar margin_key
if (response.data?.margin_key) {
  localStorage.setItem('clt_margin_key', response.data.margin_key)
  // Ou incluir no objeto de dados da simulação
}
```

### 2. Adicionar Campo `simulation_type` ao Formulário

**Local:** `components/clt-simular.tsx`

**Ação:**
```typescript
// Adicionar campo select ou radio
<select value={simulationType} onChange={...}>
  <option value="Payment">Valor da Parcela</option>
  <option value="Liquid">Valor Liberado</option>
</select>
```

### 3. Integrar Listagem de Tabelas

**Local:** `components/clt-simular.tsx`

**Ação:**
```typescript
// Carregar tabelas ao montar componente
useEffect(() => {
  fetch('/api/produto/clt/listar-tabelas?apiId=nossafintech-default')
    .then(res => res.json())
    .then(data => setTabelas(data.data))
}, [])
```

## 📋 Checklist de Implementação

- [x] Endpoint correto identificado e atualizado
- [x] Payload correto implementado
- [x] Método `listarTabelasCLT` criado
- [x] Endpoint `/api/produto/clt/listar-tabelas` criado
- [ ] Armazenar `margin_key` após consulta de margem
- [ ] Adicionar campo `simulation_type` ao formulário
- [ ] Integrar listagem de tabelas no formulário
- [ ] Atualizar formulário para usar novos campos

## 🎯 Resumo

**Temos 3 de 6 campos necessários:**
- ✅ `employer_document`
- ✅ `requested_amount`
- ✅ `service_type`

**Faltam 3 campos:**
- ❌ `margin_key` (precisa ser armazenado após consulta)
- ❌ `simulation_type` (precisa ser adicionado ao formulário)
- ❌ `cod_tabela` (precisa listar tabelas primeiro)

**Status:** Código atualizado, mas precisa de ajustes no frontend para coletar os dados faltantes.
