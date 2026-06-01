# ✅ Verificação Completa V8 Digital - Conforme Documentação Oficial

**Data**: 2025-01-17  
**Documentação**: https://docs.v8sistema.com/guide/credito-privato-clt  
**Status**: 🔄 Em verificação

---

## 📋 Checklist de Implementação

### 1. ✅ Autenticação OAuth 2.0
- [x] Endpoint: `POST https://auth.v8sistema.com/oauth/token`
- [x] Content-Type: `application/x-www-form-urlencoded`
- [x] Parâmetros obrigatórios:
  - [x] `grant_type`: `******`
  - [x] `username`: Email
  - [x] `******`: ******
  - [x] `client_id`: ID do registro
  - [x] `audience`: `https://bff.v8sistema.com` ⚠️ OBRIGATÓRIO
  - [x] `scope`: `offline_access`
- [x] Armazenamento de token com expiração
- [x] Renovação automática de token

**Arquivo**: `lib/v8-digital-client.ts` - Método `authenticate()`

---

### 2. ✅ Criar Termo de Consentimento
- [x] Endpoint: `POST /private-consignment/consult`
- [x] Body obrigatório:
  - [x] `borrowerDocumentNumber`: CPF (11 dígitos)
  - [x] `gender`: `"male"` ou `"female"`
  - [x] `birthDate`: Data no formato `YYYY-MM-DD`
  - [x] `signerName`: Nome completo
  - [x] `signerEmail`: Email válido
  - [x] `signerPhone`: Objeto com `phoneNumber`, `countryCode`, `areaCode`
  - [x] `provider`: `"QI"` (obrigatório)
- [x] Retorna `id` (consult_id) na resposta

**Arquivo**: `lib/v8-digital-client.ts` - Método `criarTermoConsentimentoCLT()`

---

### 3. ✅ Listar Termos de Consentimento (Consultar Vínculos)
- [x] Endpoint: `GET /private-consignment/consult`
- [x] Query parameters obrigatórios:
  - [x] `startDate`: Data inicial (ISO 8601)
  - [x] `endDate`: Data final (ISO 8601)
  - [x] `limit`: Quantidade por página (ex: 50)
  - [x] `page`: Número da página (base 1)
  - [x] `search`: CPF ou nome (opcional)
  - [x] `provider`: `"QI"` (obrigatório)
- [x] Retorna lista com:
  - [x] `id`: UUID da consulta
  - [x] `availableMarginValue`: Margem disponível ⭐
  - [x] `status`: Status da consulta
  - [x] `name`: Nome do registro
  - [x] `documentNumber`: CPF

**Arquivo**: `lib/v8-digital-client.ts` - Método `consultarVinculosCLT()`

---

### 4. ✅ Autorizar Termo de Consentimento
- [x] Endpoint: `POST /private-consignment/consult/{consult_id}/authorize`
- [x] Path parameter: `consult_id` (obtido ao criar termo)
- [x] Body: `{}` (vazio, mas necessário para Content-Type JSON)
- [x] Retorna sucesso quando autorizado

**Arquivo**: `lib/v8-digital-client.ts` - Método `autorizarTermoConsentimentoCLT()`

---

### 5. ✅ Consultar Taxas de Simulação
- [x] Endpoint: `GET /private-consignment/simulation/configs`
- [x] Retorna array de configurações com:
  - [x] `id`: ID da configuração (config_id) ⭐
  - [x] `slug`: Nome/descrição da taxa
  - [x] `monthly_interest_rate`: Taxa mensal (%)
  - [x] `number_of_installments`: Array de parcelas disponíveis ⭐
    - Exemplo: `[6, 8, 10, 12, 18, 24]`

**Arquivo**: `lib/v8-digital-client.ts` - Método `consultarTaxasSimulacaoCLT()`

---

### 6. ✅ Simular Crédito CLT
- [x] Endpoint: `POST /private-consignment/simulation`
- [x] Body obrigatório:
  - [x] `consult_id`: ID do termo autorizado ⭐
  - [x] `config_id`: ID da taxa selecionada ⭐
  - [x] `provider`: `"QI"` (obrigatório)
  - [x] `number_of_installments`: Número de parcelas (obrigatório, pode ser 0) ⭐
- [x] Body opcional:
  - [x] `disbursed_amount`: Valor líquido desejado
  - [x] `installment_face_value`: Valor da parcela desejado
- [x] Regra: Se `disbursed_amount` não for enviado, `installment_face_value` é obrigatório
- [x] Retorna:
  - [x] `number_of_installments`: Parcelas confirmadas
  - [x] `installment_value`: Valor da parcela calculado
  - [x] `disbursed_amount`: Valor líquido liberado
  - [x] Outros dados da simulação

**Arquivo**: `lib/v8-digital-client.ts` - Método `simularCreditoCLT()`

---

## 🎯 Fluxo Completo Conforme Documentação

### Passo 1: Criar Termo de Consentimento
```
POST /private-consignment/consult
→ Retorna: { id: "consult_id" }
```

### Passo 2: Autorizar Termo
```
POST /private-consignment/consult/{consult_id}/authorize
→ Status: 200 OK
```

### Passo 3: Consultar Taxas Disponíveis
```
GET /private-consignment/simulation/configs
→ Retorna: [{ id: "config_id", number_of_installments: [6,8,10,12,18,24], ... }]
```

### Passo 4: Simular
```
POST /private-consignment/simulation
Body: {
  consult_id: "consult_id",
  config_id: "config_id",
  provider: "QI",
  number_of_installments: 12,  // Uma das opções disponíveis
  installment_face_value: 500  // OU disbursed_amount: 5000
}
→ Retorna: Dados da simulação
```

---

## 🔍 Verificações Necessárias

### Interface (components/clt-simular.tsx)
- [ ] Exibir margem disponível do termo (`availableMarginValue`)
- [ ] Exibir parcelas disponíveis da taxa selecionada (`number_of_installments`)
- [ ] Permitir seleção de parcela baseada nas opções disponíveis
- [ ] Validar que parcela selecionada está na lista disponível
- [ ] Verificar status do termo antes de simular (deve ser "authorized")
- [ ] Exibir botão "Autorizar Termo" se status não for "authorized"

### registro V8 Digital (lib/v8-digital-client.ts)
- [x] Todos os endpoints corretos
- [x] Payloads corretos
- [x] Validações implementadas
- [x] Tratamento de erros

### Rotas API (app/api/produto/v8/*)
- [x] `/auth` - Autenticação
- [x] `/termo-consentimento` - Criar termo
- [x] `/autorizar-termo` - Autorizar termo
- [x] `/taxas-simulacao` - Consultar taxas
- [ ] Verificar se todas as rotas estão funcionando

---

## ⚠️ Problemas Conhecidos

1. **Margem não aparece na interface**
   - Verificar se `availableMarginValue` está sendo retornado
   - Verificar se está sendo carregado do termo de consentimento
   - Adicionar logs para depuração

2. **Parcelas não aparecem como select**
   - ✅ Implementado: Campo de parcelas vira select quando há opções disponíveis
   - Verificar se está funcionando corretamente

3. **Termo precisa ser autorizado antes de simular**
   - ✅ Implementado: Verificação de status antes de simular
   - ✅ Implementado: Botão para autorizar termo
   - Verificar se está funcionando corretamente

---

## 📝 Próximos Passos

1. Testar fluxo completo:
   - [ ] Criar termo de consentimento
   - [ ] Autorizar termo
   - [ ] Consultar taxas
   - [ ] Selecionar taxa e parcela
   - [ ] Simular crédito

2. Verificar exibição de dados:
   - [ ] Margem disponível aparece
   - [ ] Parcelas aparecem como select
   - [ ] Status do termo aparece

3. Corrigir problemas encontrados

---

**Última atualização**: 2025-01-17
