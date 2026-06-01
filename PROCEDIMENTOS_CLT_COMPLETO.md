# 📋 Procedimentos CLT Completos por Banco

Este documento organiza todos os procedimentos CLT disponíveis para cada banco (Nossa Fintech e V8 Digital).

**Status**: ✅ Sistema atualizado e organizado
**Última atualização**: 2025-01-18

---

## 🏦 Nossa Fintech

### 1. **Autorização CLT** ✅
**Método**: `autorizarCLT(cpf, nomeCompleto, telefone, serviceType)`

**Endpoint**: `POST /clt-loan/v1/request-authorization`

**Campos Obrigatórios**:
- `cpf`: CPF do registro (11 dígitos)
- `nomeCompleto`: Nome completo do registro
- `telefone`: Telefone/Celular (formato: (99)99999-9999 ou 99999999999)
- `serviceType`: Código da bancarizadora (ex: "QITECH")

**Payload**:
```json
{
  "document_number": "12345678900",
  "person_name": "João da Silva",
  "country_code": "55",
  "area_code": "73",
  "phone_number": "999999999",
  "notification_method": "sms",
  "service_type": "QITECH"
}
```

**Retorno**: Status da autorização

---

### 2. **Verificar Status da Autorização** ✅
**Método**: `verificarStatusAutorizacao(cpf, serviceType)`

**Endpoint**: `POST /clt-loan/v1/check-authorization`

**Campos Obrigatórios**:
- `cpf`: CPF do registro
- `serviceType`: Código da bancarizadora

**Payload**:
```json
{
  "document_number": "12345678900",
  "service_type": "QITECH"
}
```

**Retorno**: `"AUTHORIZED"`, `"PENDING"` ou `"NOT_AUTHORIZED"`

---

### 3. **Consultar Vínculos/Margem CLT** ✅
**Método**: `consultarVinculosCLT(cpfTrabalhador, cnpjEmpregador, serviceType, telefone?)`

**Endpoint**: `POST /clt-loan/v1/get-margin`

**Campos Obrigatórios**:
- `cpf`: CPF do trabalhador
- `cnpjEmpregador`: CNPJ da organizacao (14 dígitos)
- `serviceType`: Código da bancarizadora (ex: "QITECH")

**Payload**:
```json
{
  "document_number": "12345678900",
  "employer_document": "12345678000190",
  "service_type": "QITECH"
}
```

**Retorno**: Dados do vínculo incluindo `margin_key` (necessário para simulação)

---

### 4. **Listar Tabelas de Rebates** ✅
**Método**: `listarTabelasCLT()`

**Endpoint**: `GET /clt-loan/v1/list-rebates`

**Campos**: Nenhum

**Retorno**: Lista de tabelas disponíveis com `cod_tabela` (necessário para simulação)

---

### 5. **Simular CLT** ✅
**Método**: `simularCLT(params)`

**Endpoint**: `POST /clt-loan/v1/simulate-loan`

**Campos Obrigatórios**:
- `marginKey`: Obtido da consulta de margem (campo `margin_key`)
- `simulationType`: `"Payment"` (valor da parcela) ou `"Liquid"` (valor liberado)
- `employerDocument`: CNPJ do empregador
- `requestedAmount`: Valor da parcela ou valor liberado
- `serviceType`: Código da bancarizadora
- `codTabela`: Código da tabela obtido da listagem de tabelas

**Payload**:
```json
{
  "margin_key": "abc123...",
  "simulation_type": "Payment",
  "employer_document": "12345678000190",
  "requested_amount": 1000.00,
  "service_type": "QITECH",
  "cod_tabela": "TAB001"
}
```

**Retorno**: Opções de simulação disponíveis

---

### 📝 Fluxo Completo Nossa Fintech

1. **Autorizar** → `autorizarCLT()` → Aguardar autorização
2. **Verificar Status** → `verificarStatusAutorizacao()` → Confirmar "AUTHORIZED"
3. **Consultar Margem** → `consultarVinculosCLT()` → Obter `margin_key`
4. **Listar Tabelas** → `listarTabelasCLT()` → Obter `cod_tabela`
5. **Simular** → `simularCLT()` → Escolher melhor opção
6. **Enviar Proposta** → (Implementar se necessário)

---

## 🏦 V8 Digital

### 1. **Consultar Vínculos CLT** ✅
**Método**: `consultarVinculosCLT(cpf)`

**Endpoint**: `POST /clt/consultar`

**Campos Obrigatórios**:
- `cpf`: CPF do trabalhador (11 dígitos)

**Payload**:
```json
{
  "cpf": "12345678900"
}
```

**Nota**: Se este endpoint não funcionar, verificar documentação: https://docs.v8sistema.com

---

### 2. **Criar Termo de Consentimento** ✅
**Método**: `criarTermoConsentimentoCLT(params)`

**Endpoint**: `POST /clt/termo-consentimento` ⚠️ **VERIFICAR DOCUMENTAÇÃO**

**Campos Obrigatórios**:
- `cpf`: CPF do registro

**Campos Opcionais**:
- `nome`: Nome completo
- `telefone`: Telefone/Celular
- `email`: Email

**Payload**:
```json
{
  "cpf": "12345678900",
  "nome": "João da Silva",
  "telefone": "73999999999",
  "email": "joao@email.com"
}
```

---

### 3. **Simular Crédito CLT** ✅
**Método**: `simularCreditoCLT(params)`

**Endpoint**: `POST /clt/simular` ⚠️ **VERIFICAR DOCUMENTAÇÃO**

**Campos Obrigatórios**:
- `cpf`: CPF do registro

**Campos Opcionais**:
- `valorSolicitado`: Valor solicitado (deixe 0 para usar máximo)
- `numeroParcelas`: Número de parcelas (deixe 0 para usar máximo)

**Payload**:
```json
{
  "cpf": "12345678900",
  "valorSolicitado": 1000.00,
  "numeroParcelas": 12
}
```

---

### 4. **Criar Proposta CLT** ✅
**Método**: `criarPropostaCLT(params)`

**Endpoint**: `POST /clt/proposta` ⚠️ **VERIFICAR DOCUMENTAÇÃO**

**Campos Obrigatórios**:
- `cpf`: CPF do registro
- `valorSolicitado`: Valor solicitado (deve ser > 0)
- `numeroParcelas`: Número de parcelas

**Payload**:
```json
{
  "cpf": "12345678900",
  "valorSolicitado": 1000.00,
  "numeroParcelas": 12
}
```

---

### 5. **Listar Operações CLT** ✅
**Método**: `listarOperacoesCLT(cpf?)`

**Endpoint**: `GET /clt/operacoes` ⚠️ **VERIFICAR DOCUMENTAÇÃO**

**Campos Opcionais**:
- `cpf`: CPF do registro (filtro opcional)

**Query String**: `?cpf=12345678900` (se fornecido)

---

### 📝 Fluxo Completo V8 Digital

1. **Consultar Vínculos** → `consultarVinculosCLT()` → Verificar elegibilidade
2. **Criar Termo de Consentimento** → `criarTermoConsentimentoCLT()` → Obter autorização
3. **Simular** → `simularCreditoCLT()` → Escolher melhor opção
4. **Criar Proposta** → `criarPropostaCLT()` → Enviar para aprovação
5. **Listar Operações** → `listarOperacoesCLT()` → Acompanhar status

---

## ⚠️ IMPORTANTE - Endpoints V8 Digital

**ATENÇÃO**: Os endpoints da V8 Digital podem estar incorretos. É necessário verificar na documentação oficial:

- **Documentação**: https://docs.v8sistema.com
- **Verificar**: Todos os endpoints `/clt/*` e `/private-consentimento-*`

### Endpoints Atuais (Pode Estar Incorreto):
- ❓ `/private-consentimento-consult` - Consulta vínculos
- ❓ `/clt/termo-consentimento` - Termo de consentimento
- ❓ `/clt/simular` - Simulação
- ❓ `/clt/proposta` - Criar proposta
- ❓ `/clt/operacoes` - Listar operações

---

## 🔄 Integração com Esteira de Processo

### Nossa Fintech
1. ✅ Consulta → `consultarVinculosCLT()` com CNPJ e serviceType
2. ✅ Autorização → `autorizarCLT()` → Verificar status
3. ✅ Simulação → `simularCLT()` com marginKey e codTabela
4. ⚠️ Enviar Proposta → (Implementar se necessário)

### V8 Digital
1. ⚠️ Consulta → `consultarVinculosCLT()` (endpoint pode estar incorreto)
2. ✅ Termo → `criarTermoConsentimentoCLT()`
3. ✅ Simulação → `simularCreditoCLT()`
4. ✅ Proposta → `criarPropostaCLT()`

---

## 📝 Notas de Implementação

### Nossa Fintech
- ✅ Todos os métodos implementados
- ✅ Endpoints corretos conforme documentação oficial
- ✅ Validações completas
- ✅ Fluxo completo funcional
- ⚠️ Enviar proposta precisa ser implementado (se necessário na API)

**Documentação**: https://nossa-fintech-doc.spixiiservices.com.br/docs/intro

### V8 Digital
- ⚠️ **Endpoints precisam ser verificados na documentação oficial**
- ⚠️ Consulta de vínculos: endpoint `/private-consentimento-consult` pode estar incorreto
- ✅ Estrutura dos métodos está correta
- ✅ Autenticação funcionando (OAuth 2.0)
- ✅ Token obtido com sucesso

**Documentação**: https://docs.v8sistema.com

### Rotas da API Atualizadas

#### Consulta CLT
- **Rota**: `POST /api/produto/consultar-clt`
- **Suporta**: Nossa Fintech, V8 Digital
- **Campos Nossa Fintech**: `cpf`, `cnpjEmpregador`, `serviceType` (obrigatórios)
- **Campos V8 Digital**: `cpf` (obrigatório)

#### Simulação CLT
- **Rota**: `POST /api/produto/clt/simular`
- **Suporta**: Nossa Fintech, V8 Digital
- **Campos Nossa Fintech**: `cpf`, `marginKey`, `simulationType`, `employerDocument`, `requestedAmount`, `serviceType`, `codTabela` (todos obrigatórios)
- **Campos V8 Digital**: `cpf` (obrigatório), `valorSolicitado`, `numeroParcelas` (opcionais)

#### Enviar Proposta CLT
- **Rota**: `POST /api/produto/clt/enviar-proposta`
- **Suporta**: V8 Digital
- **Campos V8 Digital**: `cpf`, `valorSolicitado`, `numeroParcelas` (todos obrigatórios)
- **Nossa Fintech**: Não implementado (retorna 501)

---

## 🛠️ Próximos Passos

1. **Verificar Documentação V8 Digital**: https://docs.v8sistema.com
2. **Corrigir Endpoints V8 Digital**: Atualizar em `lib/v8-digital-client.ts`
3. **Testar Todos os Fluxos**: Garantir que cada banco funciona end-to-end
4. **Implementar Enviar Proposta Nossa Fintech**: Se necessário
