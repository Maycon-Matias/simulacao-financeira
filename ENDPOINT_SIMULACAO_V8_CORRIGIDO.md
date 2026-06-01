# ✅ Endpoint de Simulação V8 Digital - CORRIGIDO

## 📚 Fonte
Documentação oficial: https://docs.v8sistema.com/guide/credito-privato-clt/simula%C3%A7%C3%A3o-cr%C3%A9dito-clt

## 🔑 Endpoints Corretos

### 1. **Consultar Taxas Disponíveis** ✅
- **Endpoint**: `GET https://bff.v8sistema.com/private-consignment/simulation/configs`
- **Método**: `GET`
- **Autenticação**: Bearer REDACTED (JWT)

**Resposta de Sucesso (200)**:
```json
{
  "configs": [
    {
      "id": "string",                    // UUID - usar como config_id na simulação
      "slug": "string",                  // Nome da tabela
      "monthly_interest_rate": "string", // Taxa mensal
      "limit_days_to_disburse": 0,
      "number_of_installments": ["string"], // Array de parcelas disponíveis
      "created_at": "string",
      "updated_at": "string"
    }
  ]
}
```

---

### 2. **Criar Simulação** ✅
- **Endpoint**: `POST https://bff.v8sistema.com/private-consignment/simulation`
- **Método**: `POST`
- **Autenticação**: Bearer REDACTED (JWT)

**Body da Requisição**:
```json
{
  "consult_id": "string",              // ID do termo de consentimento (obrigatório)
  "config_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6", // ID da tabela de taxas (obrigatório)
  "installment_face_value": 0,         // Valor da parcela desejada (opcional)
  "disbursed_amount": 0,               // Valor desejado para desembolso (opcional)
  "number_of_installments": 0,         // Quantidade de parcelas (opcional)
  "provider": "QI"                     // Obrigatório, deve ser "QI"
}
```

**Resposta de Sucesso (200)**:
```json
{
  "id_simulation": "string",
  "partner_id": "string",
  "number_of_installments": 0,
  "monthly_interest_rate": 0,
  "disbursement_amount": 0,
  "installment_value": 0,
  "operation_amount": 0,
  "issue_amount": 0,
  "disbursed_issue_amount": 0,
  "disbursement_option": {
    "iof_amount": 0,
    "total_pre_fixed_amount": 0,
    "cet": 0,
    "contract_fee_amount": 0,
    "disbursement_date": "string",
    "first_due_date": "string",
    "issue_amount": 0,
    "disbursed_issue_amount": 0,
    "assignment_amount": 0,
    "final_disbursement_amount": 0,
    "installments": [...]
  }
}
```

---

## ⚠️ IMPORTANTE

### Endpoint INCORRETO que estava sendo usado:
- ❌ `/clt/simular` → **NÃO EXISTE**

### Endpoints CORRETOS:
- ✅ `/private-consignment/simulation/configs` (GET) → Consultar taxas
- ✅ `/private-consignment/simulation` (POST) → Criar simulação

---

## 🔄 Fluxo Correto

1. **Criar Termo de Consentimento** → `POST /private-consignment/consult`
   - Recebe `id` (consult_id) na resposta
   
2. **Consultar Taxas Disponíveis** → `GET /private-consignment/simulation/configs`
   - Recebe array de `configs` com `id` (config_id)
   - Seleciona uma taxa (config_id)
   
3. **Criar Simulação** → `POST /private-consignment/simulation`
   - Usa `consult_id` do passo 1
   - Usa `config_id` do passo 2
   - Informa valor e parcelas (opcionais)

---

## 📝 Arquivos Atualizados

1. ✅ `lib/v8-digital-client.ts`
   - Método `consultarTaxasSimulacaoCLT()` criado
   - Método `simularCreditoCLT()` atualizado com endpoint correto

2. ✅ `app/api/produto/clt/simular/route.ts`
   - Atualizado para aceitar `consultId` e `configId` para V8 Digital

3. ✅ `app/api/produto/v8/taxas-simulacao/route.ts`
   - Nova rota para consultar taxas disponíveis

---

## 🎯 Próximos Passos

1. Atualizar componente de simulação para:
   - Consultar taxas disponíveis primeiro
   - Permitir seleção de uma taxa
   - Usar consultId do termo de consentimento
   - Chamar simulação com parâmetros corretos

2. Testar fluxo completo:
   - Termo de consentimento → consult_id
   - Consultar taxas → config_id
   - Simular → resultado completo

---

**Data da correção**: 2025-01-17
**Fonte**: https://docs.v8sistema.com/guide/credito-privato-clt/simula%C3%A7%C3%A3o-cr%C3%A9dito-clt
