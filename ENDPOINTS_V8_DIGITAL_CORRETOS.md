# ✅ Endpoints V8 Digital - CORRETOS (Documentação Oficial)

## 📚 Fonte
Documentação oficial: https://docs.v8sistema.com/guide/credito-privato-clt

## 🔑 Endpoints Encontrados

### 1. **Criar Termo de Consentimento** ✅
- **Endpoint**: `POST https://bff.v8sistema.com/private-consignment/consult`
- **Método**: `POST`
- **Autenticação**: Bearer REDACTED (JWT)

**Body da Requisição**:
```json
{
  "borrowerDocumentNumber": "string",  // CPF do registro
  "gender": "male" | "female",         // Gênero
  "birthDate": "2025-08-14",           // Data de nascimento (YYYY-MM-DD)
  "signerName": "string",              // Nome do registro
  "signerEmail": "string",            // Email do registro
  "signerPhone": {
    "phoneNumber": "string",           // Número de telefone
    "countryCode": "string",           // Código do país
    "areaCode": "string"               // Código de área
  },
  "provider": "QI"                     // Provedor (deve ser "QI")
}
```

**Resposta de Sucesso (200)**:
```json
{
  "id": "string"  // Identificador único (consult_id) - usar nas próximas etapas
}
```

---

### 2. **Listar Termos de Consentimento** ✅
- **Endpoint**: `GET https://bff.v8sistema.com/private-consignment/consult`
- **Método**: `GET`
- **Autenticação**: Bearer REDACTED (JWT)

**Parâmetros de Query**:
- `startDate` (obrigatório): Data/hora inicial em ISO 8601. Ex: `2025-09-16T00:00:00Z`
- `endDate` (obrigatório): Data/hora final em ISO 8601. Ex: `2025-09-16T23:59:59Z`
- `limit` (obrigatório): Quantidade de registros por página (mínimo 1). Ex: `50`
- `page` (obrigatório): Número da página (base 1, mínimo 1). Ex: `1`
- `search` (opcional): Busca por nome ou CPF. Ex: `03898739007` ou `GABRIEL`
- `status` (opcional): Status da consulta. Valores: `WAITING_CONSENT`, `CONSENT_APPROVED`, `WAITING_CONSULT`, `WAITING_CREDIT_ANALYSIS`, `SUCCESS`, `FAILED`, `REJECTED`
- `provider` (obrigatório, padrão: QI): Provedor utilizado. Ex: `QI`

**Resposta de Sucesso (200)**:
```json
{
  "pages": {
    "current": 0,
    "hasNext": true,
    "hasPrev": true,
    "limit": 0,
    "total": 0,
    "totalPages": 0
  },
  "data": [
    {
      "id": "string",                    // UUID da consulta
      "partnerId": "string",              // ID do parceiro
      "documentNumber": "string",         // CPF consultado
      "availableMarginValue": "string",   // Margem disponível
      "status": "string",                 // Status da consulta
      "description": "string",            // Descrição/motivo
      "name": "string"                    // Nome do registro
    }
  ]
}
```

---

### 3. **Autorizar Termo de Consentimento** ✅
- **Endpoint**: `POST https://bff.v8sistema.com/private-consignment/consult/{consult_id}/authorize`
- **Método**: `POST`
- **Autenticação**: Bearer REDACTED (JWT)

**Parâmetros**:
- `consult_id` (path): ID retornado ao criar o termo de consentimento

**Resposta de Sucesso (200)**:
```
Successful response
```

---

## ⚠️ IMPORTANTE

### Endpoints INCORRETOS que estavam sendo usados:
- ❌ `/clt/consultar` → **NÃO EXISTE**
- ❌ `/private-consentimento-consult` → **NÃO EXISTE**
- ❌ `/clt/termo-consentimento` → **NÃO EXISTE**

### Endpoints CORRETOS:
- ✅ `/private-consignment/consult` (POST) → Criar termo de consentimento
- ✅ `/private-consignment/consult` (GET) → Listar termos
- ✅ `/private-consignment/consult/{consult_id}/authorize` (POST) → Autorizar termo

---

## 🔄 Fluxo Correto

1. **Criar Termo de Consentimento** → `POST /private-consignment/consult`
   - Recebe `id` (consult_id) na resposta
   
2. **Autorizar Termo** → `POST /private-consignment/consult/{consult_id}/authorize`
   - Usa o `consult_id` obtido no passo 1
   
3. **Usar consult_id na Simulação** → O `consult_id` deve ser usado na simulação

---

## 📝 Próximos Passos

1. ✅ Atualizar `lib/v8-digital-client.ts` com os endpoints corretos
2. ✅ Atualizar método `criarTermoConsentimentoCLT()` 
3. ✅ Criar método para autorizar termo
4. ✅ Atualizar método `consultarVinculosCLT()` (se necessário)
5. ✅ Testar todos os endpoints

---

**Data da descoberta**: 2025-01-17
**Fonte**: https://docs.v8sistema.com/guide/credito-privato-clt/termo-de-consentimento
