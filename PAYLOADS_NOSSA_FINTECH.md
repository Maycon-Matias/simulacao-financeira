# 📦 Payloads da API Nossa Fintech

Este documento descreve todos os payloads (corpos de requisição) utilizados na API da Nossa Fintech.

**Base URL:** `https://nossa-fintech-api.spixiiservices.com.br`  
**Documentação:** https://nossa-fintech-doc.spixiiservices.com.br/docs/intro

## 🔑 Credenciais Configuradas

- **CPF/Username:** `10143545108`
- **Promot ID:** `1` (001)
- ********:** Configurado nas variáveis de ambiente

**Variável de Ambiente:**
```env
NOSSA_FINTECH_API_PROMOT_ID=1
```

---

## 🔐 1. Autenticação (Login)

### Endpoint
```
POST /auth/login
```

### Payload
```json
{
  "cpf": "10143545108",
  "promot_id": 1,
  "******": "Pora@2025"
}
```

### Campos
- `cpf` (string, obrigatório): CPF do usuário
- `promot_id` (number, obrigatório): ID do promotor
- `******` (string, obrigatório): ****** do usuário

### Resposta
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_in": 3600
}
```

**Todas as requisições subsequentes precisam do header:**
```
Authorization: Bearer <access_token>
```

---

## 📋 2. Criar Autorização CLT

### Endpoint
```
POST /clt-loan/v1/request-authorization
```

### Payload
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

### Campos
- `document_number` (string, obrigatório): CPF do registro (11 dígitos, sem formatação)
- `person_name` (string, obrigatório): Nome completo do registro
- `country_code` (string, obrigatório): Código do país (ex: "55" para Brasil)
- `area_code` (string, obrigatório): DDD do telefone (ex: "73")
- `phone_number` (string, obrigatório): Número do telefone sem DDD (ex: "999999999")
- `notification_method` (string, obrigatório): Método de notificação (ex: "sms")
- `service_type` (string, obrigatório): Código da bancarizadora (ex: "QITECH")

### Exemplo de Requisição via API Route
```json
POST /api/produto/clt/autorizar-clt
{
  "cpf": "12345678900",
  "nomeCompleto": "João da Silva",
  "telefone": "73999999999",
  "serviceType": "QITECH",
  "apiId": "nossa-fintech-1"
}
```

---

## ✅ 3. Verificar Status da Autorização CLT

### Endpoint
```
POST /clt-loan/v1/check-authorization
```

### Payload
```json
{
  "document_number": "12345678900",
  "service_type": "QITECH"
}
```

### Campos
- `document_number` (string, obrigatório): CPF do registro (11 dígitos, sem formatação)
- `service_type` (string, obrigatório): Código da bancarizadora (ex: "QITECH")

### Resposta Esperada
```json
{
  "status": "AUTHORIZED" | "PENDING" | "NOT_AUTHORIZED"
}
```

### Exemplo de Requisição via API Route
```json
POST /api/produto/verificar-status-clt
{
  "cpf": "12345678900",
  "serviceType": "QITECH",
  "apiId": "nossa-fintech-1"
}
```

---

## 💰 4. Consultar Margem/Vínculos CLT

### Endpoint
```
POST /clt-loan/v1/get-margin
```

### Payload
```json
{
  "document_number": "12345678900",
  "employer_document": "12345678000190",
  "service_type": "QITECH"
}
```

### Campos
- `document_number` (string, obrigatório): CPF do trabalhador (11 dígitos, sem formatação)
- `employer_document` (string, obrigatório): CNPJ do empregador (14 dígitos, sem formatação)
- `service_type` (string, obrigatório): Código da bancarizadora (ex: "QITECH")

### Exemplo de Requisição via API Route
```json
POST /api/produto/consultar-clt
{
  "cpfTrabalhador": "12345678900",
  "cnpjEmpregador": "12345678000190",
  "serviceType": "QITECH",
  "apiId": "nossa-fintech-1",
  "credentials": {
    "username": "10143545108",
    "******": "sua-******",
    "promotId": 1,
    "baseUrl": "https://nossa-fintech-api.spixiiservices.com.br"
  }
}
```

**Nota:** O campo `credentials` é opcional e permite sobrescrever as credenciais da configuração.

---

## 🧮 5. Simular Proposta CLT

### Endpoint
```
POST /clt-loan/v1/simulate-loan
```

**Documentação:** https://nossa-fintech-doc.spixiiservices.com.br/docs/nossa-fintech-clt/simulacao/simulacao-clt

### Payload
```json
{
  "margin_key": "5ce86e4d-2902-4a19-9859-73eb6c93cb33",
  "simulation_type": "Payment",
  "employer_document": "98179558000180",
  "requested_amount": 10200,
  "service_type": "QITECH",
  "cod_tabela": "300003"
}
```

### Campos
- `margin_key` (string, obrigatório): Chave obtida da consulta de margem (`POST /clt-loan/v1/get-margin`)
- `simulation_type` (string, obrigatório): Tipo de simulação - `"Payment"` (valor da parcela) ou `"Liquid"` (valor liberado)
- `employer_document` (string, obrigatório): CNPJ do empregador (14 dígitos, sem formatação)
- `requested_amount` (number, obrigatório): Valor da parcela (se `Payment`) ou valor liberado (se `Liquid`)
- `service_type` (string, obrigatório): Código da bancarizadora (ex: "QITECH")
- `cod_tabela` (string, obrigatório): Código da tabela obtido da listagem de tabelas (`GET /clt-loan/v1/list-rebates`)

### Exemplo de Requisição via API Route
```json
POST /api/produto/clt/simular
{
  "marginKey": "5ce86e4d-2902-4a19-9859-73eb6c93cb33",
  "simulationType": "Payment",
  "employerDocument": "98179558000180",
  "requestedAmount": 10200,
  "serviceType": "QITECH",
  "codTabela": "300003",
  "apiId": "nossa-fintech-1"
}
```

**⚠️ IMPORTANTE:** 
- O `margin_key` deve ser obtido da consulta de margem antes de simular
- O `cod_tabela` deve ser obtido da listagem de tabelas antes de simular
- O `simulation_type` deve ser escolhido pelo usuário no formulário

### Fluxo Completo

1. **Consultar Margem** → Obter `margin_key`
   ```
   POST /clt-loan/v1/get-margin
   Resposta: { "data": { "margin_key": "..." } }
   ```

2. **Listar Tabelas** → Obter `cod_tabela`
   ```
   GET /clt-loan/v1/list-rebates
   Resposta: { "data": [{ "cod_tabela": "300003", ... }] }
   ```

3. **Simular** → Usar `margin_key` e `cod_tabela` obtidos
   ```
   POST /clt-loan/v1/simulate-loan
   ```

---

## 📋 6. Listar Tabelas CLT

### Endpoint
```
GET /clt-loan/v1/list-rebates
```

**Documentação:** https://nossa-fintech-doc.spixiiservices.com.br/docs/nossa-fintech-clt/simulacao/listar-tabelas-clt

### Headers
```
Authorization: Bearer <access_token>
```

### Resposta
```json
{
  "success": true,
  "message": "Rebates listados com sucesso.",
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

### Exemplo de Requisição via API Route
```json
GET /api/produto/clt/listar-tabelas?apiId=nossa-fintech-1
```

**Nota:** O `cod_tabela` retornado deve ser usado no campo `cod_tabela` da simulação.

---

## 📊 7. Consultar Saldo FGTS

### Endpoint
```
GET /fgts/saldo?cpf=12345678900
```

### Parâmetros (Query String)
- `cpf` (string, obrigatório): CPF do registro (11 dígitos, sem formatação)

### Exemplo
```
GET /fgts/saldo?cpf=12345678900
```

---

## 🔄 Resumo dos Endpoints e Payloads

| Endpoint | Método | Payload Principal | Campos Obrigatórios |
|----------|--------|-------------------|-------------------|
| `/auth/login` | POST | `cpf`, `promot_id`, `******` | Todos |
| `/clt-loan/v1/request-authorization` | POST | `document_number`, `person_name`, `country_code`, `area_code`, `phone_number`, `notification_method`, `service_type` | Todos |
| `/clt-loan/v1/check-authorization` | POST | `document_number`, `service_type` | Todos |
| `/clt-loan/v1/get-margin` | POST | `document_number`, `employer_document`, `service_type` | Todos |
| `/clt-loan/v1/list-rebates` | GET | Nenhum (retorna todas as tabelas) | Nenhum |
| `/clt-loan/v1/simulate-loan` | POST | `margin_key`, `simulation_type`, `employer_document`, `requested_amount`, `service_type`, `cod_tabela` | Todos |
| `/fgts/saldo` | GET | Query: `cpf` | CPF |

---

## 📝 Observações Importantes

1. **Formatação de CPF/CNPJ**: Todos os CPFs e CNPJs devem ser enviados sem formatação (apenas números)
   - CPF: 11 dígitos (ex: `12345678900`)
   - CNPJ: 14 dígitos (ex: `12345678000190`)

2. **Service Type**: O código `service_type` é obrigatório para operações CLT e representa a bancarizadora. Exemplo comum: `"QITECH"`

3. **Promot ID**: O `promot_id` é obrigatório para autenticação e deve ser configurado nas variáveis de ambiente ou credenciais da API. **Valor configurado: `1` (001)**

4. **Timeout**: Simulações CLT podem demorar até 2 minutos (120 segundos)

5. **Autenticação**: Todas as requisições (exceto login) precisam do header `Authorization: Bearer <token>`

6. **Telefone**: Para autorização CLT, o telefone é processado automaticamente:
   - Se tiver 10 ou 11 dígitos, os 2 primeiros são considerados DDD
   - Se tiver 8 ou 9 dígitos, usa DDD padrão (99)

---

## 🔗 Rotas da API Next.js

As rotas da API Next.js que utilizam esses payloads:

- `POST /api/produto/clt/autorizar-clt` - Cria autorização CLT
- `POST /api/produto/verificar-status-clt` - Verifica status da autorização
- `POST /api/produto/consultar-clt` - Consulta margem/vínculos CLT
- `POST /api/produto/clt/simular` - Simula proposta CLT
