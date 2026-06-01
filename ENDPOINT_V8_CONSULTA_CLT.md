# ⚠️ Endpoint de Consulta CLT V8 Digital - Precisa Verificação

## Problema Atual

Os seguintes endpoints foram testados e **não existem** na API V8 Digital:

1. ❌ `/clt/consultar` → `Route POST:/clt/consultar not found`
2. ❌ `/private-consentimento-consult` → `Route POST:/private-consentimento-consult not found`

## Status da Autenticação

✅ **Autenticação funcionando perfeitamente!**
- Token obtido com sucesso
- Token válido por 24 horas
- Base URL correta: `https://bff.v8sistema.com`

## O Que Precisa Ser Feito

### 1. Verificar Documentação Oficial

Acesse a documentação oficial da V8 Digital:
- **URL**: https://docs.v8sistema.com
- **Seção**: Procure por "Crédito Privado CLT" ou "Consulta de Vínculos CLT"
- **Objetivo**: Encontrar o endpoint exato para consulta de vínculos CLT

### 2. Possíveis Endpoints (Para Testar)

Baseado em padrões comuns de APIs, os endpoints podem ser:

```
POST /api/clt/consultar
POST /api/clt/vinculos
POST /api/clt/consulta
POST /clt/vinculos
POST /clt/consulta
POST /private-consentimento/consultar
POST /private-consentimento/consulta
POST /consentimento/consultar
POST /consentimento/consulta
POST /api/private-consentimento/consultar
```

### 3. Como Testar Manualmente

Após obter o token de autenticação, teste o endpoint manualmente:

```bash
# 1. Obter token (já está funcionando)
# 2. Testar endpoint
curl -X POST https://bff.v8sistema.com/ENDPOINT_CORRETO_AQUI \
  -H "Authorization: Bearer REDACTED" \
  -H "Content-Type: application/json" \
  -d '{"cpf": "12345678900"}'
```

### 4. Contato com V8 Digital

Entre em contato com o suporte técnico da V8 Digital:

- **Email**: `ti@v8digital.online`
- **Informar**:
  - Você está tentando consultar vínculos CLT
  - A autenticação está funcionando (token obtido com sucesso)
  - Os endpoints `/clt/consultar` e `/private-consentimento-consult` não existem
  - **Perguntar**: Qual é o endpoint correto para consulta de vínculos CLT?

## Como Atualizar o Endpoint

Quando descobrir o endpoint correto, atualize em:

**Arquivo**: `lib/v8-digital-client.ts`
**Linha**: ~383 (método `consultarVinculosCLT`)

```typescript
// Trocar esta linha:
const endpoint = `/clt/consultar`

// Para o endpoint correto, por exemplo:
const endpoint = `/api/clt/consultar` // ou o que for correto
```

## Teste Rápido

Você pode testar diferentes endpoints editando temporariamente o arquivo `lib/v8-digital-client.ts` e testando na interface do sistema.

## Status Atual

- ✅ Autenticação: Funcionando
- ✅ Token: Obtido com sucesso
- ✅ Base URL: Correta
- ❌ Endpoint Consulta CLT: **Precisa verificação na documentação oficial**

---

**Última atualização**: 2025-01-17
**Próximo passo**: Verificar documentação oficial ou contatar V8 Digital
