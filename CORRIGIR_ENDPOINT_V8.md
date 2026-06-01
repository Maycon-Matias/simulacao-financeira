# 🔧 Correção: Endpoint V8 Digital para Consulta CLT

## Problema

O endpoint `/clt/consultar` não existe na API V8 Digital. O erro retornado é:
```
Route POST:/clt/consultar not found
```

## Solução

O endpoint correto precisa ser verificado na documentação oficial da V8 Digital: **https://docs.v8sistema.com**

### Possíveis Endpoints Corretos

Baseado em padrões comuns de APIs REST, os endpoints podem ser:

1. `/private-consentimento-consult` (mais provável)
2. `/private-consentimento/consult`
3. `/api/private-consentimento-consult`
4. `/private-consentimento-consultar`
5. `/consentimento/consultar`

### Como Verificar

1. Acesse a documentação: **https://docs.v8sistema.com**
2. Procure pela seção de "Crédito Privado CLT" ou "Private Consentimento"
3. Verifique o endpoint exato para consulta de vínculos CLT
4. Atualize o arquivo `lib/v8-digital-client.ts` na linha 378

### Código Atual

```typescript
// lib/v8-digital-client.ts linha ~378
const endpoint = `/private-consentimento-consult` // ⚠️ Verificar se está correto
```

### Teste Manual

Após descobrir o endpoint correto, teste manualmente:

```bash
curl -X POST https://bff.v8sistema.com/ENDPOINT_CORRETO_AQUI \
  -H "Authorization: Bearer REDACTED" \
  -H "Content-Type: application/json" \
  -d '{"cpf": "12345678900"}'
```

### Logs Adicionados

Foram adicionados logs para facilitar o debug:
- URL completa da requisição
- Método HTTP
- Endpoint usado

Verifique os logs no console para ver exatamente qual endpoint está sendo chamado.
